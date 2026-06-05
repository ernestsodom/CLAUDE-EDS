from flask import Flask, render_template, request, jsonify
import xml.etree.ElementTree as ET
import pandas as pd
from io import BytesIO
import os
import random
from datetime import datetime, timedelta

app = Flask(__name__)

_store = {'records': None}

DEMO_UPLOAD_PATH = '/root/.claude/uploads/71c77a0e-5c3b-45e6-af16-f142f27d9982/9193a1e5-pedidos_venta_1.xls'

MONTH_NAMES = {1:'ENE',2:'FEB',3:'MAR',4:'ABR',5:'MAY',6:'JUN',
               7:'JUL',8:'AGO',9:'SEP',10:'OCT',11:'NOV',12:'DIC'}

SUCURSALES_NEGOCIO = {
    'Trampoline Park': ['TRAMPOLINE PARK LAS CONDES','TRAMPOLINE PARK BUENAVENTURA',
                        'TRAMPOLINE PARK ALAMEDA','TRAMPOLINE PARK LA FLORIDA',
                        'TRAMPOLINE PARK CONCEPCION','TRAMPOLINE PARK TEMUCO',
                        'TRAMPOLINE PARK PUERTO MONTT'],
    'Cerogrado': ['Parque Araucano','Arauco Buenaventura','Arauco Maipú',
                  'Santa Amalia','Mall Plaza Bio Bio','Puerto Varas']
}


def parse_xls_xml(source):
    if isinstance(source, (bytes, bytearray)):
        tree = ET.parse(BytesIO(source))
    else:
        tree = ET.parse(source)
    root = tree.getroot()
    ns = {'ss': 'urn:schemas-microsoft-com:office:spreadsheet'}
    ws = root.findall('.//ss:Worksheet', ns)[0]
    table = ws.find('ss:Table', ns)
    rows = table.findall('ss:Row', ns)
    all_rows = []
    for row in rows:
        cells = row.findall('ss:Cell', ns)
        vals = []
        for c in cells:
            d = c.find('ss:Data', ns)
            vals.append(d.text if d is not None else None)
        all_rows.append(vals)
    if not all_rows:
        return []
    headers = all_rows[0]
    return [dict(zip(headers, r + [None] * max(0, len(headers) - len(r)))) for r in all_rows[1:]]


def build_df(records):
    df = pd.DataFrame(records)
    if df.empty:
        return df
    if 'Fecha/Hora' in df.columns:
        df['fecha'] = pd.to_datetime(df['Fecha/Hora'], format='%d-%m-%Y %H:%M', errors='coerce')
        df['año'] = df['fecha'].dt.year.astype('Int64')
        df['mes'] = df['fecha'].dt.month.astype('Int64')
        df['mes_año'] = df['fecha'].dt.to_period('M').astype(str)
    if 'Monto $' in df.columns:
        df['monto'] = pd.to_numeric(df['Monto $'], errors='coerce').fillna(0)
    return df


def generate_demo_data():
    random.seed(42)
    tipos = ['Individual', 'Grupal', 'Cumpleaños', 'Clases', 'Adicional']
    formas = ['Tarjeta Débito', 'Tarjeta Crédito', 'Efectivo', 'Transferencia']
    montos = {'Individual': (10000, 25000), 'Grupal': (30000, 90000),
              'Cumpleaños': (120000, 300000), 'Clases': (15000, 35000), 'Adicional': (5000, 15000)}
    mm = {1: 0.90, 2: 0.85, 3: 0.92, 4: 0.80, 5: 0.88, 6: 0.72,
          7: 0.68, 8: 0.75, 9: 0.88, 10: 0.93, 11: 0.97, 12: 1.25}
    yg = {2024: 0.88, 2025: 1.0, 2026: 1.18}

    data = []
    n = 100000
    d = datetime(2024, 1, 1)
    while d <= datetime(2026, 5, 31):
        mult = mm[d.month] * yg.get(d.year, 1.0)
        num = max(3, int(28 * mult + random.gauss(0, 4)))
        for _ in range(num):
            neg = random.choices(list(SUCURSALES_NEGOCIO.keys()), weights=[0.55, 0.45])[0]
            suc = random.choice(SUCURSALES_NEGOCIO[neg])
            t = random.choices(tipos, weights=[0.50, 0.20, 0.10, 0.15, 0.05])[0]
            mn, mx = montos[t]
            m = random.randrange(mn, mx, 1000)
            dt = d.replace(hour=random.randint(9, 21), minute=random.randint(0, 59))
            data.append({'N° Pedido': str(n), 'Tipo': t,
                         'Fecha/Hora': dt.strftime('%d-%m-%Y %H:%M'),
                         'Monto $': str(m), 'Forma Pago': random.choice(formas),
                         'Negocio': neg, 'Sucursal': suc,
                         'Estado Proceso': 'Finalizado', 'Estado Emisión': 'Emitido'})
            n += 1
        d += timedelta(days=1)
    return data


