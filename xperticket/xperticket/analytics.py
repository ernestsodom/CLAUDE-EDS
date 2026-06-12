"""Agregaciones y vistas tabulares (pandas) para dashboard y exportación."""

from __future__ import annotations

from typing import Any

import pandas as pd

from .models import COLUMNAS_PROSPECTO, Prospecto


def prospectos_df(prospectos: list[Prospecto]) -> pd.DataFrame:
    filas = [p.to_row() for p in prospectos]
    return pd.DataFrame(filas, columns=COLUMNAS_PROSPECTO)


def _fila_analisis(a: dict[str, Any]) -> dict[str, Any]:
    web = a.get("web_intel", {})
    fin = a.get("finanzas", {})
    con = a.get("contacto", {})
    prop = a.get("propuesta", {})
    return {
        "prioridad": con.get("prioridad"),
        "score": con.get("score"),
        "prospecto": a.get("prospecto"),
        "tipo": a.get("tipo"),
        "region": a.get("region"),
        "ciudad": a.get("ciudad"),
        "ticketera": web.get("ticketera_actual"),
        "comision_actual_pct": fin.get("comision_actual_pct"),
        "comision_xperticket_pct": fin.get("comision_xperticket_pct"),
        "volumen_anual": fin.get("volumen_estimado_anual"),
        "ingresos_anuales_uf": fin.get("ingresos_anuales_uf"),
        "ahorro_uf_anual": fin.get("ahorro_comisiones_anual_uf"),
        "roi_usd_anual": fin.get("roi_estimado_anual_usd"),
        "payback_meses": fin.get("payback_meses"),
        "fuente_datos": web.get("fuente_datos"),
        "narrativa": prop.get("fuente_narrativa"),
        "prospecto_id": a.get("prospecto_id"),
        "sitio_web": a.get("sitio_web"),
        "actualizado_en": a.get("_actualizado_en"),
    }


def analisis_df(analisis: list[dict[str, Any]]) -> pd.DataFrame:
    cols = [
        "prioridad", "score", "prospecto", "tipo", "region", "ciudad",
        "ticketera", "comision_actual_pct", "comision_xperticket_pct",
        "volumen_anual", "ingresos_anuales_uf", "ahorro_uf_anual",
        "roi_usd_anual", "payback_meses", "fuente_datos", "narrativa",
        "prospecto_id", "sitio_web", "actualizado_en",
    ]
    df = pd.DataFrame([_fila_analisis(a) for a in analisis], columns=cols)
    if not df.empty:
        df = df.sort_values("score", ascending=False, na_position="last")
    return df


def filtrar(
    df: pd.DataFrame,
    tipos: list[str] | None = None,
    regiones: list[str] | None = None,
    score_min: int | None = None,
    texto: str | None = None,
) -> pd.DataFrame:
    out = df
    if tipos:
        out = out[out["tipo"].isin(tipos)]
    if regiones:
        out = out[out["region"].isin(regiones)]
    if score_min is not None and "score" in out.columns:
        out = out[out["score"].fillna(0) >= score_min]
    if texto and "prospecto" in out.columns:
        out = out[out["prospecto"].str.contains(texto, case=False, na=False)]
    return out


def resumen_por(df: pd.DataFrame, columna: str) -> pd.DataFrame:
    """Agrega por una columna: nº de prospectos, score medio, ROI total."""
    if df.empty or columna not in df.columns:
        return pd.DataFrame()
    agg = (
        df.groupby(columna)
        .agg(
            prospectos=("prospecto", "count"),
            score_medio=("score", "mean"),
            roi_usd_total=("roi_usd_anual", "sum"),
            ahorro_uf_total=("ahorro_uf_anual", "sum"),
        )
        .reset_index()
        .sort_values("roi_usd_total", ascending=False)
    )
    agg["score_medio"] = agg["score_medio"].round(1)
    return agg


def kpis(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"prospectos": 0, "roi_total_usd": 0, "ahorro_total_uf": 0, "score_medio": 0}
    return {
        "prospectos": int(len(df)),
        "roi_total_usd": int(df["roi_usd_anual"].fillna(0).sum()),
        "ahorro_total_uf": int(df["ahorro_uf_anual"].fillna(0).sum()),
        "score_medio": round(float(df["score"].fillna(0).mean()), 1),
    }
