# Estudio de mercado: ticketeras para corporaciones culturales en Chile (oct. 2026)

> Preparado para Xperticket. Investigación de fuentes públicas hecha el 13-10-2026: sitios de cada
> ticketera y corporación, sitemaps, prospecto F-1 de Ticketplus ante la SEC, Mercado Público
> (bases y actas de adjudicación), FNE, Ministerio de las Culturas y prensa.
> Cada dato indica su nivel de certeza: **[V]** verificado en fuente primaria, **[P]** prensa o
> terceros, **[E]** estimación propia.

---

## 0. Resumen ejecutivo

1. **En el nicho cultural, el rival directo es Ticketplus, no Puntoticket.** Puntoticket (Eventim/Sony)
   y Ticketmaster dominan los conciertos masivos. En corporaciones, teatros regionales y salas, la
   empresa que más penetración tiene es **Ticketplus** **[V]**. En su sitemap aparecen como clientes
   GAM, Teatro Biobío, M100, Corcudec, Teatro Nacional Chileno, Gran Sala Sinfónica Nacional,
   Corpartes, Teatro a Mil, Puerto de Ideas, Teatro UC y la red de salas de Santiago. También
   aparecen las corporaciones culturales de La Reina, Temuco y Antofagasta, el Teatro Municipal de
   Ovalle, el Municipal Español de Talca, la Filarmónica Lago Llanquihue y el Teatro Regional
   Cervantes. Además Ticketplus tiene presencia marginal en Teatro del Lago.
2. **Ticketplus es hoy una empresa listada en EE.UU.** Salió a bolsa en NYSE American en agosto
   de 2026 y recaudó US$15M a US$8 por acción. Su propio prospecto entrega su modelo exacto **[V]**:
   - Su comisión "full operation" promedia **17,3% del GMV**, con un histórico de 15,9%–17,3%.
   - Contrata con **8%–15% sobre el valor facial**, en contratos de **hasta 3 años** con
     **exclusividad de 1 a 3 años**.
   - En 2025 tuvo ingresos de US$29,5M, de los cuales US$27,8M vienen de Chile con modelo completo,
     sobre US$159,7M de GMV.

   Eso significa presión por crecer y márgenes que defender: no puede bajar precio sin dañar su
   historia ante inversionistas.
3. **Las corporaciones municipales están obligadas a licitar.** El Dictamen CGR E160316/2021 las
   somete a la Ley 19.886. Las licitaciones de ticketera que revisamos tienen tres rasgos **[V]**:
   - Cuestan **$1** a la corporación: el proveedor se paga con la comisión al público.
   - Duran 24 meses.
   - Se evalúan con un **60% por % de comisión**, un 30% técnico y un 10% de experiencia (caso
     La Reina 2025: Ticketplus le ganó a Passline).

   **La guerra se libra en las bases.** Quien logra que los requisitos técnicos reflejen las
   necesidades reales de una corporación compleja (abonos, numerado, boletería, convenios,
   reportería, donaciones) le quita peso al precio.
4. **Fuera de los grandes nombres, el mercado está muy fragmentado.** Muchos teatros regionales
   **no controlan su ticketing**. Cada productor trae su ticketera (Puntoticket, Ticketpro,
   Ticketplus, Passline, PortalTickets) y la boletería opera aparte. Les pasa al Lucho Gatica, al
   Municipal de Viña, al de Chillán, al TRM y al Cervantes **[V/P]**. La corporación pierde datos
   de público, caja y control. **Ese es el dolor central que Xperticket resuelve y el mensaje de
   ataque.**
5. **El precio de mercado lo paga el público.** El cargo por servicio va de 8% a 15%, con casos
   de hasta 16,5% en masivos **[P]**. En las salas de Ticketplus medimos un sobreprecio publicado
   de **≈10%–12%** sobre el valor base **[V]**. Para la corporación el costo directo suele ser cero.
   Por eso un modelo de "fee al público" competitivo, o una licencia SaaS fija con 0% al público,
   es un arma muy fuerte en licitaciones que puntúan la comisión.
6. **Riesgos en la propia base de Xperticket.** El Festival de Verano San Ginés 2026 se vendió por
   **Ticketmaster** **[P]**. La Corporación Cultural de Las Condes tiene página de productora en
   **Passline** **[V]**. Y algunos eventos del Teatro Municipal de Las Condes aparecen en
   Puntoticket por productores externos **[P]**. Hay fuga de eventos en clientes propios que hay
   que blindar contractualmente.

**Recomendación central:** posicionarse como **"el sistema de boletería y gestión de públicos de
la corporación"**, no como "otra ticketera". La corporación es dueña de su canal y su dato, y los
productores externos venden dentro de su sistema. Atacar en tres frentes:

- **Licitaciones**, influyendo en las bases mediante consultas al mercado y criterios técnicos.
- **Regiones**, donde no hay sistema propio.
- **Clientes de Ticketplus** cuyo contrato de exclusividad (1–3 años) está por vencer.

---

## 1. Alcance, método y límites

- **Universo:** corporaciones culturales municipales, teatros regionales y municipales, centros
  culturales con asignación directa en la Ley de Presupuestos, universidades con teatro propio y
  salas independientes relevantes.
- **Método:**
  - Revisión directa de sitios y flujos de compra de cada institución.
  - Extracción del sitemap de Ticketplus (128 "companies").
  - Páginas de productora en Passline.
  - Cartelera de Ticketpro y VivoTicket.
  - Fichas, bases y actas de Mercado Público.
  - Prospecto F-1 de Ticketplus (SEC).
  - Resolución FNE F383-2024.
  - Documentos PAOCC y Red Cultura del Ministerio de las Culturas.
- **Límites:**
  - Las ticketeras no publican tarifas negociadas.
  - Los % por cliente se infieren de licitaciones o de precios publicados.
  - Varias páginas son dinámicas (JS) o están tras Cloudflare (Passline).
  - Los "clientes" listados en una ticketera pueden ser parciales: un evento o un productor que
    arrienda la sala.
  - El dato debe validarse comercialmente antes de usarse en una propuesta.

