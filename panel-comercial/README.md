# 💼 Panel Comercial

CRM simple y autocontenido para **monitorear tus clientes y negocios**: en qué
etapa está cada uno, cuánto vale el pipeline, qué seguimientos tienes
pendientes y cuál es tu tasa de conversión.

Los negocios se cargan **a mano** (no depende de `xperticket` ni de
`mercado-publico`): tú decides qué cliente, oportunidad o negocio registrar.

> **Proyecto autocontenido.** Todo vive dentro de `panel-comercial/`. Ejecuta
> los comandos **desde esta carpeta**.

---

## 🚀 Instalación

```bash
cd panel-comercial
pip install -r requirements.txt
```

## 🖥️ Uso — Dashboard web

```bash
streamlit run app.py
```

1. **➕ Nuevo / Editar**: registra un negocio (cliente, valor estimado, etapa,
   probabilidad, próxima acción, notas) o edita uno existente.
2. **📈 Dashboard**: KPIs (pipeline abierto, valor ponderado, tasa de
   conversión, seguimientos vencidos), embudo por etapa, por fuente y
   evolución mensual.
3. **🗂️ Tablero**: vista tipo kanban por etapa, con selector para mover cada
   negocio de etapa directamente.
4. **📋 Tabla / Exportar**: tabla completa filtrable y descarga en CSV/Excel.

## ⌨️ Uso — Línea de comandos

```bash
# Registrar un negocio
python panel.py agregar --cliente "Teatro Municipal" --negocio "Renovación anual" \
    --valor 3500000 --moneda CLP --etapa Contactado --fuente referido

# Cambiar de etapa
python panel.py mover <id-del-negocio> --etapa "En negociación"

# Listar todos los negocios
python panel.py listar

# Exportar a Excel/CSV
python panel.py exportar --salida negocios.xlsx

# Ver cuántos negocios hay registrados
python panel.py estado
```

---

## 🧠 Etapas del pipeline

`Nuevo → Contactado → En negociación → Propuesta enviada → Ganado / Perdido`

Cada etapa trae una **probabilidad de cierre sugerida** (editable) que se usa
para calcular el **valor ponderado** del pipeline en el dashboard.

---

## 🧱 Arquitectura

```
panel_comercial/
  config.py      # etapas del pipeline, probabilidades por defecto, rutas
  models.py      # Negocio + serialización
  storage.py     # SQLite: negocios/leads
  analytics.py   # KPIs, embudo, seguimientos pendientes (pandas)
  export.py      # exportación CSV / Excel
  cli.py         # comandos de terminal
app.py           # dashboard Streamlit
panel.py         # punto de entrada de la CLI
```

Los datos viven en `data/` (SQLite), fuera del control de versiones
(`.gitignore`).
