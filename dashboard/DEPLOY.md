# 🚀 Cómo publicar el Dashboard online (gratis)

Esta guía te deja la herramienta accesible desde un **link** en tu celular o
computador, sin instalar nada. Usaremos **Render** (plan gratuito).

---

## Opción 1 — Render (recomendada, ~5 minutos)

### Paso 1 · Crear cuenta
1. Entra a **https://render.com**
2. Haz clic en **"Get Started"** y regístrate con tu cuenta de **GitHub**
   (la misma donde está el repositorio `ernestsodom/CLAUDE-EDS`).

### Paso 2 · Conectar el repositorio
1. En el panel de Render, haz clic en **"New +"** → **"Blueprint"**.
2. Selecciona el repositorio **`CLAUDE-EDS`**.
3. En la rama (branch) elige **`claude/eloquent-edison-AoHZj`**
   (o `main` si ya hiciste el merge).
4. Render detectará automáticamente el archivo **`render.yaml`** y mostrará
   el servicio **`dashboard-ventas`**.

### Paso 3 · Desplegar
1. Haz clic en **"Apply"** / **"Create Services"**.
2. Espera 2–4 minutos mientras Render instala y arranca la app.
3. Cuando termine, verás un link como:
   **`https://dashboard-ventas.onrender.com`**

¡Listo! Ese es tu link. Lo puedes guardar en favoritos y abrirlo cuando quieras.

---

## Opción 2 — Railway (alternativa)

1. Entra a **https://railway.app** y regístrate con GitHub.
2. **"New Project"** → **"Deploy from GitHub repo"** → elige `CLAUDE-EDS`.
3. En *Settings → Root Directory* escribe: `dashboard`
4. Railway leerá el archivo `Procfile` automáticamente y publicará la app.

---

## ⚠️ Cosas importantes que debes saber

- **Plan gratuito de Render:** la app "se duerme" tras 15 minutos sin uso.
  La primera visita después de eso tarda ~30–60 segundos en despertar.
  Las siguientes cargas son instantáneas. (Es normal y no cuesta nada.)

- **Tus datos reales NO se guardan en internet.** La versión publicada
  arranca con datos de demostración. Cuando subes tu Excel con el botón
  **"Cargar Excel"**, esos datos viven solo mientras la app esté activa
  (en memoria). Si la app se duerme y despierta, deberás volver a subir
  el archivo. Esto protege la información personal de tus clientes.

- **¿Quieres que los datos queden guardados de forma permanente?**
  Eso requiere agregar una base de datos. Avísame y lo preparo (también
  se puede hacer gratis con la base de datos de Render o Supabase).

---

## 💻 Alternativa: correrla en tu propio PC

Si prefieres no publicarla:

```bash
git clone https://github.com/ernestsodom/CLAUDE-EDS.git
cd CLAUDE-EDS/dashboard
pip install -r requirements.txt
python app.py
```

Luego abre **http://localhost:5000** en tu navegador.
