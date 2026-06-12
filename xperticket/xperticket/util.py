"""Utilidades transversales: logging de análisis y helpers de formato."""

from __future__ import annotations

from datetime import datetime, timezone

from .config import LOG_PATH


def log(mensaje: str) -> None:
    """Anexa una línea con timestamp al log de análisis (para debug/auditoría)."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {mensaje}\n")
    except OSError:
        pass  # nunca dejar que el logging rompa el flujo principal


def uf(valor: float | None) -> str:
    if valor is None:
        return "—"
    return f"{valor:,.0f} UF".replace(",", ".")


def usd(valor: float | None) -> str:
    if valor is None:
        return "—"
    return f"US$ {valor:,.0f}"


def pct(valor: float | None) -> str:
    if valor is None:
        return "—"
    return f"{valor:.1f}%"
