"""Modelo de datos del panel comercial (negocio/lead) y utilidades."""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import asdict, dataclass, fields
from typing import Any

from .config import ETAPAS, PROBABILIDAD_DEFAULT

COLUMNAS_NEGOCIO = [
    "id",
    "cliente",
    "negocio",
    "contacto",
    "email",
    "telefono",
    "valor_estimado",
    "moneda",
    "etapa",
    "probabilidad",
    "fuente",
    "fecha_cierre_estimada",
    "proxima_accion",
    "fecha_proxima_accion",
    "notas",
]


def slugify(texto: str) -> str:
    """Convierte un texto en un id legible (sin tildes, en minúsculas)."""
    if not texto:
        return uuid.uuid4().hex[:8]
    norm = unicodedata.normalize("NFKD", texto)
    norm = norm.encode("ascii", "ignore").decode("ascii")
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return f"{norm[:60]}-{uuid.uuid4().hex[:6]}"


@dataclass
class Negocio:
    """Un negocio/lead comercial en seguimiento."""

    cliente: str
    negocio: str = ""
    contacto: str = ""
    email: str = ""
    telefono: str = ""
    valor_estimado: float = 0.0
    moneda: str = "CLP"
    etapa: str = "Nuevo"
    probabilidad: int = 0
    fuente: str = ""
    fecha_cierre_estimada: str = ""
    proxima_accion: str = ""
    fecha_proxima_accion: str = ""
    notas: str = ""
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = slugify(f"{self.cliente}-{self.negocio}")
        if self.etapa not in ETAPAS:
            self.etapa = "Nuevo"
        if not self.probabilidad:
            self.probabilidad = PROBABILIDAD_DEFAULT.get(self.etapa, 0)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Negocio":
        validos = {f.name for f in fields(cls)}
        limpio = {k: ("" if v is None else v) for k, v in data.items() if k in validos}
        return cls(**limpio)