---

## 2. Cómo funciona este mercado (lo que hay que entender para ganar)

### 2.1 Tres segmentos que no compiten igual

| Segmento | Quién decide | Ticketeras dominantes | Cómo se cobra |
|---|---|---|---|
| **Masivos** (estadios, arenas, Caupolicán, Movistar) | Productora | Puntoticket (Eventim-Sony), Ticketmaster | Cargo al público 10%–16,5%, negociado por evento |
| **Institucional cultural** (corporaciones, teatros regionales/municipales, centros culturales) | Corporación (y en municipales, **por licitación**) | **Ticketplus**, Passline, Ticketpro, sistemas propios (Xperticket, Ticketera del Municipal, VivoTicket) | Comisión al público ~8%–12% y costo $1 para la corporación; en algunos casos licencia o desarrollo propio |
| **Autoservicio / salas chicas / productores indie** | Productor | Passline, PortalTickets, Welcu, Eventrid, Tikzet, NexoPass | Publicado: Welcu 10% + IVA; Tikzet fee fijo por ticket; Passline "gratis para el organizador" y cobra al comprador |

### 2.2 Marco legal que define la venta

- **Corporaciones municipales = compras públicas.** El Dictamen CGR E160316 (29-11-2021) las sujeta
  a las leyes 19.880, 19.886, 20.285, 20.730 y 20.880. Así lo cita textualmente el acta de La
  Reina **[V]**.
  - Implicancia: **el contrato vence y se re-licita**, por lo que no hay lock-in eterno.
  - Implicancia: el comprador debe justificar la elección con criterios objetivos.
- **Patrón de licitación observado** (La Reina 1238111-4-LE25) **[V]**:
  - Monto máximo: **$1 por 24 meses**.
  - Oferta económica = **% de comisión por ticket** (promedio entre eventos de más y de menos de
    3.000 asistentes): **60%**.
  - Requisitos técnicos: **30%**. Es casi binario: 1.000 puntos si cumple y ofrece adicionales,
    800 si solo cumple y 0 si no cumple.
  - Experiencia: **10%** (10 o más contratos acreditados desde 2015 = puntaje máximo).
  - Ofertas recibidas: **Passline y Ticketplus**. Ganó Ticketplus.
- **Otras licitaciones de ticketera detectadas** **[V/P]**:

| Organismo | Proceso | Resultado |
|---|---|---|
| Corp. Cultural de Temuco | 2022 · 2025 · 2026 (1214071-2-L126) | Ticketplus en 2022 y 2026 |
| Corp. Cultural de Chillán | 2025 (1298357-13-L125), Teatro Municipal | — |
| Corp. Cultural de Peñalolén | Verano 2026 | Ticketpro ($5,06M) |
| Corp. Municipal de Huechuraba | "Servicio integral de ticketera" (LP), 29-09-2026 | Ticketplus |
| Municipalidades de Lo Barnechea, Providencia, Paine, Quillota y Licantén | Ticketera para eventos | — |

- **Regulación al consumidor:**
  - SERNAC fiscaliza la transparencia del cargo.
  - Hay jurisprudencia (Corte Suprema) sobre la devolución del cargo en eventos cancelados **[P]**.
  - No encontramos un proyecto de ley vigente que tope el cargo por servicio.
  - El propio F-1 de Ticketplus lo lista como riesgo regulatorio **[V]**.

### 2.3 Concentración

- La FNE estimó en su momento que Puntoticket tenía **más del 80% de las entradas** y un 60%–70%
  de los eventos. Archivó la investigación por la compra de Eventim-Sony (65%) en julio de 2024
  **[V/P]**.
- Ticketplus reporta 2.800 promotores y venues, con ningún cliente sobre el 4% de sus ingresos
  **[V]**.

---

## 3. Perfiles de competidores

### 3.1 Ticketplus — **competidor principal en cultura**

- **Qué es:** chilena, fundada hace más de 12 años, con sede en Alonso de Córdova 5320 (Las
  Condes). Opera "Full Operation" en Chile y licencia **white-label SaaS** en otros 10 países.
  Cotiza en NYSE American (ticker TP) desde agosto de 2026. El accionista controlador tiene ~76%
  de los votos **[V]**.
- **Números 2025** **[V]**:

| Concepto | Valor |
|---|---|
| Ingresos totales | US$29,46M |
| GMV | US$268,9M |
| Ingresos Full Operation (Chile) | US$27,78M sobre US$159,7M de GMV |
| Ingresos white-label | US$1,68M sobre US$109,1M de GMV (take 1,63%) |
| Utilidad neta | ~US$2,2M **[P]** |
| Tickets procesados (full operation) | 5,5M en 20.800 eventos |
| Tickets procesados (white-label) | 4,7M en 19.000 eventos |

- **Modelo de cobro** **[V]**:
  - Fee sobre valor facial de **8%–15%** según contrato.
  - Take rate efectivo (full operation) de **17,3% del GMV**: incluye operación en terreno,
    pagos y otros.
  - Contratos multianuales de hasta 3 años, con **exclusividad de 1 a 3 años**.
  - Cobra operación de campo según escala.
  - Liquidación declarada: 48–72 h post evento **[P]**.
  - Sobreprecio observado en salas: Cachafaz +10,0%, Teatro UC y Azares +12,0%, Teatro Biobío
    +10,7% (≈9% + IVA) **[V]**.
- **Producto:**
  - Mapas de sala reutilizables.
  - Cola virtual.
  - POS y tótem con stock compartido.
  - Validación QR offline.
  - Cortesías con tracking.
  - Formularios en checkout.
  - Multimoneda.
  - "Booster" (marketing gestionado).
  - Membresías y streaming.
  - Marketplace propio con tráfico.
  - Subdominios white-label (gam.ticketplus.cl, m100.ticketplus.cl, ceacuchile.ticketplus.cl).
  - Página "Red de Salas de Teatro".
