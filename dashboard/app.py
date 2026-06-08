from flask import Flask, render_template, request, jsonify
import xml.etree.ElementTree as ET
import pandas as pd
from io import BytesIO
import os
import sqlite3
import json
from datetime import datetime, timezone

app = Flask(__name__)

# ── CONFIGURACIÓN DE BD ────────────────────────────────────────────
# LOCAL  → SQLite (ventas.db) sin configuración adicional.
# NUBE   → PostgreSQL cuando DATABASE_URL está definida (Supabase, Render…)
DATABASE_URL = os.environ.get('DATABASE_URL', '')
DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'ventas.db'))

MONTH_NAMES = {1:'ENE',2:'FEB',3:'MAR',4:'ABR',5:'MAY',6:'JUN',
               7:'JUL',8:'AGO',9:'SEP',10:'OCT',11:'NOV',12:'DIC'}

# ── CAPA DE ACCESO A DATOS ─────────────────────────────────────────

def _is_pg():
    return bool(DATABASE_URL)

def _pg_url():
    url = DATABASE_URL
    return url.replace('postgres://', 'postgresql://', 1) if url.startswith('postgres://') else url

def get_conn():
    if _is_pg():
        import psycopg2
        return psycopg2.connect(_pg_url())
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _fetchall(sql, params=()):
    conn = get_conn()
    try:
        if _is_pg():
            import psycopg2.extras
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            cur = conn.cursor()
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

