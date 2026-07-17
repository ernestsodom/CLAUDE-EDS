"""Configuración central del panel comercial."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("PANEL_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "panel_comercial.sqlite"

# Etapas del pipeline comercial, en orden de avance.
ETAPAS = [
    "Nuevo",
    "Contactado",
    "En negociación",
    "Propuesta enviada",
    "Ganado",
    "Perdido",
]

ETAPAS_CERRADAS = {"Ganado", "Perdido"}

PROBABILIDAD_DEFAULT = {
    "Nuevo": 10,
    "Contactado": 25,
    "En negociación": 50,
    "Propuesta enviada": 70,
    "Ganado": 100,
    "Perdido": 0,
}

MONEDAS = ["CLP", "USD", "UF"]
