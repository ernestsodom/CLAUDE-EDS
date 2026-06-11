"""
Inteligencia de Licitaciones para Proexsi — Mercado Público.

Enfocado en municipalidades y rubro TI (software / hardware), con vigilancia de
competencia (CAS-Chile, SMC, Insico), compras similares, último proveedor
adjudicado y contratos por terminar.

Ejecutar con:  streamlit run app.py
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import plotly.express as px
import streamlit as st

from mercado_publico import analytics, bulk_import, export, ficha, ocds, storage
from mercado_publico.config import settings
from mercado_publico.api_client import ESTADOS_FILTRO
from mercado_publico.perfil import COMPETIDORES, PROEXSI, RUBROS_OBJETIVO
from mercado_publico.rubros import opciones_rubros, RUBROS
from mercado_publico.service import (
    detalle_completo,
    sincronizar_licitaciones,
    verificar_ticket,
)

st.set_page_config(
    page_title="Radar Licitaciones · Proexsi",
    page_icon="🎯",
    layout="wide",
)


def ticket_actual() -> str:
    return st.session_state.get("ticket") or storage.get_pref("ticket") or settings.ticket


# --------------------------------------------------------------------- #
# Barra lateral
# --------------------------------------------------------------------- #
def sidebar() -> None:
    st.sidebar.title("🎯 Radar Proexsi")
    st.sidebar.caption("Inteligencia comercial · Mercado Público")

    with st.sidebar.expander("🔑 Conectar mi usuario", expanded=False):
        ticket_in = st.text_input("Ticket API", value=ticket_actual(), type="password")
        c1, c2 = st.columns(2)
        if c1.button("Verificar"):
            ok, msg = verificar_ticket(ticket_in)
            (st.success if ok else st.error)(msg)
        if c2.button("Guardar"):
            storage.set_pref("ticket", ticket_in)
            st.session_state["ticket"] = ticket_in
            st.success("Ticket guardado.")
        if settings.usando_demo and ticket_in == settings.ticket:
            st.info("Usando ticket de demostración (cuota muy limitada).")

    st.sidebar.divider()
    st.sidebar.subheader("⬇️ Sincronizar")
    hoy = date.today()
    desde = st.sidebar.date_input("Desde", hoy - timedelta(days=14))
    hasta = st.sidebar.date_input("Hasta", hoy)
    estado_sync = st.sidebar.selectbox("Estado", ["(todos)"] + ESTADOS_FILTRO, index=0)
    limite = st.sidebar.number_input(
        "Máx. detalles", 50, 5000, 600, step=50,
        help="Tope de licitaciones a enriquecer (rubros, montos, adjudicación).",
    )
    with st.sidebar.expander("⚡ Velocidad de carga", expanded=False):
        rapida = st.toggle(
            "Carga rápida (sin detalle)", value=False,
            help="Vistazo instantáneo: sólo código, nombre, estado y cierre. "
                 "OJO: la API NO entrega comprador ni proveedor en este modo, así "
                 "que los filtros de municipalidad/competencia NO funcionan. Para "
                 "tener esos datos rápido, usa '📦 Importar histórico masivo'.",
        )
        workers = st.slider(
            "Descargas en paralelo", 1, 20, 8,
            help="Más hilos = más rápido. Con ticket propio puedes subirlo; "
                 "con el ticket demo, mantenlo bajo.",
        )
        incremental = st.toggle(
            "Saltar las ya cacheadas", value=True,
            help="Re-sincronizar es casi instantáneo: sólo baja las nuevas.",
        )

    if st.sidebar.button("🔄 Sincronizar", type="primary"):
        barra = st.sidebar.progress(0.0, text="Iniciando…")
        try:
            res = sincronizar_licitaciones(
                desde=desde, hasta=hasta,
                estado=None if estado_sync == "(todos)" else estado_sync,
                enriquecer=not rapida, limite_detalle=int(limite),
                workers=int(workers), saltar_cacheadas=incremental,
                progreso=lambda p, t: barra.progress(min(p, 1.0), text=t),
                ticket=ticket_actual(),
            )
            st.sidebar.success(
                f"Encontradas {res['encontradas']} · "
                f"Detalle {res['detalles_descargados']} · "
                f"Saltadas {res.get('omitidas_cache', 0)} · "
                f"Caché {res['total_en_cache']}"
            )
        except Exception as exc:  # noqa: BLE001
            st.sidebar.error(f"Error: {exc}")

    st.sidebar.divider()
    st.sidebar.subheader("📦 Importar histórico masivo")
    st.sidebar.caption(
        "Sube un CSV/ZIP mensual de [Datos Abiertos]"
        "(https://datos-abiertos.chilecompra.cl/descargas). "
        "Carga miles de licitaciones al instante."
    )
    archivo = st.sidebar.file_uploader(
        "Archivo de licitaciones (.csv / .zip)", type=["csv", "zip"]
    )
    if archivo is not None and st.sidebar.button("📥 Importar archivo"):
        barra = st.sidebar.progress(0.0, text="Importando…")
        try:
            res = bulk_import.importar(
                archivo.getvalue(),
                progreso=lambda p, t: barra.progress(min(p, 1.0), text=t),
            )
            st.sidebar.success(
                f"Importadas {res['licitaciones']:,} licitaciones "
                f"({res['filas']:,} filas) · Caché {res['total_en_cache']:,}"
            )
        except Exception as exc:  # noqa: BLE001
            st.sidebar.error(f"Error al importar: {exc}")

    st.sidebar.divider()
    st.sidebar.metric("Licitaciones en caché", storage.contar())
    st.sidebar.caption(
        "Competencia vigilada: " + ", ".join(c.nombre for c in COMPETIDORES)
    )


# --------------------------------------------------------------------- #
# Filtros (con foco Proexsi por defecto)
# --------------------------------------------------------------------- #
def panel_filtros(df: pd.DataFrame) -> pd.DataFrame:
    with st.expander("🔎 Filtros", expanded=True):
        f0, f1, f2 = st.columns(3)
        solo_muni = f0.toggle("🏛️ Solo municipalidades", value=True)
        solo_ti = f0.toggle("💻 Solo rubro TI (software/hardware)", value=True)

        texto = f1.text_input("Buscar (nombre, comprador, código)")
        rubros_opts = opciones_rubros()
        rubros_sel = f1.multiselect(
            "Rubros", options=[c for c, _ in rubros_opts],
            format_func=lambda c: dict(rubros_opts)[c],
        )

        estados = sorted(df["estado"].dropna().unique()) if "estado" in df else []
        estados_sel = f2.multiselect("Estado", estados)
        regiones = sorted(df["region"].dropna().unique()) if "region" in df else []
        regiones_sel = f2.multiselect("Región", regiones)

        g0, g1, g2 = st.columns(3)
        comp_sel = g0.multiselect(
            "🥊 Adjudicada a competidor", [c.nombre for c in COMPETIDORES]
        )
        proveedor = g1.text_input("Proveedor adjudicado (texto)")
        monto_max_data = (
            float(df["monto_estimado"].fillna(0).max())
            if "monto_estimado" in df and not df.empty else 0.0
        )
        rango = g2.slider(
            "Monto estimado (CLP)", 0.0, max(monto_max_data, 1.0),
            (0.0, max(monto_max_data, 1.0)),
        ) if monto_max_data > 0 else (None, None)

    return analytics.filtrar(
        df, texto=texto or None, rubros=rubros_sel or None,
        estados=estados_sel or None, regiones=regiones_sel or None,
        monto_min=rango[0], monto_max=rango[1],
        solo_municipalidades=solo_muni, solo_perfil_ti=solo_ti,
        competidores=comp_sel or None, proveedor=proveedor or None,
    )


# --------------------------------------------------------------------- #
# Vistas
# --------------------------------------------------------------------- #
COLS_TABLA = [
    "codigo", "nombre", "estado", "comprador", "region", "rubros_nombres",
    "monto_estimado", "proveedor_adjudicado", "competidor", "n_oferentes",
    "fecha_publicacion", "fecha_cierre",
]


def _tabla(df: pd.DataFrame, cols: list[str] | None = None, height: int = 460) -> None:
    cols = [c for c in (cols or COLS_TABLA) if c in df.columns]
    st.dataframe(df[cols], use_container_width=True, height=height)


def vista_radar(df: pd.DataFrame) -> None:
    st.subheader("🎯 Radar comercial Proexsi")
    st.caption(
        "Oportunidades en municipalidades, rubro TI. Usa los filtros de arriba "
        "para ajustar estado/región."
    )
    k = analytics.kpis(df)
    c = st.columns(5)
    c[0].metric("Oportunidades", f"{k['total']:,}")
    c[1].metric("Monto estimado", f"${k['monto_total']:,.0f}")
    abiertas = int((df["estado"] == "Publicada").sum()) if "estado" in df else 0
    c[2].metric("Abiertas (publicadas)", abiertas)
    c[3].metric("Desiertas", k["desiertas"])
    ganadas = int(df["ganada_proexsi"].fillna(0).sum()) if "ganada_proexsi" in df else 0
    c[4].metric("Ganadas por Proexsi", ganadas)

    if df.empty:
        st.info("Sin datos. Sincroniza desde la barra lateral.")
        return

    col1, col2 = st.columns(2)
    rubro_df = analytics.por_rubro(df)
    if not rubro_df.empty:
        col1.plotly_chart(
            px.bar(rubro_df.head(12), x="cantidad", y="rubro", orientation="h",
                   title="Oportunidades por rubro"),
            use_container_width=True)
    comp_df = analytics.por_competidor(df)
    if not comp_df.empty:
        col2.plotly_chart(
            px.bar(comp_df, x="competidor", y="adjudicadas",
                   title="Adjudicaciones por competidor"),
            use_container_width=True)

    st.markdown("#### 🏛️ Municipalidades más activas")
    st.dataframe(analytics.top_compradores(df), use_container_width=True)
    st.markdown("#### 📋 Oportunidades")
    _tabla(df)


def vista_competencia(df: pd.DataFrame) -> None:
    st.subheader("🥊 Inteligencia de competencia")
    rc = analytics.resumen_competencia(df)
    c = st.columns(3)
    c[0].metric("Competidores con adjudicaciones", rc["competidores_activos"])
    c[1].metric("Licitaciones de la competencia", rc["licitaciones_competencia"])
    c[2].metric("Monto adjudicado competencia", f"${rc['monto_competencia']:,.0f}")

    comp_df = analytics.por_competidor(df)
    if comp_df.empty:
        st.info(
            "Aún no hay adjudicaciones detectadas de la competencia en el caché. "
            "Sincroniza licitaciones en estado 'adjudicada' de meses anteriores."
        )
        return
    st.plotly_chart(
        px.bar(comp_df, x="competidor", y="monto_total", color="competidor",
               title="Monto adjudicado por competidor"),
        use_container_width=True)

    nombre = st.selectbox("Ver detalle de competidor", comp_df["competidor"].tolist())
    if nombre:
        sub = analytics.licitaciones_de_competidor(df, nombre)
        st.caption(f"{len(sub)} licitaciones adjudicadas a {nombre}")
        _tabla(sub, cols=["codigo", "nombre", "comprador", "region",
                          "monto_adjudicado", "fecha_adjudicacion", "rubros_nombres"])
        st.download_button(
            f"⬇️ Exportar licitaciones de {nombre}", export.a_excel(sub),
            file_name=f"competidor_{nombre}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def vista_contratos(df: pd.DataFrame) -> None:
    st.subheader("⏰ Contratos por terminar (oportunidades de renovación)")
    meses = st.slider("Horizonte (meses)", 1, 24, 6)
    porter = analytics.contratos_por_terminar(df, dias=meses * 30)
    st.metric("Contratos en el horizonte", len(porter))
    if porter.empty:
        st.info(
            "No se detectaron contratos con fecha de término estimable en el rango. "
            "Esto depende de que las licitaciones declaren duración de contrato; "
            "sincroniza licitaciones adjudicadas para alimentar esta vista."
        )
        return
    _tabla(porter, cols=["codigo", "nombre", "comprador", "proveedor_adjudicado",
                         "competidor", "monto_adjudicado", "fecha_termino_contrato",
                         "dias_para_terminar"])
    st.download_button(
        "⬇️ Exportar contratos por terminar", export.a_excel(porter),
        file_name="contratos_por_terminar.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def _money(v: Any) -> str:
    try:
        return f"${float(v):,.0f}"
    except (TypeError, ValueError):
        return "—"


def vista_ficha(df: pd.DataFrame) -> None:
    st.subheader("🗂️ Ficha completa, documentación e investigación")
    if df.empty:
        st.info("Sin datos.")
        return
    codigo = st.selectbox("Licitación", df["codigo"].dropna().tolist())
    if not codigo:
        return
    fila = df[df["codigo"] == codigo].iloc[0]

    # --- Detalle completo desde la API (ítems, fechas, adjudicación, acta) ---
    detalle = None
    try:
        detalle = detalle_completo(codigo, ticket=ticket_actual())
    except Exception as exc:  # noqa: BLE001
        st.warning(f"No se pudo traer el detalle desde la API: {exc}")

    st.markdown(
        f"### {fila.get('nombre','')}\n"
        f"`{codigo}` · **{fila.get('estado','—')}**")

    if detalle:
        g = ficha.datos_generales(detalle)
        comp = ficha.datos_comprador(detalle)
        adj = ficha.adjudicacion(detalle)

        c = st.columns(4)
        c[0].metric("Monto estimado", _money(g["monto_estimado"]))
        c[1].metric("Tipo", g["tipo"] or "—")
        c[2].metric("Oferentes", adj["n_oferentes"] or "—")
        c[3].metric("Monto adjudicado", _money(adj["monto_total"]))

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("#### 🏛️ Comprador (cliente)")
            st.write(f"**{comp['organismo'] or '—'}**")
            st.caption(
                f"Unidad: {comp['unidad'] or '—'} · RUT: {comp['rut_unidad'] or '—'}\n\n"
                f"{comp['direccion'] or ''} {comp['comuna'] or ''}, {comp['region'] or ''}\n\n"
                f"Contacto: {comp['usuario'] or '—'} ({comp['cargo'] or '—'})")
            if g["descripcion"]:
                st.markdown("#### 📝 Descripción")
                st.write(g["descripcion"])
        with col2:
            st.markdown("#### 📅 Fechas clave")
            for label, valor in ficha.fechas(detalle):
                st.write(f"- **{label}:** {valor}")

        st.markdown("#### 📦 Ítems solicitados")
        items = ficha.items_df(detalle)
        if not items.empty:
            st.dataframe(items, use_container_width=True)
        else:
            st.caption("Sin ítems en el detalle.")

        if adj["proveedores"]:
            st.markdown("#### 🏆 Proveedores adjudicados")
            st.dataframe(pd.DataFrame(adj["proveedores"]), use_container_width=True)

        # --- Documentación / enlaces ---
        st.markdown("#### 📄 Documentación (bases, anexos, actas)")
        cols = st.columns(2)
        cols[0].link_button("🔗 Ver ficha en Mercado Público",
                            ficha.link_ficha_publica(codigo))
        if adj.get("url_acta"):
            cols[1].link_button("📑 Acta de adjudicación (PDF)", adj["url_acta"])

        if st.button("📥 Buscar documentos de esta licitación", key=f"docs_{codigo}"):
            with st.spinner("Consultando documentos (API OCDS)…"):
                try:
                    docs = ocds.documentos_licitacion(codigo)
                    if not docs:
                        st.info("No se encontraron documentos publicados para esta licitación.")
                    else:
                        st.success(f"{len(docs)} documento(s) encontrados:")
                        for d in docs:
                            etiqueta = f"⬇️ {d['titulo']}"
                            extra = " · ".join(x for x in (d["tipo"], d["formato"], d["fecha"]) if x)
                            dc = st.columns([3, 2])
                            dc[0].link_button(etiqueta, d["url"])
                            if extra:
                                dc[1].caption(extra)
                except ocds.OCDSError as exc:
                    st.warning(
                        f"{exc}\n\nUsa el botón 'Ver ficha en Mercado Público' para "
                        "descargar las bases desde el portal oficial.")
        st.caption(
            "ℹ️ Los documentos provienen de la API OCDS de ChileCompra. Si tu red "
            "bloquea el host, usa el enlace a la ficha oficial.")

    # --- Investigación: valores de similares + último adjudicado ---
    st.divider()
    st.markdown("#### 💰 Valores de compras similares")
    est = analytics.estadisticas_similares(df, codigo)
    if est.get("n"):
        m = st.columns(3)
        m[0].metric("Similares (n)", est["n"])
        m[1].metric("Adjudicado promedio",
                    _money(est.get("adjudicado_prom")))
        m[2].metric("Rango adjudicado",
                    f"{_money(est.get('adjudicado_min'))} – {_money(est.get('adjudicado_max'))}")
        st.caption(
            f"Estimado en similares: {_money(est.get('estimado_min'))} – "
            f"{_money(est.get('estimado_max'))} (prom. {_money(est.get('estimado_prom'))})")
    else:
        st.info("Aún no hay suficientes similares en el caché para estimar valores.")

    st.markdown("#### 🏆 Último proveedor adjudicado en servicios similares")
    info = analytics.ultimo_adjudicado(df, codigo)
    u = info.get("ultimo")
    if u:
        st.success(
            f"**{u['proveedor']}** ({u['competidor']}) ganó *{u['comprador']}* "
            f"por {_money(u['monto'])} — licitación {u['codigo']}")
        st.dataframe(
            info["historial"][["codigo", "comprador", "proveedor_adjudicado",
                               "competidor", "monto_adjudicado", "fecha_adjudicacion"]],
            use_container_width=True)
    else:
        st.info("No hay adjudicaciones similares en el caché todavía.")

    st.markdown("#### 🔁 Compras similares")
    similares = analytics.compras_similares(df, codigo)
    if similares.empty:
        st.info("Sin licitaciones similares en el caché.")
    else:
        _tabla(similares, cols=["codigo", "nombre", "estado", "comprador",
                                "proveedor_adjudicado", "monto_estimado",
                                "monto_adjudicado", "similitud"])

    # --- Últimas compras del comprador ---
    comprador = fila.get("comprador")
    if comprador:
        st.markdown(f"#### 🕘 Últimas compras de *{comprador}*")
        hist = analytics.historial_comprador(df, comprador)
        _tabla(hist, cols=["codigo", "nombre", "estado", "rubros_nombres",
                           "monto_estimado", "proveedor_adjudicado",
                           "fecha_publicacion"])


def vista_tabla(df: pd.DataFrame) -> None:
    st.subheader("📋 Tabla y exportación")
    _tabla(df, height=520)
    cols = [c for c in COLS_TABLA if c in df.columns]
    c1, c2 = st.columns(2)
    c1.download_button("⬇️ CSV", export.a_csv(df[cols]),
                       file_name="licitaciones.csv", mime="text/csv")
    c2.download_button(
        "⬇️ Excel", export.a_excel(df[cols]), file_name="licitaciones.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def vista_desiertas(df: pd.DataFrame) -> None:
    st.subheader("🏜️ Licitaciones desiertas")
    des = df[df["estado"] == "Desierta"] if "estado" in df else df.head(0)
    st.metric("Desiertas (con filtros actuales)", len(des))
    if des.empty:
        st.info("No hay desiertas. Sincroniza con estado 'desierta'.")
        return
    rubro_df = analytics.por_rubro(des)
    if not rubro_df.empty:
        st.plotly_chart(
            px.bar(rubro_df.head(12), x="cantidad", y="rubro", orientation="h",
                   title="Desiertas por rubro"), use_container_width=True)
    _tabla(des, cols=["codigo", "nombre", "comprador", "region", "rubros_nombres",
                      "monto_estimado", "fecha_cierre"])


# --------------------------------------------------------------------- #
def main() -> None:
    storage.init_db()
    sidebar()

    st.title("🎯 Radar de Licitaciones — Proexsi")
    st.caption(
        "Foco: municipalidades · software / hardware · vigilancia de competencia "
        "(CAS-Chile, SMC, Insico)")

    df = analytics.a_dataframe(storage.cargar_licitaciones())
    df = panel_filtros(df)
    st.caption(f"Mostrando {len(df)} licitaciones según los filtros aplicados.")

    t = st.tabs([
        "🎯 Radar", "🥊 Competencia", "⏰ Contratos por terminar",
        "🗂️ Ficha & similares", "📋 Tabla / Exportar", "🏜️ Desiertas",
    ])
    with t[0]:
        vista_radar(df)
    with t[1]:
        vista_competencia(df)
    with t[2]:
        vista_contratos(df)
    with t[3]:
        vista_ficha(df)
    with t[4]:
        vista_tabla(df)
    with t[5]:
        vista_desiertas(df)


if __name__ == "__main__":
    main()
