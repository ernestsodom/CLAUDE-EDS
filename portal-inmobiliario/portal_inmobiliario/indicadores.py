"""Valor de la UF para convertir precios entre UF y pesos."""

from __future__ import annotations

from datetime import date, datetime

import requests

from .config import settings

# mindicador.cl es la fuente principal; a veces tarda o no responde, así que
# api.boostr.cl queda de respaldo (ambas publican el valor oficial del día).
API_MINDICADOR = "https://mindicador.cl/api/uf"
API_BOOSTR = "https://api.boostr.cl/economy/indicator/uf"


def _mindicador(fecha: date | None) -> tuple[float, date] | None:
    url = f"{API_MINDICADOR}/{fecha:%d-%m-%Y}" if fecha else API_MINDICADOR
    resp = requests.get(url, timeout=min(settings.timeout, 15))
    resp.raise_for_status()
    serie = resp.json().get("serie") or []
    if not serie:
        return None
    dia = datetime.fromisoformat(serie[0]["fecha"].replace("Z", "+00:00")).date()
    return float(serie[0]["valor"]), dia


def _boostr(fecha: date | None) -> tuple[float, date] | None:
    url = f"{API_BOOSTR}/{fecha:%d-%m-%Y}.json" if fecha else f"{API_BOOSTR}.json"
    resp = requests.get(url, timeout=min(settings.timeout, 15))
    resp.raise_for_status()
    dato = resp.json().get("data")
    if isinstance(dato, list):  # consulta por fecha: lista con un elemento
        dato = dato[0] if dato else None
    if not dato:
        return None
    return float(dato["value"]), date.fromisoformat(dato["date"])


def valor_uf(fecha: date | None = None) -> tuple[float, date] | None:
    """Valor UF del día (o de `fecha`), o PI_VALOR_UF si está fijo. None si no hay fuente."""
    if settings.valor_uf:
        return settings.valor_uf, fecha or date.today()
    for fuente in (_mindicador, _boostr):
        try:
            resultado = fuente(fecha)
        except (requests.RequestException, ValueError, KeyError, TypeError):
            continue
        if resultado:
            return resultado
    return None
