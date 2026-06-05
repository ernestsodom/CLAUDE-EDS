# 📊 Dashboard de Ventas — Cerogrado & Trampoline Park

Herramienta web gráfica para analizar las ventas de pistas de patinaje en
hielo (**Cerogrado**) y parques de trampolines (**Trampoline Park**) a partir
de las exportaciones de pedidos en Excel.

## Reportes incluidos

1. **📈 Ventas Históricas** — Evolución de ventas con línea de tendencia.
   Filtros: negocio, sucursal, rango de fechas y granularidad (mensual/anual).
2. **🔀 Ventas Comparativas** — Compara dos años por mes (elige qué meses),
   muestra el % de crecimiento/decrecimiento y una tabla resumen.
3. **🍩 Participación por Negocio** — Trampoline Park vs Cerogrado sobre el
   total, con donut, evolución mensual, ranking de sucursales y tipos de pedido.

## Cargar tus datos

Usa el botón **"Cargar Excel"** (arriba a la derecha). Acepta el formato
`.xls` de Softland (XML) y `.xlsx`. Solo procesa pedidos en estado
**"Finalizado"** y evita duplicados por N° de Pedido.

> La app arranca con **datos de demostración sintéticos** (sin información
> personal real). Tus datos reales solo se cargan cuando subes el archivo.

## Ejecutar localmente

```bash
pip install -r requirements.txt
python app.py
# Abrir http://localhost:5000
```

## Publicar online

Ver **[DEPLOY.md](DEPLOY.md)** para la guía paso a paso (Render / Railway).

## Estructura

```
dashboard/
├── app.py              # Servidor Flask + API de los 3 reportes
├── templates/
│   └── index.html      # Interfaz completa (filtros + gráficos Plotly)
├── requirements.txt    # Dependencias Python
├── Procfile            # Configuración para Railway/Heroku
├── DEPLOY.md           # Guía de publicación online
└── README.md
```

## Tecnología

- **Backend:** Flask + pandas (agregaciones y filtros)
- **Frontend:** Plotly.js (gráficos interactivos), sin frameworks pesados
- **Producción:** gunicorn
