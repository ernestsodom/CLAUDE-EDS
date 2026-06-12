"""
Dashboard del motor de prospección Xperticket (Streamlit).

Ejecutar:  streamlit run app.py
"""

from __future__ import annotations

# En Streamlit Community Cloud el directorio de trabajo es la raíz del repo, por
# lo que aseguramos que la carpeta de este archivo (que contiene el paquete
# `xperticket`) esté en el path, sin importar desde dónde se ejecute.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import streamlit as st

from xperticket import analytics, discovery, export, pipeline, storage
from xperticket.config import settings

st.set_page_config(page_title="Xperticket · Prospección", page_icon="🎟️", layout="wide")


# --------------------------------------------------------------------------- #
# Datos
# --------------------------------------------------------------------------- #
def cargar_df() -> pd.DataFrame:
    return analytics.analisis_df(storage.cargar_analisis())


st.title("🎟️ Xperticket — Motor de Inteligencia & Prospección")

# --------------------------------------------------------------------------- #
# Sidebar
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.header("Datos")
    st.metric("Prospectos", storage.contar_prospectos())
    st.metric("Con análisis", storage.contar_analisis())
    st.caption(f"Claude: {'✅' if settings.claude_disponible else '— (plantilla)'} · "
               f"1 UF ≈ US$ {settings.uf_to_usd:.0f}")

    st.divider()
    st.subheader("1 · Descubrir")
    if st.button("Cargar dataset semilla"):
        n = discovery.sembrar()
        st.success(f"{n} prospectos semilla cargados.")
        st.rerun()

    archivo = st.file_uploader("Importar tu lista (CSV)", type=["csv"])
    if archivo is not None and st.button("Importar CSV"):
        import csv
        import io

        texto = archivo.getvalue().decode("utf-8-sig")
        filas = list(csv.DictReader(io.StringIO(texto)))
        n = discovery.importar_filas(filas, fuente=f"upload:{archivo.name}")
        st.success(f"{n} prospectos importados.")
        st.rerun()

    st.divider()
    st.subheader("2-5 · Analizar")
    comision = st.slider("Comisión Xperticket (%)", 2.0, 5.0, 3.0, 0.5)
    usar_claude = st.checkbox("Narrativa con Claude", value=False,
                              disabled=not settings.claude_disponible)
    forzar = st.checkbox("Forzar re-análisis", value=False)
    if st.button("▶ Analizar todos", type="primary"):
        barra = st.progress(0.0, text="Iniciando…")

        def cb(p: float, txt: str) -> None:
            barra.progress(min(p, 1.0), text=txt)

        res = pipeline.analizar_todos(
            comision_xperticket_pct=comision, usar_claude=usar_claude,
            forzar=forzar, progreso=cb,
        )
        st.success(
            f"Analizados: {res['analizados']} · Saltados: {res['saltados_por_frescura']}"
        )
        st.rerun()

df = cargar_df()

if df.empty:
    st.info(
        "No hay análisis todavía. En la barra lateral: **Cargar dataset semilla** "
        "(o importar tu CSV) y luego **Analizar todos**."
    )
    st.stop()

# --------------------------------------------------------------------------- #
# Tabs
# --------------------------------------------------------------------------- #
tab_dash, tab_tabla, tab_ficha, tab_export = st.tabs(
    ["📊 Dashboard", "📋 Ranking / Tabla", "🔎 Ficha & Propuesta", "⬇️ Exportar"]
)

