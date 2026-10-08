# Propuesta web — PAROCK Group (parock.cl)

Maqueta navegable: `index.html` (abrir en el navegador; las imágenes están en `assets/`).
Fuentes: *Brief Desarrollo Web PAROCK* + *Selling Story Supermercados Cugat* (identidad gráfica, fotos, envases y datos de mercado).

## 1. Estructura (one-page con menú anclado, escalable a páginas)

| Menú | Sección | Contenido |
|---|---|---|
| Inicio | Hero | Inspirado en la portada de la Selling Story: gato a la izquierda y perro a la derecha en marcos curvos, logo PAROCK, mensaje principal, 2 CTA y franja «Nuestro portafolio» con los logos de Minino y PetMetro |
| Nosotros | Quiénes somos | Texto breve, 3 cifras, alianza con Roval SpA y fichas del equipo (Marcelo Parodi y Kevin Rosenkranz) |
| Nuestra Propuesta | 4 pilares | Portafolio competitivo · Conocimiento del consumidor · Desarrollo de categorías · Relaciones de largo plazo |
| | Visión de categoría | Cita principal, 3 tendencias (humanización, bienestar, valor) y datos de mercado de Nielsen, Euromonitor y Kantar |
| | ¿Por qué PAROCK? | Los 5 servicios del brief en una lista numerada |
| Portafolio | Marcas | Foto con la línea completa · Minino 4 kg destacado (4 atributos) · PetMetro con 4 líneas (envase, descripción, atributos y formato, **sin precios**) · bloque «Nuevas marcas» |
| Contacto | Formulario + datos | Nombre, Empresa, Correo y Mensaje · honeypot + Turnstile/reCAPTCHA · casilla de consentimiento · botón *mailto* comercial · dirección |
| Footer | | Logo, navegación, contacto, Política de privacidad y Términos de uso |

## 2. Sistema visual (extraído de la Selling Story)

- **Colores:** azul marino `#0F1D2B` (logo y bandas oscuras), dorado `#A9864E` → `#C9A86B` (palabra «GROUP», títulos y detalles), crema `#F7F3EC` (fondos). Como acentos se usan los colores propios de cada marca: verde Minino, rojo PetMetro y naranja de las fichas de producto.
- **Recursos gráficos:** curvas marino con filo dorado en las esquinas (igual que en la presentación), huellas en marca de agua, títulos en peso *light* con la palabra clave en *extra bold*.
- **Tipografía:** Montserrat (geométrica, coherente con el logo) para títulos e Inter para textos.
- **Fotografía:** grande y emocional (perros y gatos en hogar, luz cálida). Los envases van sin modificar sobre fondos neutros.
- **Responsive:** probado a 1440 px y 390 px, sin scroll horizontal y con menú hamburguesa en móvil.

## 3. Contenido de la Selling Story que NO se incluyó (a propósito)

- Las comparativas de góndola con marcas de la competencia y de Cugat, Líder, Tottus, Jumbo y Unimarc: es información estratégica para un cliente y no debe ir en un sitio público.
- El logo de Cugat: el sitio es corporativo y no está dirigido a un cliente específico.
- Precios: el brief pide no publicarlos.
- Formatos de venta («caja de 24 latas», «pallet a medida»): aparecen solo como dato breve. Si prefieren reservarlos para la conversación comercial, se pueden quitar.

## 4. Puntos a confirmar con PAROCK

1. **Gramaje de Balance Nutrition:** el brief dice 400 g, pero las latas muestran **430 g** y la caja dice «24 latas de 430 g». La maqueta usa 400 g.
2. **Nombre de la línea de galletas:** el brief dice *Crunchy Biscuits* y la presentación dice *Snacks Biscuits*. La maqueta usa el nombre del brief.
3. **Correo comercial:** se usa `contacto@parock.cl` como ejemplo.
4. **Fotos del equipo y mención a Roval SpA:** ¿se publican?
5. **Logos en alta resolución:** los de Minino y PetMetro se recortaron del PDF. Para producción se necesitan los originales en SVG o PNG con fondo transparente, más las fotos de envases en alta resolución.
6. **Datos de mercado:** confirmar que se pueden citar públicamente (Nielsen, Euromonitor, Kantar).
7. **Fotografías:** las imágenes de la presentación parecen generadas o de banco. Hay que verificar sus derechos de uso o reemplazarlas por fotos licenciadas.

## 5. Recomendación técnica

- **Plataforma:** WordPress con un tema a medida (o Astro con un CMS headless como Sanity o Decap). El cliente podrá editar productos, fotos y textos sin programar.
- **Modelo de contenido escalable:** *Marca → Línea → Producto* (envase, descripción, atributos, formato). Agregar una nueva marca o categoría no requiere rediseñar el sitio.
- **Hosting y SSL:** Vercel, Netlify o un hosting chileno con certificado HTTPS gratuito (Let's Encrypt). Dominio parock.cl en NIC Chile.
- **SEO básico:** etiquetas meta y Open Graph (ya incluidas en la maqueta), sitemap.xml, schema.org `Organization` y `Product`, imágenes en WebP con texto alternativo y Google Search Console.
- **Formulario:** envío a un correo o CRM con Cloudflare Turnstile + honeypot (el honeypot ya está implementado en la maqueta).
- **Legal:** Política de privacidad conforme a la Ley 19.628 y a la Ley 21.719 (protección de datos personales en Chile).
