import { describe, expect, it } from "vitest";
import {
  classifyDocumentLocal,
  compareDocumentsLocal,
  extractDeliveredItemsLocal,
  extractEvaluationLocal,
  extractRequirementsLocal,
  extractSystemsLocal,
  extractTechnicalVariablesLocal,
  extractTimelineLocal,
  summarizeLocal,
} from "@/core/services/heuristic.service";
import type { PageText } from "@/core/domain/types";

/** Extracto representativo de bases de licitación municipal chilena. */
const LICITACION: PageText[] = [
  {
    pageNumber: 1,
    ocrUsed: false,
    content: `BASES TÉCNICAS
Licitación Pública N° 2397-45-LR26
Adquisición e implementación de Sistema de Gestión Municipal
Ilustre Municipalidad de Puerto Montt
Presupuesto máximo disponible: $185.000.000 (pesos chilenos)
Fecha de publicación: 15/03/2026`,
  },
  {
    pageNumber: 2,
    ocrUsed: false,
    content: `1. OBJETO DE LA LICITACIÓN
El objeto de la presente licitación es contratar la implementación de un sistema integral.
El plazo de ejecución será de 24 meses contados desde la suscripción del contrato.

2. REQUERIMIENTOS FUNCIONALES
2.1 El proveedor deberá implementar el módulo de Rentas y Patentes municipales.
2.2 El sistema deberá contar con integración con la Tesorería General de la República.
2.3 Los documentos oficiales deberán suscribirse mediante firma electrónica avanzada conforme a la Ley 19.799.
2.4 Será deseable que el oferente ofrezca tableros en Power BI para la reportería gerencial.
2.5 El adjudicatario deberá realizar la capacitación de 50 funcionarios municipales.`,
  },
  {
    pageNumber: 3,
    ocrUsed: false,
    content: `3. NIVELES DE SERVICIO Y MULTAS
El sistema deberá garantizar una disponibilidad de 99,5% mensual.
Se aplicará una multa de 5 UTM por cada día corrido de atraso en los hitos comprometidos.
El contratista deberá constituir una boleta de garantía de fiel cumplimiento.

4. CRONOGRAMA
El inicio de los trabajos se contará desde la suscripción del contrato.
La marcha blanca tendrá una duración de 60 días.
La recepción conforme se efectuará mediante acta de recepción definitiva.
El período de garantía técnica será de 12 meses.`,
  },
];

const CONTROL: PageText[] = [
  {
    pageNumber: 1,
    ocrUsed: false,
    content: `CONTROL DE ENTREGAS
El módulo de Rentas fue entregado y recepcionado conforme en junio.
La firma electrónica avanzada quedó implementada y operativa.
Los tableros de Circulación se encuentran pendientes de entrega.
Se habilitó adicionalmente una pasarela de pagos Webpay sin costo para el municipio.
Se implementaron notificaciones por WhatsApp como mejora de cortesía, sin cargo.`,
  },
];

describe("motor local — clasificación", () => {
  const c = classifyDocumentLocal(LICITACION);

  it("detecta el ID de Mercado Público", () => {
    expect(c.id_mercado_publico).toBe("2397-45-LR26");
    expect(c.numero_licitacion).toBe("2397-45-LR26");
  });

  it("identifica el organismo y lo tipifica como municipio", () => {
    expect(c.cliente).toContain("Puerto Montt");
    expect(c.tipo_cliente).toBe("municipio");
  });

  it("extrae el monto mayor con su moneda", () => {
    expect(c.monto).toBe(185000000);
    expect(c.moneda).toBe("CLP");
  });

  it("reconoce el tipo de documento, la fecha y la duración", () => {
    expect(c.tipo_documento).toBe("bases_tecnicas");
    expect(c.fecha).toBe("2026-03-15");
    expect(c.duracion_contrato).toMatch(/24 meses/);
  });

  it("deduce la ubicación desde la ciudad mencionada", () => {
    expect(c.ciudad).toBe("Puerto Montt");
    expect(c.region).toBe("Los Lagos");
    expect(c.pais).toBe("Chile");
  });
});