def _execute(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()

def init_db():
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS ventas (
                pedido_id  TEXT PRIMARY KEY,
                tipo       TEXT,
                fecha_hora TEXT,
                monto      REAL,
                forma_pago TEXT,
                negocio    TEXT,
                sucursal   TEXT,
                estado     TEXT,
                cargado_en TEXT
            )
        ''')
        id_col = 'id SERIAL PRIMARY KEY' if _is_pg() else 'id INTEGER PRIMARY KEY AUTOINCREMENT'
        cur.execute(f'''
            CREATE TABLE IF NOT EXISTS consultas (
                {id_col},
                creado_en TEXT,
                reporte   TEXT,
                titulo    TEXT,
                filtros   TEXT,
                resultado TEXT
            )
        ''')
        conn.commit()
    finally:
        conn.close()

def load_records():
    init_db()
    return _fetchall('SELECT * FROM ventas ORDER BY fecha_hora')

def save_records(raw_records):
    """
    Inserta TODOS los pedidos del archivo (sin importar el estado de la
    boleta). Ignora duplicados por pedido_id. Retorna filas insertadas.
    """
    init_db()
    ph  = '%s' if _is_pg() else '?'
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

    if _is_pg():
        sql = (f'INSERT INTO ventas '
               f'(pedido_id,tipo,fecha_hora,monto,forma_pago,negocio,sucursal,estado,cargado_en) '
               f'VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph}) '
               f'ON CONFLICT (pedido_id) DO NOTHING')
    else:
        sql = (f'INSERT OR IGNORE INTO ventas '
               f'(pedido_id,tipo,fecha_hora,monto,forma_pago,negocio,sucursal,estado,cargado_en) '
               f'VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})')

    inserted = 0
    conn = get_conn()
    try:
        cur = conn.cursor()
        for r in raw_records:
            pid = str(r.get('N° Pedido') or r.get('pedido_id') or '').strip()
            if not pid:
                continue
            try:
                monto = float(str(r.get('Monto $') or r.get('monto') or 0).replace(',', '.'))
            except (ValueError, TypeError):
                monto = 0.0
            cur.execute(sql, (
                pid,
                str(r.get('Tipo')           or r.get('tipo')       or '').strip(),
                str(r.get('Fecha/Hora')     or r.get('fecha_hora') or '').strip(),
                monto,
                str(r.get('Forma Pago')     or r.get('forma_pago') or '').strip(),
                str(r.get('Negocio')        or r.get('negocio')    or '').strip(),
                str(r.get('Sucursal')       or r.get('sucursal')   or '').strip(),
                str(r.get('Estado Proceso') or r.get('estado')     or '').strip(),
                now,
            ))
            inserted += cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return inserted

# ── CONSULTAS GUARDADAS ────────────────────────────────────────────

def save_consulta(reporte, titulo, filtros, resultado):
    init_db()
    ph = '%s' if _is_pg() else '?'
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    _execute(
        f'INSERT INTO consultas (creado_en,reporte,titulo,filtros,resultado) '
        f'VALUES ({ph},{ph},{ph},{ph},{ph})',
        (now, reporte, titulo, json.dumps(filtros), json.dumps(resultado))
    )

# ── PARSING DE EXCEL ───────────────────────────────────────────────

def parse_xls_xml(source):
    if isinstance(source, (bytes, bytearray)):
        tree = ET.parse(BytesIO(source))
    else:
        tree = ET.parse(source)
    root  = tree.getroot()
    ns    = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
    ws    = root.findall('.//ss:Worksheet', ns)[0]
    table = ws.find('ss:Table', ns)
    all_rows = []
    for row in table.findall('ss:Row', ns):
        vals = []
        for c in row.findall('ss:Cell', ns):
            d = c.find('ss:Data', ns)
            vals.append(d.text if d is not None else None)
        all_rows.append(vals)
    if not all_rows:
        return []
    headers = all_rows[0]
    return [dict(zip(headers, r + [None] * max(0, len(headers) - len(r))))
            for r in all_rows[1:]]

# ── DATAFRAME ──────────────────────────────────────────────────────

def build_df(records):
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df['fecha']   = pd.to_datetime(df['fecha_hora'], format='%d-%m-%Y %H:%M', errors='coerce')
    df['dia']     = df['fecha'].dt.normalize()          # solo día (sin hora)
    df['año']     = df['fecha'].dt.year.astype('Int64')
    df['mes']     = df['fecha'].dt.month.astype('Int64')
    df['mes_año'] = df['fecha'].dt.to_period('M').astype(str)
    df['monto']   = pd.to_numeric(df['monto'], errors='coerce').fillna(0)
    return df

def apply_filters(df, params):
    """Filtra por negocio, sucursal y rango de fechas (a nivel de día,
    ignorando la hora: date_to incluye todo el día indicado)."""
    if df.empty:
        return df
    if params.get('negocio', 'Todos') not in ('Todos', '', None):
        df = df[df['negocio'] == params['negocio']]
    if params.get('sucursal', 'Todas') not in ('Todas', '', None):
        df = df[df['sucursal'] == params['sucursal']]
    if params.get('date_from') and 'dia' in df.columns:
        df = df[df['dia'] >= pd.to_datetime(params['date_from']).normalize()]
    if params.get('date_to') and 'dia' in df.columns:
        df = df[df['dia'] <= pd.to_datetime(params['date_to']).normalize()]
    return df

def _fmt_ddmmyyyy(ts):
    return ts.strftime('%d/%m/%Y') if pd.notna(ts) else None

# ── RUTAS ──────────────────────────────────────────────────────────

@app.route('/')
def index():
    init_db()
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No se recibió ningún archivo'}), 400
    f = request.files['file']
    try:
        content = f.read()
        if b'<?xml' in content[:200]:
            raw = parse_xls_xml(content)
        else:
            raw = pd.read_excel(BytesIO(content)).to_dict('records')

        # Se consideran TODOS los pedidos, sin filtrar por estado de boleta.
        # Solo se descartan filas sin fecha válida (p.ej. la fila de totales
        # que Softland agrega al final del archivo).
        def _valid(r):
            pid = str(r.get('N° Pedido') or r.get('pedido_id') or '').strip()
            if not pid:
                return False
            fh = r.get('Fecha/Hora') or r.get('fecha_hora')
            return pd.notna(pd.to_datetime(fh, format='%d-%m-%Y %H:%M', errors='coerce'))

        registros = [r for r in raw if _valid(r)]
        if not registros:
            return jsonify({'success': False,
                            'warning': 'El archivo no contiene pedidos válidos (sin fecha o N° de Pedido).'})

        inserted = save_records(registros)

        # Período del archivo recién cargado
        fechas = pd.to_datetime(
            [r.get('Fecha/Hora') or r.get('fecha_hora') for r in registros],
            format='%d-%m-%Y %H:%M', errors='coerce'
        )
        fechas = fechas.dropna()
        periodo = None
        if len(fechas):
            periodo = {'desde': _fmt_ddmmyyyy(fechas.min()),
                       'hasta': _fmt_ddmmyyyy(fechas.max())}

        total = _fetchall('SELECT COUNT(*) AS n FROM ventas')[0]['n']
        return jsonify({'success': True, 'parsed': len(registros),
                        'new': inserted, 'total': total, 'periodo': periodo})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/db_info')
def db_info():
    init_db()
    count = _fetchall('SELECT COUNT(*) AS n FROM ventas')[0]['n']
    backend = 'PostgreSQL' if _is_pg() else 'SQLite'
    if count == 0:
        return jsonify({'count': 0, 'date_min': None, 'date_max': None,
                        'negocios': [], 'sucursales': [], 'backend': backend})
    row = _fetchall("SELECT MIN(fecha_hora) AS mn, MAX(fecha_hora) AS mx FROM ventas")[0]
    df  = build_df(load_records())
    return jsonify({
        'count':      count,
        'date_min':   _fmt_ddmmyyyy(df['fecha'].min()),
        'date_max':   _fmt_ddmmyyyy(df['fecha'].max()),
        'negocios':   sorted(df['negocio'].dropna().unique().tolist()),
        'sucursales': sorted(df['sucursal'].dropna().unique().tolist()),
        'backend':    backend,
    })


@app.route('/api/clear', methods=['POST'])
def clear_data():
    _execute('DELETE FROM ventas')
    return jsonify({'success': True})


@app.route('/api/meta')
def meta():
    df = build_df(load_records())
    if df.empty:
        # Aun sin datos, ofrecer años seleccionables (año actual y 6 atrás)
        cur = datetime.now().year
        return jsonify({'negocios': ['Todos'], 'sucursales': ['Todas'],
                        'years': [], 'year_options': list(range(cur, cur - 7, -1)),
                        'date_min': None, 'date_max': None})
    data_years = sorted(df['año'].dropna().astype(int).unique().tolist())
    cur = datetime.now().year
    hi  = max([cur] + data_years)
    lo  = min([cur - 6] + data_years)
    year_options = list(range(hi, lo - 1, -1))   # descendente, incluye años sin datos
    return jsonify({
        'negocios':     ['Todos'] + sorted(df['negocio'].dropna().unique().tolist()),
        'sucursales':   ['Todas'] + sorted(df['sucursal'].dropna().unique().tolist()),
        'years':        data_years,
        'year_options': year_options,
        'date_min':     df['fecha'].min().strftime('%Y-%m-%d'),
        'date_max':     df['fecha'].max().strftime('%Y-%m-%d'),
    })


@app.route('/api/kpis')
def kpis():
    df = build_df(load_records())
    if df.empty:
        return jsonify({'total': 0, 'n_trans': 0, 'n_suc': 0, 'n_neg': 0})
    return jsonify({
        'total':   float(df['monto'].sum()),
        'n_trans': int(len(df)),
        'n_suc':   int(df['sucursal'].nunique()),
        'n_neg':   int(df['negocio'].nunique()),
    })


@app.route('/api/r1', methods=['POST'])
def r1_historical():
    p  = request.json or {}
    df = apply_filters(build_df(load_records()), p)
    if df.empty:
        return jsonify({'labels': [], 'values': [], 'stacked': {},
                        'total': 0, 'avg_monthly': 0, 'max_month': 0, 'n_trans': 0})

    gran = p.get('granularity', 'monthly')
    key  = 'año' if gran == 'yearly' else 'mes_año'
    g      = df.groupby(key)['monto'].sum().reset_index().sort_values(key)
    labels = g[key].astype(str).tolist()
    vals   = [float(v) for v in g['monto']]

    stacked = {}
    stacked_counts = {}
    for neg in df['negocio'].dropna().unique():
        ndf = df[df['negocio'] == neg]
        ng  = ndf.groupby(key)['monto'].sum()
        nc  = ndf.groupby(key).size()
        nd  = {str(k): float(v) for k, v in ng.items()}
        ncd = {str(k): int(v)   for k, v in nc.items()}
        stacked[str(neg)]        = [nd.get(l, 0)  for l in labels]
        stacked_counts[str(neg)] = [ncd.get(l, 0) for l in labels]

    # Branch breakdown for the selected period (same format as r3)
    by_branch = df.groupby(['sucursal', 'negocio'])['monto'].sum().reset_index()
    branches = {}
    for _, r in by_branch.iterrows():
        s = str(r['sucursal'])
        branches.setdefault(s, {})[str(r['negocio'])] = float(r['monto'])

    monthly_totals = df.groupby('mes_año')['monto'].sum()
    return jsonify({
        'labels': labels, 'values': vals, 'stacked': stacked,
        'stacked_counts': stacked_counts, 'branches': branches,
        'total':       float(df['monto'].sum()),
        'avg_monthly': float(monthly_totals.mean()),
        'max_month':   float(monthly_totals.max()),
        'n_trans':     int(len(df)),
    })


@app.route('/api/r2', methods=['POST'])
def r2_comparative():
    p  = request.json or {}
    df = apply_filters(build_df(load_records()),
                       {k: p[k] for k in ('negocio', 'sucursal') if k in p})
    y1     = int(p.get('year1', 0))
    y2     = int(p.get('year2', 0))
    months = [int(m) for m in p.get('months', list(range(1, 13)))]

    rows = []
    for m in months:
        if df.empty:
            v1 = v2 = 0.0
        else:
            v1 = float(df[(df['año'] == y1) & (df['mes'] == m)]['monto'].sum())
            v2 = float(df[(df['año'] == y2) & (df['mes'] == m)]['monto'].sum())
        pct = round((v1 - v2) / v2 * 100, 1) if v2 > 0 else (0 if v1 == 0 else None)
        rows.append({'month': MONTH_NAMES.get(m, str(m)), 'm': m,
                     'actual': v1, 'anterior': v2, 'pct': pct})

    tot1    = sum(r['actual']   for r in rows)
    tot2    = sum(r['anterior'] for r in rows)
    if tot2 > 0:
        tot_pct = round((tot1 - tot2) / tot2 * 100, 1)
    else:
        tot_pct = None  # no base-year data → growth not calculable

    # "Best month" = month with highest revenue in y1
    y1_months = [(r['month'], r['actual']) for r in rows if r['actual'] > 0]
    if y1_months:
        best_month, best_valor = max(y1_months, key=lambda x: x[1])
        best_row = next((r for r in rows if r['month'] == best_month), None)
        best = {'month': best_month, 'valor': float(best_valor),
                'pct': best_row['pct'] if best_row else None}
    else:
        best = None

    valid = [r for r in rows if r['anterior'] > 0 and r['pct'] is not None]
    return jsonify({
        'rows': rows, 'y1': y1, 'y2': y2,
        'tot1': tot1, 'tot2': tot2, 'tot_pct': tot_pct,
        'best':  best,
        'worst': min(valid, key=lambda r: r['pct']) if valid else None,
    })


@app.route('/api/r3', methods=['POST'])
def r3_participation():
    p     = request.json or {}
    df    = apply_filters(build_df(load_records()), p)
    total = float(df['monto'].sum())

    if df.empty:
        return jsonify({'pie': [], 'monthly': {'periods': [], 'grouped': {}},
                        'branches': {}, 'tipo': [], 'total': 0})

    by_neg = df.groupby('negocio')['monto'].sum().reset_index()
    pie = [{'label': str(r['negocio']),
            'value': float(r['monto']),
            'pct':   round(float(r['monto']) / total * 100, 1) if total > 0 else 0}
           for _, r in by_neg.iterrows()]

    monthly = df.groupby(['mes_año', 'negocio'])['monto'].sum().reset_index()
    periods = sorted(monthly['mes_año'].unique().tolist())
    grouped = {}
    for neg in df['negocio'].dropna().unique():
        nd = dict(zip(monthly[monthly['negocio'] == neg]['mes_año'],
                      monthly[monthly['negocio'] == neg]['monto']))
        grouped[str(neg)] = [float(nd.get(per, 0)) for per in periods]

    by_branch = df.groupby(['sucursal', 'negocio'])['monto'].sum().reset_index()
    branches  = {}
    for _, r in by_branch.iterrows():
        s = str(r['sucursal'])
        branches.setdefault(s, {})[str(r['negocio'])] = float(r['monto'])

    tipo_data = []
    if 'tipo' in df.columns:
        by_tipo   = df.groupby('tipo')['monto'].sum().reset_index()
        tipo_data = [{'label': str(r['tipo']), 'value': float(r['monto'])}
                     for _, r in by_tipo.iterrows()]

    return jsonify({'pie': pie, 'monthly': {'periods': periods, 'grouped': grouped},
                    'branches': branches, 'tipo': tipo_data, 'total': total})


# ── HISTORIAL DE CONSULTAS ─────────────────────────────────────────

@app.route('/api/consultas', methods=['GET'])
def consultas_list():
    init_db()
    rows = _fetchall('SELECT id, creado_en, reporte, titulo FROM consultas ORDER BY id DESC')
    return jsonify(rows)


@app.route('/api/consultas/save', methods=['POST'])
def consultas_save():
    p = request.json or {}
    save_consulta(p.get('reporte', ''), p.get('titulo', ''),
                  p.get('filtros', {}), p.get('resultado', {}))
    return jsonify({'success': True})


@app.route('/api/consultas/<int:cid>', methods=['GET'])
def consultas_get(cid):
    ph   = '%s' if _is_pg() else '?'
    rows = _fetchall(f'SELECT * FROM consultas WHERE id = {ph}', (cid,))
    if not rows:
        return jsonify({'error': 'No encontrada'}), 404
    row = rows[0]
    row['filtros']   = json.loads(row['filtros']   or '{}')
    row['resultado'] = json.loads(row['resultado'] or '{}')
    return jsonify(row)


@app.route('/api/consultas/delete', methods=['POST'])
def consultas_delete():
    p  = request.json or {}
    ph = '%s' if _is_pg() else '?'
    if p.get('all'):
        _execute('DELETE FROM consultas')
    elif p.get('id'):
        _execute(f'DELETE FROM consultas WHERE id = {ph}', (int(p['id']),))
    return jsonify({'success': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, port=port, host='0.0.0.0')
