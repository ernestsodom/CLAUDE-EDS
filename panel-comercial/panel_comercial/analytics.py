"""Agregaciones (pandas) para el dashboard del panel comercial."""

from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

from .config import ETAPAS, ETAPAS_CERRADAS


def a_dataframe(registros: list[dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(registros)
    if df.empty:
        return df
    df["valor_estimado"] = pd.to_numeric(df.get("valor_estimado"), errors="coerce").fillna(0.0)
    df["probabilidad"] = pd.to_numeric(df.get("probabilidad"), errors="coerce").fillna(0.0)
    for col in ("fecha_cierre_estimada", "fecha_proxima_accion", "creado_en", "actualizado_en"):
        if col in df:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def filtrar(
    df: pd.DataFrame,
    texto: str | None = None,
    etapas: list[str] | None = None,
    fuentes: list[str] | None = None,
) -> pd.DataFrame:
    if df.empty:
        return df
    out = df
    if texto:
        t = texto.lower()
        campos = ["cliente", "negocio", "contacto", "email", "notas"]
        mask = pd.Series(False, index=out.index)
        for c in campos:
            if c in out:
                mask |= out[c].astype(str).str.lower().str.contains(t, na=False)
        out = out[mask]
    if etapas and "etapa" in out:
        out = out[out["etapa"].isin(etapas)]
    if fuentes and "fuente" in out:
        out = out[out["fuente"].isin(fuentes)]
    return out


def kpis(df: pd.DataFrame) -> dict[str, Any]:
    """Indicadores clave del pipeline comercial."""
    if df.empty:
        return {
            "total": 0, "abiertos": 0, "valor_pipeline": 0.0, "valor_ponderado": 0.0,
            "ganados": 0, "perdidos": 0, "valor_ganado": 0.0, "tasa_conversion": 0.0,
            "seguimientos_vencidos": 0,
        }
    abiertos_df = df[~df["etapa"].isin(ETAPAS_CERRADAS)]
    ganados_df = df[df["etapa"] == "Ganado"]
    perdidos_df = df[df["etapa"] == "Perdido"]
    cerrados = len(ganados_df) + len(perdidos_df)

    hoy = pd.Timestamp(date.today())
    vencidos = 0
    if "fecha_proxima_accion" in abiertos_df:
        vencidos = int((abiertos_df["fecha_proxima_accion"].notna() & (abiertos_df["fecha_proxima_accion"] < hoy)).sum())

    return {
        "total": len(df),
        "abiertos": len(abiertos_df),
        "valor_pipeline": float(abiertos_df["valor_estimado"].sum()),
        "valor_ponderado": float((abiertos_df["valor_estimado"] * abiertos_df["probabilidad"] / 100).sum()),
        "ganados": len(ganados_df),
        "perdidos": len(perdidos_df),
        "valor_ganado": float(ganados_df["valor_estimado"].sum()),
        "tasa_conversion": (len(ganados_df) / cerrados * 100) if cerrados else 0.0,
        "seguimientos_vencidos": vencidos,
    }


def por_etapa(df: pd.DataFrame) -> pd.DataFrame:
    """Cantidad y valor por etapa, en el orden del pipeline."""
    base = pd.DataFrame({"etapa": ETAPAS})
    if df.empty or "etapa" not in df:
        base["cantidad"] = 0
        base["valor"] = 0.0
        return base
    agg = df.groupby("etapa").agg(
        cantidad=("id", "count"), valor=("valor_estimado", "sum")
    ).reset_index()
    out = base.merge(agg, on="etapa", how="left").fillna(0)
    out["etapa"] = pd.Categorical(out["etapa"], categories=ETAPAS, ordered=True)
    return out.sort_values("etapa")


def por_fuente(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "fuente" not in df:
        return pd.DataFrame(columns=["fuente", "cantidad"])
    d = df.copy()
    d["fuente"] = d["fuente"].replace("", "(sin especificar)").fillna("(sin especificar)")
    return d.groupby("fuente").size().reset_index(name="cantidad").sort_values("cantidad", ascending=False)


def evolucion_temporal(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "creado_en" not in df:
        return pd.DataFrame(columns=["mes", "cantidad"])
    tmp = df.dropna(subset=["creado_en"]).copy()
    if tmp.empty:
        return pd.DataFrame(columns=["mes", "cantidad"])
    tmp["mes"] = tmp["creado_en"].dt.to_period("M").astype(str)
    return tmp.groupby("mes").size().reset_index(name="cantidad")


def seguimientos_pendientes(df: pd.DataFrame, dias: int = 7) -> pd.DataFrame:
    """Negocios abiertos con próxima acción vencida o a `dias` días de vencer."""
    if df.empty or "fecha_proxima_accion" not in df:
        return df
    limite = pd.Timestamp(date.today()) + pd.Timedelta(days=dias)
    abiertos = df[~df["etapa"].isin(ETAPAS_CERRADAS)]
    pendientes = abiertos[
        abiertos["fecha_proxima_accion"].notna() & (abiertos["fecha_proxima_accion"] <= limite)
    ]
    return pendientes.sort_values("fecha_proxima_accion")


def top_negocios(df: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    if df.empty:
        return df
    abiertos = df[~df["etapa"].isin(ETAPAS_CERRADAS)]
    return abiertos.sort_values("valor_estimado", ascending=False).head(n)