describe("motor local — requerimientos críticos", () => {
  const { requerimientos } = extractRequirementsLocal(LICITACION);
  const tipos = new Set(requerimientos.map((r) => r.tipo_critico));

  it("extrae los puntos que condicionan la participación", () => {
    // Boleta de garantía, SLA, multas y plazos están todos en el documento.
    expect(tipos.has("boleta_garantia")).toBe(true);
    expect(tipos.has("sla")).toBe(true);
    expect(tipos.has("multas")).toBe(true);
    expect(tipos.has("plazos")).toBe(true);
  });

  it("no incluye funcionalidades del software: esas van al checklist de sistemas", () => {
    const texto = requerimientos.map((r) => r.titulo).join(" ").toLowerCase();
    expect(texto).not.toContain("power bi");
    expect(texto).not.toContain("rentas y patentes");
  });

  it("marca como críticas las garantías, multas y plazos", () => {
    for (const r of requerimientos) {
      if (["boleta_garantia", "multas", "plazos"].includes(r.tipo_critico)) {
        expect(r.prioridad).toBe("critico");
      }
    }
  });

  it("registra la página de origen y la cita", () => {
    for (const r of requerimientos) {
      expect(r.pagina).toBeGreaterThan(0);
      expect(r.cita).toBeTruthy();
    }
  });
});

describe("motor local — sistemas y funcionalidades", () => {
  const { sistemas } = extractSystemsLocal(LICITACION);

  it("identifica el módulo nombrado y lo distingue de las menciones genéricas", () => {
    expect(sistemas.length).toBeGreaterThan(0);
    const nombres = sistemas.map((s) => s.nombre.toLowerCase()).join(" | ");
    expect(nombres).toContain("rentas y patentes");
    // "El sistema deberá contar con…" es una mención genérica, no un sistema.
    expect(nombres).not.toMatch(/sistema deber/);
  });

  it("no mezcla puntos críticos (SLA, multas, garantías) en la descripción del sistema", () => {
    const texto = sistemas.map((s) => (s.descripcion ?? "").toLowerCase()).join(" ");
    expect(texto).not.toContain("multa");
    expect(texto).not.toContain("boleta de garantía");
    expect(texto).not.toContain("disponibilidad de 99");
  });

  it("cada sistema trae página y cita", () => {
    for (const sistema of sistemas) {
      expect(sistema.nombre.length).toBeGreaterThan(0);
      expect(sistema.pagina).toBeGreaterThan(0);
      expect(sistema.cita).toBeTruthy();
    }
  });

  it("descarta los sistemas sin ninguna capacidad descrita debajo (menciones de paso)", () => {
    expect(sistemas.every((s) => s.descripcion)).toBe(true);
  });
});

describe("motor local — variables técnicas", () => {
  const { variables } = extractTechnicalVariablesLocal(LICITACION);
  const porCategoria = (c: string) => variables.filter((v) => v.categoria === c);

  it("reconoce integraciones, seguridad, SLA, multas y garantías", () => {
    expect(porCategoria("integracion").length).toBeGreaterThan(0);
    expect(porCategoria("seguridad").length).toBeGreaterThan(0);
    expect(porCategoria("sla").length).toBeGreaterThan(0);
    expect(porCategoria("multa").length).toBeGreaterThan(0);
    expect(porCategoria("garantia").length).toBeGreaterThan(0);
  });

  it("no duplica variables y cita siempre la página", () => {
    const claves = variables.map((v) => `${v.categoria}|${v.nombre}`);
    expect(new Set(claves).size).toBe(claves.length);
    for (const v of variables) expect(v.pagina).toBeGreaterThan(0);
  });
});

