"""
Panel Comercial — CRM simple para monitorear clientes y negocios.

Ejecutar con:  streamlit run app.py
"""

from __future__ import annotations

import pandas as pd
import plotly.express as px
import streamlit as st

from panel_comercial import analytics, export, storage
from panel_comercial.config import ETAPAS, MONEDAS
from panel_comercial.models import Negocio

st.set_page_config(
    page_title="Panel Comercial",
    page_icon="💼",
    layout="wide",
)


# --------------------------------------------------------------------- #
# Formulario nuevo / editar
# --------------------------------------------------------------------- #
def vista_formulario(df: pd.DataFrame) -> None:
    st.subheader("➕ Nuevo negocio")
    modo_editar = st.checkbox("Editar un negocio existente", value=False)

    base: dict = {}
    negocio_id = ""
    if modo_editar and not df.empty:
        opciones = {f"{r['cliente']} — {r['negocio'] or '(sin título)'} ({r['id']})": r["id"] for _, r in df.iterrows()}
        etiqueta = st.selectbox("Selecciona el negocio", list(opciones.keys()))
        negocio_id = opciones[etiqueta]
        base = storage.obtener_negocio(negocio_id) or {}
    elif modo_editar:
        st.info("Todavía no hay negocios para editar.")

    with st.form("form_negocio", clear_on_submit=not modo_editar):
        c1, c2 = st.columns(2)
        cliente = c1.text_input("Cliente / empresa *", value=base.get("cliente", ""))
        negocio_nombre = c2.text_input("Negocio / oportunidad", value=base.get("negocio", ""))

        c3, c4, c5 = st.columns(3)
        contacto = c3.text_input("Persona de contacto", value=base.get("contacto", ""))
        email = c4.text_input("Email", value=base.get("email", ""))
        telefono = c5.text_input("Teléfono", value=base.get("telefono", ""))

        c6, c7, c8 = st.columns(3)
        valor = c6.number_input("Valor estimado", min_value=0.0, value=float(base.get("valor_estimado") or 0.0), step=1000.0)
        moneda = c7.selectbox("Moneda", MONEDAS, index=MONEDAS.index(base.get("moneda", "CLP")) if base.get("moneda") in MONEDAS else 0)
        etapa = c8.selectbox("Etapa", ETAPAS, index=ETAPAS.index(base.get("etapa", "Nuevo")) if base.get("etapa") in ETAPAS else 0)

        c9, c10 = st.columns(2)
        fuente = c9.text_input("Fuente (referido, web, licitación…)", value=base.get("fuente", ""))
        probabilidad = c10.slider("Probabilidad de cierre (%)", 0, 100, int(base.get("probabilidad") or 0))

        c11, c12 = st.columns(2)
        fecha_cierre = c11.text_input("Fecha de cierre estimada (YYYY-MM-DD)", value=str(base.get("fecha_cierre_estimada") or ""))
        fecha_accion = c12.text_input("Fecha próxima acción (YYYY-MM-DD)", value=str(base.get("fecha_proxima_accion") or ""))

        proxima_accion = st.text_input("Próxima acción", value=base.get("proxima_accion", ""))
        notas = st.text_area("Notas", value=base.get("notas", ""))

        guardar = st.form_submit_button("💾 Guardar negocio", type="primary")
        if guardar:
            if not cliente:
                st.error("El campo Cliente / empresa es obligatorio.")
            else:
                n = Negocio(
                    id=negocio_id,
                    cliente=cliente,
                    negocio=negocio_nombre,
                    contacto=contacto,
                    email=email,
                    telefono=telefono,
                    valor_estimado=valor,
                    moneda=moneda,
                    etapa=etapa,
                    probabilidad=probabilidad,
                    fuente=fuente,
                    fecha_cierre_estimada=fecha_cierre,
                    proxima_accion=proxima_accion,
                    fecha_proxima_accion=fecha_accion,
                    notas=notas,
                )
                storage.guardar_negocio(n)
                st.success(f"Negocio guardado: {n.cliente} ({n.id})")
                st.rerun()

    if modo_editar and negocio_id:
        if st.button("🗑️ Eliminar este negocio"):
            storage.eliminar_negocio(negocio_id)
            st.success("Negocio eliminado.")
            st.rerun()


