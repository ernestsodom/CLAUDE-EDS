"""
Perfil comercial de Proexsi: rubros objetivo, competencia y reglas de negocio.

Centraliza todo lo que hace que esta herramienta esté DIRIGIDA a Proexsi:
- Foco en municipalidades.
- Rubros de tecnología (software / hardware y servicios TI).
- Vigilancia de la competencia (CAS-Chile, SMC, Insico, …).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


def normalizar_rut(rut: str | None) -> str:
    """Normaliza un RUT a 'dígitos-DV' en mayúscula, sin puntos ni espacios."""
    if not rut:
        return ""
    limpio = re.sub(r"[^0-9kK]", "", str(rut)).upper()
    if len(limpio) < 2:
        return limpio
    return f"{limpio[:-1]}-{limpio[-1]}"


# --------------------------------------------------------------------- #
# Rubros objetivo (segmentos UNSPSC) para software / hardware y TI
# --------------------------------------------------------------------- #
# 43 = Difusión de Tecnologías de Información (computadores, software, redes)
# 81 = Servicios de ingeniería y tecnología (desarrollo y soporte de software)
RUBROS_TI_CORE = ["43", "81"]
# Rubros complementarios habituales en proyectos TI municipales.
RUBROS_TI_EXTRA = ["32", "44"]  # 32 electrónicos, 44 equipos de oficina
RUBROS_OBJETIVO = RUBROS_TI_CORE + RUBROS_TI_EXTRA

# Palabras clave para reforzar el foco software/hardware en el texto.
PALABRAS_CLAVE_TI = [
    "software", "sistema", "licencia", "informátic", "informatic", "plataforma",
    "erp", "hardware", "servidor", "computador", "notebook", "data center",
    "datacenter", "soporte técnico", "soporte tecnico", "ti ", "tic ",
    "tecnología", "tecnologia", "desarrollo de software", "aplicación",
    "aplicacion", "ciberseguridad", "nube", "cloud", "redes", "municipal",
]


# --------------------------------------------------------------------- #
# Empresa propia y competencia
# --------------------------------------------------------------------- #
@dataclass
class Empresa:
    nombre: str
    rut: str
    alias: list[str] = field(default_factory=list)

    @property
    def rut_norm(self) -> str:
        return normalizar_rut(self.rut)

    def coincide(self, rut: str | None, nombre: str | None) -> bool:
        """True si un proveedor adjudicado corresponde a esta empresa."""
        if rut and normalizar_rut(rut) == self.rut_norm:
            return True
        if nombre:
            texto = nombre.upper()
            if self.nombre.upper() in texto:
                return True
            for a in self.alias:
                if a.upper() in texto:
                    return True
        return False


# Tu empresa.
PROEXSI = Empresa(
    nombre="PROEXSI",
    rut="85.825.700-K",
    alias=["PROEXSI LTDA", "PROCESAMIENTO Y EXPLOTACION"],
)

# Competencia a vigilar (editable por el usuario en la app).
COMPETIDORES: list[Empresa] = [
    Empresa("CAS-CHILE", "96.525.030-1", alias=["CAS CHILE", "CAS-CHILE S.A"]),
    Empresa("SMC", "89.906.900-5", alias=["SISTEMAS MODULARES DE COMPUTACION", "SMC CHILE"]),
    Empresa("INSICO", "79.560.740-4", alias=["INGENIERIA Y SISTEMAS COMPUTACIONALES"]),
]


def todas_las_empresas() -> list[Empresa]:
    return [PROEXSI] + COMPETIDORES


def identificar_empresa(rut: str | None, nombre: str | None) -> str | None:
    """Devuelve el nombre corto de la empresa conocida que adjudicó, si aplica."""
    for emp in todas_las_empresas():
        if emp.coincide(rut, nombre):
            return emp.nombre
    return None


# --------------------------------------------------------------------- #
# Detección de municipalidades
# --------------------------------------------------------------------- #
_MUNI_RE = re.compile(
    r"\b(municipalidad|municipal|i\.?\s*municipalidad|ilustre municipalidad|"
    r"corporaci[oó]n municipal|cmun|daem|departamento de administraci[oó]n de educaci[oó]n municipal)\b",
    re.IGNORECASE,
)


def es_municipalidad(nombre_organismo: str | None) -> bool:
    """Heurística para saber si el comprador es una municipalidad o entidad municipal."""
    if not nombre_organismo:
        return False
    return bool(_MUNI_RE.search(nombre_organismo))
