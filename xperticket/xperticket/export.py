"""Exportación de prospectos y análisis a CSV, Excel y JSON."""

from __future__ import annotations

import io
import json
from typing import Any

import pandas as pd


def a_csv(df: pd.DataFrame) -> bytes:
    """CSV en UTF-8 con BOM (compatible con Excel en Windows)."""
    return df.to_csv(index=False).encode("utf-8-sig")


def a_excel(df: pd.DataFrame, hoja: str = "Prospectos") -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=hoja[:31])
    return buffer.getvalue()


def a_json(data: Any) -> bytes:
    """Serializa cualquier estructura (lista de payloads, dict) a JSON UTF-8."""
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def guardar(data: bytes, path: str) -> None:
    with open(path, "wb") as f:
        f.write(data)
