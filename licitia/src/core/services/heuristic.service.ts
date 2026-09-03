import { diffArrays } from "diff";
import type { PageText } from "@/core/domain/types";
import type {
  Classification,
  DeliveredItems,
  Diff,
  Evaluation,
  Requirements,
  Summary,
  SystemFeatures,
  Systems,
  TechnicalVariables,
  Timeline,
} from "@/core/ai/schemas";
import { norm, wordOverlap } from "@/lib/text-match";

// ============================================================================
// MOTOR LOCAL (sin IA)
//
// Extrae la misma información que los agentes de IA, pero mediante patrones y
// diccionarios especializados en licitaciones públicas chilenas. No consume
// cuota ni créditos y se ejecuta en milisegundos.
//
// Es menos matizado que un modelo de lenguaje —no interpreta, reconoce— pero
// resulta fiable en lo estructurado: números de licitación, montos, plazos,
// organismos, cláusulas obligatorias, integraciones, garantías y multas.
// Cada dato conserva su página y su cita textual, igual que en modo IA.
// ============================================================================

interface Located {
  text: string;
  page: number;
}

/** Divide el documento en oraciones/cláusulas conservando la página de origen. */
function sentences(pages: PageText[]): Located[] {
  const out: Located[] = [];
  for (const p of pages) {
    for (const raw of p.content.split(/(?<=[.;:])\s+|\n+/)) {
      const text = raw.replace(/\s+/g, " ").trim();
      if (text.length >= 25 && text.length <= 600) out.push({ text, page: p.pageNumber });
    }
  }
  return out;
}

function fullText(pages: PageText[], max = 400_000): string {
  let out = "";
  for (const p of pages) {
    if (out.length > max) break;
    out += "\n" + p.content;
  }
  return out;
}

function findPage(pages: PageText[], needle: string): number | null {
  const n = norm(needle);
  for (const p of pages) if (norm(p.content).includes(n)) return p.pageNumber;
  return null;
}

// ─── Clasificación ──────────────────────────────────────────────────────────

const DOC_TYPE_HINTS: Array<[string, Classification["tipo_documento"]]> = [
  ["bases administrativas", "bases_administrativas"],
  ["bases tecnicas", "bases_tecnicas"],
  ["especificaciones tecnicas", "bases_tecnicas"],
  ["propuesta tecnica", "propuesta_tecnica"],
  ["oferta tecnica", "propuesta_tecnica"],
  ["propuesta economica", "propuesta_comercial"],
  ["propuesta comercial", "propuesta_comercial"],
  ["oferta economica", "propuesta_comercial"],
  ["carta gantt", "carta_gantt"],
  ["contrato de", "contrato"],
  ["contrato n", "contrato"],
  ["anexo n", "anexo"],
  ["acta de", "acta"],
  ["informe de avance", "avance"],
  ["estado de avance", "avance"],
  ["control de entregas", "control_entregas"],
  ["informe", "informe"],
  ["reclamo", "reclamo"],
  ["licitacion publica", "licitacion"],
  ["llamado a licitacion", "licitacion"],
];

const REGIONES: Record<string, string[]> = {
  "Arica y Parinacota": ["arica"],
  Tarapacá: ["iquique", "alto hospicio"],
  Antofagasta: ["antofagasta", "calama"],
  Atacama: ["copiapo", "vallenar"],
  Coquimbo: ["la serena", "coquimbo", "ovalle"],
  Valparaíso: ["valparaiso", "viña del mar", "quilpue", "san antonio"],
  Metropolitana: ["santiago", "maipu", "puente alto", "las condes", "providencia", "ñuñoa"],
  "O'Higgins": ["rancagua", "san fernando"],
  Maule: ["talca", "curico", "linares"],
  Ñuble: ["chillan"],
  Biobío: ["concepcion", "talcahuano", "los angeles"],
  Araucanía: ["temuco", "villarrica", "angol"],
  "Los Ríos": ["valdivia", "la union"],
  "Los Lagos": ["puerto montt", "osorno", "castro", "ancud"],
  Aysén: ["coyhaique"],
  Magallanes: ["punta arenas"],
};

