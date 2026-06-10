"""Configuración central de la herramienta de Mercado Público."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Directorio base de datos/caché (se crea si no existe).
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("MP_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "mercado_publico.sqlite"

# Endpoint oficial de la API de Mercado Público.
API_BASE = "https://api.mercadopublico.cl/servicios/v1/publico"

# Ticket de demostración público que publica la propia DCCP en su documentación.
# Sirve para probar la herramienta sin credenciales propias, pero está muy
# limitado en cuota. Cada usuario debería usar su PROPIO ticket gratuito.
TICKET_DEMO = "F8537A18-6766-4DEF-9E59-426B4FEE2844"


@dataclass
class Settings:
    """Parámetros de ejecución, configurables por variables de entorno."""

    # Si MP_TICKET no está definido O está vacío, se usa el ticket de demo.
    ticket: str = field(default_factory=lambda: os.getenv("MP_TICKET") or TICKET_DEMO)
    timeout: int = int(os.getenv("MP_TIMEOUT", "30"))
    max_retries: int = int(os.getenv("MP_MAX_RETRIES", "4"))
    # Pausa entre llamadas para respetar el rate-limit de la API pública.
    request_delay: float = float(os.getenv("MP_REQUEST_DELAY", "0.5"))
    # Vigencia del caché en horas antes de considerar los datos obsoletos.
    cache_ttl_hours: int = int(os.getenv("MP_CACHE_TTL_HOURS", "12"))

    @property
    def usando_demo(self) -> bool:
        return self.ticket == TICKET_DEMO


settings = Settings()
