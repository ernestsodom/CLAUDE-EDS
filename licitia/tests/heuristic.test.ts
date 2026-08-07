import { describe, expect, it } from "vitest";
import {
  classifyDocumentLocal,
  extractDeliveredItemsLocal,
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

  it("no mezcla puntos críticos (SLA, multas, garantías) con las funcionalidades", () => {
    const texto = sistemas
      .flatMap((s) => s.funcionalidades.map((f) => f.nombre.toLowerCase()))
      .join(" ");
    expect(texto).not.toContain("multa");
    expect(texto).not.toContain("boleta de garantía");
    expect(texto).not.toContain("disponibilidad de 99");
  });

  it("cuelga funcionalidades concretas de cada sistema, con página y cita", () => {
    for (const sistema of sistemas) {
      expect(sistema.funcionalidades.length).toBeGreaterThan(0);
      for (const f of sistema.funcionalidades) {
        expect(f.nombre.length).toBeGreaterThan(0);
        expect(f.pagina).toBeGreaterThan(0);
        expect(f.cita).toBeTruthy();
      }
    }
  });

  it("descarta los sistemas sin ninguna funcionalidad detectada", () => {
    expect(sistemas.every((s) => s.funcionalidades.length > 0)).toBe(true);
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

describe("motor local — resumen ejecutivo", () => {
  const s = summarizeLocal(LICITACION);

  it("produce todas las secciones del informe", () => {
    expect(s.resumen_general).toContain("2397-45-LR26");
    expect(s.objetivo).toBeTruthy();
    expect(s.requerimientos.length).toBeGreaterThan(0);
    expect(s.cronograma.length).toBeGreaterThan(0);
    expect(s.recomendaciones.length).toBeGreaterThan(0);
  });

  it("advierte que fue generado sin IA", () => {
    expect(s.resumen_general.toLowerCase()).toContain("sin ia");
  });

  it("recoge las multas como riesgos", () => {
    expect(s.riesgos.some((r) => /multa|utm/i.test(r.riesgo))).toBe(true);
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