- **Clientes culturales identificados** (sitemap de ticketplus.cl, oct. 2026) **[V]**:
  - **Corporaciones y centros:** GAM, Teatro Biobío, M100, Corcudec (Teatro UdeC), Teatro Nacional
    Chileno, CEAC U. de Chile, Gran Sala Sinfónica Nacional, Corpartes, Fundación Teatro a Mil,
    Puerto de Ideas, Pontificia U. Católica (Teatro UC), U. de los Andes, U. Mayor, Finis Terrae.
  - **Corporaciones municipales:** Corp. Cultural de La Reina (Sala Nemesio), Corp. Municipal de
    Desarrollo Cultural de Temuco, Corp. Cultural de Antofagasta, Municipalidad de Quillota.
  - **Teatros:** Teatro Municipal de Ovalle (TMO), Municipal Español de Talca, Teatro Regional
    Cervantes (Valdivia).
  - **Otros:** Corp. Cultural Filarmónica Lago Llanquihue, Planetario Huechuraba, Corp. Patagonia
    Música.
  - **Salas independientes:** Ictus, Aleph, Camilo Henríquez, Azares, Del Puente, Lospleimovil,
    Sidarte, Cachafaz, La Vitrina, DETUCH.
  - **Teatro del Lago:** solo 3 eventos; usa principalmente su propio sitio.
- **Fortalezas:**
  - Escala y marketplace con tráfico.
  - Producto amplio.
  - Experiencia en licitaciones (16 adjudicadas).
  - Operación en terreno.
  - Caja de la IPO.
  - Narrativa de "infraestructura".
- **Debilidades explotables:**
  1. **Generalista:** su foco y su P&L están en fiestas, festivales, deportes y masivos, que son
     la mayor parte de su GMV. Cultura es un vertical más.
  2. **El dato y la marca del público quedan en su marketplace:** el comprador es "cliente
     Ticketplus" y recibe recomendaciones de otros eventos. Para una corporación con misión de
     audiencias esto es un argumento potente.
  3. **Exclusividad de 1–3 años y sobreprecio de ~10%–12%** pagado por el público.
  4. **Presión de mercado de capitales:** debe sostener su take rate de ~17%, así que le cuesta
     responder a una guerra de precios en cultura.
  5. **Funcionalidad institucional profunda limitada:** abonos complejos con tarjeta virtual de
     saldo, convenios, donaciones, integración contable y presupuestaria pública, reportería para
     rendición PAOCC o Ley de Donaciones. **No hay evidencia** de que la tenga al nivel de un
     sistema hecho para corporaciones. Esto hay que validarlo en demos.

### 3.2 Passline — **el retador de autoservicio que entra a licitaciones**

- **Qué es:** chilena, presente en ~19 países. Plataforma self-service ("crea tu evento gratis").
  Ofrece tótems de autoatención y licencias internacionales **[V]**.
- **Cobro:**
  - "Gratis para el organizador"; el cargo lo paga el comprador.
  - Sus términos dicen que el organizador define el cargo.
  - En reembolsos retiene ~13%–15% según versión de sus T&C **[P]**.
  - Liquidación post evento, con reportes de 5–10 días hábiles **[P]**.
- **Clientes culturales (páginas de productora)** **[V/P]**:
  - Corp. Cultural de Las Condes (¡cliente Xperticket!).
  - Corcudec.
  - Corporación Cultural Arte Alameda / CEINA.
  - Corp. Cultural San Javier (Teatro Municipal de San Javier, beneficiario PAOCC).
  - Corp. Cultural de Temuco.
  - Corp. Municipal de Cultura de Paine.
  - Corp. de Cultura y Turismo de Calama.
  - Teatro Regional Cervantes.
  - Teatro Municipal de Antofagasta.
  - TRM / VivoTicket (página sin eventos).
  - SEMCO Concepción.
- **Lectura:** las corporaciones lo usan para **eventos gratuitos con inscripción** y eventos
  puntuales, por ser fácil de usar. Compite en licitaciones (La Reina 2025).
- **Debilidades:**
  - Experiencia genérica.
  - Reclamos por devoluciones y cargos **[P]**.
  - Débil en numerado complejo y abonos.
  - Sin foco institucional.

### 3.3 Puntoticket (Eventim + Sony Music, 65%) — masivos

- **Qué es:** líder histórico, con más del 80% de las entradas según la FNE **[P]**. Fuerte en
  música, deportes, Festival de Viña y Caupolicán **[V/P]**.
- **En cultura:** aparece **por productores externos** en teatros municipales y regionales, como
  el Municipal de Viña del Mar (Cuarteto de Nos 2026), el TRM (Los Jaivas), el Teatro del Lago
  (Devendra Banhart), el Lucho Gatica y el Centenario de La Serena. Las Condes también figura con
  algún evento **[P]**.
- **Cobro:** cargo por evento según servicios demandados; no lo publica. Rango típico 10%–15% **[P]**.
- **Amenaza:** baja como proveedor de la corporación. **Alta como fuga de eventos** cuando un
  productor externo arrienda la sala.

### 3.4 Ticketmaster (Live Nation) — expansión a teatros

- **Qué es:** cada vez más presente en venues y festivales **[P]**.
- **Ticketera oficial y exclusiva** del **Teatro Nescafé de las Artes** desde 2024, del **Teatro
  Oriente** (Providencia) y del **Teatro Mori** **[P]**.
- **Vendió el Festival de Verano San Ginés 2026** **[P]**. San Ginés es un logo que Xperticket
  muestra en su web: **riesgo de cuenta**.
- **Cobro:** cargo por servicio por entrada, variable. Ejemplo: 16,5% en Ed Sheeran 2026 **[P]**.
- **Amenaza:** media-alta en salas privadas de Santiago con programación comercial.

