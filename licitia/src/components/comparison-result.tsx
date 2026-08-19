import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ExportButtons } from "@/components/export-buttons";

interface ComparisonItem {
  id: string;
  requirement_text: string;
  status: string;
  evidence_quote: string | null;
  evidence_page: number | null;
  ai_comment: string | null;
  risk: string;
  priority: string;
}

/** Tabla de cumplimiento contractual + sección aparte de trabajos adicionales
 *  fuera de acuerdo (con marca de "sin costo"). */
function ComplianceTables({ items }: { items: ComparisonItem[] }) {
  const contractual = items.filter((i) => i.status !== "adicional");
  const additional = items.filter((i) => i.status === "adicional");

  return (
    <div className="space-y-6">
      <Table>
        <THead>
          <TR>
            <TH>Requerimiento</TH><TH>Estado</TH><TH>Evidencia</TH><TH>Pág.</TH>
            <TH>Comentario IA</TH><TH>Riesgo</TH><TH>Prioridad</TH>
          </TR>
        </THead>
        <TBody>
          {contractual.map((item) => (
            <TR key={item.id}>
              <TD className="max-w-[280px] font-medium">{item.requirement_text}</TD>
              <TD><Badge variant={statusVariant(item.status)}>{item.status.replace(/_/g, " ")}</Badge></TD>
              <TD className="max-w-[280px] text-xs italic text-muted-foreground">
                {item.evidence_quote ? `“${item.evidence_quote}”` : "—"}
              </TD>
              <TD>{item.evidence_page ?? "—"}</TD>
              <TD className="max-w-[280px] text-xs">{item.ai_comment ?? "—"}</TD>
              <TD><Badge variant={statusVariant(item.risk)}>{item.risk}</Badge></TD>
              <TD><Badge variant={statusVariant(item.priority)}>{item.priority}</Badge></TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {additional.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="font-semibold">
              Trabajos adicionales fuera de acuerdo ({additional.length})
            </h3>
            <p className="text-sm text-muted-foreground">
              Entregas registradas en tu documento de control que no responden a ningún
              requerimiento del documento base. Las marcadas “sin costo” son respaldo
              valioso en negociaciones y respuestas a reclamos.
            </p>
          </div>
          <Table>
            <THead>
              <TR><TH>Entrega</TH><TH>Condición</TH><TH>Evidencia</TH><TH>Pág.</TH><TH>Comentario IA</TH></TR>
            </THead>
            <TBody>
              {additional.map((item) => (
                <TR key={item.id}>
                  <TD className="max-w-[300px] font-medium">
                    {item.requirement_text.replace(/^\(Adicional\)\s*/, "")}
                  </TD>
                  <TD>
                    {item.ai_comment?.includes("SIN COSTO") ? (
                      <Badge variant="success">sin costo</Badge>
                    ) : (
                      <Badge variant="default">adicional</Badge>
                    )}
                  </TD>
                  <TD className="max-w-[300px] text-xs italic text-muted-foreground">
                    {item.evidence_quote ? `“${item.evidence_quote}”` : "—"}
                  </TD>
                  <TD>{item.evidence_page ?? "—"}</TD>
                  <TD className="max-w-[300px] text-xs">{item.ai_comment ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface DiffItem {
  tema: string;
  documento_a: string;
  pagina_a?: number | null;
  documento_b: string;
  pagina_b?: number | null;
  impacto: string;
  comentario: string;
}

interface Comparison {
  id: string;
  comparison_type: string;
  status: string;
  pct_fulfilled: number | null;
  pct_partial: number | null;
  pct_pending: number | null;
  pct_additional: number | null;
  pct_out_of_scope: number | null;
  traffic_light: string | null;
  summary: string | null;
  summary_points: string[] | null;
  differences: DiffItem[] | null;
  comparison_items: ComparisonItem[];
  source: { title: string } | null;
  target: { title: string } | null;
}

/** Diferencia a diferencia, con la página de origen en cada documento —
 *  el detalle que sigue al resumen macro. */
function DiffList({ differences, sourceTitle, targetTitle }: {
  differences: DiffItem[];
  sourceTitle: string;
  targetTitle: string;
}) {
  return (
    <div className="space-y-3">
      {differences.map((d, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {i + 1}. {d.tema}
              </p>
              <Badge variant={statusVariant(d.impacto)} className="uppercase">
                {d.impacto}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-2.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {sourceTitle}
                  {d.pagina_a != null && <span> · pág. {d.pagina_a}</span>}
                </p>
                <p className="mt-1 text-sm">{d.documento_a}</p>
              </div>
              <div className="rounded-md border p-2.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {targetTitle}
                  {d.pagina_b != null && <span> · pág. {d.pagina_b}</span>}
                </p>
                <p className="mt-1 text-sm">{d.documento_b}</p>
              </div>
            </div>
            {d.comentario && <p className="text-xs text-muted-foreground">{d.comentario}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Resultado de comparación: KPIs de cumplimiento + semáforo + tabla de evidencia,
 *  o tabla de diferencias para comparaciones doc vs doc. */
export function ComparisonResult({ comparison }: { comparison: Comparison }) {
  const pct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "—");
  const isCompliance = comparison.comparison_type === "cumplimiento";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {comparison.source?.title} <span className="text-muted-foreground">vs</span>{" "}
            {comparison.target?.title}
            {comparison.traffic_light && (
              <Badge variant={statusVariant(comparison.traffic_light)} className="uppercase">
                {comparison.traffic_light}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isCompliance && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Cumplido", comparison.pct_fulfilled, "text-green-600"],
                ["Parcial", comparison.pct_partial, "text-amber-600"],
                ["Pendiente", comparison.pct_pending, "text-red-600"],
                ["Adicional", comparison.pct_additional, "text-primary"],
                ["Fuera de alcance", comparison.pct_out_of_scope, "text-muted-foreground"],
              ].map(([label, value, color]) => (
                <div key={label as string} className="rounded-lg border p-3 text-center">
                  <p className={`text-xl font-semibold ${color}`}>{pct(value as number | null)}</p>
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                </div>
              ))}
            </div>
          )}
          {isCompliance && comparison.summary && (
            <p className="text-sm text-muted-foreground">{comparison.summary}</p>
          )}
          <ExportButtons kind="comparacion" entityId={comparison.id} />
        </CardContent>
      </Card>

      {isCompliance ? (
        <ComplianceTables items={comparison.comparison_items} />
      ) : (
        <div className="space-y-4">
          {(comparison.summary || (comparison.summary_points?.length ?? 0) > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen macro de las diferencias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {comparison.summary && <p className="text-sm">{comparison.summary}</p>}
                {(comparison.summary_points?.length ?? 0) > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    {comparison.summary_points!.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Detalle punto por punto ({(comparison.differences ?? []).length})
            </h3>
            {(comparison.differences ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No se identificaron diferencias.</p>
            ) : (
              <DiffList
                differences={comparison.differences!}
                sourceTitle={comparison.source?.title ?? "Documento A"}
                targetTitle={comparison.target?.title ?? "Documento B"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
