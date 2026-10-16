"""Configuración central del extractor de Portal Inmobiliario."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SALIDA_DIR = Path(os.getenv("PI_SALIDA_DIR", BASE_DIR / "salida"))

BASE_URL = "https://www.portalinmobiliario.com"

# Archivo donde `pi.py login` guarda la sesión del navegador (cookies).
SESION_POR_DEFECTO = BASE_DIR / "sesion_pi.json"


def _float_env(nombre: str) -> float | None:
    valor = os.getenv(nombre, "").strip()
    return float(valor.replace(",", ".")) if valor else None


@dataclass
class Settings:
    """Parámetros de ejecución, configurables por variables de entorno."""

    # Cookie de una sesión iniciada en MercadoLibre/Portal Inmobiliario, en el
    # formato del encabezado HTTP "Cookie" (nombre=valor; nombre2=valor2).
    # Solo hace falta cuando el sitio pide iniciar sesión (p. ej. en la nube).
    cookies: str = field(default_factory=lambda: os.getenv("PI_COOKIES", "").strip())
    # Sesión guardada por `pi.py login` (formato storage-state de Playwright).
    sesion: Path = field(
        default_factory=lambda: Path(os.getenv("PI_SESION", SESION_POR_DEFECTO))
    )
    timeout: int = int(os.getenv("PI_TIMEOUT", "30"))
    # Pausa base entre páginas (segundos); se le suma un margen aleatorio.
    pausa: float = float(os.getenv("PI_PAUSA", "3"))
    max_paginas: int = int(os.getenv("PI_MAX_PAGINAS", "5"))
    # Valor UF fijo (opcional). Si no se define se consulta mindicador.cl.
    valor_uf: float | None = field(default_factory=lambda: _float_env("PI_VALOR_UF"))


settings = Settings()