### 3.5 Ticketpro — productor itinerante y licitaciones municipales de eventos

- **Qué es:** chilena (RUT 76.048.589-6). Cartelera nacional fuerte en **giras de teatro y
  stand-up por teatros regionales** **[V]**:
  - Municipal de Santiago (arriendos).
  - Municipales de Valparaíso, Chillán y Arica.
  - TRM, Teatro UdeC, Lucho Gatica, Marina del Sol.
- **Contratos públicos** **[V]**:
  - Corp. Cultural de Peñalolén (Verano 2026, $5,06M).
  - Providencia (Fiestas Patrias 2025).
  - Lo Barnechea (2025).
  - Paine (2024).
  - Cotizó en una compra ágil del Teatro Municipal de Chillán (2026).
  - Convenio histórico con la Corp. Cultural de Antofagasta.
- **Cobro:** históricamente 12% general y 10% en fútbol **[P, antiguo]**.
- **Debilidad grave:** en 2024 CONAF le puso término anticipado al contrato de Parques Nacionales
  por "incumplimientos en la transferencia de fondos recaudados". La propia empresa declaró estar
  en "serio riesgo de subsistencia" **[P]**. Es un argumento de **riesgo de contraparte** muy
  relevante ante comités de compras.

### 3.6 Sistemas propios de los grandes (referencia, no competidores directos)

- **Ticketera del Municipal de Santiago** (ticketera.municipal.cl + api.municipal.cl) **[V]**:
  - Plataforma propia con abonos y tarjeta virtual de saldo para abonados, donaciones online y
    visitas guiadas.
  - Daleticket tuvo antes un contrato exclusivo **[P]**.
  - Aun así, arrendatarios externos venden por Ticketpro **[V]**.
- **Teatro del Lago** (Frutillar) **[V]**: venta en su propio sitio WordPress (antes en un
  subdominio mocadev), con presencia marginal en Ticketplus y Puntoticket.
- **VivoTicket** (Teatro Regional del Maule) **[V]**:
  - Desarrollo propio del TRM, que también vende para el **Teatro Provincial de Curicó** y el
    **Centro de Extensión UCM**.
  - Es una "ticketera regional" incipiente que **podría ser socio o cliente**: un teatro no quiere
    mantener software.

### 3.7 Daleticket

- Histórico, con 10% de comisión **[P, antiguo]**.
- Tuvo el Municipal de Santiago y vendía para Temuco, Chillán, la U. de Chile, UdeC y San Ginés.
- Hoy su sitio no responde de forma estable (502 durante la investigación) y hay muchos reclamos
  históricos.
- Es un competidor **en declive**: sus clientes residuales son targets.

### 3.8 Autoservicio de bajo costo (amenaza de precio en salas chicas)

| Plataforma | Modelo publicado |
|---|---|
| **Welcu** | **10% + impuestos** (tarifa publicada); eventos gratis sin costo **[V]** |
| **PortalTickets** (PortalDisc) | Self-service; dice que su cargo es "menor que otras ticketeras"; red de embajadores con 10%; más de 1.000 eventos desde 2022; vende en Diego Rivera, Cervantes, GAM y Municipal de Chillán **[V]** |
| **Eventrid** | 10% de cargo según PortalDisc; fuerte en deportes **[P]** |
| **Tikzet** | Sin cargo al público; el organizador prepaga un **fee fijo por ticket (~$111)**; cobra con su propia pasarela al instante **[V/P]** |
| **NexoPass** | En pruebas; anunciará 10% + IVA **[V]** |
| **Chiletiket, Telonticket, Datactil** | Nichos o agregadores |

### 3.9 Proveedores internacionales de artes escénicas

- Tessitura, Spektrix y AudienceView ofrecen CRM, fundraising y ticketing para instituciones
  culturales.
- **No encontramos presencia en Chile** **[V: búsqueda sin resultados]**.
- Es un espacio vacío: **Xperticket puede ocupar el lugar de "el Tessitura chileno"** (ticketing +
  gestión de públicos + abonos + donaciones) a precio local.

---

## 4. Mapa de clientes: quién usa qué (corporaciones y espacios clave)

Leyenda de oportunidad: 🟢 alta (sin sistema propio / fragmentado / contrato por vencer),
🟡 media, 🔴 baja (cliente estable de otro), ⭐ cliente Xperticket.

### Región Metropolitana

| Institución | Ticketera actual | Evidencia | Oport. |
|---|---|---|---|
| Corp. Cultural de Las Condes / Teatro Municipal Las Condes / MUI | **Xperticket** (sertex.stonline.cl) + algo de Passline y Puntoticket | sitio, Passline | ⭐ blindar |
| Teatro San Ginés / CC San Ginés | **Xperticket** (logo); festival de verano 2026 por **Ticketmaster** | xperticket.cl, prensa | ⭐ riesgo |
| Corporación Cultural Municipal de Santiago (Teatro Municipal) | Ticketera propia (api.municipal.cl); arriendos por Ticketpro | sitio, Ticketpro | 🟡 módulos o arriendos |
| GAM | Ticketplus (gam.ticketplus.cl) + sitio propio + tótem | FAQ GAM | 🟡 contrato por vencer |
| Matucana 100 | Ticketplus (m100.ticketplus.cl) | sitio | 🟡 |
| Centro Cultural La Moneda | Ticketera propia para reservas (mayoría liberado) | sitio | 🟡 |
| Fundación Teatro a Mil | Ticketplus | sitemap | 🟡 |
| Teatro UC / Teatro Nacional Chileno / CEAC UChile | Ticketplus | sitemap | 🟡 |
| Corpartes / Gran Sala Sinfónica Nacional | Ticketplus | sitemap | 🟡 |
| Teatro Oriente (Providencia) | Ticketmaster | Ticketmaster | 🔴 |
| Teatro Nescafé de las Artes / Teatro Mori | Ticketmaster (exclusivo) | prensa | 🔴 |
| Corp. Cultural de La Reina (Sala Nemesio y otros) | Ticketplus, licitación abril 2025 por 24 meses → **vence ~abr-may 2027**. Aparece otra adjudicada oct-nov 2025 ($12M) **[P]** que hay que verificar | Mercado Público | 🟢 preparar la re-licitación |
| Corp. Cultural de Peñalolén | Ticketpro (verano 2026) | Mercado Público | 🟢 |
| Corp. de Huechuraba (deportes y cultura) | Ticketplus (LP 29-09-2026) | todolicitaciones | 🟡 |
| Corp. Cultural de Lo Barnechea / Vitacura / Ñuñoa / Providencia | Mixto, eventos municipales por licitación (Ticketpro, Ticketplus) | Mercado Público | 🟢 |
| PAOCC municipales RM: Cerro Navia, San Francisco de El Monte, La Florida (PortalTickets), La Pintana, Lo Prado, Paine (Passline), Recoleta, San Joaquín | Mayoritariamente sin sistema o autoservicio | PAOCC 2025 | 🟢 paquete "corporación chica" |
| Salas independientes (Ictus, Aleph, Camilo Henríquez, etc.) | Ticketplus Red de Salas | sitemap | 🔴 bajo ticket |

