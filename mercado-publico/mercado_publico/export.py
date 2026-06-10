"""Vaciado / exportación de información a CSV y Excel."""

from __future__ import annotations

import io

import pandas as pd


def a_csv(df: pd.DataFrame) -> bytes:
    """Serializa un DataFrame a CSV (UTF-8 con BOM para Excel en Windows)."""
    return df.to_csv(index=False).encode("utf-8-sig")


def a_excel(df: pd.DataFrame, hoja: str = "Licitaciones") -> bytes:
    """Serializa un DataFrame a un archivo Excel en memoria."""
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=hoja[:31])
    return buffer.getvalue()