def get_records():
    if _store['records'] is None:
        demo = generate_demo_data()
        existing_ids = {r['N° Pedido'] for r in demo}
        if os.path.exists(DEMO_UPLOAD_PATH):
            uploaded = parse_xls_xml(DEMO_UPLOAD_PATH)
            new = [r for r in uploaded
                   if r.get('Estado Proceso') == 'Finalizado'
                   and r.get('N° Pedido') not in existing_ids]
            _store['records'] = demo + new
        else:
            _store['records'] = demo
    return _store['records']


def apply_filters(df, params):
    if params.get('negocio', 'Todos') not in ('Todos', '', None):
        df = df[df['Negocio'] == params['negocio']]
    if params.get('sucursal', 'Todas') not in ('Todas', '', None):
        df = df[df['Sucursal'] == params['sucursal']]
    if params.get('date_from'):
        df = df[df['fecha'] >= pd.to_datetime(params['date_from'])]
    if params.get('date_to'):
        df = df[df['fecha'] <= pd.to_datetime(params['date_to'])]
    return df


@app.route('/')
def index():
    get_records()
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        content = f.read()
        if b'<?xml' in content[:200]:
            records = parse_xls_xml(content)
        else:
            records = pd.read_excel(BytesIO(content)).to_dict('records')
        finalized = [r for r in records if str(r.get('Estado Proceso', '')).strip() == 'Finalizado']
        existing_ids = {r['N° Pedido'] for r in get_records()}
        new = [r for r in finalized if str(r.get('N° Pedido', '')) not in existing_ids]
        _store['records'].extend(new)
        return jsonify({'success': True, 'new': len(new), 'total': len(_store['records'])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/meta')
def meta():
    df = build_df(get_records())
    negocios = ['Todos'] + sorted(df['Negocio'].dropna().unique().tolist())
    sucursales_all = ['Todas'] + sorted(df['Sucursal'].dropna().unique().tolist())
    years = sorted(df['año'].dropna().astype(int).unique().tolist()) if 'año' in df else []
    date_min = df['fecha'].min().strftime('%Y-%m-%d') if 'fecha' in df and len(df) else None
    date_max = df['fecha'].max().strftime('%Y-%m-%d') if 'fecha' in df and len(df) else None
    return jsonify({'negocios': negocios, 'sucursales': sucursales_all,
                    'years': years, 'date_min': date_min, 'date_max': date_max})


@app.route('/api/kpis')
def kpis():
    df = build_df(get_records())
    total = float(df['monto'].sum())
    n_trans = int(len(df))
    n_suc = int(df['Sucursal'].nunique()) if 'Sucursal' in df else 0
    n_neg = int(df['Negocio'].nunique()) if 'Negocio' in df else 0
    return jsonify({'total': total, 'n_trans': n_trans, 'n_suc': n_suc, 'n_neg': n_neg})


@app.route('/api/r1', methods=['POST'])
def r1_historical():
    p = request.json or {}
    df = build_df(get_records())
    df = apply_filters(df, p)

    gran = p.get('granularity', 'monthly')
    if gran == 'yearly':
        g = df.groupby('año')['monto'].sum().reset_index().sort_values('año')
        labels = g['año'].astype(str).tolist()
        vals = [float(v) for v in g['monto'].tolist()]
    else:
        g = df.groupby('mes_año')['monto'].sum().reset_index().sort_values('mes_año')
        labels = g['mes_año'].tolist()
        vals = [float(v) for v in g['monto'].tolist()]

    stacked = {}
    for neg in df['Negocio'].dropna().unique():
        ndf = df[df['Negocio'] == neg]
        if gran == 'yearly':
            ng = ndf.groupby('año')['monto'].sum().reset_index().sort_values('año')
            nd = dict(zip(ng['año'].astype(str), ng['monto']))
        else:
            ng = ndf.groupby('mes_año')['monto'].sum().reset_index().sort_values('mes_año')
            nd = dict(zip(ng['mes_año'], ng['monto']))
        stacked[neg] = [float(nd.get(l, 0)) for l in labels]

    total = float(df['monto'].sum())
    avg = float(df.groupby('mes_año')['monto'].sum().mean()) if 'mes_año' in df and not df.empty else 0
    max_month = float(df.groupby('mes_año')['monto'].sum().max()) if 'mes_año' in df and not df.empty else 0

    return jsonify({'labels': labels, 'values': vals, 'stacked': stacked,
                    'total': total, 'avg_monthly': avg, 'max_month': max_month,
                    'n_trans': int(len(df))})


@app.route('/api/r2', methods=['POST'])
def r2_comparative():
    p = request.json or {}
    df = build_df(get_records())
    df = apply_filters(df, {k: p[k] for k in ('negocio', 'sucursal') if k in p})

    y1 = int(p.get('year1', 2026))
    y2 = int(p.get('year2', 2025))
    months = [int(m) for m in p.get('months', list(range(1, 13)))]

    rows = []
    for m in months:
        v1 = float(df[(df['año'] == y1) & (df['mes'] == m)]['monto'].sum())
        v2 = float(df[(df['año'] == y2) & (df['mes'] == m)]['monto'].sum())
        pct = round((v1 - v2) / v2 * 100, 1) if v2 > 0 else 0
        rows.append({'month': MONTH_NAMES.get(m, str(m)), 'm': m,
                     'actual': v1, 'anterior': v2, 'pct': pct})

    tot1 = sum(r['actual'] for r in rows)
    tot2 = sum(r['anterior'] for r in rows)
    tot_pct = round((tot1 - tot2) / tot2 * 100, 1) if tot2 > 0 else 0
    best = max(rows, key=lambda r: r['pct']) if rows else None
    worst = min(rows, key=lambda r: r['pct']) if rows else None

    return jsonify({'rows': rows, 'y1': y1, 'y2': y2,
                    'tot1': tot1, 'tot2': tot2, 'tot_pct': tot_pct,
                    'best': best, 'worst': worst})


@app.route('/api/r3', methods=['POST'])
def r3_participation():
    p = request.json or {}
    df = build_df(get_records())
    df = apply_filters(df, p)

    total = float(df['monto'].sum())

    by_neg = df.groupby('Negocio')['monto'].sum().reset_index()
    pie = [{'label': str(r['Negocio']),
            'value': float(r['monto']),
            'pct': round(float(r['monto']) / total * 100, 1) if total > 0 else 0}
           for _, r in by_neg.iterrows()]

    monthly = df.groupby(['mes_año', 'Negocio'])['monto'].sum().reset_index()
    periods = sorted(monthly['mes_año'].unique().tolist())
    negocios = df['Negocio'].dropna().unique().tolist()
    stacked = {}
    for neg in negocios:
        nd = dict(zip(monthly[monthly['Negocio'] == neg]['mes_año'],
                      monthly[monthly['Negocio'] == neg]['monto']))
        stacked[neg] = [float(nd.get(per, 0)) for per in periods]

    by_branch = df.groupby(['Sucursal', 'Negocio'])['monto'].sum().reset_index()
    branches = {}
    for _, r in by_branch.iterrows():
        s = str(r['Sucursal'])
        if s not in branches:
            branches[s] = {}
        branches[s][str(r['Negocio'])] = float(r['monto'])

    by_tipo = df.groupby('Tipo')['monto'].sum().reset_index() if 'Tipo' in df else pd.DataFrame()
    tipo_data = [{'label': str(r['Tipo']), 'value': float(r['monto'])}
                 for _, r in by_tipo.iterrows()] if not by_tipo.empty else []

    return jsonify({'pie': pie, 'monthly': {'periods': periods, 'stacked': stacked},
                    'branches': branches, 'tipo': tipo_data, 'total': total})


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
