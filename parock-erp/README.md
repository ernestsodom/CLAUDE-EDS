# PAROCK · Sistema de gestión (v1)

Aplicación web interna de PAROCK construida a partir de `Brief_PAROCK_ERP_v1` y de los comentarios sobre la maqueta
(`Comentarios_ERP`). Usa la identidad de la web PAROCK.

- **Frontend:** `public/` (HTML + CSS + JS, sin build).
- **API:** `api/*.js`, funciones serverless de Vercel (Node 22).
- **Base de datos:** Neon PostgreSQL (`db/schema.sql`). El driver es `@neondatabase/serverless`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Neon (pooler). |
| `AUTH_SECRET` | Secreto de al menos 32 caracteres para firmar las sesiones. |

## Base de datos

```bash
DATABASE_URL=... node scripts/seed.mjs           # crea el esquema y carga los datos iniciales
DATABASE_URL=... node scripts/seed.mjs --reset   # BORRA todo y vuelve a cargar los datos iniciales
```

El seed genera contraseñas al azar para `marcelo` y `kevin` y guarda solo el hash (scrypt). Para escribirlas en un
archivo en vez de mostrarlas en pantalla, define `CREDS_OUT=/ruta/archivo.json`.

## Seguridad

- La sesión va en una cookie HttpOnly, Secure y SameSite=Strict, firmada con HMAC. Expira tras 8 h sin actividad.
- Los permisos se aplican en el servidor. Un usuario sin permiso financiero no recibe costos, márgenes, compras ni
  la auditoría, y no puede registrar facturas ni pagos.
- `audit_log` es inalterable: un trigger bloquea UPDATE y DELETE.
- Las OC no reservan stock hasta que una persona las aprueba.

## Cambios incorporados desde los comentarios

1. **Inicio:** período por mes, año a la fecha y año móvil, con comparación contra el año anterior. Permite elegir
   varios clientes a la vez.
2. **Productos y tarifas:** cada cliente usa la tarifa regular o una lista diferenciada. En la lista diferenciada solo
   se editan los precios de ese cliente, con vigencias e historial.
3. **Órdenes de compra:** se pueden ordenar por cliente, fecha de emisión, fecha solicitada o monto, y agrupar por
   cliente, estado, mes de emisión o mes de entrega.
4. **Finanzas:** resumen de IVA mensual (débito, NC, crédito fiscal, IVA determinado o remanente) con detalle de ventas
   y compras exportable para cruzar con el RCV del SII.

## Pendiente (fases siguientes)

- Extracción de OC desde PDF con IA: falta definir el proveedor y el presupuesto. Hoy la OC se ingresa a mano.
- Registro de despachos y recepciones desde la interfaz: hoy se ven en el sistema, pero no se pueden registrar ahí.
- Edición de clientes, SKU, pipeline y actividades del CRM desde la interfaz.
- Integraciones con SII y ROVAL.