### Regiones

| Institución | Ticketera actual | Oport. |
|---|---|---|
| Teatro Biobío (Concepción) | Ticketplus + tótem | 🟡 cliente insignia de TP; asignación directa en presupuesto |
| Corcudec (Teatro UdeC) | Ticketplus + Passline; giras por Ticketpro | 🟢 fragmentado |
| Artistas del Acero (Concepción) | sin dato | 🟢 investigar |
| Teatro Regional del Maule (Talca) | **VivoTicket** (propio) + giras Puntoticket/Ticketpro | 🟢 socio o reemplazo del software |
| Teatro Provincial de Curicó / UCM | VivoTicket | 🟢 |
| Municipal Español de Talca / Teatro Municipal de San Javier | Ticketplus / Passline | 🟢 |
| Teatro Municipal de Chillán (Corp. Cultural Chillán) | Sitio propio + licitación 2025 + Ticketpro y PortalTickets | 🟢 licitación activa |
| Teatro Regional Lucho Gatica (Rancagua) | Sin sistema; Ticketpro y Puntoticket por evento; boletería | 🟢 **muy alta** |
| Teatro Regional Cervantes (Valdivia) | Sitio propio + Passline + Ticketplus + PortalTickets | 🟢 caos de canales |
| Corp. Municipal de Desarrollo Cultural de Temuco | Ticketplus (lic. 2026) tras Passline | 🟡 próximo ciclo |
| Corp. Cultural de Antofagasta | Ticketplus (antes Ticketpro) + Passline | 🟢 |
| Corp. de Cultura y Turismo de Calama | Passline | 🟢 |
| Corp. Cultural de Ovalle (TMO) / Vicuña | Ticketplus / s.d. | 🟢 |
| Teatro Municipal de Viña del Mar | Por evento (Puntoticket, Ticketpro, Passline) | 🟢 **muy alta** |
| Parque Cultural de Valparaíso / Teatro Municipal de Valparaíso | s.d. / Ticketpro por evento | 🟢 |
| Corp. Cultura y Artes de San Antonio | s.d. | 🟢 |
| Corp. Cultural de Puerto Montt (Teatro Diego Rivera) | Boletería + PortalTickets por evento | 🟢 |
| Corp. Cultural de Ancud / Coyhaique / Padre Las Casas | Sin sistema visible | 🟢 paquete chico |
| Teatro del Lago (Frutillar) | Sitio propio (WordPress) + Ticketplus/Puntoticket marginal | 🟡 |
| Filarmónica Lago Llanquihue | Ticketplus | 🟡 |
| Teatro Municipal de Iquique (reabierto 2025) | Boletería / gratuito | 🟢 nuevo |
| Arica / La Serena / Punta Arenas / Osorno | Por evento (Ticketpro, Puntoticket) / boletería | 🟢 |

**Lectura del mapa:**

- De ~45 instituciones revisadas, **Ticketplus controla ~20 de forma oficial**.
- ~5 tienen sistema propio (Municipal Santiago, Teatro del Lago, TRM/VivoTicket, Chillán, CCLM).
- ~3 son exclusivas de Ticketmaster.
- **La mayoría de los teatros regionales y municipales no tiene un sistema único** que controlen.
  Ahí está el océano azul.

---

## 5. Precios y modelos de cobro — tabla comparativa

| Ticketera | Quién paga | % / tarifa | Contrato | Liquidación | Fuente |
|---|---|---|---|---|---|
| Ticketplus | Público (cargo) | Contratos de 8%–15% s/ facial; observado ~10%–12% en salas; take efectivo 17,3% GMV | Hasta 3 años, exclusividad 1–3 años | 48–72 h post evento | F-1 SEC [V], precios [V] |
| Passline | Público | No publica; T&C retienen 13%–15% en reembolsos | Por evento / licitación | Post evento (5–10 días hábiles según reportes) | T&C [P] |
| Puntoticket | Público | 10%–15% por evento | Por productora | Corporativo | prensa [P] |
| Ticketmaster | Público | Variable; 16,5% en Ed Sheeran 2026 | Exclusividades de venue | Corporativo | prensa [P] |
| Ticketpro | Público | ~12% (histórico) | Licitaciones por evento o temporada | — | prensa [P] |
| Daleticket | Público | 10% (histórico) | — | — | prensa [P] |
| Welcu | Organizador o público | 10% + impuestos | Self-service | — | welcu.com [V] |
| PortalTickets | Público | "Menor que otras"; no publica | Self-service | — | portaldisc [V] |
| Eventrid | Público | 10% | Self-service | — | portaldisc [P] |
| Tikzet | Organizador | Fee fijo por ticket (~$111 CLP); 0% al público | Prepago | Instantánea (pasarela propia) | tikzet [V/P] |
| Licitaciones municipales | — | **$1 para la corporación**; se compite por % de comisión (60% del puntaje) | 24 meses | Según bases | Mercado Público [V] |

