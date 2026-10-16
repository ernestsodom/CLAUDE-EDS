"""Valor de la UF para convertir precios entre UF y pesos."""

from __future__ import annotations

from datetime import date, datetime

import requests

from .config import settings

API_UF = "https://mindicador.cl/api/uf"


def valor_uf(fecha: date | None = None) -> tuple[float, date] | None:
    """Valor UF del día (o de `fecha`) según mindicador.cl, o PI_VALOR_UF si está fijo."""
    if settings.valor_uf:
        return settings.valor_uf, fecha or date.today()
    url = f"{API_UF}/{fecha:%d-%m-%Y}" if fecha else API_UF
    try:
        resp = requests.get(url, timeout=settings.timeout)
        resp.raise_for_status()
        serie = resp.json().get("serie") or []
    except (requests.RequestException, ValueError):
        return None
    if not serie:
        return None
    dia = datetime.fromisoformat(serie[0]["fecha"].replace("Z", "+00:00")).date()
    return float(serie[0]["valor"]), dia