export function classifyDocumentLocal(pages: PageText[]): Classification {
  const text = fullText(pages);
  const n = norm(text);
  const head = norm(pages.slice(0, 3).map((p) => p.content).join(" "));

  // Tipo de documento: primero por encabezado, luego por cuerpo
  let tipo: Classification["tipo_documento"] = "otro";
  for (const [hint, t] of DOC_TYPE_HINTS) if (head.includes(hint)) { tipo = t; break; }
  if (tipo === "otro") for (const [hint, t] of DOC_TYPE_HINTS) if (n.includes(hint)) { tipo = t; break; }

  // ID Mercado Público (p. ej. 2397-45-LR26) y número de licitación
  const marketId = text.match(/\b\d{3,6}-\d{1,4}-[A-Z]{2}\d{2}\b/)?.[0] ?? null;
  const tenderNumber =
    marketId ??
    text.match(/licitaci[oó]n\s*(?:p[uú]blica\s*)?(?:N[°ºo.]*\s*)([\w-]{4,20})/i)?.[1] ??
    null;

  // Organismo / cliente
  const cliente =
    text.match(/(?:I(?:lustre)?\.?\s*)?Municipalidad\s+de\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){0,3})/)?.[0] ??
    text.match(/Servicio\s+de\s+Salud\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+/)?.[0] ??
    text.match(/(?:Hospital|Universidad|Ministerio|Gobierno\s+Regional|Corporación)\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ]?[\wáéíóúñ]+){0,3}/)?.[0] ??
    null;
  const tipoCliente: Classification["tipo_cliente"] = cliente
    ? /municipalidad/i.test(cliente)
      ? "municipio"
      : /(servicio|ministerio|gobierno|hospital|universidad)/i.test(cliente)
        ? "institucion"
        : "empresa"
    : null;

  // Monto: se toma el mayor valor monetario del documento (suele ser el total)
  let monto: number | null = null;
  let moneda: string | null = null;
  const money = [...text.matchAll(/(\$|UF|UTM|CLP)\s*([\d][\d.,]{2,20})/gi)];
  for (const m of money) {
    const raw = m[2].replace(/\.(?=\d{3}\b)/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
    const val = parseFloat(raw);
    if (!isNaN(val) && val > (monto ?? 0)) {
      monto = val;
      moneda = /uf/i.test(m[1]) ? "UF" : /utm/i.test(m[1]) ? "UTM" : "CLP";
    }
  }

  // Fecha: primera fecha reconocible (numérica o en palabras)
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  let fecha: string | null = null;
  const dNum = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  const dTxt = text.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join("|")})\\s+de\\s+(\\d{4})`, "i"));
  if (dNum) fecha = `${dNum[3]}-${dNum[2].padStart(2, "0")}-${dNum[1].padStart(2, "0")}`;
  else if (dTxt) {
    const mi = MESES.indexOf(norm(dTxt[2])) + 1;
    fecha = `${dTxt[3]}-${String(mi).padStart(2, "0")}-${dTxt[1].padStart(2, "0")}`;
  }

  // Duración del contrato
  const dur = text.match(/(?:plazo|duraci[oó]n|vigencia)[^.]{0,60}?(\d{1,3})\s*(meses|a[ñn]os|d[ií]as)/i);
  const duracion = dur ? `${dur[1]} ${dur[2].toLowerCase()}` : null;

  // Ubicación
  let ciudad: string | null = null;
  let region: string | null = null;
  for (const [reg, ciudades] of Object.entries(REGIONES)) {
    for (const c of ciudades) {
      if (n.includes(c)) {
        ciudad = c.replace(/\b\w/g, (ch) => ch.toUpperCase());
        region = reg;
        break;
      }
    }
    if (ciudad) break;
  }

  const titulo =
    pages[0]?.content.split("\n").map((l) => l.trim()).find((l) => l.length > 15 && l.length < 120) ??
    "Documento sin título";

  return {
    cliente,
    tipo_cliente: tipoCliente,
    numero_licitacion: tenderNumber,
    nombre_licitacion:
      text.match(/(?:denominad[ao]|objeto|licitaci[oó]n)\s*[:"]\s*["“]?([^"”\n]{15,140})/i)?.[1]?.trim() ?? null,
    id_mercado_publico: marketId,
    tipo_documento: tipo,
    fecha,
    monto,
    moneda,
    duracion_contrato: duracion,
    proveedor: text.match(/(?:proveedor|adjudicatari[oa]|contratista)\s*[:]\s*([^\n]{3,80})/i)?.[1]?.trim() ?? null,
    area: null,
    tipo_proyecto: null,
    pais: "Chile",
    region,
    ciudad,
    estado_documento: null,
    version: text.match(/versi[oó]n\s*[:]?\s*([\w.]{1,10})/i)?.[1] ?? null,
    idioma: "es",
    titulo_sugerido: titulo.slice(0, 120),
    confianza: 0.55,
  };
}

// ─── Variables técnicas ─────────────────────────────────────────────────────

type Cat = TechnicalVariables["variables"][number]["categoria"];

const DICCIONARIO: Array<[Cat, string[]]> = [
  ["modulo", ["modulo de", "rentas", "patentes", "permisos de circulacion", "tesoreria municipal", "adquisiciones", "inventario", "recursos humanos", "remuneraciones", "contabilidad", "presupuesto", "cementerio", "transito", "obras municipales", "dideco", "farmacia", "agenda", "ficha clinica"]],
  ["integracion", ["integracion", "interoperabilidad", "tesoreria general", "registro civil", "servicio de impuestos internos", "sii", "chileatiende", "clave unica", "transbank", "webpay", "servipag", "khipu", "api rest", "web service"]],
  ["seguridad", ["firma electronica", "fea", "ley 19.799", "cifrado", "encriptacion", "autenticacion", "doble factor", "mfa", "iso 27001", "ciberseguridad", "control de acceso", "ley 19.628", "datos personales"]],
  ["sla", ["sla", "nivel de servicio", "disponibilidad", "99,5", "99.5", "99,9", "tiempo de respuesta", "uptime"]],
  ["multa", ["multa", "sancion", "penalidad", "utm por dia", "descuento por atraso", "cobro de la garantia"]],
  ["garantia", ["boleta de garantia", "garantia de fiel cumplimiento", "seriedad de la oferta", "poliza", "garantia tecnica"]],
  ["capacitacion", ["capacitacion", "entrenamiento", "transferencia tecnologica", "usuarios capacitados", "material de apoyo"]],
  ["soporte", ["soporte", "mesa de ayuda", "help desk", "mantencion", "asistencia tecnica", "24x7", "5x8"]],
  ["migracion", ["migracion", "carga inicial", "datos historicos", "traspaso de datos"]],
  ["infraestructura", ["servidor", "nube", "cloud", "datacenter", "hosting", "on premise", "kubernetes", "contenedor"]],
  ["base_datos", ["base de datos", "postgresql", "sql server", "oracle", "mysql", "respaldo de datos"]],
  ["backup", ["respaldo", "backup", "recuperacion ante desastres", "plan de contingencia"]],
  ["dashboard", ["dashboard", "tablero", "power bi", "cuadro de mando", "indicadores de gestion"]],
  ["reporte", ["reporteria", "reportes", "informes automaticos", "exportacion a excel"]],
  ["certificacion", ["certificacion", "acreditacion", "iso 9001", "cmmi", "certificado"]],
  ["personal", ["jefe de proyecto", "equipo minimo", "profesional", "analista", "ingeniero", "arquitecto de software"]],
  ["experiencia", ["experiencia", "anos de experiencia", "proyectos similares", "referencias"]],
  ["licencia", ["licencia", "licenciamiento", "software propietario", "codigo abierto", "open source"]],
  ["implementacion", ["implementacion", "puesta en marcha", "marcha blanca", "despliegue", "instalacion"]],
  ["interfaz", ["interfaz", "responsive", "usabilidad", "accesibilidad", "movil", "aplicacion web"]],
];

export function extractTechnicalVariablesLocal(pages: PageText[]): TechnicalVariables {
  const sents = sentences(pages);
  const seen = new Set<string>();
  const variables: TechnicalVariables["variables"] = [];

  for (const [categoria, terms] of DICCIONARIO) {
    for (const term of terms) {
      const hit = sents.find((s) => norm(s.text).includes(term));
      if (!hit) continue;
      const key = `${categoria}|${term}`;
      if (seen.has(key)) continue;
      seen.add(key);
      variables.push({
        categoria,
        nombre: term.replace(/\b\w/g, (c) => c.toUpperCase()),
        descripcion: null,
        valor: null,
        pagina: hit.page,
        cita: hit.text.slice(0, 300),
        confianza: 0.5,
      });
    }
  }
  return { variables };
}

// ─── Requerimientos ─────────────────────────────────────────────────────────

const OBLIGACION = /(deber[aá]n?|debe(?:r[aá])?|se exige|ser[aá] obligatorio|est[aá] obligad|se requiere|requerir[aá]|tendr[aá] que|el oferente|el proveedor|el contratista|el adjudicatario|contemplar[aá]|incluir[aá]|proporcionar[aá]|garantizar[aá])/i;
const NUMERACION = /^\s*(?:\d+(?:\.\d+)*[.)-]?|[a-z][.)]|[IVXLC]+[.)]|[-•*])\s+/;

type CriticalType = Requirements["requerimientos"][number]["tipo_critico"];

/**
 * Diccionario de los puntos que condicionan la participación. El motor local
 * solo devuelve requerimientos que caen en uno de estos tipos — igual que el
 * agente de IA, que tiene la misma instrucción.
 */
const CRITICOS: Array<[CriticalType, RegExp]> = [
  ["boleta_garantia", /(boleta de garantia|garantia de fiel cumplimiento|seriedad de la oferta|poliza de garantia|vale vista|caucion)/],
  ["servidores", /(servidor|hosting|datacenter|centro de datos|nube|cloud|on premise|alojamiento|infraestructura tecnologica)/],
  ["sla", /(sla|nivel(?:es)? de servicio|disponibilidad (?:de|del|minima|comprometida)|tiempo de respuesta|tiempo de resolucion|uptime|99[.,]\d)/],
  ["plazos", /(plazo (?:de|maximo|minimo)|fecha (?:limite|de cierre|de entrega)|dias corridos|dias habiles|a partir de la (?:firma|suscripcion))/],
  ["multas", /(multa|sancion|penalidad|descuento por atraso|termino anticipado|cobro de la garantia|utm por dia)/],
  ["certificados", /(certificad|acreditacion|iso 9001|iso 27001|cmmi|chileproveedores|inscripcion en el registro|certificacion)/],
  ["migracion_datos", /(migracion de datos|migrar los datos|traspaso de datos|carga de datos hist(?:o|ó)ricos|migracion del sistema actual)/],
  ["experiencia", /(experiencia (?:m[ií]nima|acreditada|comprobable|del oferente|del proponente)|a[ñn]os de experiencia|contratos similares|acreditar experiencia)/],
];

/** Solo los puntos críticos y obligatorios para participar. */
export function extractRequirementsLocal(pages: PageText[]): Requirements {
  const sents = sentences(pages);
  const requerimientos: Requirements["requerimientos"] = [];
  const seen = new Set<string>();
  // Tope por tipo: el objetivo es una lista corta y accionable, no un volcado.
  const perType = new Map<CriticalType, number>();
  const MAX_POR_TIPO = 6;

  for (const s of sents) {
    const lower = norm(s.text);
    const match = CRITICOS.find(([, re]) => re.test(lower));
    if (!match) continue;
    const [tipo] = match;
    if ((perType.get(tipo) ?? 0) >= MAX_POR_TIPO) continue;
    // Debe ser una exigencia, no una mención de pasada.
    if (!OBLIGACION.test(s.text) && !/(multa|sancion|garantia|certificad|plazo|migracion)/.test(lower)) continue;

    const clean = s.text.replace(NUMERACION, "").trim();
    const key = norm(clean).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    perType.set(tipo, (perType.get(tipo) ?? 0) + 1);

    const codeMatch = s.text.match(/^\s*(\d+(?:\.\d+)*)/);
    const prioridad: Requirements["requerimientos"][number]["prioridad"] =
      tipo === "boleta_garantia" || tipo === "multas" || tipo === "plazos"
        ? "critico"
        : /(critic|indispensable|obligatori|no podr|rechaz|excluyent)/.test(norm(clean))
          ? "alto"
          : "medio";

    const valorMatch = clean.match(/(\d{1,3}(?:[.,]\d{1,3})?\s*%|(?:UF|CLP|\$)\s*[\d.,]+)/i);

    requerimientos.push({
      tipo_critico: tipo,
      codigo: codeMatch ? `RQ-${codeMatch[1]}` : null,
      titulo: clean.slice(0, 140),
      descripcion: clean.length > 140 ? clean : null,
      obligatorio: !/(deseable|opcional|podr[aá])/.test(norm(clean)),
      plazo: clean.match(PLAZO_RE)?.[1] ?? null,
      // El motor local reconoce el ítem por patrón, pero no separa de forma
      // confiable la condición/tope de un valor cuantitativo dentro de la
      // misma oración — solo captura el valor cuando aparece explícito
      // (monto o %); base_calculo/condicion quedan para el motor de IA.
      valor: valorMatch?.[0] ?? null,
      base_calculo: null,
      condicion: null,
      pagina: s.page,
      cita: clean.slice(0, 300),
      prioridad,
    });
  }
  return { requerimientos };
}

// ─── Sistemas y funcionalidades ─────────────────────────────────────────────

/**
 * Detección local de sistemas: se buscan menciones con la forma
 * "Sistema/Módulo/Portal/Plataforma de <Nombre Propio>" y se agrupan bajo
 * ellas las oraciones siguientes que expresan una capacidad exigida.
 *
 * Sin modelo de lenguaje esto es reconocimiento, no interpretación: agrupa por
 * proximidad en el documento, que es como suelen estar escritas las bases
 * técnicas (un encabezado con el módulo y debajo sus exigencias).
 */
const SISTEMA_KEYWORD =
  /\b(sistemas?|subsistemas?|m[oó]dulos?|portal|plataforma|aplicaci[oó]n|software)\b/i;

/** Preposiciones/artículos que pueden ir dentro del nombre de un sistema. */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e", "en", "para"]);

const CAPACIDAD =
  /(deber[aá]n?|permitir|generar|emitir|registrar|consultar|gestionar|administrar|calcular|exportar|importar|notificar|validar|almacenar|visualizar|imprimir|integrar|integraci[oó]n|sincronizar|contar con|disponer de|contemplar|incluir|realizar|ofrecer|proveer)/i;

const PLAZO_RE =
  /(\d{1,3}\s*(?:d[ií]as|meses|semanas|a[ñn]os)(?:\s+(?:corridos|h[aá]biles))?(?:\s+(?:desde|contados desde|a contar de)[^.,;]{0,60})?)/i;

/**
 * Devuelve el nombre del sistema mencionado en la oración, o null si la
 * mención es genérica ("el sistema deberá…") y no un nombre propio.
 * Se recorta al último término con mayúscula: el nombre nunca acaba en
 * conector ("Módulo de Rentas y" ⇒ "Módulo de Rentas").
 */
function detectSystemName(text: string): string | null {
  const m = SISTEMA_KEYWORD.exec(text);
  if (!m) return null;

  const afterKeyword = m.index + m[0].length;
  const prefix = /^\s*(?:web\s+)?(?:de|del|para|denominado)?\s*["“]?/i.exec(text.slice(afterKeyword));
  let cursor = afterKeyword + (prefix?.[0].length ?? 0);
  let end = 0;

  for (let taken = 0; taken < 6; taken++) {
    const gap = /^\s*/.exec(text.slice(cursor))![0].length;
    const word = /^[\wáéíóúñÁÉÍÓÚÑ]+/.exec(text.slice(cursor + gap))?.[0];
    if (!word) break;

    const isProper = /^[A-ZÁÉÍÓÚÑ]/.test(word);
    const isConnector = CONECTORES.has(word.toLowerCase());
    // Sin nombre propio inmediatamente después, la mención es genérica.
    if (taken === 0 && !isProper) return null;
    if (!isProper && !isConnector) break;

    cursor += gap + word.length;
    if (isProper) end = cursor;
  }

  if (end === 0) return null;
  const raw = text.slice(m.index, end).replace(/\s+/g, " ").trim();
  return `${raw[0].toUpperCase()}${raw.slice(1)}`.slice(0, 120);
}

export function extractSystemsLocal(pages: PageText[]): Systems {
  const sents = sentences(pages);
  const sistemas: Systems["sistemas"] = [];
  const byName = new Map<string, Systems["sistemas"][number]>();
  let current: Systems["sistemas"][number] | null = null;

  // Cuántas capacidades ("el sistema debe permitir…") aparecen bajo cada
  // sistema. Ya no se extrae ninguna —el listado no incluye funcionalidades—,
  // pero contarlas sigue sirviendo de señal de que el nombre detectado es de
  // verdad un sistema que el documento exige, y no una mención de paso.
  const capacidades = new Map<string, number>();

  for (const s of sents) {
    const nombre = detectSystemName(s.text);
    if (nombre) {
      const key = norm(nombre);
      const existing = byName.get(key);
      if (existing) {
        current = existing;
      } else {
        if (sistemas.length >= 25) continue;
        current = {
          nombre,
          descripcion: null,
          plazo: s.text.match(PLAZO_RE)?.[1] ?? null,
          pagina: s.page,
          cita: s.text.slice(0, 300),
        };
        byName.set(key, current);
        sistemas.push(current);
      }
      continue;
    }

    if (!current || !CAPACIDAD.test(s.text)) continue;
    // Lo que es un punto crítico (garantías, multas, SLA, plazos,
    // certificados) no describe al sistema: va en la otra lista.
    const lower = norm(s.text);
    if (CRITICOS.some(([, re]) => re.test(lower))) continue;

    const key = norm(current.nombre);
    capacidades.set(key, (capacidades.get(key) ?? 0) + 1);
    // La primera capacidad que aparece hace de descripción del sistema.
    if (!current.descripcion) {
      current.descripcion = s.text.replace(NUMERACION, "").trim().slice(0, 300);
    }
  }

  return { sistemas: sistemas.filter((s) => (capacidades.get(norm(s.nombre)) ?? 0) > 0) };
}

/**
 * Funcionalidades de UN sistema concreto: recorre el documento igual que
 * extractSystemsLocal (agrupando por el encabezado de sistema más cercano),
 * pero en vez de solo contar las capacidades bajo el sistema buscado, las
 * conserva todas como funcionalidades individuales.
 */
export function extractSystemFeaturesLocal(pages: PageText[], systemName: string): SystemFeatures {
  const sents = sentences(pages);
  const target = norm(systemName);
  const funcionalidades: SystemFeatures["funcionalidades"] = [];
  let matchesTarget = false;
  const seen = new Set<string>();

  for (const s of sents) {
    const nombre = detectSystemName(s.text);
    if (nombre) {
      const n = norm(nombre);
      matchesTarget = n === target || n.includes(target) || target.includes(n);
      continue;
    }

    // "Será deseable que ofrezca…" no siempre trae un verbo de la lista de
    // CAPACIDAD, pero sigue siendo una exigencia (opcional) del sistema — se
    // reconoce igual por el marcador de opcionalidad.
    if (!matchesTarget || !(CAPACIDAD.test(s.text) || /\b(deseable|opcional)\b/i.test(s.text))) continue;
    const lower = norm(s.text);
    // Lo que es un punto crítico (garantías, multas, SLA...) no es una
    // funcionalidad del sistema — va aparte, en Puntos críticos.
    if (CRITICOS.some(([, re]) => re.test(lower))) continue;

    const clean = s.text.replace(NUMERACION, "").trim();
    const key = norm(clean).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    funcionalidades.push({
      nombre: clean.slice(0, 140),
      descripcion: clean.length > 140 ? clean.slice(0, 300) : null,
      obligatoria: !/(deseable|opcional|podr[aá])/.test(lower),
      // El motor local no distingue explícito/implícito/interpretación con
      // confianza — todo lo que detecta por patrón lo marca como explícito.
      tipo_evidencia: "explicito",
      plazo: clean.match(PLAZO_RE)?.[1] ?? null,
      pagina: s.page,
      cita: clean.slice(0, 300),
    });
    if (funcionalidades.length >= 100) break;
  }

  return { funcionalidades };
}

// ─── Entregas (documentos de control) ───────────────────────────────────────

// Se evalúan sobre texto normalizado (sin tildes, en minúsculas) y por raíz
// verbal, para cubrir las distintas conjugaciones del español:
// "se habilitó", "fue habilitada", "se implementaron", "quedó implementado"…
const ENTREGADO = /(entreg|implement|desarroll|habilit|instal|recepcion|finaliz|complet|termin|activ|desplegad|puesta en marcha|en produccion)/;
const PENDIENTE_RE = /(pendiente|en desarrollo|en progreso|en curso|por entregar|por implementar|comprometid|no se ha)/;
const ADICIONAL = /(adicional|fuera de (?:bases|contrato|alcance)|no exigid|no contemplad|no solicitad|mejora|cortesia|extra)/;
const GRATUITO = /(sin costo|gratuit|sin cargo|no facturad|sin cobro|de cortesia|sin valor)/;

export function extractDeliveredItemsLocal(pages: PageText[]): DeliveredItems {
  const sents = sentences(pages);
  const entregas: DeliveredItems["entregas"] = [];
  const seen = new Set<string>();

  for (const s of sents) {
    const t = norm(s.text);
    // Lo pendiente manda sobre lo entregado: "pendiente de entrega" contiene
    // ambas señales y no debe registrarse como entregado.
    const isPending = PENDIENTE_RE.test(t);
    const isDone = !isPending && ENTREGADO.test(t);
    if (!isDone && !isPending) continue;

    const key = t.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    entregas.push({
      titulo: s.text.replace(NUMERACION, "").slice(0, 140),
      descripcion: null,
      fecha_entrega: null,
      estado: isDone ? "entregado" : "en_progreso",
      es_adicional: ADICIONAL.test(t),
      es_gratuito: GRATUITO.test(t),
      referencia_requerimiento: s.text.match(/\bRQ[-\s]?\d+(?:\.\d+)*/i)?.[0] ?? null,
      pagina: s.page,
      cita: s.text.slice(0, 300),
      confianza: 0.5,
    });
    if (entregas.length >= 150) break;
  }
  return { entregas };
}

// ─── Línea de tiempo ────────────────────────────────────────────────────────

const HITOS: Array<[Timeline["hitos"][number]["tipo"], RegExp]> = [
  ["inicio", /(inicio|comienzo|fecha de inicio|suscripci[oó]n del contrato|orden de compra)/i],
  ["capacitacion", /capacitaci[oó]n/i],
  ["implementacion", /(implementaci[oó]n|puesta en marcha|despliegue)/i],
  ["marcha_blanca", /marcha blanca/i],
  ["recepcion", /(recepci[oó]n (?:conforme|provisoria|definitiva)|acta de recepci[oó]n)/i],
  ["garantia", /(per[ií]odo de garant[ií]a|garant[ií]a t[eé]cnica)/i],
  ["soporte", /(soporte|mantenci[oó]n)/i],
  ["termino", /(t[eé]rmino del contrato|finalizaci[oó]n|vencimiento del contrato)/i],
  ["entregable", /(entregable|hito de pago|informe final)/i],
];

const DIAS_POR_UNIDAD: Record<string, number> = { dia: 1, día: 1, semana: 7, mes: 30, año: 365, ano: 365 };

/** "40 días", "3 meses", "2 semanas" → días corridos. Solo lo que hace falta
 *  para la aritmética del resolver; sin este parseo, el motor local no podía
 *  ofrecer ninguna fecha calculada para plazos relativos. */
function plazoADias(cantidad: number, unidad: string): number {
  const clave = unidad.toLowerCase().replace(/s$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return Math.round(cantidad * (DIAS_POR_UNIDAD[clave] ?? 1));
}

export function extractTimelineLocal(pages: PageText[]): Timeline {
  const sents = sentences(pages);
  const hitos: Timeline["hitos"] = [];
  const used = new Set<string>();

  for (const [tipo, re] of HITOS) {
    for (const s of sents) {
      if (!re.test(s.text)) continue;
      if (used.has(tipo)) break;
      used.add(tipo);

      const plazoMatch = s.text.match(/(\d{1,3})\s*(d[ií]as|meses|semanas|a[ñn]os)/i);
      const f = s.text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
      // Sin fecha explícita en la oración pero con un plazo relativo: se
      // ancla al documento — el motor local no distingue "hito anterior" de
      // "documento" con la misma finura que un modelo de lenguaje.
      const tieneFechaExplicita = Boolean(f);
      hitos.push({
        tipo,
        titulo: s.text.replace(NUMERACION, "").slice(0, 120),
        descripcion: null,
        fecha_inicio: f ? `${f[3]}-${f[2].padStart(2, "0")}-${f[1].padStart(2, "0")}` : null,
        fecha_fin: null,
        plazo_texto: plazoMatch?.[0] ?? null,
        plazo_dias: !tieneFechaExplicita && plazoMatch ? plazoADias(Number(plazoMatch[1]), plazoMatch[2]) : null,
        ancla: !tieneFechaExplicita && plazoMatch ? "documento" : null,
        pagina: s.page,
        cita: s.text.slice(0, 300),
      });
      break;
    }
  }
  return { hitos };
}

// ─── Resumen ejecutivo (extractivo) ─────────────────────────────────────────

/**
 * Busca la exigencia de una norma ISO concreta. `exigida: null` cuando la
 * norma no se menciona — distinto de `false`, que solo se afirma si el
 * documento dice expresamente que no hace falta.
 */
function isoLocal(sents: Located[], norma: "9001" | "27001"): Summary["certificaciones"]["iso_9001"] {
  const re = new RegExp(`ISO[\\s/-]*${norma}`, "i");
  const hit = sents.find((s) => re.test(s.text));
  if (!hit) return { exigida: null, a_quien: null, obligatoria_o_deseable: null, detalle: null, pagina: null, cita: null };
  const niega = /(no (?:se )?(?:ser[aá]|es) (?:exigid|requerid|obligatori)|no se exige|sin exigencia)/i.test(hit.text);
  const deseable = /(deseable|opcional|puntuar[aá]|puntaje adicional|suma(?:r[aá])? puntos)/i.test(hit.text);
  return {
    exigida: !niega,
    // El motor local no separa de forma confiable a quién exactamente se le
    // exige (oferente/fabricante/subcontratista) dentro de la misma oración
    // — eso queda para el motor de IA.
    a_quien: null,
    obligatoria_o_deseable: niega ? null : deseable ? "deseable" : "obligatoria",
    detalle: hit.text.replace(NUMERACION, "").trim().slice(0, 300),
    pagina: hit.page,
    cita: hit.text.slice(0, 300),
  };
}

export function summarizeLocal(pages: PageText[]): Summary {
  const c = classifyDocumentLocal(pages);
  const sents = sentences(pages);

  const pick = (re: RegExp, limit = 6) =>
    sents
      .filter((s) => re.test(s.text))
      .slice(0, limit)
      .map((s) => ({ titulo: `Página ${s.page}`, detalle: s.text.slice(0, 300) }));

  const objetivo =
    sents.find((s) => /(objeto|objetivo|finalidad|prop[oó]sito)\s+(de|del|de la)/i.test(s.text))?.text ??
    "No fue posible determinar el objetivo con el análisis local.";
  const alcance =
    sents.find((s) => /(alcance|comprende|contempla|incluye)\b/i.test(s.text))?.text ??
    "Alcance no identificado en modo local.";

  // Plazo de implementación: se prioriza una mención explícita de
  // "implementación/puesta en marcha" con plazo; si no hay, se cae al plazo
  // general del contrato ya detectado en la clasificación.
  const implementacionSentence = sents.find(
    (s) => /(implementaci[oó]n|puesta en marcha)/i.test(s.text) && PLAZO_RE.test(s.text)
  );
  const plazoImplementacion =
    implementacionSentence?.text.match(PLAZO_RE)?.[1] ?? c.duracion_contrato;

  // Periodicidad del presupuesto: se busca la palabra que la acompaña más
  // cerca del monto detectado en la clasificación.
  const presupuestoSentence = c.monto
    ? sents.find((s) => norm(s.text).includes("mensual") || norm(s.text).includes("anual"))
    : undefined;
  const periodicidad: "mensual" | "anual" | "total" | "unico" | null = presupuestoSentence
    ? /mensual/i.test(presupuestoSentence.text)
      ? "mensual"
      : "anual"
    : c.monto
      ? "total"
      : null;

  // Migración de datos: se busca la mención y, en la misma oración, el plazo
  // y cualquier cifra que cuantifique el volumen (años, registros, GB…).
  const MIGRA_RE =
    /(migraci[oó]n|migrar|traspaso) de (?:los )?datos|migraci[oó]n de la informaci[oó]n|(?:datos|informaci[oó]n) a migrar|volumen a migrar/i;
  const VOLUMEN_RE =
    /(\d{1,3}(?:[.,]\d{3})*\s*(?:registros|filas|documentos|usuarios|GB|TB|MB)|\d{1,2}\s*a[ñn]os de (?:historia|informaci[oó]n|datos))/i;
  const migraSentences = sents.filter((s) => MIGRA_RE.test(s.text));
  const RESPONSABLE_RE = /(a cargo del|ser[aá] responsabilidad de|deber[aá] ejecutar(?:la)?|responsable de la migraci[oó]n)\s+(el proveedor|el oferente|el contratista|el mandante|la instituci[oó]n)/i;
  const migracionDatos: Summary["migracion_datos"] = migraSentences.length
    ? {
        exigida: true,
        plazo: migraSentences.map((s) => s.text.match(PLAZO_RE)?.[1]).find(Boolean) ?? null,
        volumen: migraSentences.map((s) => s.text.match(VOLUMEN_RE)?.[1]).find(Boolean) ?? null,
        // El motor local detecta QUE se exige migración, pero no distingue de
        // forma confiable el contenido a migrar (informacion_a_migrar) del
        // resto de la oración — eso queda para el motor de IA.
        informacion_a_migrar: null,
        responsable: migraSentences.map((s) => s.text.match(RESPONSABLE_RE)?.[2]).find(Boolean) ?? null,
        detalle: migraSentences[0].text.replace(NUMERACION, "").trim().slice(0, 300),
      }
    : { exigida: null, plazo: null, volumen: null, informacion_a_migrar: null, responsable: null, detalle: null };

  return {
    resumen_general:
      `Análisis local (sin IA) de un documento de tipo ${c.tipo_documento.replace(/_/g, " ")}` +
      `${c.cliente ? ` para ${c.cliente}` : ""}` +
      `${c.numero_licitacion ? `, licitación ${c.numero_licitacion}` : ""}` +
      `${c.monto ? `, por ${c.monto.toLocaleString("es-CL")} ${c.moneda ?? ""}` : ""}` +
      `${c.duracion_contrato ? `, con una duración de ${c.duracion_contrato}` : ""}. ` +
      `Este resumen se generó sin consumir cuota de IA, extrayendo las frases del propio documento; ` +
      `para un resumen interpretativo, vuelve a analizarlo en modo IA.`,
    objetivo,
    alcance,
    plazo_implementacion: plazoImplementacion,
    presupuesto: c.monto
      ? { monto: c.monto, moneda: c.moneda, periodicidad, detalle: null }
      : null,
    obligaciones: pick(/(obligaci[oó]n|deber[aá]|responsabilidad del (?:proveedor|contratista))/i),
    restricciones: pick(/(no podr[aá]|prohibid|restricci[oó]n|limitaci[oó]n|queda vedado)/i),
    certificaciones: {
      iso_9001: isoLocal(sents, "9001"),
      iso_27001: isoLocal(sents, "27001"),
    },
    migracion_datos: migracionDatos,
  };
}

// ─── Evaluación y anexos (extractivo) ───────────────────────────────────────

export function extractEvaluationLocal(pages: PageText[]): Evaluation {
  const sents = sentences(pages);

  // Criterios de evaluación: oraciones con "criterio(s) de evaluación",
  // "ponderación" o "puntaje máximo", con el porcentaje/puntaje que
  // aparezca en la misma oración, si lo hay — sin poder distinguir la
  // "pauta" (cómo se calcula) del criterio en sí, que queda en null.
  const EVAL_RE = /(criterio.{0,25}evaluaci[oó]n|pondera(ci[oó]n)?|puntaje m[aá]ximo|escala de evaluaci[oó]n)/i;
  const PORC_RE = /(\d{1,3}\s?%|\d{1,3}\s*puntos)/i;
  const criteriosEvaluacion = sents
    .filter((s) => EVAL_RE.test(s.text))
    .slice(0, 10)
    .map((s) => ({
      criterio: s.text.slice(0, 150),
      ponderacion: s.text.match(PORC_RE)?.[1] ?? null,
      pauta: null,
      pagina: s.page,
      cita: s.text.slice(0, 300),
    }));

  const metodologiaEvaluacion =
    sents.find((s) =>
      /(metodolog[ií]a de evaluaci[oó]n|puntaje total|f[oó]rmula de evaluaci[oó]n|criterio de desempate)/i.test(
        s.text
      )
    )?.text ?? null;

  // Anexos solicitados: oraciones que mencionan "Anexo N°..." — se agrupan
  // por número de anexo para no repetir el mismo anexo citado varias veces
  // en el documento.
  const ANEXO_RE = /\bANEXO\s*N?[°º]?\s*\d+/i;
  const anexosSolicitados: Evaluation["anexos_solicitados"] = [];
  const seenAnexos = new Set<string>();
  for (const s of sents) {
    const match = s.text.match(ANEXO_RE);
    if (!match) continue;
    const nombre = match[0].toUpperCase().replace(/\s+/g, " ");
    if (seenAnexos.has(nombre)) continue;
    seenAnexos.add(nombre);
    anexosSolicitados.push({
      nombre,
      // El motor local no clasifica el tipo de anexo ni qué debe hacer el
      // oferente con él de forma confiable — eso queda para el motor de IA.
      tipo: null,
      descripcion: s.text.slice(0, 200),
      accion_oferente: null,
      obligatorio: null,
      pagina: s.page,
      cita: s.text.slice(0, 300),
    });
    if (anexosSolicitados.length >= 20) break;
  }

  return {
    criterios_evaluacion: criteriosEvaluacion,
    metodologia_evaluacion: metodologiaEvaluacion,
    anexos_solicitados: anexosSolicitados,
  };
}

// ─── Comparador de dos documentos (sin IA) ─────────────────────────────────

const MONTO_O_NUMERO = /(\$\s?\d|\bUF\b|\bUTM\b|\d{1,3}(?:[.,]\d{3})+|\d+\s*%|\d+\s*(?:d[ií]as|meses|a[ñn]os))/i;
const NO_APARECE = "No aparece en este documento.";
const MAX_DIFERENCIAS = 60;
const MIN_LARGO_CAMBIO = 8;

/** El punto/cláusula numerado más cercano hacia atrás, sin salir de la
 *  página — el mejor sustituto sin IA de "en qué punto del documento". */
function nearestHeading(sents: Located[], index: number): string | null {
  if (index < 0) return null;
  const page = sents[index].page;
  for (let i = index - 1; i >= 0 && sents[i].page === page; i--) {
    if (NUMERACION.test(sents[i].text) && sents[i].text.length <= 140) {
      return sents[i].text.replace(/\s+/g, " ").trim().slice(0, 120);
    }
  }
  return null;
}

/** Sin interpretación posible sin modelo, se usa una señal barata: si el
 *  texto toca un punto crítico (garantías, multas, plazos…) es alto; si
 *  cambia una cifra (monto, plazo, porcentaje) es medio; el resto, bajo. */
function classifyImpactLocal(text: string): "bajo" | "medio" | "alto" | "critico" {
  const lower = norm(text);
  if (CRITICOS.some(([, re]) => re.test(lower))) return "alto";
  if (MONTO_O_NUMERO.test(text)) return "medio";
  return "bajo";
}

/** Código de numeración inicial ("8.3", "10.1"…), si la oración empieza con uno. */
function clauseNumber(text: string): string | null {
  return text.match(/^\s*(\d+(?:\.\d+)*)/)?.[1] ?? null;
}

const REWRITE_THRESHOLD = 0.35;

/** Empareja, de un bloque quitado y uno agregado adyacentes, los elementos
 *  que parecen ser la misma cláusula reescrita (mejor coincidencia primero,
 *  greedy); lo que no encuentra pareja razonable queda como quite/agregado
 *  puro en vez de forzarse a una pareja arbitraria por posición. */
function pairRewrites(
  removedItems: Located[],
  addedItems: Located[]
): { pairs: Array<[Located, Located]>; leftoverRemoved: Located[]; leftoverAdded: Located[] } {
  const scored: Array<{ i: number; j: number; score: number }> = [];
  for (let i = 0; i < removedItems.length; i++) {
    for (let j = 0; j < addedItems.length; j++) {
      const a = removedItems[i].text;
      const b = addedItems[j].text;
      const ca = clauseNumber(a);
      const cb = clauseNumber(b);
      const score = ca && cb && ca === cb ? 1 : wordOverlap(a, b);
      if (score >= REWRITE_THRESHOLD) scored.push({ i, j, score });
    }
  }
  scored.sort((x, y) => y.score - x.score);

  const usedRemoved = new Set<number>();
  const usedAdded = new Set<number>();
  const pairs: Array<[Located, Located]> = [];
  for (const { i, j } of scored) {
    if (usedRemoved.has(i) || usedAdded.has(j)) continue;
    usedRemoved.add(i);
    usedAdded.add(j);
    pairs.push([removedItems[i], addedItems[j]]);
  }

  return {
    pairs,
    leftoverRemoved: removedItems.filter((_, i) => !usedRemoved.has(i)),
    leftoverAdded: addedItems.filter((_, j) => !usedAdded.has(j)),
  };
}

/**
 * Compara dos documentos SIN IA: diff léxico oración por oración (Myers, vía
 * la librería `diff`), alineando por igualdad exacta tras normalizar
 * acentos/mayúsculas/espacios. Pensado para dos documentos del mismo tipo y
 * muy parecidos entre sí (dos versiones de una licitación, dos borradores de
 * contrato) — no interpreta el sentido de cada cambio como un modelo, pero
 * es exacto en lo literal: exactamente qué cambió y en qué página de cada
 * documento, instantáneo y sin consumir cuota de ningún proveedor.
 */
export function compareDocumentsLocal(pagesA: PageText[], pagesB: PageText[]): Diff {
  const sentsA = sentences(pagesA);
  const sentsB = sentences(pagesB);

  const parts = diffArrays(sentsA, sentsB, {
    comparator: (a, b) => norm(a.text) === norm(b.text),
  });

  interface Item {
    documento_a: string;
    pagina_a: number | null;
    documento_b: string;
    pagina_b: number | null;
    seccion: string | null;
  }
  const items: Item[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  const seccionFor = (b: Located | null, a: Located | null) => {
    if (b) {
      const idx = sentsB.indexOf(b);
      const s = nearestHeading(sentsB, idx);
      if (s) return s;
    }
    if (a) {
      const idx = sentsA.indexOf(a);
      return nearestHeading(sentsA, idx);
    }
    return null;
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.removed && !part.added) continue; // contexto: igual en ambos documentos

    if (part.removed) {
      const next = parts[i + 1];
      if (next?.added) {
        // Bloque quitado seguido de uno agregado: puede ser la misma
        // cláusula reescrita, o dos contenidos distintos que solo quedaron
        // adyacentes en el diff — se empareja por similitud, no por
        // posición, y lo que no encuentra pareja razonable queda como
        // quite/agregado puro.
        const { pairs, leftoverRemoved, leftoverAdded } = pairRewrites(part.value, next.value);
        for (const [a, b] of pairs) {
          items.push({
            documento_a: a.text,
            pagina_a: a.page,
            documento_b: b.text,
            pagina_b: b.page,
            seccion: seccionFor(b, a),
          });
          modified++;
        }
        for (const a of leftoverRemoved) {
          items.push({
            documento_a: a.text,
            pagina_a: a.page,
            documento_b: NO_APARECE,
            pagina_b: null,
            seccion: seccionFor(null, a),
          });
          removed++;
        }
        for (const b of leftoverAdded) {
          items.push({
            documento_a: NO_APARECE,
            pagina_a: null,
            documento_b: b.text,
            pagina_b: b.page,
            seccion: seccionFor(b, null),
          });
          added++;
        }
        i++; // el bloque 'added' siguiente ya se consumió
        continue;
      }
      for (const s of part.value) {
        items.push({
          documento_a: s.text,
          pagina_a: s.page,
          documento_b: NO_APARECE,
          pagina_b: null,
          seccion: seccionFor(null, s),
        });
        removed++;
      }
    } else if (part.added) {
      for (const s of part.value) {
        items.push({
          documento_a: NO_APARECE,
          pagina_a: null,
          documento_b: s.text,
          pagina_b: s.page,
          seccion: seccionFor(s, null),
        });
        added++;
      }
    }
  }

  // Ruido de OCR/formato (cambios ínfimos sin dígitos) no cuenta como
  // diferencia real; un cambio numérico corto ($, %, fechas) sí importa.
  const relevant = items.filter((it) => {
    const combined = `${it.documento_a} ${it.documento_b}`;
    return combined.length >= MIN_LARGO_CAMBIO || MONTO_O_NUMERO.test(combined);
  });

  const capped = relevant.slice(0, MAX_DIFERENCIAS);

  const diferencias: Diff["diferencias"] = capped.map((it, k) => {
    const sourceText = it.documento_b !== NO_APARECE ? it.documento_b : it.documento_a;
    return {
      tema: sourceText.slice(0, 70).replace(/\s+/g, " ").trim() || `Diferencia ${k + 1}`,
      seccion: it.seccion,
      documento_a: it.documento_a,
      pagina_a: it.pagina_a,
      documento_b: it.documento_b,
      pagina_b: it.pagina_b,
      impacto: classifyImpactLocal(sourceText),
      comentario:
        it.documento_a === NO_APARECE
          ? "Contenido agregado en el Documento B, ausente en el A."
          : it.documento_b === NO_APARECE
            ? "Contenido presente en el Documento A, ausente en el B."
            : "Contenido modificado entre ambos documentos.",
    };
  });

  const resumen_puntos = [
    `${modified} fragmentos modificados, ${added} agregados, ${removed} eliminados entre ambos documentos (comparación literal, sin IA).`,
  ];
  if (relevant.length > MAX_DIFERENCIAS) {
    resumen_puntos.unshift(
      `⚠ Se detectaron ${relevant.length} diferencias; se muestran las primeras ${MAX_DIFERENCIAS}. Si son muchas, puede ser señal de que los documentos no son versiones del mismo original.`
    );
  }
  if (sentsA.length > 0 && relevant.length > sentsA.length * 0.6) {
    resumen_puntos.unshift(
      "⚠ Más de la mitad del contenido difiere: confirma que ambos documentos sean realmente versiones del mismo original antes de fiarte de este detalle."
    );
  }

  return {
    resumen:
      `Comparación literal con el motor local (sin IA): ${diferencias.length} diferencias listadas de ${relevant.length} detectadas. ` +
      "Cada una indica la página exacta en cada documento; a diferencia del modo con IA, el motor local no interpreta el impacto legal o de negocio de cada cambio, solo lo señala.",
    resumen_puntos,
    diferencias,
  };
}
