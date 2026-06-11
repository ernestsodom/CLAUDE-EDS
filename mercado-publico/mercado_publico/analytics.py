"""Filtros potentes y agregaciones para dashboards y gráficos."""

from __future__ import annotations

from typing import Any

import pandas as pd

from .perfil import COMPETIDORES, PALABRAS_CLAVE_TI, RUBROS_OBJETIVO
from .rubros import RUBROS


def a_dataframe(registros: list[dict[str, Any]]) -> pd.DataFrame:
    """Convierte los registros cacheados en un DataFrame tipado."""
    df = pd.DataFrame(registros)
    if df.empty:
        return df

    for col in ("monto_estimado", "monto_adjudicado", "n_oferentes", "n_items",
                "es_municipalidad", "ganada_proexsi"):
        if col in df:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in ("fecha_publicacion", "fecha_cierre", "fecha_adjudicacion",
                "fecha_termino_contrato"):
        if col in df:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df


def filtrar(
    df: pd.DataFrame,
    texto: str | None = None,
    rubros: list[str] | None = None,
    estados: list[str] | None = None,
    regiones: list[str] | None = None,
    compradores: list[str] | None = None,
    monto_min: float | None = None,
    monto_max: float | None = None,
    fecha_desde: Any = None,
    fecha_hasta: Any = None,
    solo_municipalidades: bool = False,
    solo_perfil_ti: bool = False,
    competidores: list[str] | None = None,
    proveedor: str | None = None,
) -> pd.DataFrame:
    """Aplica filtros combinados sobre el DataFrame de licitaciones."""
    if df.empty:
        return df
    out = df

    if solo_municipalidades and "es_municipalidad" in out:
        out = out[out["es_municipalidad"].fillna(0) == 1]

    if solo_perfil_ti:
        # Licitaciones del perfil Proexsi: rubros TI o palabras clave de software/hardware.
        def es_perfil(row: pd.Series) -> bool:
            segs = set(str(row.get("rubros", "")).split(","))
            if segs & set(RUBROS_OBJETIVO):
                return True
            texto = f"{row.get('nombre','')} {row.get('descripcion','')}".lower()
            return any(p in texto for p in PALABRAS_CLAVE_TI)

        out = out[out.apply(es_perfil, axis=1)]

    if competidores and "competidor" in out:
        out = out[out["competidor"].isin(competidores)]

    if proveedor and "proveedores_adjudicados" in out:
        p = proveedor.lower()
        out = out[
            out["proveedores_adjudicados"].astype(str).str.lower().str.contains(p, na=False)
            | out["proveedor_adjudicado"].astype(str).str.lower().str.contains(p, na=False)
        ]

    if texto:
        t = texto.lower()
        campos = ["nombre", "descripcion", "comprador", "codigo", "unidad_compra"]
        mask = pd.Series(False, index=out.index)
        for c in campos:
            if c in out:
                mask |= out[c].astype(str).str.lower().str.contains(t, na=False)
        out = out[mask]

    if rubros:
        # Coincide si cualquiera de los segmentos seleccionados está en la lista
        # de rubros (campo "rubros" es CSV de segmentos de 2 dígitos).
        def tiene_rubro(valor: Any) -> bool:
            segs = set(str(valor).split(",")) if valor else set()
            return bool(segs & set(rubros))

        out = out[out["rubros"].apply(tiene_rubro)]

    if estados and "estado" in out:
        out = out[out["estado"].isin(estados)]

    if regiones and "region" in out:
        out = out[out["region"].isin(regiones)]

    if compradores and "comprador" in out:
        out = out[out["comprador"].isin(compradores)]

    if monto_min is not None and "monto_estimado" in out:
        out = out[out["monto_estimado"].fillna(0) >= monto_min]

    if monto_max is not None and "monto_estimado" in out:
        out = out[out["monto_estimado"].fillna(0) <= monto_max]

    if fecha_desde is not None and "fecha_publicacion" in out:
        out = out[out["fecha_publicacion"] >= pd.Timestamp(fecha_desde)]

    if fecha_hasta is not None and "fecha_publicacion" in out:
        out = out[out["fecha_publicacion"] <= pd.Timestamp(fecha_hasta)]

    return out


