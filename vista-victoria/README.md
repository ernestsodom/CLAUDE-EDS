# Vista Victoria — réplica de landing page

Réplica en HTML/CSS/JS puro (sin frameworks ni build step) de la landing page
de **Condominio Vista Victoria** (`vistavictoria.cl`), construida a partir de
capturas de pantalla del sitio original — no del código fuente real, al que
no fue posible acceder desde este entorno.

## ⚠️ Qué es y qué no es esto

- Reproduce **estructura, textos, secciones, orden y estilo visual**
  (colores, tipografía, layout) tal como aparecen en las capturas.
- **No** es un scrape del HTML/CSS/JS original — es una implementación nueva
  que imita el resultado visual.
- Las **imágenes son placeholders SVG** generados (fondos de color + texto
  indicando qué foto va ahí). Hay que reemplazarlas por las fotos/renders
  reales del proyecto.
- Colores y fuente exactos son una **aproximación visual** a partir de las
  capturas — ajusta los tokens en `css/style.css` si tienes los valores
  exactos de marca (Pantone/HEX, familia tipográfica real, etc.).

## Estructura

```
vista-victoria/
├── index.html          # Todas las secciones de la página
├── css/style.css        # Estilos (tokens de color/tipografía al inicio)
├── js/script.js         # Carruseles de imágenes + formulario de contacto (demo)
├── assets/img/          # Placeholders SVG — reemplazar por fotos reales
└── README.md
```

## Cómo verla

No requiere instalación ni build. Abre `index.html` directo en el navegador,
o levanta un servidor local simple:

```bash
cd vista-victoria
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Cómo editarla

- **Textos y estructura** → `index.html`
- **Colores / tipografía / espaciados** → variables `:root` al inicio de
  `css/style.css` (`--color-tan`, `--color-sage`, `--color-gray`,
  `--color-taupe`, `--font-heading`, `--font-body`, etc.)
- **Fotos** → reemplaza los archivos en `assets/img/` (mantén los mismos
  nombres o actualiza las rutas `src` en `index.html`)
- **Formulario de contacto** → `js/script.js`, función `initLeadForm()`.
  Ahora mismo solo valida y muestra un mensaje en pantalla; para que envíe
  datos de verdad hay que conectarlo a un backend, Zapier Webhook, Google
  Sheets, CRM, etc. (hay un `TODO` marcado en el código).
- **Mapa** → el iframe de Google Maps usa la dirección "Reina Victoria 7001,
  La Reina, Santiago, Chile" vía `output=embed` (no requiere API key).

## Secciones incluidas

1. Hero con logo e imagen de fachada
2. Intro ("Descubre el balance entre diseño, conexión y calidad de vida")
3. Formulario de contacto (Nombre, Mail, Teléfono, Rut)
4. Ficha técnica (6 Casas / Programa / Dirección / Valor)
5. Equilibrio comunidad-privacidad + precios de lanzamiento
6. Espacios modernos + botón "Ver Tour Virtual"
7. El Conjunto (descripción, bullets, carrusel exterior, plantas 1º y 2º piso)
8. La Casa (descripción, bullets, carrusel interior)
9. Mapa de ubicación
10. Footer con colaboradores (Grupo IRV, PAR Arquitectos, Grupo Nortem, RCP
    Constructora, Itaú, Rosenthal & Cia Abogados)
