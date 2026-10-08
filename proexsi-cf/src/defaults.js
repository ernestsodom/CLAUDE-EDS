// Contenido inicial del sitio (tomado de la maqueta aprobada). Lo guardado en la base de datos se mezcla sobre esto.
import { PALETTES } from './schema.js';

export const DEFAULTS = {
  version: 1,
  site: {
    name: 'Proexsi',
    logo: '/img/logo-proexsi-verde.png',
    logoMode: 'tint',
    logoRatio: 9.09,
    title: 'Proexsi | Plataforma de venta y gestión para corporaciones culturales',
    description: 'La mejor plataforma para gestionar todas las actividades de tu corporación cultural: venta online y presencial, inscripciones, check in con QR e informes en línea.',
    ctaLabel: 'Agenda una demo',
    ctaHref: '/#contacto',
    email: 'ventas@proexsi.cl',
    phone: '+56 2 0000 0000',
    hours: 'Lunes a viernes, 9:00 a 18:00 h',
    footerText: 'Más de 20 años desarrollando sistemas de venta y gestión cultural.',
    legal: '© 2026 Proexsi S.A.',
    footerProductsTitle: 'Productos',
    footerContactTitle: 'Contacto',
    footerLinks: [
      { label: 'Agenda una demo', href: '/#contacto' },
      { label: 'Nosotros', href: '/nosotros' },
      { label: 'Preguntas frecuentes', href: '/#preguntas' },
    ],
  },
  nav: [
    { label: 'Inicio', href: '/' },
    { label: 'Nosotros', href: '/nosotros' },
    { label: 'Productos', href: '/#productos' },
    { label: 'Beneficios', href: '/#beneficios' },
    { label: 'La Plataforma', href: '/#plataforma' },
    { label: 'Preguntas', href: '/#preguntas' },
  ],
  theme: {
    palette: 'bosque',
    colors: { ...PALETTES[0].colors },
    fontDisplay: 'DM Serif Display',
    fontBody: 'Jost',
    displayWeight: 400,
    titleScale: 100,
    bodyScale: 100,
    radius: 18,
  },
  home: {
    blocks: [
      { id: 'inicio', type: 'hero', kicker: 'Venta y gestión cultural', title: 'Cultura y Comunidad', titleAccent: 'para Todos.',
        lead: 'La Mejor Plataforma para Gestionar Todas las Actividades de tu Corporación Cultural.',
        image: '/img/hero-mercado.webp', alt: 'Abuela y nieta recorriendo una feria de artesanía al aire libre', pos: '36% 35%', posMobile: '58% center', veil: 100,
        cta1Label: 'Agenda una demo', cta1Href: '/#contacto', cta2Label: 'Ver productos', cta2Href: '/#productos',
        facts: [
          { title: '+20 años', text: 'en gestión cultural' },
          { title: 'Online y en caja', text: 'con el mismo stock' },
          { title: 'Check in QR', text: 'desde cualquier celular' },
        ] },
      { id: 'productos', type: 'categories', eyebrow: '', title: '', lead: '', columns: '4', moreLabel: 'Conoce la solución', bg: '' },
      { id: 'confianza', type: 'trust', items: [
        { icon: 'shield', title: 'Compra segura', text: 'Tus datos y compras están protegidos.' },
        { icon: 'ticket', title: 'Entradas digitales', text: 'Recíbelas al instante en tu dispositivo.' },
        { icon: 'heart', title: 'Apoya lo local', text: 'Fortalece la cultura de tu comunidad.' },
        { icon: 'family', title: 'Para todas las edades', text: 'Actividades inclusivas para toda la familia.' },
      ] },
      { id: 'beneficios', type: 'benefits', eyebrow: 'Beneficios', title: 'Tu equipo gana autonomía. Tu público compra sin fricción.',
        image: '/img/beneficios-mujer.webp', alt: 'Mujer sonriendo con una tarjeta de pago y su celular',
        items: [
          { icon: 'sliders', title: 'Autoadministrable', text: 'Sin limitaciones, aporta full autonomía y facilita el trabajo diario de nuestros clientes, mediante un acabado conocimiento de las reglas del negocio y una completa integración.' },
          { icon: 'shield', title: 'Venta segura y expedita', text: 'Nuestra plataforma de TI permite entregar una experiencia de venta segura y expedita al público, con una operación que funciona las 24 horas del día, los 365 días del año.' },
        ] },
      { id: 'plataforma', type: 'flow', eyebrow: 'La Plataforma', title: 'Maximiza tus ventas sin compartir tu oferta programática',
        lead: 'Configuras todo en un solo lugar, vendes en caja y por internet con el mismo stock, y validas cada entrada en la puerta.',
        startIcon: 'monitor', startTitle: 'Back Office', startText: 'Configuras tu programación.',
        channels: [
          { icon: 'pos', title: 'POS', text: 'Venta en caja.' },
          { icon: 'globe', title: 'Venta Online', text: 'Venta por internet.' },
        ],
        endIcon: 'qr', endTitle: 'Check In', endText: 'Validas con QR.',
        checks: [
          'La más completa integración con diferentes medios de pago, programas de fidelización y otros, que simplifican las tareas de gestión administrativa en la preventa y la posventa.',
          'Integración con dispositivos que automatizan el control y la gestión de accesos.',
          'Check in digital, rápido, fácil, simple y sin papel.',
          'Acceso a tus informes de gestión personalizados en línea y en tiempo real, desde cualquier lugar y dispositivo.',
        ] },
      { id: 'modulos', type: 'cards', eyebrow: '', title: 'Todo en una plataforma web, sin instalar nada', lead: 'Funciona en computador, tablet y celular.', style: 'icon', columns: '4', bg: '',
        items: [
          { icon: 'sliders', title: 'Administra tu Oferta', text: 'Dibujamos tu sala tal como es, con zonas, precios y butacas numeradas. Manejo de promociones, integraciones, listas de espera, distintos tipos de precios con restricciones propias a la medida, y mucho más.' },
          { icon: 'userplus', title: 'Inscripciones Online y Presencial', text: 'Una sola lista de cupos para la web y la boletería. Sin dobles inscripciones.' },
          { icon: 'qr', title: 'Control de acceso y check in', text: 'Tu equipo escanea el código QR con el celular o con lectores integrados.' },
          { icon: 'chart', title: 'Informes en línea', text: 'Ventas por canal, ocupación y recaudación en tiempo real, desde cualquier lugar.' },
        ] },
      { id: 'preguntas', type: 'faq', eyebrow: 'Preguntas frecuentes', title: 'Lo que nos suelen preguntar', items: [
        { q: '¿Tengo que compartir mi cartelera con otras instituciones?', a: 'No. Vendes desde tu propio sitio y con tu marca. Tu oferta programática no aparece en un portal junto a otras.' },
        { q: '¿Tengo que cambiar mi sitio web?', a: 'No. Agregamos un botón o una cartelera embebida en tu sitio actual, con tus colores y tu logo.' },
        { q: '¿Mi equipo necesita conocimientos técnicos?', a: 'No. La plataforma es autoadministrable: tu equipo crea actividades, precios y cupos desde el navegador, y te acompañamos en la puesta en marcha.' },
      ] },
      { id: 'contacto', type: 'contact', eyebrow: 'Hablemos', title: 'Agenda una demo de 30 minutos', lead: 'Te mostramos la plataforma, sin compromiso.',
        showForm: true, button: 'Solicitar demo', success: '¡Gracias! Recibimos tu solicitud y te contactaremos pronto.' },
    ],
  },
  categoryPage: {
    crumb: 'Productos',
    featuresTitle: 'Qué puedes hacer',
    stepsTitle: 'Así funciona',
    othersTitle: 'Otros productos',
    ctaTitle: '¿Lo vemos con tu programación?',
    cta1Label: 'Agenda una demo',
    cta2Label: 'Ver todos los productos',
  },
  categories: [
  {
    "id": "cursos",
    "slug": "cursos-y-talleres",
    "name": "Cursos y Talleres",
    "icon": "cursos",
    "image": "/img/cat-cursos.webp",
    "alt": "Manos trabajando la greda en un torno",
    "pos": "center center",
    "veil": 100,
    "short": "Inscripciones, cupos, cuotas y asistencia.",
    "lead": "Abre inscripciones online y presenciales, controla cupos y asistencia, y cobra matrículas y cuotas desde un mismo lugar.",
    "features": [
      {
        "title": "Inscripciones online y presencial",
        "text": "Una sola lista de cupos para la web y la boletería."
      },
      {
        "title": "Cupos y lista de espera",
        "text": "Cuando se libera un cupo, la siguiente persona recibe el aviso."
      },
      {
        "title": "Matrículas y cuotas",
        "text": "Cobra la matrícula y divide el pago del curso en cuotas."
      },
      {
        "title": "Asistencia por sesión",
        "text": "Registra quién asistió a cada clase desde el celular."
      },
      {
        "title": "Precios por perfil",
        "text": "Valores distintos para estudiantes, vecinos o personas mayores."
      },
      {
        "title": "Informes por curso",
        "text": "Inscritos, recaudación y asistencia de cada taller."
      }
    ],
    "steps": [
      "Publicas tus cursos con horarios, cupos y precios.",
      "Tus alumnos se inscriben y pagan online o en caja.",
      "Registras la asistencia y revisas los informes."
    ],
    "hidden": false
  },
  {
    "id": "ferias",
    "slug": "ferias",
    "name": "Ferias al Aire Libre",
    "icon": "ferias",
    "image": "/img/cat-ferias.webp",
    "alt": "Feria al aire libre con toldos blancos y público",
    "pos": "center center",
    "veil": 100,
    "short": "Entradas por día, aforo y accesos masivos.",
    "lead": "Vende entradas por día y bloque horario, controla accesos masivos y cobra en los puntos de venta del recinto.",
    "features": [
      {
        "title": "Entradas por día y horario",
        "text": "Bloques horarios para ordenar el flujo de público."
      },
      {
        "title": "Aforo por bloque",
        "text": "La venta se cierra sola cuando se completa el aforo."
      },
      {
        "title": "Accesos masivos",
        "text": "Lectores QR para validar muchas entradas por minuto."
      },
      {
        "title": "Puntos de venta",
        "text": "Cobra comida, productos y merchandising en el recinto."
      },
      {
        "title": "Acreditación de expositores",
        "text": "Credenciales para expositores y personal."
      },
      {
        "title": "Flujo de público",
        "text": "Ingresos por hora y por puerta en tiempo real."
      }
    ],
    "steps": [
      "Configuras los días, bloques y aforos.",
      "El público compra online o en caja.",
      "Validas en los accesos y sigues el flujo en vivo."
    ],
    "hidden": false
  },
  {
    "id": "mayores",
    "slug": "tercera-edad",
    "name": "Eventos 3era Edad",
    "icon": "mayores",
    "image": "/img/cat-mayores.webp",
    "alt": "Personas mayores en un taller de cerámica",
    "pos": "center 30%",
    "veil": 100,
    "short": "Inscripción asistida y precios preferentes.",
    "lead": "Facilita el acceso de las personas mayores a tu programación, con inscripción asistida y precios preferentes.",
    "features": [
      {
        "title": "Inscripción asistida",
        "text": "El equipo de caja inscribe a cada persona en pocos pasos."
      },
      {
        "title": "Precios preferentes por RUT",
        "text": "El descuento se aplica al validar el RUT."
      },
      {
        "title": "Recordatorios",
        "text": "Avisos por correo o SMS antes de cada actividad."
      },
      {
        "title": "Talleres con cupos",
        "text": "Cupos por taller y lista de espera."
      },
      {
        "title": "Grupos y clubes",
        "text": "Inscripciones para agrupaciones de adultos mayores."
      },
      {
        "title": "Informes de participación",
        "text": "Asistencia y participación por actividad."
      }
    ],
    "steps": [
      "Publicas las actividades con sus cupos y precios.",
      "Las personas se inscriben en caja o por internet.",
      "Registras la asistencia y revisas la participación."
    ],
    "hidden": false
  },
  {
    "id": "teatro",
    "slug": "teatro",
    "name": "Teatro Local",
    "icon": "teatro",
    "image": "/img/cat-teatro.webp",
    "alt": "Público en un teatro frente al telón rojo",
    "pos": "center center",
    "veil": 100,
    "short": "Butacas numeradas, temporadas y cortesías.",
    "lead": "Vende butacas numeradas en el mapa real de tu sala, administra temporadas y controla el acceso en cada función.",
    "features": [
      {
        "title": "Mapa de sala",
        "text": "Butaca numerada por zona, con vista del escenario."
      },
      {
        "title": "Temporadas y funciones",
        "text": "Crea todas las funciones de una obra de una sola vez."
      },
      {
        "title": "Cortesías",
        "text": "Entradas para elenco, prensa e invitados, con control de cupos."
      },
      {
        "title": "Precios por zona",
        "text": "Platea, balcón y palcos, con promociones propias."
      },
      {
        "title": "Venta online y presencial",
        "text": "Internet y caja presencial con el mismo stock."
      },
      {
        "title": "Control de acceso",
        "text": "Check in por función con código QR, desde lectores o celulares."
      }
    ],
    "steps": [
      "Cargas la obra, las funciones y el mapa de sala.",
      "El público elige su butaca y paga en el canal que prefiera.",
      "Validas las entradas en la puerta y revisas la ocupación."
    ],
    "hidden": false
  },
  {
    "id": "infantil",
    "slug": "infantil",
    "name": "Actividades Culturales Infantiles",
    "icon": "infantil",
    "image": "/img/cat-infantil.webp",
    "alt": "Niña disfrazada a quien le pintan la cara",
    "pos": "center center",
    "veil": 100,
    "short": "Pase familiar, apoderados y cupos por edad.",
    "lead": "Vende entradas familiares y gestiona talleres y funciones para niños, con datos del apoderado y cupos por edad.",
    "features": [
      {
        "title": "Pase familiar",
        "text": "Una compra para toda la familia, con precios para adultos y niños."
      },
      {
        "title": "Datos del apoderado",
        "text": "Nombre, contacto y autorización quedan asociados a cada inscripción."
      },
      {
        "title": "Cupos por edad",
        "text": "Define rangos de edad para cada taller o función."
      },
      {
        "title": "Grupos escolares",
        "text": "Reservas de colegios con listas de alumnos y profesores."
      },
      {
        "title": "Contacto de emergencia",
        "text": "A mano del equipo durante la actividad."
      },
      {
        "title": "Check in de grupos",
        "text": "Valida a un curso completo en un solo paso."
      }
    ],
    "steps": [
      "Creas la actividad con edades, cupos y precios.",
      "Las familias o colegios reservan y pagan.",
      "Validas el ingreso y revisas la asistencia."
    ],
    "hidden": false
  },
  {
    "id": "orquesta",
    "slug": "orquesta",
    "name": "Orquesta y Sala de Música",
    "icon": "orquesta",
    "image": "/img/cat-orquesta.webp",
    "alt": "Músicos de una orquesta tocando violín",
    "pos": "center center",
    "veil": 100,
    "short": "Temporadas de conciertos y multisala.",
    "lead": "Organiza tu temporada de conciertos, vende por programa y gestiona funciones en distintas salas o giras.",
    "features": [
      {
        "title": "Temporada de conciertos",
        "text": "Todos los programas del año en un solo calendario."
      },
      {
        "title": "Venta por programa",
        "text": "Cada concierto con su repertorio, precios y zonas."
      },
      {
        "title": "Multisala y giras",
        "text": "Vende funciones en salas propias o en otras ciudades."
      },
      {
        "title": "Precios por zona",
        "text": "Valores distintos según la ubicación en la sala."
      },
      {
        "title": "Cortesías",
        "text": "Entradas para músicos, invitados y auspiciadores."
      },
      {
        "title": "Informes por concierto",
        "text": "Ocupación y recaudación de cada fecha."
      }
    ],
    "steps": [
      "Publicas la temporada con sus programas y salas.",
      "Tu público compra online o en caja.",
      "Controlas el acceso y comparas los conciertos."
    ],
    "hidden": false
  },
  {
    "id": "seminarios",
    "slug": "seminarios",
    "name": "Seminarios y Conferencias",
    "icon": "seminarios",
    "image": "/img/cat-seminarios.webp",
    "alt": "Público asistiendo a una conferencia",
    "pos": "center center",
    "veil": 100,
    "short": "Acreditación con QR y certificados.",
    "lead": "Acredita a los asistentes con QR, controla el acceso a cada charla y entrega certificados de participación.",
    "features": [
      {
        "title": "Inscripción online",
        "text": "Formulario con los datos que tu evento necesita."
      },
      {
        "title": "Acreditación con QR",
        "text": "Credencial digital que se valida al ingresar."
      },
      {
        "title": "Acceso por charla",
        "text": "Controla el aforo de cada sala o bloque."
      },
      {
        "title": "Certificados",
        "text": "Constancia de participación para quienes asistieron."
      },
      {
        "title": "Precios y convenios",
        "text": "Valores por perfil y códigos para instituciones."
      },
      {
        "title": "Informes de asistencia",
        "text": "Quién asistió a qué charla, en tiempo real."
      }
    ],
    "steps": [
      "Creas el evento con su programa y salas.",
      "Los asistentes se inscriben y reciben su QR.",
      "Acreditas en la entrada y entregas los certificados."
    ],
    "hidden": false
  }
],
  pages: [
    { id: 'nosotros', slug: 'nosotros', title: 'Nosotros', hidden: false,
      seoDescription: 'Proexsi es una empresa chilena de TI con más de 20 años desarrollando sistemas de venta y gestión cultural.',
      blocks: [
        { id: 'encabezado', type: 'pageHero', eyebrow: 'Nosotros', icon: '', title: 'Tecnología hecha para la cultura',
          lead: 'Somos Proexsi, una empresa chilena de TI que desarrolla sistemas de venta y gestión para organizaciones culturales, artísticas y de entretenimiento.',
          image: '/img/hero-feria-full.webp', alt: 'Feria cultural al aire libre', pos: '72% 40%', veil: 100, cta1Label: '', cta1Href: '', cta2Label: '', cta2Href: '' },
        { id: 'trayectoria', type: 'stat', number: '+20',
          body: '<strong>Empresa de TI con más de 20 años desarrollando sistemas customizados de venta y gestión cultural.</strong> Optimizamos la gestión y eficiencia de organizaciones cuyo foco está en el mundo de la cultura, las artes y el entretenimiento.',
          body2: 'Conocemos las reglas de negocio de teatros, centros culturales, orquestas, escuelas de arte y ferias, y las llevamos a una plataforma que tu equipo administra con autonomía.', bg: '' },
        { id: 'que-hacemos', type: 'cards', eyebrow: 'Qué hacemos', title: 'Desarrollamos, integramos y operamos contigo', lead: '', style: 'number', columns: '3', bg: 'sand', items: [
          { icon: '', title: 'Sistemas a la medida', text: 'Adaptamos la plataforma a tus salas, precios, perfiles de público y forma de trabajar.' },
          { icon: '', title: 'Autoadministrable', text: 'Tu equipo crea actividades, precios y cupos sin depender de nosotros para el día a día.' },
          { icon: '', title: 'Operación 24/7', text: 'Venta segura y expedita las 24 horas del día, los 365 días del año.' },
        ] },
        { id: 'valores', type: 'cards', eyebrow: 'Cómo trabajamos', title: 'Lo que nos importa', lead: '', style: 'line', columns: '4', bg: '', items: [
          { icon: '', title: 'Tu oferta es tuya', text: 'Vendes desde tu sitio y con tu marca, sin compartir tu programación en un portal ajeno.' },
          { icon: '', title: 'Autonomía', text: 'Herramientas simples para que tu equipo decida y opere sin intermediarios.' },
          { icon: '', title: 'Integración completa', text: 'Medios de pago, boleta electrónica, fidelización y dispositivos de acceso en un solo sistema.' },
          { icon: '', title: 'Cercanía', text: 'Un equipo en Chile que conoce la gestión cultural y te acompaña en cada temporada.' },
        ] },
        { id: 'acompanamos', type: 'chips', title: 'A quiénes acompañamos', bg: '' },
        { id: 'cta', type: 'cta', title: '¿Conversamos sobre tu programación?', button: 'Agenda una demo', href: '/#contacto' },
      ] },
  ],
};
