# TeVendoElAuto.cl

Sitio de compra y consignación de vehículos, con back office y monitoreo.

- **Sitio público:** `public/index.html`. Carga vehículos, textos, logo y menú desde la base de datos.
- **Back office:** `public/admin.html` → `/admin`, protegido por contraseña.
- **API (funciones de Vercel):** `api/`
  - `site`: datos públicos
  - `lead`: formularios
  - `track`: visitas y clics
  - `media`: imágenes subidas
  - `admin`: acciones del back office
- **Base de datos:** Neon (Postgres). El esquema está en `db/schema.sql`.

## Back office

| Sección | Qué permite |
|---|---|
| Resumen | Personas que entraron, páginas vistas, clics en WhatsApp, vehículos más vistos y clickeados, origen de las visitas, dispositivos |
| Contactos | Todas las solicitudes clasificadas por tipo: cotización, visita, crédito, parte de pago, venta y contacto. Tiene estados, notas, botón de WhatsApp y exportación a Excel (CSV) |
| Vehículos | Agregar, editar, eliminar, subir fotos, destacar en portada y cambiar el estado. **Vendido** = foto en blanco y negro; **Reservado** = franja diagonal |
| Textos de la página | Editar cualquier texto de todas las páginas y agregar bloques de texto nuevos |
| Logo, menú y botones | Logo, imagen de portada, botones del menú (texto, orden, visibilidad), botón de WhatsApp y redes sociales |

## Variables de entorno (Vercel)

Ver `.env.example`: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

## Dominio definitivo

En Vercel, abre el proyecto `tevendoelauto` → Settings → Domains → agrega `tevendoelauto.cl` y configura el DNS según indique Vercel.

`maqueta/tevendoelauto-maqueta.html` es la maqueta estática original, en un solo archivo.