describe("motor local — línea de tiempo", () => {
  const { hitos } = extractTimelineLocal(LICITACION);

  it("identifica los hitos típicos del contrato", () => {
    const tipos = hitos.map((h) => h.tipo);
    expect(tipos).toContain("marcha_blanca");
    expect(tipos).toContain("recepcion");
    expect(tipos).toContain("garantia");
  });

  it("captura plazos relativos cuando no hay fecha absoluta", () => {
    const mb = hitos.find((h) => h.tipo === "marcha_blanca");
    expect(mb?.plazo_texto).toMatch(/60\s*d[ií]as/i);
  });

  it("convierte el plazo relativo a días y lo ancla al documento, para que el resolver pueda calcular la fecha", () => {
    const mb = hitos.find((h) => h.tipo === "marcha_blanca");
    expect(mb?.plazo_dias).toBe(60);
    expect(mb?.ancla).toBe("documento");
  });

  it("un hito con fecha explícita no lleva plazo_dias/ancla (no hay nada que calcular)", () => {
    const conFecha = extractTimelineLocal([
      { pageNumber: 1, ocrUsed: false, content: "El inicio de los trabajos será el 15/03/2026." },
    ]).hitos.find((h) => h.tipo === "inicio");
    expect(conFecha?.fecha_inicio).toBe("2026-03-15");
    expect(conFecha?.plazo_dias).toBeNull();
  });
});

describe("motor local — entregas y trabajos adicionales", () => {
  const { entregas } = extractDeliveredItemsLocal(CONTROL);

  it("detecta lo entregado y lo pendiente", () => {
    expect(entregas.some((e) => e.estado === "entregado")).toBe(true);
    expect(entregas.some((e) => e.estado === "en_progreso")).toBe(true);
  });

  it("marca los trabajos adicionales realizados sin costo", () => {
    const gratuitos = entregas.filter((e) => e.es_adicional && e.es_gratuito);
    expect(gratuitos.length).toBeGreaterThanOrEqual(2);
    const texto = gratuitos.map((e) => e.titulo).join(" ").toLowerCase();
    expect(texto).toContain("webpay");
    expect(texto).toContain("whatsapp");
  });
});

describe("motor local — resumen", () => {
  const s = summarizeLocal(LICITACION);

  it("produce las variables fundamentales del resumen", () => {
    expect(s.resumen_general).toContain("2397-45-LR26");
    expect(s.objetivo).toBeTruthy();
    expect(s.obligaciones).toBeTruthy();
    expect(s.certificaciones).toBeTruthy();
    expect(s.migracion_datos).toBeTruthy();
  });

  it("advierte que fue generado sin IA", () => {
    expect(s.resumen_general.toLowerCase()).toContain("sin ia");
  });

  it("sin mención de una norma ISO, la deja en null (no inventa)", () => {
    expect(s.certificaciones.iso_9001.exigida).toBeNull();
    expect(s.certificaciones.iso_27001.exigida).toBeNull();
  });

  it("sin mención de migración de datos, la deja en null", () => {
    expect(s.migracion_datos.exigida).toBeNull();
  });
});

describe("motor local — ISO y migración de datos", () => {
  const CON_ISO_Y_MIGRACION: PageText[] = [
    {
      pageNumber: 3,
      ocrUsed: false,
      content: `4. CERTIFICACIONES EXIGIDAS
El oferente deberá contar con certificación vigente ISO 9001 de gestión de calidad.
No se exige certificación ISO 27001 para este proceso.

5. MIGRACIÓN DE DATOS
El adjudicatario deberá realizar la migración de los datos desde el sistema actual en un plazo de 30 días corridos desde la firma del contrato.
El volumen a migrar corresponde a 10 años de historia, aproximadamente 500000 registros.`,
    },
  ];
  const s = summarizeLocal(CON_ISO_Y_MIGRACION);

  it("detecta la exigencia de ISO 9001", () => {
    expect(s.certificaciones.iso_9001.exigida).toBe(true);
  });

  it("detecta que ISO 27001 se niega explícitamente", () => {
    expect(s.certificaciones.iso_27001.exigida).toBe(false);
  });

  it("detecta que se exige migración de datos, con su plazo y volumen", () => {
    expect(s.migracion_datos.exigida).toBe(true);
    expect(s.migracion_datos.plazo).toMatch(/30\s*d[ií]as/i);
    expect(s.migracion_datos.volumen).toMatch(/500000 registros|10\s*a[ñn]os/i);
  });
});

