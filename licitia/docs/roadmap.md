# Plan de Evolución del Producto — LicitIA

## Fase 1 — Consolidación (0–3 meses)

- **Visor de PDF sincronizado**: panel `react-pdf` junto al chat; clic en una cita → salto a la página exacta (la API y el modelo de citas ya lo soportan).
- **Cola de ingesta**: mover `/api/internal/process` detrás de QStash o Supabase Queues con reintentos exponenciales y concurrencia controlada, para cargas masivas (cientos de documentos en lote).
- **Gestión de usuarios en la UI**: pantalla admin para invitar usuarios, asignar roles y permisos por documento (hoy vía Supabase Dashboard/SQL).
- **Etiquetas de documentos en la UI** (el modelo `tags`/`document_tags` ya existe).
- **Notificaciones**: email/push cuando termina un procesamiento, vence un recordatorio o cambia un semáforo de cumplimiento.

## Fase 2 — Inteligencia ampliada (3–6 meses)

- **Ingesta automática desde Mercado Público**: conector con la API de mercadopublico.cl (el monorepo ya incluye `mercado-publico/` como base) para descargar bases y anexos de licitaciones seguidas.
- **Re-ranking**: añadir un paso de re-rank (cross-encoder o LLM-as-judge) sobre el top-50 híbrido para subir precisión de citas.
- **Generador de propuestas técnicas completo**: del agente actual a un flujo que arma la propuesta sección por sección mapeada a requerimientos, reutilizando propuestas históricas ganadoras.
- **Alertas de riesgo proactivas**: watchers sobre hitos de la línea de tiempo (garantías por vencer, marcha blanca próxima) y sobre requerimientos pendientes de alta prioridad.
- **Comparación multi-documento**: cumplimiento de una licitación contra N informes de avance acumulados.

## Fase 3 — Escala y plataforma (6–12 meses)

- **Panel de analítica comercial**: tasas de adjudicación, montos por región/rubro, análisis de competencia, pricing histórico.
- **API pública** (API keys por organización) y webhooks para integrar con ERPs/CRMs.
- **SSO empresarial** (SAML/OIDC vía Supabase Auth) y auditoría exportable (SIEM).
- **Fine-tuning / distillation** de clasificación y extracción sobre el corpus propio para bajar costo por documento.
- **Particionado** de `document_chunks` por organización + `pgvector` con cuantización escalar cuando el corpus supere ~5 M de chunks.
- **Multi-idioma completo** (portugués/inglés) para licitaciones internacionales.

## Deuda técnica controlada

- Tipos generados de Supabase (`supabase gen types typescript`) para reemplazar los tipos manuales de dominio.
- Tests E2E (Playwright) del flujo subir→procesar→chatear con un proyecto Supabase efímero.
- Rate limiting por usuario en endpoints de IA (Upstash Ratelimit).
