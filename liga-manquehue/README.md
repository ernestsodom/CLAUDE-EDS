# Liga Manquehue ⚽

Sitio de la liga de Ex Alumnos y Apoderados del Colegio Sagrados Corazones de Manquehue.
Next.js + Neon (Postgres) + Vercel.

## Qué tiene

**Sitio público** (categorías *Todo Competidor* y *Senior*):
Tabla de posiciones (se calcula sola) · Fixture · Resultados y goleadores · Tribunal, sanciones y fair play ·
Comunicados · Equipos (escudo, foto y plantel) · Fotos · La Liga (historia, directiva, reglamentos en PDF, tesorería y contacto).
La portada muestra el video de bienvenida (`public/video/inicio.mp4`).

**Panel administrador** (`/admin`, protegido con clave):
- **Equipos y jugadores**: agrega equipos; pega el plantel con un jugador por línea (`10 Juan Pérez`).
- **Fixture**: crea fechas y partidos a mano, o genera el "todos contra todos" con un clic.
- **Resultados**: escribe los goles y guarda. La tabla se actualiza al instante.
- **Tribunal**: suspensiones (fechas) y descuento de puntos (se resta en la tabla).
- **Comunicados**: para una categoría o ambas.
- **Fotos**: se comprimen en el celular antes de subirlas y se guardan en Neon.
- **Documentos**: PDF de reglamentos y anexos (máx. 3 MB).
- **Historia y textos**: historia, directiva, administración y contacto, con un formato de texto simple.

Los botones de arriba del panel eligen la categoría con la que trabajas.

### Contenido importado del sitio anterior (ligassccmanquehue.cl)
Fixture completo del Clausura 2026 (TC y Senior, con libres, fecha recuperativa y play off),
resultados de las fechas 1 a 4, escudos, fotos de equipos, goleadores y fair play publicados (Fecha 4),
historia, directiva, tesorería, contacto, los 10 PDF reglamentarios y el video de inicio.

### Puntaje de arrastre
Las tablas de posiciones vigentes (TC y Senior) son la referencia. Como no todos los partidos tienen
resultado cargado, cada equipo tiene un "arrastre" = tabla vigente − resultados cargados
(Equipos → *Editar equipo*). Los resultados que cargues desde ahora se suman a eso.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Neon |
| `ADMIN_PASSWORD` | Clave para entrar a `/admin` |

## Desarrollo

```bash
cp .env.example .env.local   # completa los valores
npm install
npm run db:setup             # crea tablas y carga la tabla inicial (seguro de repetir)
npm run dev
```

## Despliegue en Vercel
1. Importa el repositorio en Vercel y define **Root Directory = `liga-manquehue`**.
2. Agrega `DATABASE_URL` y `ADMIN_PASSWORD` en *Settings → Environment Variables*.
3. Deploy.