**Conclusión de precio:** la comisión de referencia en cultura está en **9%–12% cobrado al
público**, con costo cero para la corporación. Hay tres formas de ganar en precio sin destruir
margen:

1. **Ofertar 7%–9%** en licitaciones municipales, donde 60 puntos dependen solo de esto. Bajar de
   10% a 8% genera ~12 puntos de diferencia en el puntaje total (60 × (1 − 8/10)).
2. **Ofrecer un modelo dual:** licencia SaaS mensual con 0% al público (la corporación cobra con
   su propia pasarela y se queda el 100% del dato) **o** comisión baja. Es ideal para corporaciones
   con asignación presupuestaria (GAM, Biobío, M100, Teatro a Mil, Parque Cultural), que son
   sensibles a la crítica pública por el "cargo por servicio".
3. **Cobrar el "fee de productor externo":** cuando un productor arrienda la sala y vende por el
   sistema de la corporación, el fee lo paga ese productor o su público. Puede compartirse con la
   corporación (revenue share), lo que convierte a Xperticket en **fuente de ingresos** para la
   corporación.

---

## 6. Tamaño de mercado (estimación de orden de magnitud) [E]

**Supuestos** (validar con memorias y transparencia de cada institución):

| Tier | Instituciones | GMV por institución (CLP/año) | GMV total (CLP/año) |
|---|---|---|---|
| **A** (Municipal Santiago, GAM, Biobío, Teatro del Lago, Las Condes, M100, Teatro a Mil, CCLM, TRM, Corcudec, Corpartes, Teatro UC/TNCh) | 10–12 | 800–5.000 MM | **15.000–25.000 MM** |
| **B** (teatros regionales y municipales medianos, centros culturales grandes) | ~35 | 100–600 MM | **3.500–21.000 MM** |
| **C** (corporaciones municipales chicas, ECBC, salas) | ~80–100 | 10–80 MM | **1.000–8.000 MM** |
| **Total cultural institucional** | | | **≈ 20.000–54.000 MM** (US$20M–55M) |

- **Pool de comisiones** a un 10%: **CLP 2.000–5.400 MM/año (US$2M–5,5M)**.
- **Referencia:** Ticketplus factura US$27,8M en Chile con su modelo completo, con todas las
  categorías. Cultura sería una fracción de eso.
- **Lectura:** el mercado cultural institucional es **acotado pero concentrado y estratégico**.
  Ganar 10–15 cuentas Tier A/B cambia la escala de Xperticket. Para Ticketplus es un vertical
  menor que probablemente no defenderá a cualquier costo.
- **Universo de cuentas:**
  - ~81 corporaciones culturales (documento Cámara) **[P]**.
  - 48 espacios bajo convenio (ECBC) en 45 comunas **[V]**.
  - 78 organizaciones PAOCC 2026 **[V]**.
  - 21 teatros regionales y municipales con PAOCC 2025 **[V]**.
  - 14 instituciones con asignación directa en la Ley de Presupuestos 2025 **[V]**.
  - **Total depurado estimado: 120–150 cuentas.**

---

## 7. Diagnóstico estratégico para Xperticket

**Fortalezas** (según su planteamiento y su web):

- ~15 años 100% dedicados a corporaciones culturales.
- Referencias de primer nivel (Corporación Cultural de Las Condes y Teatro Municipal de Las Condes).
- Abonos, convenios, preventas y promociones.
- Productos complementarios (confitería, merchandising).
- Validación con lector de RUT.
- Reportería en tiempo real.
- El dato no se comparte con terceros.
- Desarrollo a medida.

**Debilidades a corregir:**

- **Marca casi invisible.** La web es de 2023, con pocos logos y sin casos ni cifras.
- **El front de compra del cliente vive en un dominio técnico** (sertex.stonline.cl) que una
  herramienta automática califica como "de riesgo" (32/100 en Gridinsoft). Esto **daña la
  confianza** en evaluaciones técnicas y en el comprador final.
- **Sin marketplace ni tráfico propio**, a diferencia de Ticketplus o Passline.
- **Experiencia acreditable en Mercado Público:** no aparece como proveedor adjudicado con nombre
  propio en los agregadores. Hay que verificar el RUT con el que licita, porque el 10% del puntaje
  es experiencia acreditada (10 o más contratos).

**Oportunidades:**

- Fragmentación regional.
- Re-licitaciones periódicas (24 meses).
- Ticketpro debilitado (caso CONAF).
- Daleticket en declive.
- Vacío de un "Tessitura chileno".
- Sensibilidad política al cargo por servicio.
- PAOCC exige reportar públicos: la reportería es un argumento de valor.

**Amenazas:**

- Ticketplus capitalizado y con exclusividades de 1–3 años.
- Ticketmaster entrando a teatros privados (San Ginés).
- Plataformas de fee fijo (Tikzet) que bajan el precio de referencia.
- Licitaciones que premian solo el % de comisión.

---

## 8. Plan de acción (agresivo y ejecutable)

### 8.1 Blindar la base (0–30 días)

1. **Las Condes y San Ginés:**
   - Revisar contratos e incorporar **exclusividad sobre eventos de terceros que usen la sala**,
     con fee compartido.
   - Ofrecer el "módulo productor externo" para que Passline, Puntoticket y Ticketmaster no
     entren por la puerta del arriendo.
   - Investigar por qué el Festival San Ginés 2026 se fue a Ticketmaster.
