# 📊 Herramienta de Licitaciones de Mercado Público

Plataforma para **consultar, analizar y exportar licitaciones de Mercado Público
(ChileCompra)** por rubro, estado, proveedor y comprador (cliente), con filtros
potentes, gráficos, dashboards y exportación de datos.

Usa la **API oficial** de Mercado Público (`api.mercadopublico.cl`). Tu usuario se
conecta mediante tu **ticket** gratuito de la API.

---

## ✨ Funcionalidades

- 🔑 **Conecta tu usuario** pegando tu ticket de la API (se guarda localmente).
- 🗂️ **Consulta por rubros específicos** (clasificación UNSPSC: salud, médico,
  construcción, alimentos, TI, etc.).
- 🚦 **Licitaciones en todos los estados**: publicada, cerrada, **desierta**,
  adjudicada, revocada, suspendida.
- 🏢 **Gestión por cliente (comprador)** y por **proveedor adjudicado**.
- 🔁 **Compras similares anteriores**: encuentra licitaciones parecidas por rubro
  y texto.
- 🏜️ **Vista dedicada a licitaciones desiertas** con desglose por rubro.
- 🔎 **Filtros potentes**: texto, rubro, estado, región, comprador, rango de monto
  y fechas.
- 📈 **Dashboards y gráficos**: KPIs, distribución por estado/rubro/región,
  evolución temporal y ranking de compradores.
- ⬇️ **Vaciado de información** a CSV y Excel.
- 💾 **Caché local SQLite** para análisis rápido sin golpear la API.

---

> **Proyecto autocontenido.** Todo lo necesario vive dentro de esta carpeta
> (`mercado-publico/`), aislado de cualquier otro código del repositorio.
> Ejecuta todos los comandos **desde dentro de esta carpeta**.

## 🚀 Instalación

```bash
cd mercado-publico
pip install -r requirements.txt
```

Configura tu ticket en un archivo `.env` (copia `.env.example`):

```env
MP_TICKET=TU-TICKET-DE-LA-API
```

> El ticket gratuito se obtiene en el portal de desarrolladores de Mercado Público:
> https://api.mercadopublico.cl/modules/api/
> Sin ticket propio se usa uno de **demostración** con cuota muy limitada.

---

## 🖥️ Uso — Dashboard (interfaz web)

```bash
streamlit run app.py
```

1. En la barra lateral, **Conectar mi usuario** → pega y guarda tu ticket.
2. **Sincronizar datos**: elige rango de fechas y estado, y descarga.
3. Explora las pestañas: **Dashboard**, **Tabla / Exportar**,
   **Ficha & similares**, **Desiertas**.

---

## ⌨️ Uso — Línea de comandos

```bash
# Verificar tu ticket
python mp.py verificar --ticket TU-TICKET

# Descargar licitaciones de la última semana (con detalle: rubros y montos)
python mp.py sincronizar --desde 2026-06-01 --hasta 2026-06-10

# Solo desiertas
python mp.py sincronizar --estado desierta

# Exportar el caché filtrado por rubros (42 = médico, 85 = salud) a Excel
python mp.py exportar --rubro 42 --rubro 85 --salida salud.xlsx

# Ver cuántas licitaciones hay en el caché
python mp.py estado
```

---

## 🧱 Arquitectura

```
mercado_publico/
  config.py       # configuración y ticket (env vars)
  api_client.py   # cliente HTTP de la API oficial (reintentos, estados)
  models.py       # normalización de respuestas crudas → registros planos
  rubros.py       # catálogo de rubros (segmentos UNSPSC)
  storage.py      # caché SQLite + preferencias del usuario
  service.py      # orquestación: descargar → normalizar → cachear
  analytics.py    # filtros y agregaciones (pandas) para gráficos
  export.py       # exportación a CSV / Excel
  cli.py          # comandos de terminal
app.py            # dashboard Streamlit
mp.py             # punto de entrada de la CLI
```

---

## 📝 Notas

- La API pública tiene **cuota limitada por ticket**; por eso enriquecer el
  detalle (necesario para rubros y montos) está topado por `--limite` y se
  cachea localmente.
- El filtrado por **rubro** se basa en los códigos de categoría UNSPSC de los
  ítems de cada licitación, agrupados por su **segmento** (2 primeros dígitos).
- Los datos del caché (`data/`, `*.sqlite`) están en `.gitignore`.

---

## 📦 Extraer a su propio repositorio

Esta carpeta es un proyecto independiente y puede vivir en su propio repo de
GitHub. Desde tu máquina:

```bash
# 1. Crea un repositorio vacío en GitHub (web) llamado, por ej., mercado-publico-licitaciones

# 2. Copia esta carpeta a un lugar nuevo y conviértela en repo
cp -r mercado-publico ~/mercado-publico-licitaciones
cd ~/mercado-publico-licitaciones
git init
git add .
git commit -m "init: herramienta de licitaciones de Mercado Público"

# 3. Conéctala a tu repo de GitHub y sube
git remote add origin git@github.com:TU-USUARIO/mercado-publico-licitaciones.git
git branch -M main
git push -u origin main
```

A partir de ahí queda 100% separado del resto.