# --------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------- #
def vista_dashboard(df: pd.DataFrame) -> None:
    k = analytics.kpis(df)
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Negocios abiertos", k["abiertos"])
    c2.metric("Valor en pipeline", f"$ {k['valor_pipeline']:,.0f}")
    c3.metric("Valor ponderado", f"$ {k['valor_ponderado']:,.0f}")
    c4.metric("Ganados", k["ganados"], f"$ {k['valor_ganado']:,.0f}")
    c5.metric("Tasa de conversión", f"{k['tasa_conversion']:.0f}%")
    c6.metric("Seguimientos vencidos", k["seguimientos_vencidos"])

    if df.empty:
        st.info("Todavía no hay negocios registrados. Agrega el primero en la pestaña **➕ Nuevo / Editar**.")
        return

    col1, col2 = st.columns(2)
    etapa_df = analytics.por_etapa(df)
    col1.plotly_chart(
        px.bar(etapa_df, x="etapa", y="cantidad", title="Negocios por etapa (embudo)"),
        use_container_width=True,
    )
    fuente_df = analytics.por_fuente(df)
    if not fuente_df.empty:
        col2.plotly_chart(
            px.pie(fuente_df, names="fuente", values="cantidad", title="Por fuente"),
            use_container_width=True,
        )

    col3, col4 = st.columns(2)
    evo = analytics.evolucion_temporal(df)
    if not evo.empty:
        col3.plotly_chart(
            px.line(evo, x="mes", y="cantidad", markers=True, title="Negocios creados por mes"),
            use_container_width=True,
        )
    valor_etapa = etapa_df[etapa_df["valor"] > 0]
    if not valor_etapa.empty:
        col4.plotly_chart(
            px.bar(valor_etapa, x="etapa", y="valor", title="Valor estimado por etapa"),
            use_container_width=True,
        )

    st.subheader("⏰ Seguimientos pendientes (próximos 7 días o vencidos)")
    pend = analytics.seguimientos_pendientes(df)
    if pend.empty:
        st.success("No hay seguimientos pendientes ni vencidos. 🎉")
    else:
        cols = ["cliente", "negocio", "etapa", "proxima_accion", "fecha_proxima_accion", "contacto", "email"]
        st.dataframe(pend[[c for c in cols if c in pend.columns]], use_container_width=True)

    st.subheader("🏆 Top negocios abiertos por valor")
    top = analytics.top_negocios(df)
    cols = ["cliente", "negocio", "etapa", "valor_estimado", "moneda", "probabilidad"]
    st.dataframe(top[[c for c in cols if c in top.columns]], use_container_width=True)


# --------------------------------------------------------------------- #
# Tablero (kanban simple)
# --------------------------------------------------------------------- #
def vista_tablero(df: pd.DataFrame) -> None:
    st.subheader("🗂️ Tablero por etapa")
    if df.empty:
        st.info("Sin negocios registrados.")
        return

    columnas = st.columns(len(ETAPAS))
    for col, etapa in zip(columnas, ETAPAS):
        with col:
            subset = df[df["etapa"] == etapa]
            st.markdown(f"**{etapa}** ({len(subset)})")
            for _, fila in subset.iterrows():
                with st.container(border=True):
                    st.markdown(f"**{fila['cliente']}**")
                    if fila.get("negocio"):
                        st.caption(fila["negocio"])
                    st.caption(f"{fila['moneda']} {fila['valor_estimado']:,.0f} · {fila['probabilidad']:.0f}%")
                    nueva_etapa = st.selectbox(
                        "Etapa", ETAPAS, index=ETAPAS.index(etapa),
                        key=f"mover-{fila['id']}", label_visibility="collapsed",
                    )
                    if nueva_etapa != etapa:
                        n = Negocio.from_dict(storage.obtener_negocio(fila["id"]))
                        n.etapa = nueva_etapa
                        storage.guardar_negocio(n)
                        st.rerun()


# --------------------------------------------------------------------- #
# Tabla / exportar
# --------------------------------------------------------------------- #
def vista_tabla(df: pd.DataFrame) -> None:
    st.subheader("📋 Tabla de negocios")
    cols = [
        "cliente", "negocio", "contacto", "email", "telefono",
        "valor_estimado", "moneda", "etapa", "probabilidad", "fuente",
        "fecha_cierre_estimada", "proxima_accion", "fecha_proxima_accion", "notas", "id",
    ]
    cols = [c for c in cols if c in df.columns]
    st.dataframe(df[cols], use_container_width=True, height=500)

    st.subheader("⬇️ Exportar")
    c1, c2 = st.columns(2)
    c1.download_button(
        "Descargar CSV", export.a_csv(df[cols]),
        file_name="negocios.csv", mime="text/csv",
    )
    c2.download_button(
        "Descargar Excel", export.a_excel(df[cols]),
        file_name="negocios.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# --------------------------------------------------------------------- #
# Filtros compartidos
# --------------------------------------------------------------------- #
def panel_filtros(df: pd.DataFrame) -> pd.DataFrame:
    st.sidebar.subheader("🔎 Filtros")
    texto = st.sidebar.text_input("Buscar (cliente, negocio, contacto, notas)")
    etapas_sel = st.sidebar.multiselect("Etapa", ETAPAS)
    fuentes = sorted(df["fuente"].dropna().replace("", pd.NA).dropna().unique()) if "fuente" in df and not df.empty else []
    fuentes_sel = st.sidebar.multiselect("Fuente", fuentes)
    return analytics.filtrar(df, texto=texto or None, etapas=etapas_sel or None, fuentes=fuentes_sel or None)


def main() -> None:
    storage.init_db()
    st.sidebar.title("💼 Panel Comercial")
    st.sidebar.caption("Monitorea tus clientes y negocios en un solo lugar")
    st.sidebar.metric("Negocios registrados", storage.contar_negocios())
    st.sidebar.divider()

    st.title("Panel Comercial")
    df = analytics.a_dataframe(storage.cargar_negocios())
    df_filtrado = panel_filtros(df)
    st.caption(f"Mostrando {len(df_filtrado)} de {len(df)} negocios según los filtros aplicados.")

    tab1, tab2, tab3, tab4 = st.tabs(
        ["📈 Dashboard", "🗂️ Tablero", "➕ Nuevo / Editar", "📋 Tabla / Exportar"]
    )
    with tab1:
        vista_dashboard(df_filtrado)
    with tab2:
        vista_tablero(df_filtrado)
    with tab3:
        vista_formulario(df)
    with tab4:
        vista_tabla(df_filtrado)


if __name__ == "__main__":
    main()
