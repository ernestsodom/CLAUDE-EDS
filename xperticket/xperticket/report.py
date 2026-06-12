"""
Generador de reporte web autocontenido (un solo archivo .html).

Pensado para uso NO técnico: produce un HTML con todo embebido (estilos y JS),
que se abre con doble clic en cualquier navegador, sin instalar nada ni levantar
servidores. Muestra KPIs, ranking filtrable de prospectos y, por cada uno, su
análisis, propuesta y el email de contacto listo para copiar.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import Any

from . import analytics, storage

_CSS = """
:root{--bg:#0f1220;--card:#1a1f33;--ink:#eef1f8;--mut:#9aa3bd;--acc:#5b8cff;
--good:#37d39b;--warn:#ffb454;--line:#2a3150}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
background:var(--bg);color:var(--ink);line-height:1.5}
header{padding:28px 24px;background:linear-gradient(135deg,#202a4d,#141a30)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
h1{margin:0;font-size:24px}
.sub{color:var(--mut);margin-top:6px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.kpi .n{font-size:26px;font-weight:700}
.kpi .l{color:var(--mut);font-size:13px;margin-top:4px}
.toolbar{display:flex;gap:12px;align-items:center;margin:18px 0;flex-wrap:wrap}
input[type=search],select{background:var(--card);border:1px solid var(--line);
color:var(--ink);border-radius:10px;padding:10px 12px;font-size:14px}
input[type=search]{min-width:280px}
table{width:100%;border-collapse:collapse;background:var(--card);
border:1px solid var(--line);border-radius:14px;overflow:hidden}
th,td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--line);font-size:14px}
th{color:var(--mut);font-weight:600;cursor:pointer;user-select:none;white-space:nowrap}
tr:hover td{background:#212847}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}
.b-hi{background:rgba(55,211,155,.16);color:var(--good)}
.b-md{background:rgba(255,180,84,.16);color:var(--warn)}
.b-lo{background:rgba(154,163,189,.16);color:var(--mut)}
a.row{color:var(--acc);text-decoration:none;font-weight:600}
a.row:hover{text-decoration:underline}
.cards{margin-top:34px;display:grid;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;scroll-margin-top:14px}
.card h3{margin:0 0 2px}
.meta{color:var(--mut);font-size:13px;margin-bottom:14px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.lbl{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}
ul{margin:0;padding-left:18px}li{margin:3px 0}
.fin{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 0}
.fin div{background:#141a30;border:1px solid var(--line);border-radius:10px;padding:10px}
.fin .n{font-size:18px;font-weight:700}.fin .l{color:var(--mut);font-size:12px}
.email{position:relative;margin-top:10px}
textarea{width:100%;min-height:230px;background:#0c1020;color:var(--ink);
border:1px solid var(--line);border-radius:12px;padding:14px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}
.copy{position:absolute;top:10px;right:10px;background:var(--acc);color:#fff;border:0;
border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer;font-weight:600}
.note{background:#23304a;border:1px solid var(--line);border-radius:12px;padding:12px 14px;
color:#cdd6f0;font-size:13px;margin:16px 0}
footer{color:var(--mut);font-size:12px;text-align:center;padding:30px 0 50px}
@media(max-width:780px){.kpis,.fin{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}}
"""

_JS = """
function buscar(){var q=document.getElementById('q').value.toLowerCase();
var seg=document.getElementById('seg').value;
document.querySelectorAll('#tabla tbody tr').forEach(function(tr){
 var t=tr.getAttribute('data-text');var s=tr.getAttribute('data-seg');
 tr.style.display=(t.indexOf(q)>-1 && (seg===''||s===seg))?'':'none';});}
function ordenar(i,num){var tb=document.querySelector('#tabla tbody');
var rows=Array.prototype.slice.call(tb.querySelectorAll('tr'));
var asc=tb.getAttribute('data-asc-'+i)!=='1';tb.setAttribute('data-asc-'+i,asc?'1':'0');
rows.sort(function(a,b){var x=a.children[i].getAttribute('data-v')||a.children[i].innerText;
var y=b.children[i].getAttribute('data-v')||b.children[i].innerText;
if(num){x=parseFloat(x)||0;y=parseFloat(y)||0;return asc?x-y:y-x;}
return asc?(''+x).localeCompare(y):(''+y).localeCompare(x);});
rows.forEach(function(r){tb.appendChild(r);});}
function copiar(id){var el=document.getElementById(id);el.select();
document.execCommand('copy');var b=event.target;var o=b.innerText;b.innerText='¡Copiado!';
setTimeout(function(){b.innerText=o;},1400);}
"""


def _esc(v: Any) -> str:
    return html.escape("" if v is None else str(v))


def _fmt_usd(v: Any) -> str:
    try:
        return f"US$ {float(v):,.0f}"
    except (TypeError, ValueError):
        return "—"


def _fmt_uf(v: Any) -> str:
    try:
        return f"{float(v):,.0f} UF"
    except (TypeError, ValueError):
        return "—"


def _fmt_pct(v: Any) -> str:
    try:
        return f"{float(v):.1f}%"
    except (TypeError, ValueError):
        return "—"


def _badge(score: Any) -> str:
    try:
        s = float(score)
    except (TypeError, ValueError):
        s = 0
    cls = "b-hi" if s >= 75 else ("b-md" if s >= 55 else "b-lo")
    return f'<span class="badge {cls}">{int(s)}</span>'


def _fila(a: dict[str, Any]) -> str:
    fin = a.get("finanzas", {})
    web = a.get("web_intel", {})
    con = a.get("contacto", {})
    pid = _esc(a.get("prospecto_id"))
    nombre = _esc(a.get("prospecto"))
    tipo = _esc(a.get("tipo"))
    region = _esc(a.get("region"))
    tick = _esc(web.get("ticketera_actual"))
    score = con.get("score") or 0
    prio = con.get("prioridad") or ""
    ahorro = fin.get("ahorro_comisiones_anual_uf") or 0
    roi = fin.get("roi_estimado_anual_usd") or 0
    texto = f"{nombre} {tipo} {region} {tick}".lower()
    return (
        f'<tr data-text="{_esc(texto)}" data-seg="{tipo}">'
        f'<td class="num" data-v="{prio}">{prio}</td>'
        f'<td class="num" data-v="{score}">{_badge(score)}</td>'
        f'<td><a class="row" href="#{pid}">{nombre}</a></td>'
        f'<td>{tipo}</td><td>{region}</td><td>{tick}</td>'
        f'<td class="num" data-v="{ahorro}">{_fmt_uf(ahorro)}</td>'
        f'<td class="num" data-v="{roi}">{_fmt_usd(roi)}</td>'
        f"</tr>"
    )


def _card(a: dict[str, Any]) -> str:
    fin = a.get("finanzas", {})
    web = a.get("web_intel", {})
    prop = a.get("propuesta", {})
    con = a.get("contacto", {})
    pid = _esc(a.get("prospecto_id"))

    pains = "".join(f"<li>{_esc(d)}</li>" for d in web.get("pain_points_detectados", [])[:6])
    oportun = "".join(f"<li>✓ {_esc(o)}</li>" for o in prop.get("propuesta_xperticket", [])[:6])
    email = _esc(prop.get("narrativa_email", ""))
    sitio = _esc(a.get("sitio_web"))
    sitio_link = f'<a class="row" href="{sitio}" target="_blank">{sitio}</a>' if sitio else "—"
    fuente = _esc(web.get("fuente_datos"))

    return f"""
<div class="card" id="{pid}">
  <h3>{_badge(con.get('score'))}&nbsp; {_esc(a.get('prospecto'))}</h3>
  <div class="meta">{_esc(a.get('tipo'))} · {_esc(a.get('ciudad'))}, {_esc(a.get('region'))}
   · Ticketera actual: <b>{_esc(web.get('ticketera_actual'))}</b> · {sitio_link}
   · <span title="web = leído del sitio; heuristica = estimado por segmento">fuente: {fuente}</span></div>
  <div class="fin">
    <div><div class="n">{_fmt_uf(fin.get('ahorro_comisiones_anual_uf'))}</div><div class="l">Ahorro comisiones/año</div></div>
    <div><div class="n">{_fmt_usd(fin.get('roi_estimado_anual_usd'))}</div><div class="l">ROI estimado/año</div></div>
    <div><div class="n">{_esc(fin.get('payback_meses'))} meses</div><div class="l">Payback</div></div>
    <div><div class="n">{_fmt_pct(fin.get('comision_actual_pct'))} → {_fmt_pct(fin.get('comision_xperticket_pct'))}</div><div class="l">Comisión actual → Xperticket</div></div>
    <div><div class="n">{_esc(fin.get('volumen_estimado_anual'))}</div><div class="l">Entradas/año (est.)</div></div>
    <div><div class="n">{_fmt_uf(fin.get('ingresos_anuales_uf'))}</div><div class="l">Ingresos/año (est.)</div></div>
  </div>
  <div class="grid2" style="margin-top:16px">
    <div><p class="lbl">Dolores detectados</p><ul>{pains}</ul></div>
    <div><p class="lbl">Propuesta Xperticket</p><ul>{oportun}</ul></div>
  </div>
  <p class="lbl" style="margin-top:16px">Email de contacto (listo para copiar)</p>
  <div class="email">
    <button class="copy" onclick="copiar('mail-{pid}')">Copiar</button>
    <textarea id="mail-{pid}" readonly>{email}</textarea>
  </div>
</div>
"""


def generar_html() -> str:
    """Construye el HTML completo a partir de los análisis almacenados."""
    analisis = storage.cargar_analisis()
    analisis.sort(key=lambda a: a.get("contacto", {}).get("score", 0), reverse=True)

    df = analytics.analisis_df(analisis)
    k = analytics.kpis(df)
    segmentos = sorted({a.get("tipo", "") for a in analisis if a.get("tipo")})

    fecha = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    filas = "".join(_fila(a) for a in analisis)
    cards = "".join(_card(a) for a in analisis)
    opciones = "".join(f'<option value="{_esc(s)}">{_esc(s)}</option>' for s in segmentos)

    cabeceras = [
        ("Prio.", True), ("Score", True), ("Institución", False), ("Tipo", False),
        ("Región", False), ("Ticketera", False), ("Ahorro/año", True), ("ROI/año", True),
    ]
    ths = "".join(
        f'<th class="{"num" if num else ""}" onclick="ordenar({i},{str(num).lower()})">{_esc(t)} ⇅</th>'
        for i, (t, num) in enumerate(cabeceras)
    )

    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xperticket · Prospección</title><style>{_CSS}</style></head>
<body>
<header><div class="wrap">
  <h1>🎟️ Xperticket — Inteligencia & Prospección</h1>
  <div class="sub">Reporte generado el {fecha} · {k['prospectos']} prospectos analizados ·
   Director Comercial: Ernesto Domínguez (Proexsi S.A.)</div>
</div></header>
<div class="wrap">
  <div class="kpis">
    <div class="kpi"><div class="n">{k['prospectos']}</div><div class="l">Prospectos analizados</div></div>
    <div class="kpi"><div class="n">{_fmt_usd(k['roi_total_usd'])}</div><div class="l">ROI total estimado/año</div></div>
    <div class="kpi"><div class="n">{k['ahorro_total_uf']:,.0f} UF</div><div class="l">Ahorro comisiones/año</div></div>
    <div class="kpi"><div class="n">{k['score_medio']}</div><div class="l">Score medio</div></div>
  </div>

  <div class="note">⚠️ <b>Datos de partida, no verificados.</b> Volúmenes y comisiones son
   estimaciones por segmento (la mayoría de sitios bloquea bots, por eso la fuente suele ser
   «heurística»). <b>Valida cada contacto y cifra antes de contactar.</b> El score (0-100) prioriza
   por volumen, comisión actual, facilidad de contacto y fit tecnológico.</div>

  <div class="toolbar">
    <input id="q" type="search" placeholder="Buscar institución, tipo, región, ticketera…" oninput="buscar()">
    <select id="seg" onchange="buscar()"><option value="">Todos los segmentos</option>{opciones}</select>
  </div>

  <table id="tabla"><thead><tr>{ths}</tr></thead><tbody>{filas}</tbody></table>

  <div class="cards">{cards}</div>
</div>
<footer>Generado por el Motor de Prospección Xperticket · Haz clic en una institución de la tabla para ir a su ficha.</footer>
<script>{_JS}</script>
</body></html>
"""


def guardar_html(path: str) -> int:
    """Escribe el reporte en `path`. Devuelve el nº de prospectos incluidos."""
    contenido = generar_html()
    with open(path, "w", encoding="utf-8") as f:
        f.write(contenido)
    return storage.contar_analisis()
