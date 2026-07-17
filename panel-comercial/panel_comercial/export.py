"""Exportación de negocios a CSV y Excel."""

from __future__ import annotations

import io

import pandas as pd


def a_csv(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode("utf-8-sig")


def a_excel(df: pd.DataFrame, hoja: str = "Negocios") -> bytes:
    """Serializa a Excel; Excel no admite datetimes con zona horaria."""
    df = df.copy()
    for col in df.select_dtypes(include=["datetimetz"]).columns:
        df[col] = df[col].dt.tz_localize(None)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=hoja[:31])
    return buffer.getvalue()
