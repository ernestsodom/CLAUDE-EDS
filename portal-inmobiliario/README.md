# 🏠 Extractor de Portal Inmobiliario

Extrae avisos de **portalinmobiliario.com** según filtros (operación, tipo,
comuna, precio, dormitorios, baños, superficie, características…) y genera un
**informe HTML autónomo** con cifras, gráfico precio vs m² y tabla ordenable,
además de **CSV** (listo para Excel) y **JSON**.

> **Proyecto autocontenido.** Todo vive en esta carpeta (`portal-inmobiliario/`).
> Ejecuta los comandos **desde dentro de esta carpeta**.

---

## 🔐 Acceso al sitio: lo que hay que saber

Portal Inmobiliario es de MercadoLibre, que bloquea el tráfico que considera
automatizado. Lo comprobado (octubre 2026):

| Desde dónde | Resultado |
|---|---|
| Servidor en la nube (IP de datacenter), con HTTP o con Chromium real | Redirige a **"¡Hola! Para continuar, ingresa a tu cuenta"** en todo el sitio |
| API pública de MercadoLibre (`/sites/MLC/search`) | **403**: la búsqueda requiere app autorizada desde 2025 |
| Conexión de hogar/oficina | Debería cargar normal (es la vía recomendada; verifícalo con `diagnostico`) |

Por eso hay tres formas de usar la herramienta:

1. **En tu computador (recomendado).** `python pi.py diagnostico` confirma el
   acceso y luego `python pi.py buscar …` funciona directo.
2. **Con una sesión iniciada.** Si el sitio te pide cuenta, ejecuta una vez
   `python pi.py login` (abre un navegador, inicias sesión y se guarda en
   `sesion_pi.json`). Para usarlo en la nube, `python pi.py exportar-sesion`
   imprime el valor para la variable **`PI_COOKIES`**: guárdalo como *secreto*
   del entorno, nunca en el repositorio ni en un chat. Usa una cuenta
   secundaria de MercadoLibre: la cookie da acceso a la cuenta, caduca, y
   MercadoLibre puede pedir verificación si la sesión se usa desde otra red.

   Sin instalar nada, el mismo valor se obtiene desde Chrome: con la sesión
   iniciada abre cualquier búsqueda, `F12` → pestaña **Network** → recarga con
   `F5` → clic en la primera fila (la página) → **Headers** → *Request
   Headers* → `cookie` → clic derecho → **Copy value**.
3. **Páginas guardadas a mano.** Abre la búsqueda en tu navegador, guárdala
   con `Ctrl+S` y procésala con `python pi.py desde-html pagina.html`. Sin
   automatización; siempre funciona.

---

## 🚀 Instalación

```bash
cd portal-inmobiliario
pip install -r requirements.txt

# Opcional, para --navegador y login:
pip install playwright && python -m playwright install chromium
```

## 🖥️ Uso

```bash
# ¿Este equipo puede leer el sitio?
python pi.py diagnostico

# Ver la URL que corresponde a unos filtros (no se conecta)
python pi.py url --comuna "Ñuñoa" --dormitorios-min 2 --precio-max 6000 --con terraza

# Buscar y generar el informe (5 páginas de 48 avisos como máximo)
python pi.py buscar --operacion venta --tipo departamento --comuna "Las Condes" \
    --dormitorios 3 --precio-max 15000 --con terraza --con estacionamiento-visitas

# Arriendos en pesos, ordenados por precio
python pi.py buscar --operacion arriendo --comuna Providencia --precio-max 900000 \
    --moneda CLP --orden precio-asc --paginas 3

# Usar una búsqueda armada en el sitio (copia la URL del navegador)
python pi.py buscar --url "https://www.portalinmobiliario.com/venta/casa/la-reina-metropolitana"

# Procesar páginas guardadas con el navegador
python pi.py desde-html busqueda-p1.html busqueda-p2.html
```

Cada búsqueda deja en `salida/` tres archivos con el mismo nombre:

- **`.html`**: el informe. Ábrelo con doble clic; tiene filtros propios
  (texto, dormitorios, precio máximo, solo rebajas), cifras, gráfico y tabla.
- **`.csv`**: separado por `;`, con coma decimal y BOM, para abrir en Excel.
- **`.json`**: todos los datos y metadatos de la búsqueda.

Con `--artefacto` se guarda además una versión del informe sin
`<html>/<body>`, lista para publicarla como artefacto de Claude.

## 🔎 Filtros

| Opción | Ejemplo | Token del sitio |
|---|---|---|
| `--operacion` | `venta`, `arriendo`, `arriendo-de-temporada` | ruta |
| `--tipo` | `departamento`, `casa`, `oficina`, `terreno`… | ruta |
| `--comuna` / `--region` | `"Las Condes"` / `valparaiso` | `las-condes-metropolitana` |
| `--ubicacion` | `barrio-el-golf-las-condes-santiago-metropolitana` | slug libre (barrios) |
| `--condicion` | `nuevo` / `usado` | `proyectos` / `propiedades-usadas` |
| `--dormitorios`, `--dormitorios-min/max` | `3` | `3-dormitorios`, `BEDROOMS_2-*` |
| `--banos-min` | `2` | `FULL*BATHROOMS_2-*` |
| `--estacionamientos-min` | `1` | `PARKING*LOTS_1-*` |
| `--precio-min/max` + `--moneda` | `--precio-max 8000` (UF) | `PriceRange_…CLP` (UF convertida con el valor del día) |
| `--m2-min/max` | `60` / `120` | `COVERED*AREA_60m²-120m²` |
| `--m2-total-min/max` | | `TOTAL*AREA_…` |
| `--antiguedad-max` | `0` = a estrenar | `PROPERTY*AGE_*-0años` |
| `--gastos-comunes-max` | `150000` | `MAINTENANCE*FEE_*-150000CLP` |
| `--con` (repetible) | `terraza`, `piscina`, `gimnasio`, `ascensor`, `amoblado`, `mascotas`… | `HAS*TERRACE_242085`… |
| `--publica` | `particular` / `profesional` | ruta |
| `--publicados-hoy` | | `PublishedToday_YES` |
| `--orden` | `precio-asc`, `precio-desc` | `OrderId_PRICE` |

`python pi.py buscar --help` lista todas las opciones.

## ✅ Cómo se valida

- La gramática de URLs se tomó de los enlaces de filtro que genera el propio
  sitio; las pruebas comprueban que 18 combinaciones producen **exactamente**
  la URL del sitio.
- El extractor se probó con 7 páginas reales (venta, arriendo en UF y pesos,
  casas, proyectos "Desde", oficinas): 253 avisos, todos con precio y moneda.
- Cada informe muestra **los filtros que el sitio confirmó** (sus etiquetas de
  filtros aplicados). Si alguno de los pedidos no figura entre los que la
  página reporta como aplicados, el informe lo advierte.
- Además se re-verifican en local precio, dormitorios, baños y superficie; los
  avisos que no cumplen se descartan y se informa cuántos.
- La paginación (`_Desde_N`) y el orden se contrastan con el offset y orden
  que reporta la página; si no coinciden, se detiene y lo avisa.

```bash
python -m unittest discover -s tests -v
```

## ⚖️ Uso responsable

Pensado para consultas personales de poco volumen: pausa de ~3–4,5 s entre
páginas y 5 páginas por búsqueda por defecto (`PI_PAUSA`, `PI_MAX_PAGINAS`).
Los términos de MercadoLibre restringen el acceso automatizado; no lo uses
para copias masivas ni para republicar avisos.
