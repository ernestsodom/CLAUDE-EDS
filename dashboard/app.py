from flask import Flask, render_template, request, jsonify
import xml.etree.ElementTree as ET
import pandas as pd
from io import BytesIO
import os
import sqlite3
from datetime import datetime, timezone

app = Flask(__name__)

# ── CONFIGURACIÓN DE BD ────────────────────────────────────────────
# LOCAL  → SQLite (ventas.db) sin configuración adicional.
# NUBE   → PostgreSQL cuando DATABASE_URL está definida (Supabase, Render, etc.)
DATABASE_URL = os.environ.get('DATABASE_URL', '')
DB_PATH = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'ventas.db'))

MONTH_NAMES = {1:'ENE',2:'FEB',3:'MAR',4:'ABR',5:'MAY',6:'JUN',
               7:'JUL',8:'AGO',9:'SEP',10:'OCT',11:'NOV',12:'DIC'}

# ── CAPA DE ACCESO A DATOS ─────────────────────────────────────────

def _is_pg():
    return bool(DATABASE_URL)

def _pg_url():
    """Normaliza postgres:// → postgresql:// que exige psycopg2."""
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
        conn.commit()
    finally:
        conn.close()

def load_records():
    """Carga todos los registros de la BD como lista de dicts."""
    init_db()
    return _fetchall('SELECT * FROM ventas ORDER BY fecha_hora')

def save_records(raw_records):
    """
    Normaliza e inserta registros ignorando duplicados por pedido_id.
    Compatible con SQLite (INSERT OR IGNORE) y PostgreSQL (ON CONFLICT DO NOTHING).
    Retorna el número de filas efectivamente insertadas.
    """
    init_db()
    ph  = '%s' if _is_pg() else '?'
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

    if _is_pg():
        sql = (
            f'INSERT INTO ventas '
            f'(pedido_id,tipo,fecha_hora,monto,forma_pago,negocio,sucursal,estado,cargado_en) '
            f'VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph}) '
            f'ON CONFLICT (pedido_id) DO NOTHING'
        )
    else:
        sql = (
            f'INSERT OR IGNORE INTO ventas '
            f'(pedido_id,tipo,fecha_hora,monto,forma_pago,negocio,sucursal,estado,cargado_en) '
            f'VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})'
        )

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

# ── PARSING DE EXCEL ───────────────────────────────────────────────

def parse_xls_xml(source):
    """Parsea el formato XML-Excel que exporta Softland como .xls"""
    if isinstance(source, (bytes, bytearray)):
        tree = ET.parse(BytesIO(source))
    else:
        tree = ET.parse(source)
    root = tree.getroot()
    ns   = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
    ws   = root.findall('.//ss:Worksheet', ns)[0]
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
    return [
        dict(zip(headers, r + [None] * max(0, len(headers) - len(r))))
        for r in all_rows[1:]
    ]

# ── DATAFRAME ──────────────────────────────────────────────────────

def build_df(records):
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df['fecha']   = pd.to_datetime(df['fecha_hora'], format='%d-%m-%Y %H:%M', errors='coerce')
    df['año']     = df['fecha'].dt.year.astype('Int64')
    df['mes']     = df['fecha'].dt.month.astype('Int64')
    df['mes_año'] = df['fecha'].dt.to_period('M').astype(str)
    df['monto']   = pd.to_numeric(df['monto'], errors='coerce').fillna(0)
    return df

def apply_filters(df, params):
    if df.empty:
        return df
    if params.get('negocio', 'Todos') not in ('Todos', '', None):
        df = df[df['negocio'] == params['negocio']]
    if params.get('sucursal', 'Todas') not in ('Todas', '', None):
        df = df[df['sucursal'] == params['sucursal']]
    if params.get('date_from') and 'fecha' in df.columns:
        df = df[df['fecha'] >= pd.to_datetime(params['date_from'])]
    if params.get('date_to') and 'fecha' in df.columns:
        df = df[df['fecha'] <= pd.to_datetime(params['date_to'])]
    return df

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

        finalized = [r for r in raw
                     if str(r.get('Estado Proceso', '')).strip() == 'Finalizado']
        if not finalized:
            return jsonify({
                'success': False,
                'warning': 'No se encontraron registros con estado "Finalizado" en el archivo.'
            })

        inserted = save_records(finalized)
        total = _fetchall('SELECT COUNT(*) AS n FROM ventas')[0]['n']
        return jsonify({'success': True, 'parsed': len(finalized),
                        'new': inserted, 'total': total})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/db_info')
def db_info():
    init_db()
    rows = _fetchall('SELECT COUNT(*) AS n FROM ventas')
    count = rows[0]['n']
    if count == 0:
        return jsonify({'count': 0, 'date_min': None, 'date_max': None,
                        'negocios': [], 'sucursales': [],
                        'backend': 'PostgreSQL' if _is_pg() else 'SQLite'})
    row  = _fetchall("SELECT MIN(fecha_hora) AS mn, MAX(fecha_hora) AS mx FROM ventas")[0]
    negs = [r['negocio'] for r in
            _fetchall("SELECT DISTINCT negocio FROM ventas WHERE negocio <> '' AND negocio IS NOT NULL")]
    sucs = [r['sucursal'] for r in
            _fetchall("SELECT DISTINCT sucursal FROM ventas WHERE sucursal <> '' AND sucursal IS NOT NULL")]
    dates = pd.to_datetime([row['mn'], row['mx']], format='%d-%m-%Y %H:%M', errors='coerce')
    return jsonify({
        'count':    count,
        'date_min': dates[0].strftime('%Y-%m-%d') if pd.notna(dates[0]) else None,
        'date_max': dates[1].strftime('%Y-%m-%d') if pd.notna(dates[1]) else None,
        'negocios':   sorted(negs),
        'sucursales': sorted(sucs),
        'backend': 'PostgreSQL' if _is_pg() else 'SQLite',
    })


