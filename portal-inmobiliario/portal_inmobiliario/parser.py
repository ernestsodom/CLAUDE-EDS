"""
Extracción de avisos desde el HTML de una página de resultados.

El sitio entrega los resultados renderizados en el servidor: cada aviso es una
tarjeta ``.poly-card`` dentro de ``li.ui-search-layout__item`` con título,
precio (``andes-money-amount``), atributos (dormitorios, baños, m² útiles),
ubicación y publicador. Además la página trae:

- ``.ui-search-search-result__quantity-results``: total de resultados.
- ``.ui-search-applied-filters__tag``: los filtros que el sitio aplicó.
- ``melidata("add","event_data",{...})``: offset, orden y total de la búsqueda,
  útil para comprobar que la paginación y el orden pedidos se respetaron.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, Tag

# Señales de la barrera "¡Hola! Para continuar, ingresa a tu cuenta".
RUTAS_BARRERA = ("/gz/account-verification", "/gz/webdevice", "/hub/registration")
TEXTO_BARRERA = "para continuar, ingresa a tu cuenta"

MONEDAS = {
    "unidades de fomento": "UF",
    "pesos chilenos": "CLP",
    "pesos": "CLP",
    "dólares": "USD",
    "dolares": "USD",
}
SIMBOLOS = {"UF": "UF", "$": "CLP", "US$": "USD", "U$S": "USD"}

_RE_NUM = re.compile(r"\d+(?:[.,]\d+)*")
_RE_MONTO = re.compile(
    r"(\d+(?:[.,]\d+)*)\s+(unidades de fomento|pesos chilenos|pesos|d[oó]lares)"
    r"(?:\s+con\s+(\d+)\s+centavos)?",
    re.I,
)


@dataclass
class Aviso:
    """Un aviso tal como aparece en la página de resultados."""

    id: str
    url: str
    titulo: str
    posicion: int
    encabezado: str | None = None          # "Departamento en venta"
    precio: float | None = None
    moneda: str | None = None              # UF | CLP | USD
    precio_desde: bool = False             # "Desde UF …" (proyectos)
    precio_anterior: float | None = None   # precio antes de una rebaja
    dormitorios_min: int | None = None
    dormitorios_max: int | None = None
    banos_min: int | None = None
    banos_max: int | None = None
    superficie_util_min: float | None = None
    superficie_util_max: float | None = None
    superficie_total_min: float | None = None
    superficie_total_max: float | None = None
    privados_min: int | None = None        # oficinas
    privados_max: int | None = None
    ubicacion: str | None = None
    publicador: str | None = None
    etiqueta: str | None = None            # "PUBLICADO ESTA SEMANA", etc.
    imagen: str | None = None
    otros_atributos: list[str] = field(default_factory=list)

    @property
    def es_proyecto(self) -> bool:
        """Proyecto nuevo: precio "Desde" o rangos de dormitorios/superficie."""
        return self.precio_desde or (
            self.dormitorios_min != self.dormitorios_max
            or self.superficie_util_min != self.superficie_util_max
        )


@dataclass
class Pagina:
    """Resultado de procesar una página de búsqueda."""

    avisos: list[Aviso]
    total: int | None = None
    titulo: str | None = None
    filtros_sitio: list[str] = field(default_factory=list)
    canonical: str | None = None
    offset: int | None = None
    orden_sitio: str | None = None
    bloqueada: bool = False


def numero(texto: str) -> float:
    """Número en formato chileno: '1.450.000' -> 1450000, '47,75' -> 47.75."""
    texto = texto.strip()
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif texto.count(".") >= 1 and all(len(p) == 3 for p in texto.split(".")[1:]):
        texto = texto.replace(".", "")
    return float(texto)


def es_barrera(html: str, url_final: str = "") -> bool:
    """True si el sitio respondió con la página de inicio de sesión obligatorio."""
    if any(r in url_final for r in RUTAS_BARRERA):
        return True
    return TEXTO_BARRERA in html[:60000].lower() and "poly-card" not in html


def _texto(el: Tag | None) -> str | None:
    if el is None:
        return None
    txt = el.get_text(" ", strip=True)
    return txt or None


def _monto(el: Tag) -> tuple[float | None, str | None]:
    """Lee un ``andes-money-amount``: primero su aria-label, luego los spans."""
    m = _RE_MONTO.search(el.get("aria-label") or "")
    if m:
        valor = numero(m.group(1)) + (int(m.group(3)) / 100 if m.group(3) else 0)
        return valor, MONEDAS[m.group(2).lower()]
    frac = el.select_one(".andes-money-amount__fraction")
    if frac is None:
        return None, None
    cents = el.select_one(".andes-money-amount__cents")
    valor = numero(frac.get_text()) + (int(cents.get_text(strip=True)) / 100 if cents else 0)
    simbolo = _texto(el.select_one(".andes-money-amount__currency-symbol")) or ""
    return valor, SIMBOLOS.get(simbolo, simbolo or None)


def _rango_numeros(texto: str) -> tuple[float | None, float | None]:
    nums = [numero(n) for n in _RE_NUM.findall(texto)]
    if not nums:
        return None, None
    return nums[0], nums[-1]


def _aplicar_atributo(aviso: Aviso, texto: str) -> None:
    """Interpreta '3 dormitorios', '1 a 3 dormitorios', '45 - 90 m² útiles', etc."""
    t = texto.lower()
    lo, hi = _rango_numeros(t)
    if "dormitorio" in t or "monoambiente" in t:
        if t.startswith(("estudio", "monoambiente")):
            lo, hi = 0, (hi if hi is not None else 0)
        if lo is not None:
            aviso.dormitorios_min, aviso.dormitorios_max = int(lo), int(hi)
            return
    elif "baño" in t or "bano" in t:
        if lo is not None:
            aviso.banos_min, aviso.banos_max = int(lo), int(hi)
            return
    elif "m²" in t or "m2" in t:
        if lo is not None:
            if "total" in t or "terreno" in t:
                aviso.superficie_total_min, aviso.superficie_total_max = lo, hi
            else:
                aviso.superficie_util_min, aviso.superficie_util_max = lo, hi
            return
    elif "privado" in t:
        if lo is not None:
            aviso.privados_min, aviso.privados_max = int(lo), int(hi)
            return
    aviso.otros_atributos.append(texto)


def _aviso(card: Tag, posicion: int) -> Aviso | None:
    enlace = card.select_one("a.poly-component__title") or card.select_one("a[href*='MLC']")
    if enlace is None:
        return None
    url = (enlace.get("href") or "").split("#", 1)[0]
    m = re.search(r"MLC-?(\d+)", url)
    aviso = Aviso(
        id=f"MLC{m.group(1)}" if m else url,
        url=url,
        titulo=_texto(enlace) or "",
        posicion=posicion,
        encabezado=_texto(card.select_one(".poly-component__headline")),
        ubicacion=_texto(card.select_one(".poly-component__location")),
        publicador=_texto(card.select_one(".poly-component__seller")),
        etiqueta=_texto(card.select_one(".poly-component__float-highlight")),
    )
    img = card.select_one("img.poly-component__picture")
    if img is not None:
        aviso.imagen = img.get("src") or img.get("data-src")

    precio = card.select_one(".poly-component__price")
    if precio is not None:
        actual = precio.select_one(".poly-price__current .andes-money-amount")
        if actual is not None:
            aviso.precio, aviso.moneda = _monto(actual)
        anterior = precio.select_one(".poly-price__previous")
        if anterior is not None:
            aviso.precio_anterior, _ = _monto(anterior)
        prefijo = _texto(precio.select_one(".poly-price__prefix")) or ""
        aviso.precio_desde = prefijo.lower().startswith("desde")

    for item in card.select(".poly-attributes_list__item"):
        texto = _texto(item)
        if texto:
            _aplicar_atributo(aviso, texto)
    return aviso


def _event_data(html: str) -> dict:
    """Objeto ``event_data`` de la analítica embebida (offset, orden, total)."""
    i = html.find('melidata("add","event_data",')
    if i < 0:
        return {}
    try:
        datos, _ = json.JSONDecoder().raw_decode(html, html.find("{", i))
    except ValueError:
        return {}
    return datos if isinstance(datos, dict) else {}


def parsear_pagina(html: str, url_final: str = "") -> Pagina:
    """Extrae avisos y metadatos de una página de resultados."""
    if es_barrera(html, url_final):
        return Pagina(avisos=[], bloqueada=True)

    soup = BeautifulSoup(html, "lxml")
    tarjetas = [
        li.select_one(".poly-card") for li in soup.select("li.ui-search-layout__item")
    ]
    tarjetas = [t for t in tarjetas if t is not None] or soup.select(".poly-card")
    avisos = []
    for tarjeta in tarjetas:
        aviso = _aviso(tarjeta, len(avisos) + 1)
        if aviso is not None:
            avisos.append(aviso)

    evento = _event_data(html)
    total = None
    cantidad = _texto(soup.select_one(".ui-search-search-result__quantity-results"))
    if cantidad and _RE_NUM.search(cantidad):
        total = int(numero(_RE_NUM.search(cantidad).group(0)))
    elif isinstance(evento.get("total"), int):
        total = evento["total"]

    canonical = soup.select_one("link[rel=canonical]")
    return Pagina(
        avisos=avisos,
        total=total,
        titulo=_texto(soup.select_one("h1")),
        filtros_sitio=[
            t for t in (_texto(x) for x in soup.select(".ui-search-applied-filters__tag")) if t
        ],
        canonical=canonical.get("href") if canonical is not None else None,
        offset=evento.get("offset") if isinstance(evento.get("offset"), int) else None,
        orden_sitio=evento.get("sort_id"),
    )