2. **Front de compra con dominio de marca** (p. ej. `entradas.tmlascondes.cl` o
   `tickets.xperticket.cl/<cliente>`), con certificado y branding del cliente. Elimina la objeción
   de confianza.
3. **Caso de éxito cuantificado de Las Condes:** entradas, % online, abonados, tiempos de acceso
   y ahorro vs. comisión de mercado. Es el activo comercial número uno.

### 8.2 Ganar licitaciones (30–180 días)

1. **Monitoreo diario en Mercado Público** de "ticketera", "venta de entradas", "boletería" y
   "control de acceso", filtrado por corporaciones y municipios. Ya existe la herramienta en
   `mercado-publico/` de este repo: configurar una alerta.
2. **Calendario de re-licitaciones:**
   - La Reina: vence ~abr-may 2027.
   - Temuco: anual.
   - Chillán.
   - Peñalolén: verano.
   - Huechuraba.
   - Lo Barnechea y Providencia: eventos.
3. **Influir en las bases antes de que se publiquen:**
   - Ofrecer a las corporaciones una **plantilla de bases técnicas** de "sistema de boletería
     institucional" con requisitos objetivos: numerado multi-sala, abonos con saldo, convenios y
     descuentos (vecinos, estudiantes, tercera edad), boletería presencial con stock compartido,
     validación offline, reportería PAOCC, propiedad del dato, conciliación contable, pasarela
     propia de la corporación, SLA y soporte en sala.
   - Sugerir que el **puntaje técnico sea gradual** y no binario, y que **la comisión pese menos
     de 40%**.
   - Proponer "consultas al mercado" (RFI), que la Ley 19.886 permite, para participar en el
     diseño.
4. **Oferta económica agresiva:** % de comisión **igual o menor que Ticketplus** en eventos
   pequeños, porque es el promedio de dos tramos el que se evalúa. Como opción, 0% al público con
   licencia mensual si las bases lo permiten.
5. **Experiencia:** consolidar 10 o más certificados de clientes desde 2015 para el puntaje
   máximo del 10%.
6. **Riesgo de contraparte:** en las propuestas, destacar la custodia de fondos (cuenta de la
   corporación / liquidación inmediata) frente a los incumplimientos documentados de Ticketpro.

### 8.3 Ofensiva en regiones (60–365 días)

Prioridad por dolor (sin sistema único) e influencia:

1. **Teatro Regional Lucho Gatica (Rancagua)**, **Teatro Municipal de Viña del Mar**,
   **Teatro Municipal de Valparaíso / Parque Cultural** y **Teatro Regional Cervantes (Valdivia)**.
   Propuesta: "un solo sistema para la corporación, los productores externos venden dentro de él".
2. **TRM / VivoTicket:** proponer alianza o migración. El TRM mantiene software propio y vende
   para Curicó y la UCM. Xperticket puede operar como motor y que VivoTicket conserve la marca
   regional. Así se ganan tres recintos de una vez.
3. **Corcudec, Antofagasta, Calama, Ovalle, Chillán, Temuco:** hoy usan Ticketplus o Passline, o
   reparten sus canales. Atacar al vencimiento de contrato con la demo de abonos y reportería.
4. **Paquete "Corporación PAOCC"** para las ~20 corporaciones municipales chicas: precio plano,
   puesta en marcha en 2 semanas, eventos gratuitos con inscripción sin costo y reportería lista
   para la rendición al Ministerio.

### 8.4 Ir por los clientes insignia de Ticketplus (6–18 meses)

- **Targets:** GAM, Teatro Biobío, M100, Teatro a Mil y Corpartes, más Teatro UC y el Teatro
  Nacional Chileno.
- **Táctica:**
  - Detectar la fecha de término de exclusividad (por transparencia, preguntas directas o
    licitaciones).
  - Llegar 6 meses antes con un **piloto en un ciclo o sala**: una temporada, un festival o
    abonos.
- **Mensaje:**
  - "Tu público es tuyo, no del marketplace de otro."
  - "Sin sobreprecio del 10%–12% a tu audiencia."
  - "Un sistema hecho para abonos, convenios y gestión de públicos."
  - "Reportería para el Ministerio."
- **Cuidado:** las instituciones con asignación directa no siempre licitan como las municipales,
  porque pueden ser fundaciones o corporaciones privadas. La venta es consultiva y la decide el
  directorio.

### 8.5 Producto y propuesta de valor (lo que debe estar sí o sí en la demo)

1. **Módulo productor externo / arriendo de sala** con revenue share.
2. **Abonos, temporadas y tarjeta de saldo** (lo que ya usa el Municipal de Santiago como
   estándar).
3. **Gestión de públicos (CRM)** con exportación y segmentación; **donaciones** integradas
   (Ley de Donaciones Culturales).
4. **Inscripción a eventos gratuitos** a costo cero: es la puerta de entrada que hoy le regalan a
   Passline.
5. **Reportes PAOCC y transparencia** con un clic.
6. **Pasarela de la propia corporación** (Webpay/Getnet/Mercado Pago) con liquidación inmediata.
7. **Marca blanca** en el dominio del cliente.

### 8.6 Indicadores del plan

- 12 meses:
  - 8 nuevas cuentas Tier B/C.
  - 2 cuentas Tier A.
  - 100% de licitaciones de ticketera cultural detectadas y respondidas.
  - 0 eventos de clientes vendidos por terceros.
- 24 meses: 25 cuentas y presencia en 8 regiones.

---

## 9. Datos que conviene validar a continuación

1. Bases técnicas, oferta económica y % ganador de las licitaciones de Temuco 2026, Chillán 2025,
   Huechuraba 2026 y La Reina (segunda licitación, oct-nov 2025). Se descargan desde Mercado
   Público: los adjuntos se bajaron con éxito con Playwright para La Reina.
2. Ingresos por boletería de las cuentas Tier A (memorias y transparencia activa) para afinar el
   TAM.
