# 🚀 Guía de despliegue online (gratis)

---

## Paso 0 · Crear base de datos permanente en Supabase (5 min)

Supabase ofrece PostgreSQL gratuito. Sin este paso los datos se pierden
cuando Render reinicia el servicio (cada ~7 días en plan gratuito).

1. Entra a **https://supabase.com** → **"Start your project"**
2. Regístrate con GitHub
3. Crea un **nuevo proyecto** (elige región más cercana, ej. South America)
4. Cuando termine de aprovisionar, ve a:
   **Settings → Database → Connection String → URI**
5. Copia la cadena que empieza con `postgresql://postgres:...`
   Guárdala, la usarás en el Paso 3.

---

## Paso 1 · Crear cuenta en Render

1. Entra a **https://render.com**
2. Haz clic en **"Get Started"** → regístrate con tu cuenta de **GitHub**

---

## Paso 2 · Conectar el repositorio

1. En el panel de Render: **"New +"** → **"Blueprint"**
2. Selecciona el repo **`CLAUDE-EDS`**
3. Elige la rama **`claude/eloquent-edison-AoHZj`** (o `main` si hiciste merge)
4. Render detecta el archivo `render.yaml` y muestra el servicio **`dashboard-ventas`**

---

## Paso 3 · Configurar la base de datos

Antes de hacer clic en "Apply":

1. En la sección de variables de entorno, busca **`DATABASE_URL`**
2. Pega la cadena de conexión de Supabase que copiaste en el Paso 0
3. Ahora haz clic en **"Apply"**

Si no configuras `DATABASE_URL`, la app igual funciona pero con SQLite
(los datos se pierden al reiniciar).

---

## Paso 4 · Desplegar

Render instala dependencias y arranca la app (~3-4 min).
Al terminar obtienes un link permanente:

**`https://dashboard-ventas.onrender.com`**

---

## ⚠️ Notas importantes

- **Plan gratuito de Render:** la app "se duerme" tras 15 min sin uso.
  La primera visita puede tardar ~30-60 seg en despertar. Es normal.

- **Tus datos personales de clientes NO se publican en internet.**
  Subes tu Excel desde la interfaz ("Cargar Excel"); los datos van
  directamente a la base de datos, nunca a GitHub.

- **Múltiples archivos:** puedes subir un archivo por mes o semana.
  Los pedidos duplicados se ignoran automáticamente por N° de Pedido.

---

## 💻 Uso local (sin necesidad de internet)

```bash
git clone https://github.com/ernestsodom/CLAUDE-EDS.git
cd CLAUDE-EDS/dashboard
pip install -r requirements.txt
python app.py
# Abrir http://localhost:5000
```

Los datos se guardan en `ventas.db` junto al código. Persisten entre
reinicios del servidor local sin necesidad de configurar nada más.
