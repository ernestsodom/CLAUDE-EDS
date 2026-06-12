"""Configuración central del motor de prospección Xperticket."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # python-dotenv es opcional: si falta, se leen las env vars del sistema.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # noqa: BLE001
    pass

# Directorio base de datos/caché (se crea si no existe).
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("XPERTI_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "xperticket.sqlite"
LOG_PATH = DATA_DIR / "analisis.log"


@dataclass
class Settings:
    """Parámetros de ejecución, configurables por variables de entorno."""

    # --- Web scraping (Módulo 2) ---------------------------------------- #
    user_agent: str = field(
        default_factory=lambda: os.getenv(
            "XPERTI_USER_AGENT",
            "XperticketIntelBot/0.1 (+https://xperticket.cl; prospección comercial)",
        )
    )
    timeout: int = int(os.getenv("XPERTI_TIMEOUT", "20"))
    max_retries: int = int(os.getenv("XPERTI_MAX_RETRIES", "3"))
    # Pausa entre peticiones al mismo host (scraping ético, sin DDoS).
    request_delay: float = float(os.getenv("XPERTI_REQUEST_DELAY", "1.0"))
    # Respetar robots.txt antes de hacer fetch de una página.
    respetar_robots: bool = os.getenv("XPERTI_RESPECT_ROBOTS", "1") != "0"
    # Re-analizar un prospecto cuyo análisis tenga más de N días.
    reanalisis_dias: int = int(os.getenv("XPERTI_REANALISIS_DIAS", "45"))

    # --- Claude API (Módulo 4, narrativa opcional) ---------------------- #
    anthropic_api_key: str = field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", "")
    )
    claude_model: str = field(
        default_factory=lambda: os.getenv("XPERTI_CLAUDE_MODEL", "claude-sonnet-4-6")
    )

    # --- Conversión monetaria (Módulo 3) -------------------------------- #
    # Valores de referencia. ACTUALIZAR periódicamente (UF/CLP/USD varían).
    uf_to_clp: float = float(os.getenv("XPERTI_UF_CLP", "39000"))
    usd_to_clp: float = float(os.getenv("XPERTI_USD_CLP", "960"))

    @property
    def claude_disponible(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def uf_to_usd(self) -> float:
        """Cuántos USD vale 1 UF (derivado de los tipos de cambio configurados)."""
        return self.uf_to_clp / self.usd_to_clp


settings = Settings()
