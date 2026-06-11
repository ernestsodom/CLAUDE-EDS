# 🎯 Radar de Licitaciones — Proexsi (Mercado Público)

Plataforma de **inteligencia comercial** sobre Mercado Público (ChileCompra),
**dirigida a Proexsi**: enfocada en **municipalidades** y rubro **TI
(software / hardware)**, con vigilancia de la **competencia**, compras similares,
último proveedor adjudicado y contratos por terminar.

Usa la **API oficial** de Mercado Público (`api.mercadopublico.cl`). Tu usuario se
conecta mediante tu **ticket** gratuito de la API.

---

## ✨ Funcionalidades

### Foco comercial Proexsi
- 🏛️ **Filtro municipalidades** activado por defecto (detecta municipalidades,
  corporaciones municipales, DAEM, etc.).
- 💻 **Perfil TI** (software/hardware): rubros UNSPSC **43** y **81** + palabras
  clave (ERP, licencias, servidores, ciberseguridad, nube…).
- 🥊 **Vigilancia de competencia** por RUT y nombre:
  **CAS-Chile** (`96.525.030-1`), **SMC** (`89.906.900-5`),
  **Insico** (`79.560.740-4`). Editable en `mercado_publico/perfil.py`.
- 🏆 **Último proveedor adjudicado** para servicios similares (¿quién ganó y por
  cuánto?), clave para posicionar tu oferta.
- ⏰ **Contratos por terminar**: estima el término del contrato para detectar
  oportunidades de relicitación/renovación.
- 🎯 **Radar**: oportunidades abiertas en municipalidades + TI en un vistazo,
  marcando las **ganadas por Proexsi**.

### Ficha completa e investigación (estilo LicitaLab)
- 🗂️ **Ficha detallada** por licitación: comprador, fechas clave (publicación,
  preguntas, apertura, cierre, adjudicación), **ítems** solicitados, montos,
  **proveedores adjudicados** y datos de contacto.
- 📄 **Documentación**: enlace a la ficha y bases en Mercado Público + **acta de
  adjudicación** (PDF) cuando la API la expone.
- 💰 **Valores de compras similares**: rango y promedio de lo estimado y
  adjudicado en servicios parecidos (para fijar tu precio).
- 🏆 **Último proveedor adjudicado** en servicios similares.
- 🕘 **Últimas compras del comprador** (historial del cliente).

> ⚠️ **Carga rápida vs. datos completos:** la API de listado NO entrega comprador
> ni proveedor. Para filtrar por municipalidad/competencia con velocidad, usa el
> **importador masivo** (CSV de Datos Abiertos) o la sincronización **con detalle**
> (en paralelo). La API pública **no entrega archivos adjuntos** (bases/anexos):
> se abren desde la ficha oficial enlazada.

### Base
- 🔑 **Conecta tu usuario** con tu ticket de la API.
- 🗂️ **Consulta por rubros** (clasificación UNSPSC completa).
- 🚦 **Todos los estados**: publicada, cerrada, **desierta**, adjudicada,
  revocada, suspendida.
- 🔁 **Compras similares anteriores** por rubro y texto.
- 🔎 **Filtros potentes**: municipalidades, perfil TI, competidor, proveedor,
  texto, rubro, estado, región, monto, fechas.
- 📈 **Dashboards y gráficos** + ⬇️ **exportación** a CSV y Excel.
- 💾 **Caché local SQLite**.

---

## 🥊 Competencia vigilada (editable)

| Empresa | RUT | Foco |
|---|---|---|
| **Proexsi** (tú) | 85.825.700-K | ERP / IT municipal |
| **CAS-Chile** | 96.525.030-1 | Software gestión pública |
| **SMC** | 89.906.900-5 | TI municipal |
| **Insico** | 79.560.740-4 | ERP municipal |

Para añadir/quitar competidores, edita la lista `COMPETIDORES` en
`mercado_publico/perfil.py`.

> ⚠️ **Sobre "contratos por terminar":** la API pública no siempre publica la
> duración del contrato. La fecha de término se **estima** a partir de la fecha de
> adjudicación + duración declarada cuando está disponible; si no, no aparece.

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