# ---------------------------------------------------------------------- #
# Agregaciones para gráficos
# ---------------------------------------------------------------------- #
def kpis(df: pd.DataFrame) -> dict[str, Any]:
    """Indicadores clave para las tarjetas del dashboard."""
    if df.empty:
        return {"total": 0, "monto_total": 0, "desiertas": 0, "adjudicadas": 0}
    return {
        "total": len(df),
        "monto_total": float(df.get("monto_estimado", pd.Series(dtype=float)).fillna(0).sum()),
        "desiertas": int((df["estado"] == "Desierta").sum()) if "estado" in df else 0,
        "adjudicadas": int((df["estado"] == "Adjudicada").sum()) if "estado" in df else 0,
        "compradores_unicos": int(df["comprador"].nunique()) if "comprador" in df else 0,
    }


def por_estado(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "estado" not in df:
        return pd.DataFrame(columns=["estado", "cantidad"])
    return (
        df.groupby("estado").size().reset_index(name="cantidad").sort_values("cantidad", ascending=False)
    )


def por_rubro(df: pd.DataFrame) -> pd.DataFrame:
    """Cantidad de licitaciones por rubro (un registro puede contar en varios)."""
    if df.empty or "rubros" not in df:
        return pd.DataFrame(columns=["rubro", "cantidad"])
    filas: list[str] = []
    for valor in df["rubros"].dropna():
        for seg in str(valor).split(","):
            if seg:
                filas.append(RUBROS.get(seg, f"Rubro {seg}"))
    if not filas:
        return pd.DataFrame(columns=["rubro", "cantidad"])
    s = pd.Series(filas).value_counts().reset_index()
    s.columns = ["rubro", "cantidad"]
    return s


def por_region(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "region" not in df:
        return pd.DataFrame(columns=["region", "cantidad"])
    return (
        df.groupby("region").size().reset_index(name="cantidad").sort_values("cantidad", ascending=False)
    )


def top_compradores(df: pd.DataFrame, n: int = 15) -> pd.DataFrame:
    """Ranking de organismos compradores (clientes) por monto y cantidad."""
    if df.empty or "comprador" not in df:
        return pd.DataFrame(columns=["comprador", "cantidad", "monto_total"])
    g = df.groupby("comprador").agg(
        cantidad=("codigo", "count"),
        monto_total=("monto_estimado", "sum"),
    ).reset_index()
    return g.sort_values("monto_total", ascending=False).head(n)


def evolucion_temporal(df: pd.DataFrame) -> pd.DataFrame:
    """Cantidad de licitaciones publicadas por mes."""
    if df.empty or "fecha_publicacion" not in df:
        return pd.DataFrame(columns=["mes", "cantidad"])
    tmp = df.dropna(subset=["fecha_publicacion"]).copy()
    if tmp.empty:
        return pd.DataFrame(columns=["mes", "cantidad"])
    tmp["mes"] = tmp["fecha_publicacion"].dt.to_period("M").astype(str)
    return tmp.groupby("mes").size().reset_index(name="cantidad")


def compras_similares(
    df: pd.DataFrame, codigo: str, top: int = 10
) -> pd.DataFrame:
    """
    Busca licitaciones similares a una dada por coincidencia de rubros y texto.
    Útil para revisar 'compras similares anteriores'.
    """
    if df.empty or "codigo" not in df:
        return df
    fila = df[df["codigo"] == codigo]
    if fila.empty:
        return df.head(0)
    base = fila.iloc[0]
    base_rubros = set(str(base.get("rubros", "")).split(","))
    palabras = set(str(base.get("nombre", "")).lower().split())

    def score(row: pd.Series) -> float:
        if row["codigo"] == codigo:
            return -1.0
        r = set(str(row.get("rubros", "")).split(",")) & base_rubros
        p = palabras & set(str(row.get("nombre", "")).lower().split())
        return len(r) * 2 + len(p)

    tmp = df.copy()
    tmp["similitud"] = tmp.apply(score, axis=1)
    return tmp[tmp["similitud"] > 0].sort_values("similitud", ascending=False).head(top)


# ---------------------------------------------------------------------- #
# Inteligencia comercial (Proexsi)
# ---------------------------------------------------------------------- #
def por_competidor(df: pd.DataFrame) -> pd.DataFrame:
    """Ranking de competidores por licitaciones adjudicadas y monto."""
    if df.empty or "competidor" not in df:
        return pd.DataFrame(columns=["competidor", "adjudicadas", "monto_total"])
    comp = df[df["competidor"].astype(str).str.len() > 0]
    if comp.empty:
        return pd.DataFrame(columns=["competidor", "adjudicadas", "monto_total"])
    g = comp.groupby("competidor").agg(
        adjudicadas=("codigo", "count"),
        monto_total=("monto_adjudicado", "sum"),
    ).reset_index()
    return g.sort_values("monto_total", ascending=False)


def licitaciones_de_competidor(df: pd.DataFrame, nombre: str) -> pd.DataFrame:
    """Todas las licitaciones adjudicadas a un competidor concreto."""
    if df.empty or "competidor" not in df:
        return df.head(0)
    return df[df["competidor"] == nombre].sort_values(
        "fecha_adjudicacion", ascending=False, na_position="last"
    )


def ultimo_adjudicado(df: pd.DataFrame, codigo: str, top: int = 5) -> dict[str, Any]:
    """
    Para una licitación, devuelve el último proveedor que ganó un servicio similar
    (y un pequeño historial), clave para negociar/posicionarse.
    """
    similares = compras_similares(df, codigo, top=50)
    adj = similares[
        (similares.get("estado") == "Adjudicada")
        & (similares["proveedor_adjudicado"].astype(str).str.len() > 0)
    ] if not similares.empty else similares
    if adj.empty:
        return {"ultimo": None, "historial": adj}
    adj = adj.sort_values("fecha_adjudicacion", ascending=False, na_position="last")
    fila = adj.iloc[0]
    return {
        "ultimo": {
            "proveedor": fila.get("proveedor_adjudicado"),
            "competidor": fila.get("competidor") or "—",
            "monto": fila.get("monto_adjudicado"),
            "comprador": fila.get("comprador"),
            "codigo": fila.get("codigo"),
            "fecha": fila.get("fecha_adjudicacion"),
        },
        "historial": adj.head(top),
    }


def contratos_por_terminar(df: pd.DataFrame, dias: int = 180) -> pd.DataFrame:
    """
    Licitaciones adjudicadas cuyo contrato termina dentro de `dias` (o ya venció
    hace poco): oportunidades de relicitación / renovación.
    """
    if df.empty or "fecha_termino_contrato" not in df:
        return df.head(0)
    hoy = pd.Timestamp.now().normalize()
    limite = hoy + pd.Timedelta(days=dias)
    tmp = df.dropna(subset=["fecha_termino_contrato"]).copy()
    if tmp.empty:
        return tmp
    # Desde 30 días atrás (recién vencidos) hasta el límite futuro.
    mask = (tmp["fecha_termino_contrato"] >= hoy - pd.Timedelta(days=30)) & (
        tmp["fecha_termino_contrato"] <= limite
    )
    out = tmp[mask].copy()
    out["dias_para_terminar"] = (out["fecha_termino_contrato"] - hoy).dt.days
    return out.sort_values("dias_para_terminar")


def resumen_competencia(df: pd.DataFrame) -> dict[str, Any]:
    """KPIs de la pestaña de competencia."""
    nombres = [c.nombre for c in COMPETIDORES]
    comp = df[df["competidor"].isin(nombres)] if "competidor" in df else df.head(0)
    return {
        "competidores_activos": int(comp["competidor"].nunique()) if not comp.empty else 0,
        "licitaciones_competencia": len(comp),
        "monto_competencia": float(comp.get("monto_adjudicado", pd.Series(dtype=float)).fillna(0).sum()),
    }