describe("motor local — criterios de evaluación y anexos", () => {
  const CON_EVALUACION: PageText[] = [
    {
      pageNumber: 5,
      ocrUsed: false,
      content: `5. CRITERIOS DE EVALUACIÓN
La oferta se evaluará según los siguientes criterios de evaluación: Precio, con una ponderación de 40%.
Experiencia del oferente, con una ponderación de 30%.
Presentación técnica, con una ponderación de 30 puntos sobre el puntaje total.
El puntaje total será la suma ponderada de cada criterio; en caso de empate se preferirá al oferente con menor precio.

6. ANEXOS
Deberá adjuntarse el ANEXO N°1 — Identificación del oferente, con los datos de contacto del representante legal.
Deberá adjuntarse también el ANEXO N°2 — Declaración jurada de no inhabilidad para contratar con el Estado.`,
    },
  ];
  const e = extractEvaluationLocal(CON_EVALUACION);

  it("detecta los criterios de evaluación con su ponderación", () => {
    expect(e.criterios_evaluacion.length).toBeGreaterThan(0);
    const ponderaciones = e.criterios_evaluacion.map((c) => c.ponderacion).filter(Boolean);
    expect(ponderaciones.some((p) => p?.includes("40"))).toBe(true);
  });

  it("detecta la metodología general de evaluación", () => {
    expect(e.metodologia_evaluacion).toMatch(/puntaje total|empate/i);
  });

  it("detecta los anexos solicitados sin duplicarlos", () => {
    const nombres = e.anexos_solicitados.map((a) => a.nombre);
    expect(nombres).toContain("ANEXO N°1");
    expect(nombres).toContain("ANEXO N°2");
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("sin mención de criterios de evaluación o anexos, devuelve listas vacías (no inventa)", () => {
    const vacio = extractEvaluationLocal(LICITACION);
    expect(vacio.criterios_evaluacion).toEqual([]);
    expect(vacio.anexos_solicitados).toEqual([]);
  });
});

describe("motor local — robustez", () => {
  it("no falla con un documento vacío", () => {
    const vacio: PageText[] = [{ pageNumber: 1, content: "", ocrUsed: false }];
    expect(() => classifyDocumentLocal(vacio)).not.toThrow();
    expect(extractRequirementsLocal(vacio).requerimientos).toEqual([]);
    expect(extractTimelineLocal(vacio).hitos).toEqual([]);
  });
});

describe("motor local — comparador de dos documentos (sin IA)", () => {
  const DOC_A: PageText[] = [
    {
      pageNumber: 1,
      ocrUsed: false,
      content:
        "1. Objeto del contrato. El presente contrato tiene por objeto la implementación de un sistema de gestión municipal.",
    },
    {
      pageNumber: 2,
      ocrUsed: false,
      content:
        "8.3 Boleta de garantía. El oferente deberá presentar una boleta de garantía de fiel cumplimiento por el 5% del monto total del contrato. " +
        "9.1 Plazo de implementación. El plazo máximo de implementación será de 90 días corridos desde la firma del contrato.",
    },
    {
      pageNumber: 3,
      ocrUsed: false,
      content: "10.1 Confidencialidad. Ambas partes se obligan a mantener confidencialidad sobre la información intercambiada.",
    },
  ];

  const DOC_B: PageText[] = [
    {
      pageNumber: 1,
      ocrUsed: false,
      content:
        "1. Objeto del contrato. El presente contrato tiene por objeto la implementación de un sistema de gestión municipal.",
    },
    {
      pageNumber: 2,
      ocrUsed: false,
      content:
        "8.3 Boleta de garantía. El oferente deberá presentar una boleta de garantía de fiel cumplimiento por el 10% del monto total del contrato. " +
        "9.1 Plazo de implementación. El plazo máximo de implementación será de 120 días corridos desde la firma del contrato.",
    },
    // La cláusula de confidencialidad (pág. 3 en A) desaparece en B, y se
    // agrega una cláusula de migración de datos nueva.
    {
      pageNumber: 3,
      ocrUsed: false,
      content: "11.1 Migración de datos. El proveedor deberá migrar los datos históricos del sistema actual en un plazo de 30 días corridos.",
    },
  ];

  const IDENTICAL_TEXT = "Esta es exactamente la misma cláusula en ambos documentos, sin ningún cambio de ningún tipo.";
  const DOC_IDENTICAL_A: PageText[] = [{ pageNumber: 1, ocrUsed: false, content: IDENTICAL_TEXT }];
  const DOC_IDENTICAL_B: PageText[] = [{ pageNumber: 1, ocrUsed: false, content: IDENTICAL_TEXT }];

  it("no reporta diferencias entre dos documentos idénticos", () => {
    const result = compareDocumentsLocal(DOC_IDENTICAL_A, DOC_IDENTICAL_B);
    expect(result.diferencias).toEqual([]);
  });

  it("detecta el monto de la boleta de garantía modificado, con página en cada lado", () => {
    const result = compareDocumentsLocal(DOC_A, DOC_B);
    const boleta = result.diferencias.find((d) => /boleta de garant[ií]a/i.test(d.documento_a));
    expect(boleta).toBeTruthy();
    expect(boleta!.documento_a).toContain("5%");
    expect(boleta!.documento_b).toContain("10%");
    expect(boleta!.pagina_a).toBe(2);
    expect(boleta!.pagina_b).toBe(2);
    // Toca un punto crítico (boleta de garantía) ⇒ impacto alto.
    expect(boleta!.impacto).toBe("alto");
  });

  it("detecta el plazo de implementación modificado", () => {
    const result = compareDocumentsLocal(DOC_A, DOC_B);
    const plazo = result.diferencias.find((d) => /plazo m[aá]ximo de implementaci[oó]n/i.test(d.documento_a));
    expect(plazo).toBeTruthy();
    expect(plazo!.documento_a).toContain("90 días");
    expect(plazo!.documento_b).toContain("120 días");
  });

  it("marca la cláusula de confidencialidad como ausente en el Documento B", () => {
    const result = compareDocumentsLocal(DOC_A, DOC_B);
    const confidencialidad = result.diferencias.find((d) => /confidencialidad/i.test(d.documento_a));
    expect(confidencialidad).toBeTruthy();
    expect(confidencialidad!.pagina_a).toBe(3);
    expect(confidencialidad!.documento_b).toMatch(/no aparece/i);
    expect(confidencialidad!.pagina_b).toBeNull();
  });

  it("marca la cláusula de migración de datos como agregada en el Documento B", () => {
    const result = compareDocumentsLocal(DOC_A, DOC_B);
    const migracion = result.diferencias.find((d) => /migrar los datos/i.test(d.documento_b));
    expect(migracion).toBeTruthy();
    expect(migracion!.documento_a).toMatch(/no aparece/i);
    expect(migracion!.pagina_a).toBeNull();
    expect(migracion!.pagina_b).toBe(3);
  });

  it("no menciona IA en el resumen y advierte que es una comparación literal", () => {
    const result = compareDocumentsLocal(DOC_A, DOC_B);
    expect(result.resumen.toLowerCase()).toContain("sin ia");
    expect(result.resumen_puntos.length).toBeGreaterThan(0);
  });
});
