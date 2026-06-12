# 🎟️ Xperticket — Motor de Inteligencia & Prospección

Herramienta para **descubrir, analizar y priorizar clientes potenciales** de
[Xperticket.cl](https://xperticket.cl) (SaaS de venta y gestión de entradas) en
el mercado cultural y de entretenimiento de Chile (teatros, cines, museos,
planetarios, corporaciones culturales, trampoline parks, parques temáticos,
centros de eventos).

Implementa los **5 módulos** del *Prompt Maestro*:

| Módulo | Qué hace | Código |
| --- | --- | --- |
| 1 · **Discovery** | Identifica y normaliza prospectos en Chile, deduplica y valida contacto | `discovery.py`, `seed.py` |
| 2 · **Web Intelligence** | Scraping ético: detecta ticketera, pasarela, CMS, comisiones y pain points | `web_intel.py` |
| 3 · **Financial Analysis** | Estima volumen, comisión y **ROI** de migrar a Xperticket | `finance.py` |
| 4 · **Value Proposition** | Propuesta personalizada por segmento + narrativa de email (con Claude opcional) | `proposals.py` |
| 5 · **Contact Strategy** | **Score 0-100**, plan de contacto en 3 pasos y templates de outreach | `contact.py` |

> **Proyecto autocontenido.** Todo vive dentro de `xperticket/`. Ejecuta los
> comandos **desde esta carpeta**.

---

## 🚀 Instalación

```bash
cd xperticket
pip install -r requirements.txt
```

Configura variables (opcional) copiando `.env.example` a `.env`:

```env
# Solo si quieres narrativas de email generadas con IA (si no, usa plantillas):
ANTHROPIC_API_KEY=tu-api-key

# Tipos de cambio para el ROI (ACTUALÍZALOS periódicamente):
XPERTI_UF_CLP=39000
XPERTI_USD_CLP=960
```

---

## 👀 ¿Solo quieres VER los resultados? (sin instalar nada)

Genera un **reporte web en un solo archivo** que se abre con doble clic en
cualquier navegador (no necesita internet ni servidores):

```bash
python xperti.py sembrar
python xperti.py analizar --todos
python xperti.py reporte --salida xperticket_reporte.html
```

Doble clic en `xperticket_reporte.html` y verás KPIs, el ranking filtrable de
prospectos y, por cada uno, su análisis, propuesta y el email listo para copiar.
Hay un ejemplo ya generado en [`ejemplos/xperticket_reporte_demo.html`](ejemplos/xperticket_reporte_demo.html)
(descárgalo y ábrelo).

---

## ⌨️ Uso rápido — Línea de comandos

```bash
# 1. Cargar el dataset semilla de instituciones culturales de Chile
python xperti.py sembrar

# (o importar TU lista de 100-200 prospectos; genera la plantilla primero)
python xperti.py plantilla --salida mi_lista.csv
python xperti.py importar mi_lista.csv      # CSV o JSON, encabezados flexibles

# 2. Validar contacto público
python xperti.py validar

# 3-6. Analizar todos los prospectos (módulos 2-5)
python xperti.py analizar --todos --comision 3

# Ver el Top 30 por score
python xperti.py ranking --top 30

# Ficha completa de un prospecto (análisis + email de contacto)
python xperti.py ficha teatro-municipal-de-las-condes

# Exportar para actuar manualmente / Google Sheets
python xperti.py exportar --que analisis   --salida analisis.csv
python xperti.py exportar --que analisis   --salida analisis.json
python xperti.py exportar --que propuestas --salida propuestas.csv

# Estado de la base
python xperti.py estado
```

### Narrativa con IA (opcional)

```bash
python xperti.py analizar --todos --claude   # usa Claude para el email
```

Sin `ANTHROPIC_API_KEY` se usan narrativas de plantilla (deterministas), igual
de funcionales.

---

## 🖥️ Uso — Dashboard web

```bash
streamlit run app.py
```

1. **Cargar dataset semilla** (o importar tu CSV) en la barra lateral.
2. Ajustar la **comisión Xperticket** y pulsar **Analizar todos**.
3. Explorar pestañas: **Dashboard** (KPIs y gráficos), **Ranking / Tabla**
   (filtrable), **Ficha & Propuesta** (análisis + emails), **Exportar**.

---

## 🧠 Cómo decide la herramienta

- **Score (0-100)** = Volumen (0-30) + Comisión actual (0-30) +
  Facilidad de contacto (0-20) + Fit cultural (0-20). Ver `contact.py`.
- **ROI anual (USD)** = ahorro de comisiones + beneficios intangibles
  (automatización, CRM, venta dinámica). Ver `finance.py`.
- **Supuestos por segmento** (volumen, ticket promedio, intangibles, dolores y
  oportunidades) y **benchmarks de ticketeras** están centralizados en
  `catalog.py` — ajústalos ahí para calibrar el motor sin tocar la lógica.

### Scraping ético

`web_intel.py` respeta `robots.txt`, se identifica con un User-Agent propio,
agrega *delays* entre peticiones y nunca martillea un sitio. Si una web bloquea
bots (WAF) o no responde, el análisis **degrada con elegancia** a una
estimación heurística por segmento, marcando `fuente_datos = heuristica_segmento`
para que sepas que ese dato no se leyó de la web.

---

## ⚠️ Sobre los datos

- El **dataset semilla** (`seed.py`) es un punto de partida representativo, **no
  verificado**: los sitios web son de mejor esfuerzo y los emails/teléfonos se
  dejan vacíos a propósito. **Valida cada contacto antes de cualquier outreach.**
- Las **comisiones por ticketera** y los **supuestos de volumen** son rangos de
  mercado orientativos; refínalos con datos reales cuando los tengas.
- Los **tipos de cambio UF/CLP/USD** cambian: mantenlos al día en `.env`.
- Re-analiza periódicamente: `analizar --todos --forzar` (por defecto reusa
  análisis de menos de `XPERTI_REANALISIS_DIAS` días).

---

## 🧱 Arquitectura

```
xperticket/
  config.py      # configuración (env vars, rutas, tipos de cambio)
  catalog.py     # dominio: tipos, regiones, ticketeras, supuestos por segmento
  models.py      # Prospecto + serialización
  seed.py        # dataset semilla de instituciones de Chile
  storage.py     # SQLite: prospectos + análisis + preferencias
  discovery.py   # MÓDULO 1: descubrimiento, importación, dedupe, validación
  web_intel.py   # MÓDULO 2: scraping ético + detección + pain points
  finance.py     # MÓDULO 3: volumen, comisiones y ROI
  proposals.py   # MÓDULO 4: propuesta de valor + narrativa (Claude opcional)
  contact.py     # MÓDULO 5: scoring + plan de contacto + templates
  pipeline.py    # orquestación end-to-end + batch + re-priorización
  analytics.py   # agregaciones (pandas) para dashboard
  export.py      # exportación CSV / Excel / JSON
  cli.py         # comandos de terminal
  util.py        # logging y formato
app.py           # dashboard Streamlit
xperti.py        # punto de entrada de la CLI
```

Datos y caché viven en `data/` (SQLite + `analisis.log`), fuera del control de
versiones (`.gitignore`).

---

## 🗺️ Roadmap (siguientes pasos)

- Conectar **Google Places / directorios públicos** para auto-descubrir
  prospectos (hoy: semilla + importación).
- Parsear **calendarios de eventos** reales para afinar volumen.
- Integración con **Gmail / Google Sheets** para enviar y registrar outreach.
- Registro de **respuestas y seguimiento** (estado del pipeline comercial).
