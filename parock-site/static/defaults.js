// Contenido inicial del sitio PAROCK. El back office guarda una copia editable en Neon;
// este archivo solo se usa la primera vez o al restablecer.
const I = (src, alt = '') => ({ src: '/static/img/' + src, alt });

export const DEFAULT_CONTENT = {
  version: 1,
  theme: {
    colors: {
      navy: '#0F1D2B', gold: '#A9864E', 'gold-2': '#C9A86B', 'gold-soft': '#E9DCC4',
      cream: '#F7F3EC', ink: '#1B2430', muted: '#5E6875', accent: '#E8743B'
    },
    fontHead: 'Montserrat',
    fontBody: 'Inter'
  },
  site: {
    name: 'PAROCK Group',
    logo: I('logo-parock.png', 'PAROCK Group'),
    logoWhite: I('logo-parock-white.png', 'PAROCK Group'),
    metaTitle: 'PAROCK Group — Conectamos marcas, productos y oportunidades',
    metaDescription: 'PAROCK es una empresa chilena de desarrollo comercial, gestión de portafolios y distribución de productos para el retail, con foco en la categoría mascotas.',
    moreLabel: 'Ver más'
  },
  nav: {
    items: [
      { label: 'Inicio', href: '/#inicio' },
      { label: 'Nosotros', href: '/#nosotros' },
      { label: 'Nuestra Propuesta', href: '/#propuesta' },
      { label: 'Portafolio', href: '/#portafolio' }
    ],
    cta: { label: 'Contacto', href: '/#contacto' }
  },
  hero: {
    mode: 'classic',
    leftImage: I('gato-portada.jpg', 'Gato atigrado mirando hacia arriba'),
    rightImage: I('perro-portada.jpg', 'Perro feliz con la lengua afuera'),
    showLogo: true,
    title: 'Conectamos **marcas, productos** y **oportunidades** de negocio.',
    subtitle: 'Desarrollo comercial, gestión de portafolios y distribución para el retail chileno.',
    buttons: [
      { label: 'Ver portafolio', href: '/#portafolio', style: 'gold' },
      { label: 'Hablemos de negocios', href: '/#contacto', style: 'line' }
    ],
    showBrands: true,
    brandsLabel: 'Nuestro portafolio',
    slides: [
      { image: I('portafolio-completo.jpg', 'Portafolio Minino y PetMetro'), title: 'Conectamos **marcas, productos** y **oportunidades**', text: 'Desarrollo comercial y distribución para el retail chileno.', button: { label: 'Ver portafolio', href: '/portafolio' } },
      { image: I('joven-gato.jpg', 'Joven con su gato'), title: 'El consumidor está **cambiando**', text: 'La categoría mascotas debe evolucionar con él.', button: { label: 'Nuestra propuesta', href: '/propuesta' } },
      { image: I('perro-comida.jpg', 'Perro disfrutando su alimento'), title: 'Productos con **foco en rotación**', text: 'Calidad, formatos atractivos y precios accesibles.', button: { label: 'Contáctanos', href: '/#contacto' } }
    ],
    autoplay: 6
  },
  about: {
    eyebrow: 'Nosotros',
    title: 'Una empresa chilena con **visión comercial**',
    lead1: 'PAROCK conecta marcas y productos con oportunidades de negocio, generando valor para nuestros clientes y para el consumidor final.',
    lead2: 'Combinamos conocimiento del mercado, visión comercial y un portafolio competitivo, con foco inicial en la categoría mascotas.',
    facts: [
      { value: '+30', label: 'años de experiencia combinada en consumo masivo' },
      { value: '2', label: 'marcas propias en la categoría mascotas' },
      { value: '5', label: 'líneas de producto listas para el retail' }
    ],
    images: [I('joven-gato.jpg', 'Joven descansando con su gato en el sofá'), I('gato-snack.jpg', 'Gato disfrutando su alimento')],
    badgeTitle: 'En alianza estratégica con Roval SpA',
    badgeText: 'Abastecimiento y distribución coordinados',
    team: [
      {
        photo: I('equipo-marcelo.jpg', 'Marcelo Parodi L.'), name: 'Marcelo Parodi L.', role: '+15 años en consumo masivo',
        bio: 'Gerente de Marketing y Trade Marketing en Mars, Nestlé y Agrosuper. Amplio conocimiento del rubro mascotas y de los principales clientes hard discount de Latinoamérica.',
        highlights: [
          { title: 'Amplio conocimiento en el rubro de mascotas', text: 'Identificación de oportunidades, desarrollo de categoría y propuestas de valor para el consumidor.' },
          { title: 'Experiencia con los principales clientes hard discount de Latinoamérica', text: 'Conocimiento de modelos comerciales orientados a competitividad, rentabilidad y ejecución.' }
        ]
      },
      {
        photo: I('equipo-kevin.jpg', 'Kevin Rosenkranz B.'), name: 'Kevin Rosenkranz B.', role: '+17 años en consumo masivo y B2B',
        bio: 'Trayectoria ejecutiva en Nestlé, Unilever y Puig como Business Manager, Customer Marketing Manager y Key Account Manager. Profundo conocimiento del canal supermercados.',
        highlights: [
          { title: 'Visión estratégica de negocios y rentabilidad', text: 'Diseño de estrategias de crecimiento rentable por cliente y canal, con foco en generar valor conjunto para el retailer y el shopper.' },
          { title: 'Profundo conocimiento del canal supermercados', text: 'Experiencia directa con las principales cadenas de Chile.' }
        ]
      }
    ],
    more: { label: 'Conoce más sobre nosotros', href: '/nosotros' }
  },
  aboutPage: {
    title: 'Somos **PAROCK Group**',
    intro: 'Una empresa chilena especializada en desarrollo comercial, gestión de portafolios y distribución de productos para el retail.',
    heroImage: I('joven-gato.jpg', 'Joven con su gato'),
    storyTitle: 'Quiénes somos',
    story: 'PAROCK nace para conectar marcas y productos con oportunidades de negocio, buscando generar valor tanto para nuestros clientes como para los consumidores finales.\n\nNuestra propuesta combina conocimiento del mercado, visión comercial y un portafolio competitivo. Comenzamos con un foco especial en la categoría mascotas, una de las de mayor dinamismo en el consumo masivo chileno.',
    gallery: [I('gato-portada.jpg', 'Gato'), I('perro-portada.jpg', 'Perro'), I('gato-saludo.jpg', 'Gato saludando')],
    mission: 'Desarrollar categorías atractivas, competitivas y rentables para el retail, acercando al consumidor productos de calidad a precios accesibles.',
    vision: 'Ser el socio comercial de referencia para el retail chileno en la incorporación de nuevas marcas, categorías y líneas de negocio.',
    valuesTitle: 'Lo que nos mueve',
    values: [
      { icon: 'handshake', title: 'Relaciones de largo plazo', text: 'Construimos alianzas orientadas al crecimiento conjunto.' },
      { icon: 'chart', title: 'Foco en resultados', text: 'Rotación, competitividad y rentabilidad para cada cliente.' },
      { icon: 'user', title: 'Cercanía con el consumidor', text: 'Entendemos sus tendencias y nuevas necesidades.' },
      { icon: 'shield', title: 'Seriedad y cumplimiento', text: 'Coordinamos abastecimiento y distribución con rigor.' }
    ],
    teamTitle: 'Nuestro equipo',
    allianceTitle: 'Alianza estratégica con Roval SpA',
    allianceText: 'Trabajamos en alianza con Roval SpA para coordinar el abastecimiento y la distribución de nuestro portafolio, asegurando continuidad y cumplimiento con cada cadena.'
  },
  proposal: {
    eyebrow: 'Nuestra propuesta',
    title: 'Más allá de la **distribución tradicional**',
    lead: 'Desarrollamos categorías atractivas, competitivas y rentables para nuestros clientes.',
    pillars: [
      { icon: 'layers', title: 'Portafolio competitivo', text: 'Buena calidad, formatos atractivos y precios accesibles.', long: 'Seleccionamos y desarrollamos productos con una relación precio-calidad pensada para el shopper chileno, en formatos que facilitan la compra y la exhibición.' },
      { icon: 'user', title: 'Conocimiento del consumidor', text: 'Identificamos tendencias y nuevas necesidades del mercado.', long: 'Seguimos de cerca la humanización de las mascotas, el cuidado preventivo y la búsqueda de valor para anticipar qué necesita el consumidor.' },
      { icon: 'chart', title: 'Desarrollo de categorías', text: 'Surtidos y oportunidades que potencian rotación y rentabilidad.', long: 'Proponemos surtidos, espacios y exhibiciones basados en datos de mercado para que cada metro de góndola rinda más.' },
      { icon: 'handshake', title: 'Relaciones de largo plazo', text: 'Alianzas comerciales orientadas al crecimiento conjunto.', long: 'Trabajamos como socios de nuestros clientes: planes conjuntos, seguimiento permanente y compromiso con los resultados.' }
    ],
    more: { label: 'Ver nuestra propuesta completa', href: '/propuesta' }
  },
  proposalPage: {
    title: 'Nuestra **propuesta de valor**',
    intro: 'Queremos ser un socio comercial que aporte al crecimiento de nuestros clientes, con una mirada de categoría y no solo de producto.',
    heroImage: I('perro-comida.jpg', 'Perro disfrutando su alimento'),
    processTitle: 'Cómo trabajamos',
    process: [
      { title: 'Diagnóstico de categoría', text: 'Analizamos el desempeño de la categoría, los espacios y las oportunidades del cliente.' },
      { title: 'Propuesta de surtido', text: 'Definimos el portafolio y los formatos que mejor se adaptan a cada canal.' },
      { title: 'Plan comercial y exhibición', text: 'Acordamos precios, activaciones y exhibición para maximizar la rotación.' },
      { title: 'Abastecimiento y seguimiento', text: 'Coordinamos la distribución y medimos los resultados junto al cliente.' }
    ],
    trendsTitle: 'Tendencias que impulsan la categoría',
    trends: [
      { icon: 'heart', kpi: '82%', kpiLabel: 'de los tutores considera a su mascota un miembro más de la familia', title: 'Humanización y premiumización', quote: 'Mi mascota es parte de mi familia', points: ['Mayor disposición a pagar por productos de mayor valor y calidad', 'Búsqueda de experiencias que mejoren su bienestar', 'Impulsa el crecimiento de marcas premium e innovadoras'] },
      { icon: 'shield', kpi: '+30%', kpiLabel: 'crecimiento global de productos de salud y cuidado preventivo en 5 años', title: 'Salud y cuidado preventivo', quote: 'Una mascota sana vive más y mejor', points: ['Mayor foco en nutrición, salud digestiva, control de peso y salud oral', 'Aumento de productos con beneficios funcionales y naturales', 'Tutores más informados y proactivos'] },
      { icon: 'phone', kpi: '43,5%', kpiLabel: 'de la tenencia de mascotas en 2024 corresponde a la Generación Z', title: 'Generación Z: el nuevo tutor', quote: 'Una nueva generación, más informada y conectada', points: ['Redes sociales como principal fuente de información', 'Buscan productos innovadores, funcionales y sustentables', 'Mayor interés por marcas auténticas y con propósito'] },
      { icon: 'cart', kpi: '+40%', kpiLabel: 'de las ventas globales de snacks y treats en los últimos 5 años', title: 'Conveniencia y formatos prácticos', quote: 'Soluciones simples para el día a día', points: ['Productos prácticos, fáciles de usar y porcionados', 'Snacks y treats como complemento a la nutrición', 'Formatos pequeños y packs múltiples impulsan la frecuencia'] }
    ],
    trendsSource: 'Fuente: Kantar y Euromonitor, 2025.',
    marketTitle: 'Un mercado en crecimiento',
    market: [
      { title: 'Perros', households: '57%', householdsLabel: 'de los hogares chilenos tiene al menos un perro', cagr1: '+2,0%', cagr2: '+1,4%', volumes: '311 · 296 · 338 kton (2020 · 2025 · 2030)' },
      { title: 'Gatos', households: '48%', householdsLabel: 'de los hogares chilenos tiene al menos un gato', cagr1: '+4,2%', cagr2: '+2,9%', volumes: '99 · 115 · 146 kton (2020 · 2025 · 2030)' }
    ],
    penetrationTitle: 'Penetración de compra',
    penetrationLead: 'Porcentaje de personas con mascota que declararon comprar cada tipo de producto.',
    penetration: [
      { label: 'Alimento seco', value: 89 }, { label: 'Arena sanitaria', value: 70 }, { label: 'Cuidado e higiene', value: 58 },
      { label: 'Alimento húmedo', value: 37 }, { label: 'Snacks y treats', value: 36 }
    ],
    marketSource: 'Fuente: Nielsen y Euromonitor, 2025.'
  },
  vision: {
    eyebrow: 'Nuestra visión de la categoría',
    quote: 'El consumidor está cambiando, y la categoría de mascotas **debe evolucionar con él.**',
    lead: 'Las mascotas ocupan un lugar cada vez más importante en los hogares, impulsando nuevas necesidades de alimentación, higiene y cuidado.',
    images: [I('gato-snack.jpg', 'Gato disfrutando su alimento')],
    trends: [
      { kpi: '82%', kpiLabel: 'de los tutores', title: 'Humanización', text: 'Las mascotas son consideradas integrantes de la familia.' },
      { kpi: '+30%', kpiLabel: 'salud preventiva', title: 'Bienestar y cuidado', text: 'Los consumidores buscan productos que contribuyan al cuidado cotidiano de sus mascotas.' },
      { kpi: '+40%', kpiLabel: 'snacks y treats', title: 'Valor y accesibilidad', text: 'Buena calidad, formatos convenientes y precios competitivos.' }
    ],
    stats: [
      { value: '57%', label: 'de los hogares chilenos tiene al menos un perro' },
      { value: '48%', label: 'de los hogares chilenos tiene al menos un gato' },
      { value: '+4,2%', label: 'crecimiento anual alimento para gatos 2020–2025' },
      { value: '70%', label: 'de quienes tienen mascota compra arena sanitaria' }
    ],
    source: 'Fuentes: Nielsen, Euromonitor y Kantar, 2025.',
    more: { label: 'Ver tendencias y datos de mercado', href: '/propuesta#tendencias' }
  },
  why: {
    eyebrow: '¿Por qué trabajar con PAROCK?',
    title: 'Un socio que aporta al **crecimiento** de tu negocio',
    items: [
      { title: 'Desarrollo y gestión de portafolios', text: 'Construimos y administramos el portafolio de cada cliente.' },
      { title: 'Propuestas comerciales adaptadas a cada canal', text: 'Supermercados, hard discount, mayoristas y canal tradicional.' },
      { title: 'Visión de categoría, surtido y exhibición', text: 'Decisiones basadas en datos de mercado y del shopper.' },
      { title: 'Coordinación de abastecimiento y distribución', text: 'Continuidad de suministro y cumplimiento.' },
      { title: 'Foco en rotación, competitividad y rentabilidad', text: 'Medimos y mejoramos los resultados junto a ti.' }
    ],
    button: { label: 'Conversemos', href: '/#contacto' },
    image: I('gato-saludo.jpg', 'Gato levantando la pata en señal de saludo')
  },
  portfolio: {
    eyebrow: 'Portafolio',
    title: 'Productos pensados para el **retail** y para sus **mascotas**',
    lead: 'Respondemos a las tendencias de humanización, cuidado y bienestar animal.',
    images: [I('portafolio-completo.jpg', 'Línea completa de productos Minino y PetMetro')],
    more: { label: 'Ver portafolio completo', href: '/portafolio' },
    pageTitle: 'Nuestro **portafolio**',
    pageIntro: 'Productos de higiene, alimentación y premios para perros y gatos, con calidad confiable, formatos prácticos y precios competitivos para el retail.',
    coming: { title: 'Nuevas marcas y categorías en desarrollo', text: '¿Tienes una marca o un producto con potencial para el retail? Conversemos.', button: { label: 'Proponer una alianza', href: '/#contacto' } },
    brands: [
      {
        slug: 'minino', name: 'Minino', logo: I('logo-minino.png', 'Minino Arena Premium'), tag: 'Higiene y cuidado', color: '#6E8B2B',
        description: 'Arena sanitaria para gatos, elaborada con bentonita aglomerante.',
        longDescription: 'Minino Arena Premium ofrece máxima limpieza y control de olores para un hogar más fresco, con la calidad de una arena premium a un precio accesible.',
        products: [
          {
            slug: 'minino-arena-sanitaria-4kg-lavanda', name: 'Minino Arena Sanitaria 4 kg Lavanda', category: 'Arena sanitaria · Gatos', featured: true,
            claim: 'La limpieza que tu gato necesita. **Al precio que buscas.**',
            short: 'Arena aglutinante premium con aroma lavanda.',
            description: 'Arena sanitaria aglutinante elaborada con bentonita aglomerante. Atrapa la humedad de forma rápida, controla los olores con un aroma lavanda fresco y duradero, y forma bloques compactos que facilitan la limpieza y rinden por más tiempo.',
            image: I('minino-4kg.jpg', 'Envase Minino Arena Premium Aglutinante Lavanda 4 kg'),
            gallery: [I('minino-4kg.jpg', 'Minino 4 kg'), I('gato-portada.jpg', 'Gato')],
            features: [
              { icon: 'drop', title: 'Absorción 350%', text: 'Atrapa la humedad de forma rápida y eficiente.' },
              { icon: 'waves', title: 'Control de olores', text: 'Aroma lavanda, mayor frescura en el hogar.' },
              { icon: 'flower', title: 'Aglutinamiento concentrado', text: 'Facilita la limpieza y rinde por más tiempo.' },
              { icon: 'dust', title: 'Baja emisión de polvo', text: '99% libre de polvo, más limpio y seguro para tu mascota.' }
            ],
            benefits: ['Hogares más limpios', 'Mayor bienestar para tu gato', 'Calidad premium a un precio accesible'],
            variants: [{ name: 'Lavanda 4 kg', image: I('minino-4kg.jpg', 'Minino Lavanda 4 kg') }],
            specs: [
              { label: 'Formato', value: 'Bolsa 4 kg con mango transportable' },
              { label: 'Tipo', value: 'Arena aglutinante de bentonita' },
              { label: 'Aroma', value: 'Lavanda' },
              { label: 'Especie', value: 'Gatos' },
              { label: 'Formato de venta', value: 'Pallet a medida del cliente' }
            ],
            chips: ['Bentonita aglomerante', 'Mango transportable', 'Pallet a medida del cliente']
          }
        ]
      },
      {
        slug: 'petmetro', name: 'PetMetro', logo: I('logo-petmetro.png', 'PetMetro — Deliver Your Love'), tag: 'Alimentación y premios', color: '#C8383A',
        description: 'Alimentación y snacks para perros y gatos, con formatos prácticos y competitivos.',
        longDescription: 'PetMetro reúne alimento húmedo, premios cremosos y galletas para perros y gatos, con ingredientes reales, sin aditivos artificiales y en formatos pensados para el día a día.',
        products: [
          {
            slug: 'balance-nutrition', name: 'Balance Nutrition', category: 'Alimento húmedo · Gatos',
            claim: 'Nutrición real y deliciosa **para todos los días.**',
            short: 'Nutrición real y deliciosa para todos los días.',
            description: 'Alimento húmedo para gatos elaborado con proteínas reales de pollo, atún y salmón, sin colorantes ni conservantes artificiales. Incluye taurina y omega, que contribuyen a la salud del corazón, la vista y un pelaje más sano.',
            image: I('balance-nutrition.jpg', 'Latas PetMetro Balance Nutrition'),
            gallery: [I('balance-nutrition.jpg', 'Balance Nutrition'), I('gato-snack.jpg', 'Gato comiendo')],
            features: [
              { icon: 'fish', title: 'Ingredientes naturales', text: 'Proteínas reales de pollo, atún y salmón para una nutrición completa.' },
              { icon: 'leaf', title: 'Sin colorantes ni conservantes artificiales', text: 'Una receta más natural y saludable.' },
              { icon: 'heart', title: 'Con taurina y omega', text: 'Contribuye a la salud del corazón, la vista y el pelaje.' },
              { icon: 'bowl', title: 'Formato ideal de 400 g', text: 'Porciones jugosas y apetitosas para todos los días.' }
            ],
            benefits: ['Nutrición completa para su bienestar', 'Gran sabor que les encanta', 'Calidad confiable todos los días', 'Una opción accesible para más hogares'],
            variants: [
              { name: 'Salmón en trozos', image: I('bn-salmon-chunk.jpg', 'Balance Nutrition salmón en trozos') },
              { name: 'Salmón en paté', image: I('bn-salmon-pate.jpg', 'Balance Nutrition salmón en paté') },
              { name: 'Atún en trozos', image: I('bn-tuna-chunk.jpg', 'Balance Nutrition atún en trozos') },
              { name: 'Atún en paté', image: I('bn-tuna-pate.jpg', 'Balance Nutrition atún en paté') }
            ],
            specs: [
              { label: 'Formato', value: 'Lata 400 g' },
              { label: 'Especie', value: 'Gatos' },
              { label: 'Variedades', value: 'Salmón y atún, en trozos o paté' },
              { label: 'Formato de venta', value: 'Caja con 24 latas' }
            ],
            chips: ['Con taurina y omega', 'Sin conservantes']
          },
          {
            slug: 'super-chunk', name: 'Super Chunk', category: 'Alimento húmedo · Perros',
            claim: 'Trozos reales de carne y un **sabor irresistible.**',
            short: 'Trozos reales de carne y un sabor irresistible.',
            description: 'Alimento húmedo para perros con trozos reales de carne y proteínas de alta calidad, sin colorantes ni conservantes artificiales. Con vitaminas y minerales que contribuyen a una vida activa y un sistema inmune fuerte.',
            image: I('super-chunk.jpg', 'Latas PetMetro Super Chunk'),
            gallery: [I('super-chunk.jpg', 'Super Chunk'), I('perro-comida.jpg', 'Perro comiendo')],
            features: [
              { icon: 'bone', title: 'Trozos reales de carne', text: 'Proteínas de alta calidad para una nutrición completa.' },
              { icon: 'leaf', title: 'Sin colorantes ni conservantes artificiales', text: 'Una receta más natural y saludable.' },
              { icon: 'heart', title: 'Con vitaminas y minerales', text: 'Contribuye a una vida activa y un sistema inmune fuerte.' },
              { icon: 'paw', title: 'Cuatro deliciosos sabores', text: 'Cordero, pollo, pato y vacuno, para más variedad.' }
            ],
            benefits: ['Nutrición completa para su bienestar', 'Sabor real que les encanta', 'Calidad confiable todos los días', 'Una opción accesible para más hogares'],
            variants: [
              { name: 'Cordero', image: I('sc-cordero.jpg', 'Super Chunk cordero') },
              { name: 'Pollo', image: I('sc-pollo.jpg', 'Super Chunk pollo') },
              { name: 'Pato', image: I('sc-pato.jpg', 'Super Chunk pato') },
              { name: 'Vacuno', image: I('sc-vacuno.jpg', 'Super Chunk vacuno') }
            ],
            specs: [
              { label: 'Formato', value: 'Lata 400 g' },
              { label: 'Especie', value: 'Perros' },
              { label: 'Variedades', value: 'Cordero, pollo, pato y vacuno' },
              { label: 'Formato de venta', value: 'Caja con 24 latas de 400 g' }
            ],
            chips: ['Trozos reales', 'Vitaminas y minerales']
          },
          {
            slug: 'creamy-treats', name: 'Creamy Treats', category: 'Premios cremosos · Gatos',
            claim: 'Un snack cremoso para **consentirlos todos los días.**',
            short: 'Un snack cremoso para consentirlos todos los días.',
            description: 'Premio cremoso para gatos, suave y nutritivo, elaborado con ingredientes reales y sin sabores ni aditivos artificiales. Ideal como premio diario para fortalecer el vínculo con tu gato.',
            image: I('creamy-treats.jpg', 'Sobres PetMetro Creamy Treats'),
            gallery: [I('creamy-treats.jpg', 'Creamy Treats'), I('gato-snack.jpg', 'Gato')],
            features: [
              { icon: 'fish', title: 'Snack suave y nutritivo', text: 'Con ingredientes reales y de alta calidad.' },
              { icon: 'leaf', title: 'Sin sabores ni aditivos artificiales', text: 'Una alternativa más natural y saludable.' },
              { icon: 'heart', title: 'Funcional y delicioso', text: 'Ideal como premio diario, fortalece el vínculo con tu gato.' },
              { icon: 'star', title: 'Tres irresistibles sabores', text: 'Atún, salmón y pollo.' }
            ],
            benefits: ['Un premio saludable para su bienestar', 'Sabores reales que les encantan', 'Calidad premium a un precio accesible', 'Ideal para todos los días'],
            variants: [
              { name: 'Atún', image: I('ct-atun.jpg', 'Creamy Treats atún') },
              { name: 'Salmón', image: I('ct-salmon.jpg', 'Creamy Treats salmón') },
              { name: 'Pollo', image: I('ct-pollo.jpg', 'Creamy Treats pollo') }
            ],
            specs: [
              { label: 'Formato', value: '5 sobres × 15 g (75 g)' },
              { label: 'Especie', value: 'Gatos' },
              { label: 'Variedades', value: 'Atún, salmón y pollo' },
              { label: 'Formato de venta', value: 'Caja (unidades por confirmar)' }
            ],
            chips: ['5 sobres × 15 g', 'Sin aditivos']
          },
          {
            slug: 'crunchy-biscuits', name: 'Crunchy Biscuits', category: 'Snacks y galletas · Gatos',
            claim: 'El snack perfecto para **sorprender y consentir** a tu gato.',
            short: 'El snack perfecto para sorprender a tu gato.',
            description: 'Galletas para gatos con proteínas reales de pollo, atún y leche, libres de colorantes, saborizantes y conservantes artificiales. Un snack nutritivo y funcional, ideal como premio diario.',
            image: I('crunchy-biscuits.jpg', 'Bolsas PetMetro Crunchy Biscuits'),
            gallery: [I('crunchy-biscuits.jpg', 'Crunchy Biscuits'), I('gato-saludo.jpg', 'Gato')],
            features: [
              { icon: 'fish', title: 'Ingredientes naturales', text: 'Proteínas reales de pollo, atún y leche.' },
              { icon: 'leaf', title: 'Sin aditivos artificiales', text: 'Libre de colorantes, saborizantes y conservantes artificiales.' },
              { icon: 'heart', title: 'Snack nutritivo y funcional', text: 'Ideal como premio diario para reforzar el vínculo.' },
              { icon: 'star', title: 'Tres deliciosos sabores', text: 'Pollo, atún y leche.' }
            ],
            benefits: ['Un snack irresistible que les encanta', 'Contribuye a su bienestar y felicidad', 'Calidad premium a un precio accesible', 'Ideal para consentirlo todos los días'],
            variants: [
              { name: 'Atún', image: I('cb-atun.jpg', 'Crunchy Biscuits atún') },
              { name: 'Leche', image: I('cb-leche.jpg', 'Crunchy Biscuits leche') },
              { name: 'Pollo', image: I('cb-pollo.jpg', 'Crunchy Biscuits pollo') }
            ],
            specs: [
              { label: 'Formato', value: 'Bolsa 85 g' },
              { label: 'Especie', value: 'Gatos' },
              { label: 'Variedades', value: 'Pollo, atún y leche' },
              { label: 'Formato de venta', value: 'Caja (unidades por confirmar)' }
            ],
            chips: ['100% Human Grade Meat', '3 sabores']
          }
        ]
      }
    ]
  },
  contact: {
    eyebrow: 'Contacto',
    title: 'Hablemos de **oportunidades**',
    lead: 'Para compradores, proveedores y potenciales socios comerciales.',
    company: '**PAROCK** Group',
    address: 'Av. Las Condes 11271, Oficina 11\nLas Condes, Santiago, Chile',
    email: 'contacto@parock.cl',
    phone: '',
    mapUrl: 'https://maps.google.com/?q=Av.+Las+Condes+11271,+Las+Condes,+Santiago',
    mailButton: 'Contacto comercial por correo',
    labels: { nombre: 'Nombre', empresa: 'Empresa', email: 'Correo electrónico', mensaje: 'Mensaje' },
    consent: 'Acepto la política de privacidad y el tratamiento de mis datos para fines de contacto comercial.',
    submit: 'Enviar mensaje',
    success: '¡Gracias! Recibimos tu mensaje y te contactaremos pronto.'
  },
  footer: {
    tagline: 'Conectamos marcas, productos y oportunidades de negocio.',
    copyright: '© 2026 PAROCK Group. Todos los derechos reservados.',
    privacyLabel: 'Política de privacidad',
    privacyText: 'En PAROCK Group respetamos tu privacidad. Los datos que nos entregas a través del formulario de contacto (nombre, empresa, correo electrónico y mensaje) se usan exclusivamente para responder tu consulta y gestionar una eventual relación comercial.\n\nNo compartimos tus datos con terceros, salvo obligación legal. Puedes solicitar el acceso, rectificación o eliminación de tus datos escribiendo a contacto@parock.cl.\n\nEste sitio cumple con la Ley N° 19.628 sobre protección de la vida privada y la Ley N° 21.719 de protección de datos personales.'
  }
};