3. Fechas de vencimiento de los contratos de Ticketplus con GAM, Biobío y M100 (solicitud por
   Ley de Transparencia a las que reciben fondos públicos).
4. El RUT y la razón social con que Xperticket participa en Mercado Público, y su historial
   acreditable.
5. Estado real de Ticketek y Daleticket en 2026.

---

## 10. Fuentes principales

- Ticketplus — Prospecto F-1 ante la SEC: <https://www.sec.gov/Archives/edgar/data/2104296/000121390026062169/ea0291977-f1_ticket.htm>
- Ticketplus — Cierre IPO: <https://www.globenewswire.com/news-release/2026/08/10/3342204/0/en/ticketplus-announces-closing-of-initial-public-offering.html>
- Ticketplus — Sitemap (clientes): <https://ticketplus.cl/sitemap.xml> · Red de Salas: <https://ticketplus.cl/en/collections/red-salas-de-teatro> · Servicios: <https://ticketplus.com/servicios/>
- Mercado Público — Licitación La Reina 1238111-4-LE25 (bases, apertura, acta): <https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=1238111-4-LE25>
- Mercado Público — Temuco 1214071-2-L126 / L125: <https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=1214071-2-L126>
- Todolicitaciones — Ticketplus SpA: <https://www.todolicitaciones.cl/proveedor/764681886/ticketplus-spa> · Ticketpro S.A.: <https://www.todolicitaciones.cl/proveedor/760485896/ticketpro-sa>
- FNE — Archivo investigación Punto Ticket (F383-2024): <https://www.fne.gob.cl/wp-content/uploads/2024/07/inpu_F383_2024.pdf>
- La Tercera — Cifras venta Punto Ticket: <https://www.latercera.com/pulso/noticia/las-cifras-desconocidas-de-la-venta-de-punto-ticket/7UBMZPIJIBCTPKAGIP6ERYEDPU/>
- La Tercera (2012, vía Etcheberry) — Industria de tickets: <http://www.jec.cl/articulos/?p=22877>
- Ministerio de las Culturas — PAOCC Teatros 2025 (21 espacios): <https://www.cultura.gob.cl/actualidad/convocatoria-de-teatros-regionales-y-municipales-del-programa-de-apoyo-a-organizaciones-culturales-colaboradoras-beneficiara-a-21-espacios-con-mas-de-mil-cuatrocientos-millones-de-pesos/>
- Ministerio de las Culturas — PAOCC 2026 (78 organizaciones): <https://www.cultura.gob.cl/actualidad/programa-de-organizaciones-colaboradoras-culturales-paocc-entregara-mas-de-5-mil-millones-para-apoyar-el-funcionamiento-de-78-organizaciones-a-traves-de-las-convocatorias-de-ingreso-y-continuidad/>
- Ministerio de las Culturas — Bases PAOCC Continuidad 2026: <https://www.cultura.gob.cl/paocc/wp-content/uploads/sites/78/2025/10/paocc-continuidad-2026.pdf>
- Red Cultura — Espacios culturales bajo convenio: <https://www.cultura.gob.cl/redcultura/espacios-culturales-bajo-convenio/>
- GAM — Preguntas frecuentes: <https://gam.cl/es/experiencia/preguntas-frecuentes/>
- Teatro Biobío — Guía de públicos: <https://teatrobiobio.cl/guia-de-publicos/>
- Teatro Regional del Maule — Boletería: <https://www.teatroregional.cl/boleteria> · VivoTicket: <https://www.vivoticket.cl/web/>
- Teatro Municipal de Santiago — Ticketera: <https://ticketera.municipal.cl/> · T&C: <https://ticketera.municipal.cl/terminos-y-condiciones>
- Teatro Municipal de Las Condes — Venta: <https://sertex.stonline.cl/tmlc/tmlcFrontOffice>
- Teatro Regional Cervantes — FAQ: <https://www.teatroregionalcervantes.cl/preguntas-frecuentes/> · Passline: <https://www.passline.com/productora/teatro-cervantes>
- Passline — productoras culturales (Las Condes, Corcudec, Temuco, San Javier, Paine, Calama): <https://www.passline.com/productora/corporacion-cultural-de-las-condes>
- Ticketpro — cartelera: <https://www.ticketpro.cl/> · Caso CONAF: <https://www.df.cl/empresas/industria/ticketpro-se-declara-en-serio-riesgo-de-subsistencia-tras-conflicto>
- Ticketmaster — Teatro Oriente: <https://www.ticketmaster.cl/page/home-teatro-oriente> · Nescafé de las Artes: <https://www.teatro-nescafe-delasartes.cl/venta-de-entradas/>
- Radio Agricultura — Festival San Ginés 2026: <https://www.radioagricultura.cl/entretencion/hoy-se-sale/festival-de-verano-san-gines-lanza-su-programacion-2026-con-una-seleccion-imperdible_20251231/>
- Puntoticket — Cuarteto de Nos, Municipal de Viña: <https://www.puntoticket.com/cuarteto-de-nos-teatro-municipal-de-vina-del-mar-ene-2026>
- Comparativas de cargo (partes interesadas): Tikzet <https://www.tikzet.com/blog/cuanto-cobran-cargo-por-servicio-ticketeras-chile/> · NexoPass <https://nexopass.cl/ticketeras-en-chile/>
- Welcu — precios: <https://welcu.com/es/pricing> · PortalTickets: <https://portaldisc.com/queesportaltickets>
- BioBioChile — Cargo por servicio (jun. 2026): <https://www.biobiochile.cl/noticias/artes-y-cultura/actualidad-cultural/2026/06/23/cargo-por-servicio-el-factor-que-encarece-las-entradas-y-que-te-cobra-de-mas-por-ofrecer-lo-mismo.shtml>
- IQ Magazine — International Ticketing Report 2026 (Chile): <https://www.iqmagazine.com/publications/international-ticketing-report-2026/chile/>
- Xperticket: <https://xperticket.cl>
