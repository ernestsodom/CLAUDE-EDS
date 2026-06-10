"""Filtros potentes y agregaciones para dashboards y gráficos."""

from __future__ import annotations

from typing import Any

import pandas as pd

from .rubros import RUBROS


def a_dataframe(registros: list[dict[str, Any]]) -> pd.DataFrame:
    """Convierte los registros cacheados en un DataFrame tipado."""
    df = pd.DataFrame(registros)
    if df.empty:
        return df

    for col in ("monto_estimado", "monto_adjudicado", "n_oferentes", "n_items"):
        if col in df:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in ("fecha_publicacion", "fecha_cierre", "fecha_adjudicacion"):
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
) -> pd.DataFrame:
    """Aplica filtros combinados sobre el DataFrame de licitaciones."""
    if df.empty:
        return df
    out = df

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
