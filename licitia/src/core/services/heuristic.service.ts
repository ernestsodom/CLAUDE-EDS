import type { PageText } from "@/core/domain/types";
import type {
  Classification,
  DeliveredItems,
  Requirements,
  Summary,
  TechnicalVariables,
  Timeline,
} from "@/core/ai/schemas";

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

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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

export function extractRequirementsLocal(pages: PageText[]): Requirements {
  const sents = sentences(pages);
  const requerimientos: Requirements["requerimientos"] = [];
  const seen = new Set<string>();
  let counter = 1;

  for (const s of sents) {
    const numbered = NUMERACION.test(s.text);
    if (!OBLIGACION.test(s.text) && !numbered) continue;
    if (!OBLIGACION.test(s.text)) continue; // la numeración sola no basta

    const clean = s.text.replace(NUMERACION, "").trim();
    const key = norm(clean).slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    const codeMatch = s.text.match(/^\s*(\d+(?:\.\d+)*)/);
    const lower = norm(clean);
    const prioridad: Requirements["requerimientos"][number]["prioridad"] =
      /(critic|indispensable|obligatori|no podr|rechaz)/.test(lower) ? "alto"
      : /(deseable|opcional|valorar|podr[aá])/.test(lower) ? "bajo"
      : "medio";

    requerimientos.push({
      codigo: codeMatch ? `RQ-${codeMatch[1]}` : `RQ-${String(counter).padStart(3, "0")}`,
      titulo: clean.slice(0, 140),
      descripcion: clean.length > 140 ? clean : null,
      categoria: null,
      obligatorio: !/(deseable|opcional|podr[aá])/.test(lower),
      pagina: s.page,
      cita: clean.slice(0, 300),
      prioridad,
    });
    counter++;
    if (requerimientos.length >= 200) break;
  }
  return { requerimientos };
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

export function extractTimelineLocal(pages: PageText[]): Timeline {
  const sents = sentences(pages);
  const hitos: Timeline["hitos"] = [];
  const used = new Set<string>();

  for (const [tipo, re] of HITOS) {
    for (const s of sents) {
      if (!re.test(s.text)) continue;
      if (used.has(tipo)) break;
      used.add(tipo);

      const plazo = s.text.match(/(\d{1,3})\s*(d[ií]as|meses|semanas|a[ñn]os)/i)?.[0] ?? null;
      const f = s.text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
      hitos.push({
        tipo,
        titulo: s.text.replace(NUMERACION, "").slice(0, 120),
        descripcion: null,
        fecha_inicio: f ? `${f[3]}-${f[2].padStart(2, "0")}-${f[1].padStart(2, "0")}` : null,
        fecha_fin: null,
        plazo_texto: plazo,
        pagina: s.page,
        cita: s.text.slice(0, 300),
      });
      break;
    }
  }
  return { hitos };
}

// ─── Resumen ejecutivo (extractivo) ─────────────────────────────────────────

export function summarizeLocal(pages: PageText[]): Summary {
  const c = classifyDocumentLocal(pages);
  const reqs = extractRequirementsLocal(pages).requerimientos;
  const vars = extractTechnicalVariablesLocal(pages).variables;
  const tl = extractTimelineLocal(pages).hitos;
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

  const catCount = new Map<string, number>();
  for (const v of vars) catCount.set(v.categoria, (catCount.get(v.categoria) ?? 0) + 1);
  const topCats = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k.replace(/_/g, " ")} (${v})`)
    .join(", ");

  return {
    resumen_general:
      `Análisis local (sin IA) de un documento de tipo ${c.tipo_documento.replace(/_/g, " ")}` +
      `${c.cliente ? ` para ${c.cliente}` : ""}` +
      `${c.numero_licitacion ? `, licitación ${c.numero_licitacion}` : ""}` +
      `${c.monto ? `, por ${c.monto.toLocaleString("es-CL")} ${c.moneda ?? ""}` : ""}` +
      `${c.duracion_contrato ? `, con una duración de ${c.duracion_contrato}` : ""}. ` +
      `Se detectaron ${reqs.length} cláusulas con carácter obligatorio, ${vars.length} elementos técnicos ` +
      `(principalmente ${topCats || "sin categorías predominantes"}) y ${tl.length} hitos de cronograma. ` +
      `Este resumen se generó sin consumir cuota de IA; para un informe interpretativo completo, vuelve a analizar en modo IA.`,
    objetivo,
    alcance,
    problemas_detectados: pick(/(problema|dificultad|riesgo|incumplimiento|deficiencia|retraso)/i),
    requerimientos: reqs.slice(0, 15).map((r) => ({ titulo: r.codigo ?? "RQ", detalle: r.titulo })),
    obligaciones: pick(/(obligaci[oó]n|deber[aá]|responsabilidad del (?:proveedor|contratista))/i),
    restricciones: pick(/(no podr[aá]|prohibid|restricci[oó]n|limitaci[oó]n|queda vedado)/i),
    riesgos: pick(/(multa|sanci[oó]n|penalidad|caducidad|t[eé]rmino anticipado)/i, 8).map((x) => ({
      riesgo: x.detalle.slice(0, 200),
      nivel: "medio" as const,
      mitigacion: "Revisar la cláusula citada y validar su impacto con el equipo legal.",
    })),
    aspectos_criticos: pick(/(critic|indispensable|excluyent|causal de rechazo)/i),
    entregables: pick(/(entregable|producto esperado|informe final|documentaci[oó]n a entregar)/i),
    cronograma: tl.map((h) => ({
      hito: h.titulo.slice(0, 120),
      plazo: h.plazo_texto ?? h.fecha_inicio ?? "sin plazo explícito",
    })),
    recomendaciones: [
      "Resumen generado con el motor local: verifica las cláusulas citadas antes de tomar decisiones.",
      reqs.length > 0
        ? `Revisa los ${reqs.length} requerimientos detectados; el comparador de cumplimiento ya puede usarlos.`
        : "No se detectaron cláusulas obligatorias: revisa si el documento es escaneado o tiene poco texto.",
      "Cuando dispongas de cuota de IA, vuelve a analizar el documento para obtener el informe interpretativo.",
    ],
  };
}
