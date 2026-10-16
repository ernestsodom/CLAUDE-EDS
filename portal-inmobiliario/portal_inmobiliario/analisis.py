"""Conversión de precios y verificación local de los filtros numéricos."""

from __future__ import annotations

from .filtros import Filtros
from .parser import Aviso


def precio_en(aviso: Aviso, moneda: str, valor_uf: float | None) -> float | None:
    """Precio del aviso expresado en `moneda` (UF o CLP)."""
    if aviso.precio is None or aviso.moneda not in ("UF", "CLP"):
        return None
    if aviso.moneda == moneda:
        return aviso.precio
    if not valor_uf:
        return None
    return aviso.precio * valor_uf if moneda == "CLP" else aviso.precio / valor_uf


def moneda_de_analisis(avisos: list[Aviso]) -> str:
    """UF si la mayoría publica en UF (ventas); CLP si no (la mayoría de los arriendos)."""
    en_uf = sum(1 for a in avisos if a.moneda == "UF")
    en_clp = sum(1 for a in avisos if a.moneda == "CLP")
    return "UF" if en_uf >= en_clp else "CLP"


def _fuera(valor_min: float | None, valor_max: float | None,
           lo: float | None, hi: float | None) -> bool:
    """True si el rango del aviso [valor_min, valor_max] no toca el pedido [lo, hi]."""
    if valor_min is None and valor_max is None:
        return False  # sin dato: se conserva
    vmin = valor_min if valor_min is not None else valor_max
    vmax = valor_max if valor_max is not None else valor_min
    return (lo is not None and vmax < lo) or (hi is not None and vmin > hi)


def cumple(aviso: Aviso, f: Filtros, valor_uf: float | None) -> bool:
    """Comprueba en local los filtros numéricos (el sitio ya filtró; esto lo verifica)."""
    precio = precio_en(aviso, f.moneda, valor_uf)
    if precio is not None:
        if f.precio_max is not None and precio > f.precio_max:
            return False
        # "Desde UF …" es el mínimo de un proyecto: puede tener unidades más caras.
        if f.precio_min is not None and precio < f.precio_min and not aviso.precio_desde:
            return False
    checks = (
        (aviso.dormitorios_min, aviso.dormitorios_max, f.dormitorios_min, f.dormitorios_max),
        (aviso.banos_min, aviso.banos_max, f.banos_min, None),
        (aviso.superficie_util_min, aviso.superficie_util_max,
         f.superficie_util_min, f.superficie_util_max),
        (aviso.superficie_total_min, aviso.superficie_total_max,
         f.superficie_total_min, f.superficie_total_max),
    )
    return not any(_fuera(*c) for c in checks)


def filtrar(avisos: list[Aviso], f: Filtros, valor_uf: float | None) -> tuple[list[Aviso], int]:
    """Devuelve (avisos que cumplen, cantidad descartada)."""
    ok = [a for a in avisos if cumple(a, f, valor_uf)]
    return ok, len(avisos) - len(ok)