with tab_dash:
    k = analytics.kpis(df)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Prospectos analizados", k["prospectos"])
    c2.metric("ROI total estimado", f"US$ {k['roi_total_usd']:,.0f}")
    c3.metric("Ahorro comisiones", f"{k['ahorro_total_uf']:,.0f} UF")
    c4.metric("Score medio", k["score_medio"])

    st.divider()
    cols = st.columns(2)
    with cols[0]:
        st.subheader("ROI por tipo de cliente")
        por_tipo = analytics.resumen_por(df, "tipo")
        if not por_tipo.empty:
            st.bar_chart(por_tipo.set_index("tipo")["roi_usd_total"])
            st.dataframe(por_tipo, use_container_width=True, hide_index=True)
    with cols[1]:
        st.subheader("Prospectos por región")
        por_region = analytics.resumen_por(df, "region")
        if not por_region.empty:
            st.bar_chart(por_region.set_index("region")["prospectos"])
            st.dataframe(por_region, use_container_width=True, hide_index=True)

    st.subheader("Ticketeras detectadas")
    tick = df["ticketera"].fillna("Desconocida").value_counts()
    st.bar_chart(tick)

with tab_tabla:
    f1, f2, f3 = st.columns([2, 2, 1])
    tipos = f1.multiselect("Tipo", sorted(df["tipo"].dropna().unique()))
    regiones = f2.multiselect("Región", sorted(df["region"].dropna().unique()))
    score_min = f3.slider("Score mínimo", 0, 100, 0, 5)
    texto = st.text_input("Buscar por nombre")

    filtrado = analytics.filtrar(df, tipos=tipos or None, regiones=regiones or None,
                                 score_min=score_min, texto=texto or None)
    st.caption(f"{len(filtrado)} prospectos")
    st.dataframe(
        filtrado.drop(columns=["prospecto_id"], errors="ignore"),
        use_container_width=True, hide_index=True,
    )

with tab_ficha:
    nombres = df.sort_values("score", ascending=False)["prospecto"].tolist()
    elegido = st.selectbox("Prospecto", nombres)
    pid = df[df["prospecto"] == elegido]["prospecto_id"].iloc[0]
    payload = storage.obtener_analisis(pid)
    if payload:
        web = payload["web_intel"]
        fin = payload["finanzas"]
        prop = payload["propuesta"]
        con = payload["contacto"]

        c1, c2, c3 = st.columns(3)
        c1.metric("Score", con.get("score"), help=str(con.get("score_desglose")))
        c2.metric("ROI anual", f"US$ {fin.get('roi_estimado_anual_usd'):,.0f}")
        c3.metric("Ahorro comisiones", f"{fin.get('ahorro_comisiones_anual_uf'):,.0f} UF/año")

        c4, c5, c6 = st.columns(3)
        c4.metric("Ticketera actual", web.get("ticketera_actual"))
        c5.metric("Comisión actual", f"{fin.get('comision_actual_pct')}%")
        c6.metric("Payback", f"{fin.get('payback_meses')} meses")

        st.subheader("Pain points detectados")
        for d in web.get("pain_points_detectados", []):
            st.markdown(f"- {d}")

        st.subheader("Propuesta Xperticket")
        for o in prop.get("propuesta_xperticket", []):
            st.markdown(f"- ✓ {o}")

        st.subheader(f"Email de contacto ({prop.get('fuente_narrativa')})")
        st.code(prop.get("narrativa_email", ""), language="text")

        with st.expander("Plan de contacto y más templates"):
            st.json(con.get("estrategia_contacto", {}))
            st.markdown("**Contactos identificados**")
            st.json(con.get("contactos_identificados", []))
            st.markdown("**Email follow-up**")
            st.code(con.get("templates", {}).get("email_followup", ""), language="text")
            st.markdown("**Guion de llamada**")
            st.code(con.get("templates", {}).get("guion_llamada", ""), language="text")

with tab_export:
    st.write("Descarga los datos para usarlos manualmente o en Google Sheets.")
    st.download_button(
        "⬇️ Análisis (CSV)", export.a_csv(df), "xperticket_analisis.csv", "text/csv"
    )
    st.download_button(
        "⬇️ Análisis completo (JSON)",
        export.a_json(storage.cargar_analisis()),
        "xperticket_analisis.json",
        "application/json",
    )
    st.download_button(
        "⬇️ Prospectos (CSV)",
        export.a_csv(analytics.prospectos_df(storage.cargar_prospectos())),
        "xperticket_prospectos.csv",
        "text/csv",
    )
