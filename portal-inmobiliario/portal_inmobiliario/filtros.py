"""
Construcción de URLs de búsqueda de Portal Inmobiliario a partir de filtros.

La gramática se tomó de los enlaces de filtro que genera el propio sitio en su
barra lateral (páginas de resultados reales de agosto de 2026):

    https://www.portalinmobiliario.com/{operacion}/{tipo}/[condicion]/[dormitorios]/
        [publicador]/{ubicacion}/_{TOKEN}_{valor}_{TOKEN}_{valor}...

Ejemplos reales:
    /venta/departamento/las-condes-metropolitana/_HAS*TERRACE_242085
    /venta/casa/3-dormitorios/penalolen-metropolitana/_MAINTENANCE*FEE_3000CLP-10000CLP
    /arriendo/departamento/proyectos/1-dormitorio/santiago-metropolitana

Los tokens de rango usan "*" como extremo abierto (``_COVERED*AREA_80m²-*``) y
el precio usa 0 (``_PriceRange_0CLP-350000000CLP``). La paginación
(``_Desde_N``) y el orden (``_OrderId_PRICE``) siguen la convención general de
MercadoLibre; el cliente comprueba en cada página que el sitio los respetó.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from urllib.parse import quote, urlsplit, urlunsplit

from .config import BASE_URL

# Valor que el sitio usa para "Sí" en los filtros booleanos.
SI = "242085"

# Características booleanas: nombre en la CLI -> (token del sitio, etiqueta).
CARACTERISTICAS: dict[str, tuple[str, str]] = {
    "amoblado": ("FURNISHED", "Amoblado"),
    "aire-acondicionado": ("HAS*AIR*CONDITIONING", "Con aire acondicionado"),
    "alarma": ("HAS*ALARM", "Con alarma"),
    "ascensor": ("HAS*LIFT", "Con ascensor"),
    "bano-visitas": ("HAS*HALF*BATH", "Con baño de visitas"),
    "estacionamiento-visitas": ("HAS*GUEST*PARKING", "Con estacionamiento de visitas"),
    "gimnasio": ("HAS*GYM", "Con gimnasio"),
    "jardin": ("HAS*GARDEN", "Con jardín"),
    "mascotas": ("IS*SUITABLE*FOR*PETS", "Admite mascotas"),
    "parrilla": ("HAS*GRILL", "Con parrilla"),
    "piscina": ("HAS*SWIMMING*POOL", "Con piscina"),
    "sala-multiuso": ("HAS*MULTIPURPOSE*ROOM", "Con sala multiuso"),
    "terraza": ("HAS*TERRACE", "Con terraza"),
    "uso-profesional": ("PROFESSIONAL*USE*ALLOWED", "Permite uso profesional"),
}

OPERACIONES = ("venta", "arriendo", "arriendo-de-temporada")

# Tipos más usados; se acepta cualquier otro slug que exista en el sitio.
TIPOS = (
    "departamento", "casa", "oficina", "terreno", "parcela", "local-comercial",
    "bodega", "estacionamiento", "industrial", "agricola",
)

CONDICIONES = {"nuevo": "proyectos", "usado": "propiedades-usadas"}
PUBLICADORES = ("profesional", "particular")
ORDENES = {
    "relevancia": None,
    "precio-asc": "PRICE",
    "precio-desc": "PRICE*DESC",
}

# Alias frecuentes de regiones -> slug que usa el sitio. Los valores comprobados
# en URLs reales son: metropolitana, valparaiso, coquimbo, antofagasta,
# la-araucania, maule, tarapaca y nuble.
REGIONES = {
    "rm": "metropolitana",
    "region-metropolitana": "metropolitana",
    "santiago-de-chile": "metropolitana",
    "araucania": "la-araucania",
    "bio-bio": "biobio",
}

POR_PAGINA = 48


def slug(texto: str) -> str:
    """'Peñalolén' -> 'penalolen', "O'Higgins" -> 'ohiggins'."""
    texto = texto.replace("'", "").replace("’", "")
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^a-z0-9]+", "-", texto.lower())
    return texto.strip("-")


def _num(valor: float) -> str:
    """Número sin decimales innecesarios: 80.0 -> '80', 2.5 -> '2.5'."""
    return f"{valor:g}" if valor != int(valor) else str(int(valor))


def _rango(minimo: float | None, maximo: float | None, sufijo: str) -> str:
    a = f"{_num(minimo)}{sufijo}" if minimo is not None else "*"
    b = f"{_num(maximo)}{sufijo}" if maximo is not None else "*"
    return f"{a}-{b}"


def _miles(valor: float) -> str:
    return f"{valor:,.0f}".replace(",", ".")


@dataclass
class Filtros:
    """Filtros de búsqueda. Todos opcionales salvo operación y tipo."""

    operacion: str = "venta"
    tipo: str = "departamento"
    comuna: str | None = None
    region: str = "metropolitana"
    # Slug libre que reemplaza comuna/región (barrios, p. ej.
    # "barrio-el-golf-las-condes-santiago-metropolitana").
    ubicacion: str | None = None
    condicion: str | None = None            # nuevo | usado
    dormitorios_min: int | None = None
    dormitorios_max: int | None = None
    banos_min: int | None = None
    estacionamientos_min: int | None = None
    precio_min: float | None = None
    precio_max: float | None = None
    moneda: str = "UF"                      # moneda de precio_min/max: UF | CLP
    superficie_util_min: float | None = None
    superficie_util_max: float | None = None
    superficie_total_min: float | None = None
    superficie_total_max: float | None = None
    antiguedad_min: int | None = None
    antiguedad_max: int | None = None
    gastos_comunes_min: int | None = None
    gastos_comunes_max: int | None = None
    caracteristicas: list[str] = field(default_factory=list)
    publicador: str | None = None           # profesional | particular
    publicados_hoy: bool = False
    orden: str = "relevancia"

    def __post_init__(self) -> None:
        self.operacion = slug(self.operacion)
        self.tipo = slug(self.tipo)
        self.moneda = self.moneda.upper()
        if self.moneda not in ("UF", "CLP"):
            raise ValueError("La moneda debe ser UF o CLP.")
        if self.condicion and self.condicion not in CONDICIONES:
            raise ValueError(f"Condición desconocida: {self.condicion} (usa nuevo/usado).")
        if self.publicador and self.publicador not in PUBLICADORES:
            raise ValueError(f"Publicador desconocido: {self.publicador}.")
        if self.orden not in ORDENES:
            raise ValueError(f"Orden desconocido: {self.orden}.")
        desconocidas = [c for c in self.caracteristicas if c not in CARACTERISTICAS]
        if desconocidas:
            raise ValueError(
                "Características desconocidas: " + ", ".join(desconocidas)
                + ". Opciones: " + ", ".join(CARACTERISTICAS)
            )

    # ------------------------------------------------------------------ #
    # Partes de la URL
    # ------------------------------------------------------------------ #
    def slug_ubicacion(self) -> str | None:
        if self.ubicacion:
            return self.ubicacion.strip("/")
        region = REGIONES.get(slug(self.region), slug(self.region)) if self.region else ""
        if self.comuna:
            return f"{slug(self.comuna)}-{region}" if region else slug(self.comuna)
        return region or None

    def _segmento_dormitorios(self) -> str | None:
        """Los valores exactos 0-3 y '4 o más' tienen segmento propio en la ruta."""
        lo, hi = self.dormitorios_min, self.dormitorios_max
        if lo is not None and lo == hi and lo <= 3:
            return {0: "sin-dormitorios", 1: "1-dormitorio"}.get(lo, f"{lo}-dormitorios")
        if lo == 4 and hi is None:
            return "mas-de-4-dormitorios"
        return None

    def _tokens(self, valor_uf: float | None) -> tuple[list[str], list[str]]:
        """Devuelve (tokens nativos, tokens de atributos) sin el '_' inicial."""
        nativos: list[str] = []
        atributos: list[str] = []

        if self.precio_min is not None or self.precio_max is not None:
            nativos.append("PriceRange_" + self._rango_precio(valor_uf))
        if self.publicados_hoy:
            nativos.append("PublishedToday_YES")

        lo, hi = self.dormitorios_min, self.dormitorios_max
        if (lo is not None or hi is not None) and not self._segmento_dormitorios():
            atributos.append(f"BEDROOMS_{_rango(lo, hi, '')}")
        if self.banos_min is not None:
            atributos.append(f"FULL*BATHROOMS_{self.banos_min}-*")
        if self.estacionamientos_min is not None:
            atributos.append(f"PARKING*LOTS_{self.estacionamientos_min}-*")
        if self.superficie_util_min is not None or self.superficie_util_max is not None:
            atributos.append(
                "COVERED*AREA_" + _rango(self.superficie_util_min, self.superficie_util_max, "m²")
            )
        if self.superficie_total_min is not None or self.superficie_total_max is not None:
            atributos.append(
                "TOTAL*AREA_" + _rango(self.superficie_total_min, self.superficie_total_max, "m²")
            )
        if self.antiguedad_min is not None or self.antiguedad_max is not None:
            atributos.append(
                "PROPERTY*AGE_" + _rango(self.antiguedad_min, self.antiguedad_max, "años")
            )
        if self.gastos_comunes_min is not None or self.gastos_comunes_max is not None:
            atributos.append(
                "MAINTENANCE*FEE_"
                + _rango(self.gastos_comunes_min, self.gastos_comunes_max, "CLP")
            )
        for c in self.caracteristicas:
            atributos.append(f"{CARACTERISTICAS[c][0]}_{SI}")
        return nativos, sorted(atributos)

    def _rango_precio(self, valor_uf: float | None) -> str:
        """El sitio filtra el precio en pesos (con conversión) y usa 0 como abierto."""
        lo, hi = self.precio_min or 0, self.precio_max or 0
        if self.moneda == "UF":
            if not valor_uf:
                # Sin valor UF se usa el código ISO de la UF (CLF).
                return f"{_num(lo)}CLF-{_num(hi)}CLF"
            lo, hi = round(lo * valor_uf), round(hi * valor_uf)
        return f"{_num(lo)}CLP-{_num(hi)}CLP"

    def url(self, pagina: int = 1, por_pagina: int = POR_PAGINA,
            valor_uf: float | None = None) -> str:
        """URL de la página `pagina` de resultados para estos filtros."""
        partes = [self.operacion, self.tipo]
        if self.condicion:
            partes.append(CONDICIONES[self.condicion])
        dorm = self._segmento_dormitorios()
        if dorm:
            partes.append(dorm)
        if self.publicador:
            partes.append(self.publicador)
        ubic = self.slug_ubicacion()
        if ubic:
            partes.append(ubic)

        nativos, atributos = self._tokens(valor_uf)
        extra = []
        if pagina > 1:
            extra.append(f"Desde_{(pagina - 1) * por_pagina + 1}")
        if ORDENES[self.orden]:
            extra.append(f"OrderId_{ORDENES[self.orden]}")
        tokens = extra + nativos + atributos
        if extra:
            tokens.append("NoIndex_True")

        ruta = "/" + "/".join(partes)
        if tokens:
            ruta += "/_" + "_".join(tokens)
        return BASE_URL + quote(ruta, safe="/*-_.~")

    # ------------------------------------------------------------------ #
    # Utilidades para el informe
    # ------------------------------------------------------------------ #
    def describir(self) -> list[str]:
        """Etiquetas legibles de los filtros pedidos."""
        out = [self.tipo.replace("-", " ").capitalize(), self.operacion.replace("-", " ")]
        if self.ubicacion:
            out.append(self.ubicacion)
        elif self.comuna:
            out.append(self.comuna)
        if self.condicion:
            out.append("Proyectos nuevos" if self.condicion == "nuevo" else "Usados")
        lo, hi = self.dormitorios_min, self.dormitorios_max
        if lo is not None or hi is not None:
            if lo == hi:
                out.append(f"{lo} dormitorios")
            elif hi is None:
                out.append(f"{lo}+ dormitorios")
            else:
                out.append(f"{lo or 0} a {hi} dormitorios")
        if self.banos_min is not None:
            out.append(f"{self.banos_min}+ baños")
        if self.estacionamientos_min is not None:
            out.append(f"{self.estacionamientos_min}+ estacionamientos")
        if self.precio_min is not None or self.precio_max is not None:
            pre = "UF " if self.moneda == "UF" else "$ "
            if self.precio_min is not None and self.precio_max is not None:
                out.append(f"{pre}{_miles(self.precio_min)} a {_miles(self.precio_max)}")
            elif self.precio_max is not None:
                out.append(f"Hasta {pre}{_miles(self.precio_max)}")
            else:
                out.append(f"Desde {pre}{_miles(self.precio_min)}")
        for nombre, lo2, hi2, unidad in (
            ("útiles", self.superficie_util_min, self.superficie_util_max, "m²"),
            ("totales", self.superficie_total_min, self.superficie_total_max, "m²"),
        ):
            if lo2 is not None or hi2 is not None:
                out.append(f"{_rango(lo2, hi2, '').replace('*', '…')} {unidad} {nombre}")
        if self.antiguedad_min is not None or self.antiguedad_max is not None:
            out.append(f"Antigüedad {_rango(self.antiguedad_min, self.antiguedad_max, '').replace('*', '…')} años")
        if self.gastos_comunes_min is not None or self.gastos_comunes_max is not None:
            out.append("Gastos comunes " + _rango(
                self.gastos_comunes_min, self.gastos_comunes_max, "").replace("*", "…") + " CLP")
        out += [CARACTERISTICAS[c][1] for c in self.caracteristicas]
        if self.publicador:
            out.append("Corredoras" if self.publicador == "profesional" else "Particulares")
        if self.publicados_hoy:
            out.append("Publicados hoy")
        if self.orden != "relevancia":
            out.append("Menor precio primero" if self.orden == "precio-asc" else "Mayor precio primero")
        return out


def paginar_url(url: str, pagina: int, por_pagina: int = POR_PAGINA) -> str:
    """Agrega o reemplaza ``_Desde_N`` en una URL de búsqueda copiada del sitio."""
    partes = urlsplit(url)
    ruta = re.sub(r"_Desde_\d+", "", partes.path)
    if pagina > 1:
        desde = f"Desde_{(pagina - 1) * por_pagina + 1}"
        segmentos = ruta.rstrip("/").split("/")
        if segmentos[-1].startswith("_"):
            segmentos[-1] = f"_{desde}{segmentos[-1]}"
        else:
            segmentos.append(f"_{desde}")
        if "_NoIndex_True" not in segmentos[-1]:
            segmentos[-1] += "_NoIndex_True"
        ruta = "/".join(segmentos)
    return urlunsplit((partes.scheme, partes.netloc, ruta, partes.query, ""))
