"""
Dashboard de Licitaciones de Mercado Público.

Ejecutar con:  streamlit run app.py
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import plotly.express as px
import streamlit as st

from mercado_publico import analytics, export, storage
from mercado_publico.config import settings
from mercado_publico.api_client import ESTADOS_FILTRO
from mercado_publico.rubros import opciones_rubros, RUBROS
from mercado_publico.service import (
    detalle_completo,
    sincronizar_licitaciones,
    verificar_ticket,
)

st.set_page_config(
    page_title="Licitaciones · Mercado Público",
    page_icon="📊",
    layout="wide",
)


# --------------------------------------------------------------------- #
# Estado / conexión del usuario
# --------------------------------------------------------------------- #
def ticket_actual() -> str:
    return st.session_state.get("ticket") or storage.get_pref("ticket") or settings.ticket


def sidebar() -> None:
    st.sidebar.title("📊 Mercado Público")
    st.sidebar.caption("Consulta y análisis de licitaciones")

    with st.sidebar.expander("🔑 Conectar mi usuario", expanded=False):
        st.write(
            "Pega tu **ticket** de la API de Mercado Público. "
            "Lo obtienes gratis en el portal de desarrolladores."
        )
        ticket_in = st.text_input(
            "Ticket API", value=ticket_actual(), type="password"
        )
        col1, col2 = st.columns(2)
        if col1.button("Verificar"):
            ok, msg = verificar_ticket(ticket_in)
            (st.success if ok else st.error)(msg)
        if col2.button("Guardar"):
            storage.set_pref("ticket", ticket_in)
            st.session_state["ticket"] = ticket_in
            st.success("Ticket guardado.")
        if settings.usando_demo and ticket_in == settings.ticket:
            st.info("Usando ticket de demostración (cuota muy limitada).")

    st.sidebar.divider()
    st.sidebar.subheader("⬇️ Sincronizar datos")
    hoy = date.today()
    desde = st.sidebar.date_input("Desde", hoy - timedelta(days=7))
    hasta = st.sidebar.date_input("Hasta", hoy)
    estado_sync = st.sidebar.selectbox(
        "Estado", ["(todos)"] + ESTADOS_FILTRO, index=0
    )
    enriquecer = st.sidebar.checkbox(
        "Descargar detalle (rubros, montos, comprador)", value=True
    )
    limite = st.sidebar.number_input(
        "Máx. detalles", 50, 2000, 400, step=50,
        help="Tope de licitaciones a enriquecer para proteger la cuota de la API.",
    )

    if st.sidebar.button("🔄 Sincronizar", type="primary"):
        barra = st.sidebar.progress(0.0, text="Iniciando…")

        def cb(p: float, txt: str) -> None:
            barra.progress(min(p, 1.0), text=txt)

        try:
            res = sincronizar_licitaciones(
                desde=desde,
                hasta=hasta,
                estado=None if estado_sync == "(todos)" else estado_sync,
                enriquecer=enriquecer,
                limite_detalle=int(limite),
                progreso=cb,
                ticket=ticket_actual(),
            )
            st.sidebar.success(
                f"Encontradas {res['encontradas']} · "
                f"Detalle {res['detalles_descargados']} · "
                f"Caché total {res['total_en_cache']}"
            )
        except Exception as exc:  # noqa: BLE001
            st.sidebar.error(f"Error: {exc}")

    st.sidebar.divider()
    st.sidebar.metric("Licitaciones en caché", storage.contar())


# --------------------------------------------------------------------- #
# Filtros
# --------------------------------------------------------------------- #
def panel_filtros(df: pd.DataFrame) -> pd.DataFrame:
    st.subheader("🔎 Filtros")
    c1, c2, c3 = st.columns(3)

    texto = c1.text_input("Buscar (nombre, comprador, código)")

    rubros_opts = opciones_rubros()
    rubros_sel = c1.multiselect(
        "Rubros", options=[c for c, _ in rubros_opts],
        format_func=lambda c: dict(rubros_opts)[c],
    )

    estados = sorted(df["estado"].dropna().unique()) if "estado" in df else []
    estados_sel = c2.multiselect("Estado", estados)

    regiones = sorted(df["region"].dropna().unique()) if "region" in df else []
    regiones_sel = c2.multiselect("Región", regiones)

    compradores = sorted(df["comprador"].dropna().unique()) if "comprador" in df else []
    compradores_sel = c3.multiselect("Comprador (cliente)", compradores)

    monto_max_data = float(df["monto_estimado"].fillna(0).max()) if "monto_estimado" in df and not df.empty else 0.0
    rango = c3.slider(
        "Monto estimado (CLP)",
        0.0, max(monto_max_data, 1.0),
        (0.0, max(monto_max_data, 1.0)),
    ) if monto_max_data > 0 else (None, None)

    return analytics.filtrar(
        df,
        texto=texto or None,
        rubros=rubros_sel or None,
        estados=estados_sel or None,
        regiones=regiones_sel or None,
        compradores=compradores_sel or None,
        monto_min=rango[0],
        monto_max=rango[1],
    )


# --------------------------------------------------------------------- #
# Vistas
# --------------------------------------------------------------------- #
def vista_dashboard(df: pd.DataFrame) -> None:
    k = analytics.kpis(df)
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Licitaciones", f"{k['total']:,}")
    c2.metric("Monto estimado", f"${k['monto_total']:,.0f}")
    c3.metric("Desiertas", k["desiertas"])
    c4.metric("Adjudicadas", k["adjudicadas"])
    c5.metric("Compradores", k.get("compradores_unicos", 0))

    if df.empty:
        st.info("Sin datos. Sincroniza licitaciones desde la barra lateral.")
        return

    col1, col2 = st.columns(2)
    estado_df = analytics.por_estado(df)
    if not estado_df.empty:
        col1.plotly_chart(
            px.pie(estado_df, names="estado", values="cantidad", title="Por estado"),
            use_container_width=True,
        )
    rubro_df = analytics.por_rubro(df)
    if not rubro_df.empty:
        col2.plotly_chart(
            px.bar(rubro_df.head(15), x="cantidad", y="rubro", orientation="h",
                   title="Top rubros"),
            use_container_width=True,
        )

    col3, col4 = st.columns(2)
    region_df = analytics.por_region(df)
    if not region_df.empty:
        col3.plotly_chart(
            px.bar(region_df, x="region", y="cantidad", title="Por región"),
            use_container_width=True,
        )
    evo = analytics.evolucion_temporal(df)
    if not evo.empty:
        col4.plotly_chart(
            px.line(evo, x="mes", y="cantidad", markers=True,
                    title="Evolución de publicaciones"),
            use_container_width=True,
        )

    st.subheader("🏢 Top compradores (clientes)")
    st.dataframe(analytics.top_compradores(df), use_container_width=True)


def vista_tabla(df: pd.DataFrame) -> None:
    st.subheader("📋 Tabla de licitaciones")
    cols = [
        "codigo", "nombre", "estado", "comprador", "region",
        "rubros_nombres", "monto_estimado", "monto_adjudicado",
        "n_oferentes", "fecha_publicacion", "fecha_cierre",
    ]
    cols = [c for c in cols if c in df.columns]
    st.dataframe(df[cols], use_container_width=True, height=500)

    st.subheader("⬇️ Exportar / vaciar información")
    c1, c2 = st.columns(2)
    c1.download_button(
        "Descargar CSV", export.a_csv(df[cols]),
        file_name="licitaciones.csv", mime="text/csv",
    )
    c2.download_button(
        "Descargar Excel", export.a_excel(df[cols]),
        file_name="licitaciones.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def vista_ficha(df: pd.DataFrame) -> None:
    st.subheader("🗂️ Ficha de licitación y compras similares")
    if df.empty:
        st.info("Sin datos cargados.")
        return
    codigos = df["codigo"].dropna().tolist()
    codigo = st.selectbox("Código de licitación", codigos)
    if not codigo:
        return

    fila = df[df["codigo"] == codigo].iloc[0]
    c1, c2, c3 = st.columns(3)
    c1.metric("Estado", fila.get("estado", "—"))
    c2.metric("Monto estimado", f"${(fila.get('monto_estimado') or 0):,.0f}")
    c3.metric("Oferentes", fila.get("n_oferentes") or "—")
    st.write(f"**{fila.get('nombre', '')}**")
    st.caption(
        f"Comprador: {fila.get('comprador', '—')} · Región: {fila.get('region', '—')} · "
        f"Rubros: {fila.get('rubros_nombres', '—')}"
    )

    if st.button("Ver detalle completo desde la API"):
        try:
            det = detalle_completo(codigo, ticket=ticket_actual())
            st.json(det)
        except Exception as exc:  # noqa: BLE001
            st.error(f"No se pudo obtener el detalle: {exc}")

    st.markdown("#### 🔁 Compras similares anteriores")
    similares = analytics.compras_similares(df, codigo)
    if similares.empty:
        st.info("No se encontraron licitaciones similares en el caché.")
    else:
        st.dataframe(
            similares[["codigo", "nombre", "estado", "comprador", "monto_estimado", "similitud"]],
            use_container_width=True,
        )


def vista_desiertas(df: pd.DataFrame) -> None:
    st.subheader("🏜️ Licitaciones desiertas")
    if "estado" not in df:
        st.info("Sin datos.")
        return
    des = df[df["estado"] == "Desierta"]
    st.metric("Total desiertas", len(des))
    if des.empty:
        st.info("No hay licitaciones desiertas en el caché. Sincroniza con estado 'desierta'.")
        return
    rubro_df = analytics.por_rubro(des)
    if not rubro_df.empty:
        st.plotly_chart(
            px.bar(rubro_df.head(15), x="cantidad", y="rubro", orientation="h",
                   title="Desiertas por rubro"),
            use_container_width=True,
        )
    cols = [c for c in ["codigo", "nombre", "comprador", "region", "rubros_nombres",
                        "monto_estimado", "fecha_cierre"] if c in des.columns]
    st.dataframe(des[cols], use_container_width=True)


# --------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------- #
def main() -> None:
    storage.init_db()
    sidebar()

    st.title("Licitaciones de Mercado Público")
    df = analytics.a_dataframe(storage.cargar_licitaciones())

    df = panel_filtros(df)
    st.caption(f"Mostrando {len(df)} licitaciones según los filtros aplicados.")

    tab1, tab2, tab3, tab4 = st.tabs(
        ["📈 Dashboard", "📋 Tabla / Exportar", "🗂️ Ficha & similares", "🏜️ Desiertas"]
    )
    with tab1:
        vista_dashboard(df)
    with tab2:
        vista_tabla(df)
    with tab3:
        vista_ficha(df)
    with tab4:
        vista_desiertas(df)


if __name__ == "__main__":
    main()
