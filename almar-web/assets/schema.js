// Textos editables del sitio. Cada campo tiene un valor por defecto; el back office
// guarda en la base de datos solo los que se modifican.
// Formato: *texto* se muestra destacado (cursiva rosada). Una línea en blanco separa párrafos.
window.ALMAR_SCHEMA = [
  { id: 'contacto', title: 'Contacto y redes', fields: [
    { k: 'whatsapp', label: 'WhatsApp (con código de país, solo números)', d: '', hint: 'Ej: 56912345678. Se usa en el botón flotante de WhatsApp.' },
    { k: 'whatsapp_msg', label: 'Mensaje inicial de WhatsApp', d: 'Hola Magda, quiero cotizar fotografía para mi evento.' },
    { k: 'email', label: 'Correo de contacto', d: '', hint: 'Aparece en la página de contacto.' },
    { k: 'instagram', label: 'Usuario de Instagram (sin @)', d: 'almar_fotolitoral' },
    { k: 'footer_tagline', label: 'Frase del pie de página', d: 'Yo estaré ahí, y la cámara también… pero el momento seguirá siendo tuyo.' }
  ]},
  { id: 'inicio', title: 'Inicio', fields: [
    { k: 'home_eyebrow', label: 'Portada · etiqueta', d: 'Matrimonios · Eventos · Corporativas' },
    { k: 'home_title', label: 'Portada · título', d: 'Almar fotografía' },
    { k: 'home_sub', label: 'Portada · frase', d: 'Yo estaré ahí, y la cámara también… pero el momento seguirá siendo tuyo.', area: 1 },
    { k: 'home_statement', label: 'Declaración · título', d: 'Observo, anticipo y *sólo cuando hace falta*, intervengo.', area: 1 },
    { k: 'home_lede', label: 'Declaración · bajada', d: 'Para que la cámara esté presente, pero sin convertirse en el centro.', area: 1 },
    { k: 'home_intro', label: 'Declaración · texto', d: 'Fotografía documental para matrimonios, celebraciones e instituciones. Imágenes naturales, cuidadas y pensadas como un conjunto que cuenta una historia.', area: 1 },
    { k: 'verb1_t', label: 'Verbo 1', d: 'Observo' },
    { k: 'verb1_d', label: 'Verbo 1 · texto', d: 'Estoy atenta a lo que pasa, sin interrumpir lo que están viviendo.' },
    { k: 'verb2_t', label: 'Verbo 2', d: 'Anticipo' },
    { k: 'verb2_d', label: 'Verbo 2 · texto', d: 'Me adelanto a los momentos que ocurren una sola vez.' },
    { k: 'verb3_t', label: 'Verbo 3', d: 'Intervengo' },
    { k: 'verb3_d', label: 'Verbo 3 · texto', d: 'Sólo cuando tiene sentido: una buena luz, una idea, unos minutos juntos.' },
    { k: 'services_title', label: 'Servicios · título', d: 'Lo que *fotografío*' },
    { k: 'svc_mat', label: 'Servicio Matrimonios · bajada', d: 'Capturar lo que ocurre' },
    { k: 'svc_otr', label: 'Servicio Otros eventos · bajada', d: 'Grandes o pequeñas' },
    { k: 'svc_corp', label: 'Servicio Corporativas · bajada', d: 'Instituciones y emprendimientos' },
    { k: 'about_title', label: 'Sobre mí · título', d: 'Soy Magdalena Domínguez, *fotógrafa y diseñadora editorial.*', area: 1 },
    { k: 'about_text', label: 'Sobre mí · texto', d: 'El diseño también es parte de mi forma de mirar: pienso las fotografías no solo como imágenes individuales, sino como parte de un conjunto que se combina para contar una historia.', area: 1 },
    { k: 'about_sig', label: 'Sobre mí · firma', d: 'Magda' },
    { k: 'book_eyebrow', label: 'Libro · etiqueta', d: '…un libro que te lleve de regreso' },
    { k: 'book_title', label: 'Libro · título', d: 'Guardar recuerdos es construir y reconstruir historias.', area: 1 },
    { k: 'book_text', label: 'Libro · texto', d: 'Por eso me gusta tanto lo que sucede después de tomar las fotos: seleccionarlas, ordenarlas y darles sentido.\n\nCuando las imágenes se juntan, pueden llevarte de vuelta a lo que viviste: para sentirlo, recordarlo y recorrerlo otra vez.', area: 1 },
    { k: 'process_title', label: 'Cómo trabajo · título', d: 'De la primera conversación *al libro*' },
    { k: 'step1_t', label: 'Paso 1', d: 'Conversamos' },
    { k: 'step1_d', label: 'Paso 1 · texto', d: 'Me cuentas qué estás preparando, vemos qué necesitas y encontramos juntos la mejor manera de hacerlo.', area: 1 },
    { k: 'step2_t', label: 'Paso 2', d: 'El día' },
    { k: 'step2_d', label: 'Paso 2 · texto', d: 'Ustedes viven el momento. Yo acompaño, me adelanto y, cuando tiene sentido, creamos juntos.', area: 1 },
    { k: 'step3_t', label: 'Paso 3', d: 'Selección y edición' },
    { k: 'step3_d', label: 'Paso 3 · texto', d: 'Selecciono y edito para que recuerden no solo cómo se veía el día, sino cómo se sentía.', area: 1 },
    { k: 'step4_t', label: 'Paso 4', d: 'El libro' },
    { k: 'step4_d', label: 'Paso 4 · texto', d: 'Ordeno las imágenes como un conjunto, diseñado para recorrerlo otra vez.', area: 1 },
    { k: 'recent_title', label: 'Portafolio · título', d: 'Momentos *recientes*' },
    { k: 'home_band_title', label: 'Llamado final · título', d: 'Cuéntame qué estás preparando' },
    { k: 'home_band_text', label: 'Llamado final · texto', d: '¿Tienes un matrimonio, una celebración, una actividad o un proyecto en mente? Vemos juntos cómo puedo acompañarlo.', area: 1 }
  ]},
  { id: 'testimonios', title: 'Testimonios', hint: 'La sección se muestra en el inicio solo cuando hay al menos un testimonio escrito.', fields: [
    { k: 'testi_title', label: 'Título', d: 'Lo que dicen *quienes confiaron*' },
    { k: 'testi1_text', label: 'Testimonio 1', d: '', area: 1 }, { k: 'testi1_author', label: 'Testimonio 1 · autor', d: '' },
    { k: 'testi2_text', label: 'Testimonio 2', d: '', area: 1 }, { k: 'testi2_author', label: 'Testimonio 2 · autor', d: '' },
    { k: 'testi3_text', label: 'Testimonio 3', d: '', area: 1 }, { k: 'testi3_author', label: 'Testimonio 3 · autor', d: '' }
  ]},
  { id: 'faq', title: 'Preguntas frecuentes', hint: 'Deja vacía una pregunta para ocultarla.', fields: [
    { k: 'faq_title', label: 'Título', d: 'Antes de *reservar*' },
    { k: 'faq1_q', label: 'Pregunta 1', d: '¿Cómo reservo una fecha?' }, { k: 'faq1_a', label: 'Respuesta 1', d: 'Escríbeme desde el formulario de contacto, por WhatsApp o por Instagram con la fecha, el lugar y el tipo de evento. Conversamos y te envío una propuesta a la medida.', area: 1 },
    { k: 'faq2_q', label: 'Pregunta 2', d: '¿Vas a dirigir las fotos todo el tiempo?' }, { k: 'faq2_a', label: 'Respuesta 2', d: 'No. La mayor parte del tiempo observo y me adelanto a lo que pasa. Sólo cuando tiene sentido propongo algo: una buena luz, una idea, unos minutos frente a la cámara.', area: 1 },
    { k: 'faq3_q', label: 'Pregunta 3', d: '¿Qué recibo después del evento?' }, { k: 'faq3_a', label: 'Respuesta 3', d: 'Una selección de fotografías editadas que cuentan la historia completa del día. Si quieres, también diseño un libro para recorrerla otra vez.', area: 1 },
    { k: 'faq4_q', label: 'Pregunta 4', d: '¿Fotografías eventos pequeños?' }, { k: 'faq4_a', label: 'Respuesta 4', d: 'Sí. Grande o pequeña, todas las celebraciones son especiales: bautizos, cumpleaños, aniversarios, exposiciones o encuentros íntimos.', area: 1 },
    { k: 'faq5_q', label: 'Pregunta 5', d: '¿Sirven las fotos corporativas para web y redes?' }, { k: 'faq5_a', label: 'Respuesta 5', d: 'Están pensadas para eso: web, redes, presentaciones y piezas gráficas. Como también soy diseñadora, cuido cómo cada imagen convive con las demás.', area: 1 }
  ]},
  { id: 'matrimonios', title: 'Matrimonios', fields: [
    { k: 'mat_title', label: 'Título de la página', d: 'Matrimonios' },
    { k: 'mat_h', label: 'Bloque 1 · título', d: 'Capturar *lo que ocurre*' },
    { k: 'mat_lede', label: 'Bloque 1 · bajada', d: 'No necesitamos convertir un día tan importante en una sesión de fotos.', area: 1 },
    { k: 'mat_p', label: 'Bloque 1 · texto', d: 'Estoy ahí para observar, anticipar y encontrar esos momentos que ocurren una sola vez.', area: 1 },
    { k: 'mat_s2e', label: 'Bloque 2 · etiqueta', d: 'El día' },
    { k: 'mat_s2h', label: 'Bloque 2 · título', d: 'Sin estar pendientes de la cámara' },
    { k: 'mat_s2p', label: 'Bloque 2 · texto', d: 'La mayor parte del tiempo, ustedes están viviendo el momento. Yo acompaño, me adelanto y, cuando tiene sentido, también podemos crear juntos: una buena luz, una idea, unos minutos para estar juntos frente a la cámara.', area: 1 },
    { k: 'mat_s3e', label: 'Bloque 3 · etiqueta', d: 'Después' },
    { k: 'mat_s3h', label: 'Bloque 3 · título', d: 'Al final todo tiene sentido' },
    { k: 'mat_s3p', label: 'Bloque 3 · texto', d: 'Después selecciono y edito las fotografías para que no solo recuerden cómo se veía el día, sino también cómo se sentía. Que puedan volver a él y recorrerlo de nuevo.', area: 1 },
    { k: 'mat_band_title', label: 'Llamado final · título', d: '¿Se casan pronto?' },
    { k: 'mat_band_text', label: 'Llamado final · texto', d: 'Cuéntame la fecha, el lugar y cómo imaginan el día.', area: 1 }
  ]},
  { id: 'otros', title: 'Otros eventos', fields: [
    { k: 'otr_title', label: 'Título de la página', d: 'Otros eventos' },
    { k: 'otr_h', label: 'Bloque 1 · título', d: 'Grande o pequeña, todas las celebraciones *son especiales.*', area: 1 },
    { k: 'otr_lede', label: 'Bloque 1 · bajada', d: 'Puede ser una celebración íntima, un gran evento, un aniversario, una exposición o un bautizo.', area: 1 },
    { k: 'otr_p', label: 'Bloque 1 · texto', d: 'Sin importar el formato, pongo la misma atención en todo lo que está pasando. Porque si es importante para ustedes, merece ser fotografiado con la honestidad, cuidado y atención que el momento amerita.', area: 1 },
    { k: 'otr_s2e', label: 'Bloque 2 · etiqueta', d: 'Para quien organiza' },
    { k: 'otr_s2h', label: 'Bloque 2 · título', d: 'Que puedas estar ahí' },
    { k: 'otr_s2p', label: 'Bloque 2 · texto', d: 'Quien organiza también merece disfrutar. Yo estoy atenta a lo que pasa para que ustedes puedan estar atentos a las personas que quieren.', area: 1 },
    { k: 'otr_v1_t', label: 'Tipo 1', d: 'Bautizos' }, { k: 'otr_v1_d', label: 'Tipo 1 · texto', d: 'Y cumpleaños, con la calma que piden.' },
    { k: 'otr_v2_t', label: 'Tipo 2', d: 'Aniversarios' }, { k: 'otr_v2_d', label: 'Tipo 2 · texto', d: 'Celebraciones íntimas o grandes encuentros.' },
    { k: 'otr_v3_t', label: 'Tipo 3', d: 'Exposiciones' }, { k: 'otr_v3_d', label: 'Tipo 3 · texto', d: 'Lanzamientos, conciertos y actividades.' },
    { k: 'otr_s3e', label: 'Bloque 3 · etiqueta', d: 'Después' },
    { k: 'otr_s3h', label: 'Bloque 3 · título', d: 'Lo importante es cómo se vivió' },
    { k: 'otr_s3p', label: 'Bloque 3 · texto', d: 'Después, selecciono y organizo las imágenes para construir una historia que atesore la atmósfera y la forma en que se vivió ese día.', area: 1 },
    { k: 'otr_band_title', label: 'Llamado final · título', d: '¿Qué estás celebrando?' },
    { k: 'otr_band_text', label: 'Llamado final · texto', d: 'Cuéntame el formato, la fecha y el lugar, y vemos juntos cómo acompañarlo.', area: 1 }
  ]},
  { id: 'corporativas', title: 'Corporativas', fields: [
    { k: 'corp_title', label: 'Título de la página', d: 'Corporativas' },
    { k: 'corp_h', label: 'Bloque 1 · título', d: 'Instituciones *y emprendimientos*' },
    { k: 'corp_lede', label: 'Bloque 1 · bajada', d: 'Fotografío personas, instalaciones y espacios de trabajo.', area: 1 },
    { k: 'corp_p', label: 'Bloque 1 · texto', d: 'Busco imágenes naturales, cuidadas y que realmente hablen de ustedes y de lo que hacen.', area: 1 },
    { k: 'corp_s2e', label: 'Bloque 2 · etiqueta', d: 'A la medida' },
    { k: 'corp_s2h', label: 'Bloque 2 · título', d: '. . .a la medida de lo que necesitas' },
    { k: 'corp_s2p', label: 'Bloque 2 · texto', d: 'Conversamos, vemos qué necesitan y encontramos juntos la mejor manera de hacerlo, sin complicar más de la cuenta la jornada.', area: 1 },
    { k: 'corp_u1_t', label: 'Uso 1', d: 'Web' }, { k: 'corp_u1_d', label: 'Uso 1 · texto', d: 'Sitio institucional y tienda.' },
    { k: 'corp_u2_t', label: 'Uso 2', d: 'Redes' }, { k: 'corp_u2_d', label: 'Uso 2 · texto', d: 'Contenido para publicar.' },
    { k: 'corp_u3_t', label: 'Uso 3', d: 'Presentaciones' }, { k: 'corp_u3_d', label: 'Uso 3 · texto', d: 'Equipos, espacios, procesos.' },
    { k: 'corp_u4_t', label: 'Uso 4', d: 'Piezas gráficas' }, { k: 'corp_u4_d', label: 'Uso 4 · texto', d: 'Impresos, catálogos, prensa.' },
    { k: 'corp_s3e', label: 'Bloque 3 · etiqueta', d: 'Diseño y fotografía' },
    { k: 'corp_s3h', label: 'Bloque 3 · título', d: 'Fotografías que puedan hacer su trabajo' },
    { k: 'corp_s3p', label: 'Bloque 3 · texto', d: 'Pienso las imágenes para que puedas usarlas en tu web, redes, presentaciones o piezas gráficas.\n\nY como también soy diseñadora, me importa tanto cada fotografía como la manera en que después va a convivir con las demás.', area: 1 },
    { k: 'corp_band_title', label: 'Llamado final · título', d: '¿Necesitas imágenes para tu marca?' },
    { k: 'corp_band_text', label: 'Llamado final · texto', d: 'Cuéntame qué hace tu equipo y dónde vas a usar las fotos.', area: 1 }
  ]},
  { id: 'galerias', title: 'Galerías (página índice)', fields: [
    { k: 'gal_title', label: 'Título', d: 'Galerías' },
    { k: 'gal_intro', label: 'Texto', d: 'Historias completas, contadas en conjunto. Elige una galería para recorrerla.', area: 1 }
  ]},
  { id: 'contactopag', title: 'Página de contacto', fields: [
    { k: 'contact_title', label: 'Título', d: 'Contacto' },
    { k: 'contact_sub', label: 'Subtítulo', d: 'Cuéntame qué estás preparando' },
    { k: 'contact_text', label: 'Texto', d: '¿Tienes un matrimonio, una celebración, una actividad o un proyecto en mente? Cuéntame un poco sobre lo que estás organizando y vemos juntos cómo puedo acompañarlo.', area: 1 },
    { k: 'form_title', label: 'Formulario · título', d: 'Hablemos de tu evento' },
    { k: 'form_ok', label: 'Mensaje al enviar', d: 'Recibí tu mensaje. Te escribo pronto para conversar sobre tu evento.', area: 1 }
  ]}
];

// Categorías (galerías). El back office puede cambiar nombre, texto, portada, orden,
// visibilidad, ocultar fotos y agregar fotos por URL.
window.ALMAR_GALLERIES = [
  { k: 'matrimonios', slug: 'galeria-matrimonios', t: 'Matrimonios', cover: 'WEB_MATRIMONIOS_-26' },
  { k: 'eventos', slug: 'galeria-eventos', t: 'Eventos', cover: 'WEB_EVENTOS-56' },
  { k: 'bautizos', slug: 'galeria-bautizos', t: 'Bautizos & Cumpleaños', cover: 'BAUTIZO_CLEMENTE-29' },
  { k: 'corporativas', slug: 'galeria-corporativas', t: 'Corporativas', cover: 'WEB_CORPORATIVO-40' },
  { k: 'emprendimientos', slug: 'galeria-emprendimientos', t: 'Emprendimientos', cover: 'WEB_CORPORATIVO-16' },
  { k: 'retratos', slug: 'galeria-retratos', t: 'Retratos', cover: 'WEB_CORPORATIVO-49' }
];
