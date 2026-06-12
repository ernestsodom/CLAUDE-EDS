"""Modelos de datos del motor (prospecto y utilidades de serialización)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field, fields
from typing import Any

# Columnas del CSV/JSON de salida del Módulo 1 (Prospecting & Discovery).
COLUMNAS_PROSPECTO = [
    "id",
    "nombre_institucion",
    "tipo",
    "region",
    "ciudad",
    "sitio_web",
    "email_publico",
    "telefono",
    "linkedin_url",
    "facebook",
    "instagram",
    "anio_fundacion",
    "descripcion_breve",
    "ticketera_identificada",
    "estado_prospectable",
    "fuente",
]


def slugify(texto: str) -> str:
    """Convierte un nombre en un id estable (sin tildes, en minúsculas)."""
    if not texto:
        return ""
    norm = unicodedata.normalize("NFKD", texto)
    norm = norm.encode("ascii", "ignore").decode("ascii")
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return norm[:80]


@dataclass
class Prospecto:
    """Un cliente potencial (institución cultural / de entretenimiento)."""

    nombre_institucion: str
    tipo: str = ""
    region: str = ""
    ciudad: str = ""
    sitio_web: str = ""
    email_publico: str = ""
    telefono: str = ""
    linkedin_url: str = ""
    facebook: str = ""
    instagram: str = ""
    anio_fundacion: str = ""
    descripcion_breve: str = ""
    ticketera_identificada: str = ""
    # "prospectable" si hay contacto público (email o web); si no, "incompleto".
    estado_prospectable: str = ""
    fuente: str = "seed"
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = slugify(self.nombre_institucion)
        if not self.estado_prospectable:
            self.estado_prospectable = (
                "prospectable" if (self.email_publico or self.sitio_web) else "incompleto"
            )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_row(self) -> dict[str, Any]:
        """Fila ordenada según COLUMNAS_PROSPECTO (para CSV/tablas)."""
        d = self.to_dict()
        return {c: d.get(c, "") for c in COLUMNAS_PROSPECTO}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Prospecto":
        validos = {f.name for f in fields(cls)}
        limpio = {k: ("" if v is None else v) for k, v in data.items() if k in validos}
        return cls(**limpio)