@app.route('/api/clear', methods=['POST'])
def clear_data():
    _execute('DELETE FROM ventas')
    return jsonify({'success': True})


@app.route('/api/meta')
def meta():
    records = load_records()
    df = build_df(records)
    if df.empty:
        return jsonify({'negocios': ['Todos'], 'sucursales': ['Todas'],
                        'years': [], 'date_min': None, 'date_max': None})
    return jsonify({
        'negocios':   ['Todos']  + sorted(df['negocio'].dropna().unique().tolist()),
        'sucursales': ['Todas']  + sorted(df['sucursal'].dropna().unique().tolist()),
        'years':      sorted(df['año'].dropna().astype(int).unique().tolist()),
        'date_min':   df['fecha'].min().strftime('%Y-%m-%d'),
        'date_max':   df['fecha'].max().strftime('%Y-%m-%d'),
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
    if gran == 'yearly':
        g      = df.groupby('año')['monto'].sum().reset_index().sort_values('año')
        labels = g['año'].astype(str).tolist()
        vals   = [float(v) for v in g['monto']]
    else:
        g      = df.groupby('mes_año')['monto'].sum().reset_index().sort_values('mes_año')
        labels = g['mes_año'].tolist()
        vals   = [float(v) for v in g['monto']]

    stacked = {}
    for neg in df['negocio'].dropna().unique():
        ndf = df[df['negocio'] == neg]
        if gran == 'yearly':
            ng = ndf.groupby('año')['monto'].sum().reset_index().sort_values('año')
            nd = dict(zip(ng['año'].astype(str), ng['monto']))
        else:
            ng = ndf.groupby('mes_año')['monto'].sum().reset_index().sort_values('mes_año')
            nd = dict(zip(ng['mes_año'], ng['monto']))
        stacked[neg] = [float(nd.get(l, 0)) for l in labels]

    monthly_totals = df.groupby('mes_año')['monto'].sum()
    return jsonify({
        'labels':      labels,
        'values':      vals,
        'stacked':     stacked,
        'total':       float(df['monto'].sum()),
        'avg_monthly': float(monthly_totals.mean()),
        'max_month':   float(monthly_totals.max()),
        'n_trans':     int(len(df)),
    })


@app.route('/api/r2', methods=['POST'])
def r2_comparative():
    p  = request.json or {}
    df = apply_filters(
        build_df(load_records()),
        {k: p[k] for k in ('negocio', 'sucursal') if k in p}
    )
    y1     = int(p.get('year1', 0))
    y2     = int(p.get('year2', 0))
    months = [int(m) for m in p.get('months', list(range(1, 13)))]

    rows = []
    for m in months:
        v1  = float(df[(df['año'] == y1) & (df['mes'] == m)]['monto'].sum())
        v2  = float(df[(df['año'] == y2) & (df['mes'] == m)]['monto'].sum())
        pct = round((v1 - v2) / v2 * 100, 1) if v2 > 0 else (0 if v1 == 0 else None)
        rows.append({'month': MONTH_NAMES.get(m, str(m)), 'm': m,
                     'actual': v1, 'anterior': v2, 'pct': pct})

    tot1    = sum(r['actual']   for r in rows)
    tot2    = sum(r['anterior'] for r in rows)
    tot_pct = round((tot1 - tot2) / tot2 * 100, 1) if tot2 > 0 else 0
    valid   = [r for r in rows if r['pct'] is not None]
    return jsonify({
        'rows': rows, 'y1': y1, 'y2': y2,
        'tot1': tot1, 'tot2': tot2, 'tot_pct': tot_pct,
        'best':  max(valid, key=lambda r: r['pct'])  if valid else None,
        'worst': min(valid, key=lambda r: r['pct'])  if valid else None,
    })


@app.route('/api/r3', methods=['POST'])
def r3_participation():
    p     = request.json or {}
    df    = apply_filters(build_df(load_records()), p)
    total = float(df['monto'].sum())

    if df.empty:
        return jsonify({'pie': [], 'monthly': {'periods': [], 'stacked': {}},
                        'branches': {}, 'tipo': [], 'total': 0})

    by_neg = df.groupby('negocio')['monto'].sum().reset_index()
    pie = [{'label': str(r['negocio']),
            'value': float(r['monto']),
            'pct':   round(float(r['monto']) / total * 100, 1) if total > 0 else 0}
           for _, r in by_neg.iterrows()]

    monthly  = df.groupby(['mes_año', 'negocio'])['monto'].sum().reset_index()
    periods  = sorted(monthly['mes_año'].unique().tolist())
    stacked  = {}
    for neg in df['negocio'].dropna().unique():
        nd = dict(zip(monthly[monthly['negocio'] == neg]['mes_año'],
                      monthly[monthly['negocio'] == neg]['monto']))
        stacked[neg] = [float(nd.get(per, 0)) for per in periods]

    by_branch = df.groupby(['sucursal', 'negocio'])['monto'].sum().reset_index()
    branches  = {}
    for _, r in by_branch.iterrows():
        s = str(r['sucursal'])
        if s not in branches:
            branches[s] = {}
        branches[s][str(r['negocio'])] = float(r['monto'])

    tipo_data = []
    if 'tipo' in df.columns:
        by_tipo   = df.groupby('tipo')['monto'].sum().reset_index()
        tipo_data = [{'label': str(r['tipo']), 'value': float(r['monto'])}
                     for _, r in by_tipo.iterrows()]

    return jsonify({'pie': pie, 'monthly': {'periods': periods, 'stacked': stacked},
                    'branches': branches, 'tipo': tipo_data, 'total': total})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, port=port, host='0.0.0.0')
