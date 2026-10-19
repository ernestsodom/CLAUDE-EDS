# Liga Manquehue ⚽

Sitio de la liga de Ex Alumnos y Apoderados del Colegio Sagrados Corazones de Manquehue.
Next.js + Neon (Postgres) + Vercel.

## Qué tiene

**Sitio público** (categorías *Todo Competidor* y *Senior*):
Tabla de posiciones (se calcula sola) · Fixture · Resultados · Tribunal y sanciones · Comunicados · Equipos y planteles · Fotos.

**Panel administrador** (`/admin`, protegido con clave):
- **Equipos y jugadores**: agrega equipos; pega el plantel con un jugador por línea (`10 Juan Pérez`).
- **Fixture**: crea fechas y partidos a mano, o genera el "todos contra todos" con un clic.
- **Resultados**: escribe los goles y guarda. La tabla se actualiza al instante.
- **Tribunal**: suspensiones (fechas) y descuento de puntos (se resta en la tabla).
- **Comunicados**: para una categoría o ambas.
- **Fotos**: se comprimen en el celular antes de subirlas y se guardan en Neon.

Los botones de arriba del panel eligen la categoría con la que trabajas.

### Puntaje de arrastre
La tabla de Todo Competidor del Clausura 2026 se cargó como "arrastre" de cada equipo
(Equipos → *Editar nombre y puntaje de arrastre*). Los resultados que cargues se suman a eso.

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
