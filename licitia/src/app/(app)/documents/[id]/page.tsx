import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDocumentDetail, getVersionSummary } from "@/core/repositories/documents.repo";
import { checklistProgress } from "@/core/repositories/checklist.repo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TimelineView } from "@/components/timeline-view";
import { ChatPanel } from "@/components/chat-panel";
import { ExportButtons } from "@/components/export-buttons";
import { SystemsChecklist } from "@/components/systems-checklist";
import { CriticalPointsAccordion } from "@/components/critical-points-accordion";
import { DocumentProcessButton } from "@/components/document-process-button";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { ReanalyzeButton } from "@/components/reanalyze-button";
import { BUDGET_PERIOD_LABELS } from "@/core/ai/schemas";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";
import { formatCLP, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Ficha de documento: resumen ejecutivo, checklist de sistemas, puntos
 *  críticos, línea de tiempo, chat IA y versiones. */
export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v: viewVersionId } = await searchParams;
  const supabase = await createClient();
  const detail = await getDocumentDetail(supabase, id);
  const {
    document: doc,
    requirements,
    timeline,
    versions,
    deliveredItems,
    systems,
  } = detail;

  // Por defecto se ve el resumen de la versión actual; el usuario puede
  // abrir el de cualquier otra desde la pestaña Versiones sin perder la de
  // hoy — cada reanálisis con otro motor queda guardado aparte.
  const viewingVersion = viewVersionId ? versions.find((v) => v.id === viewVersionId) : null;
  const summary = viewingVersion ? await getVersionSummary(supabase, viewingVersion.id) : detail.summary;

  const progress = checklistProgress(systems);

  const summaryList = (items: unknown) =>
    ((items ?? []) as Array<{ titulo: string; detalle: string }>).map((i, k) => (
      <li key={k}>
        <span className="font-medium">{i.titulo}:</span> {i.detalle}
      </li>
    ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {[
              doc.doc_type.replace(/_/g, " "),
              doc.tender_number && `N° ${doc.tender_number}`,
              doc.doc_date && formatDate(doc.doc_date),
              doc.amount != null && formatCLP(doc.amount),
              doc.contract_duration,
              doc.page_count != null && `${doc.page_count} págs.`,
              doc.is_scanned && "OCR",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {doc.tender_name && (
            <p className="text-sm text-muted-foreground">{doc.tender_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(doc.status)}>
            {doc.status === "procesando" && doc.processing_step
              ? `procesando: ${doc.processing_step}`
              : doc.status}
          </Badge>
          {doc.status === "procesado" && <ReanalyzeButton documentId={doc.id} />}
          <DeleteDocumentButton documentId={doc.id} title={doc.title} />
        </div>
      </div>

      {viewingVersion && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span>
              Viendo el resumen de <span className="font-medium">v{viewingVersion.version}</span>
              {viewingVersion.analysis_engine &&
                ` (${ENGINE_LABELS[viewingVersion.analysis_engine as AnalysisMode] ?? viewingVersion.analysis_engine})`}
              , no la versión actual.
            </span>
            <Link href={`/documents/${doc.id}`} className="font-medium text-primary underline">
              Volver a la actual
            </Link>
          </CardContent>
        </Card>
      )}

      {doc.status !== "procesado" && (
        <Card className={doc.status === "error" ? "border-destructive/50" : undefined}>
          <CardContent className="space-y-2 p-4">
            {doc.status === "error" ? (
              <p className="text-sm text-destructive">
                Error de procesamiento: {doc.processing_error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este documento aún no ha sido analizado por la IA. El análisis avanza por
                etapas (extracción, clasificación, resumen, sistemas, puntos críticos
                y cronograma) y puede tardar unos minutos.
              </p>
            )}
            <DocumentProcessButton documentId={doc.id} status={doc.status} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="sistemas">
            Sistemas ({systems.length}){progress.total > 0 && ` · ${progress.pct}%`}
          </TabsTrigger>
          <TabsTrigger value="requerimientos">Puntos críticos ({requirements.length})</TabsTrigger>
          {deliveredItems.length > 0 && (
            <TabsTrigger value="entregas">Entregas ({deliveredItems.length})</TabsTrigger>
          )}
          <TabsTrigger value="timeline">Línea de tiempo</TabsTrigger>
          <TabsTrigger value="chat">Chat IA</TabsTrigger>
          <TabsTrigger value="versiones">Versiones ({versions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          {!summary ? (
            <p className="text-sm text-muted-foreground">
              El resumen ejecutivo se generará al completarse el procesamiento.
            </p>
          ) : (
            <div className="space-y-4">
              <ExportButtons kind="resumen" entityId={doc.id} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Resumen general</CardTitle></CardHeader>
                  <CardContent className="text-sm">{summary.summary}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Objetivo y alcance</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-medium">Objetivo:</span> {summary.objective}</p>
                    <p><span className="font-medium">Alcance:</span> {summary.scope}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Plazo y presupuesto</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Plazo de implementación:</span>{" "}
                      {summary.implementation_deadline ?? "No especificado en el documento"}
                    </p>
                    <p>
                      <span className="font-medium">Presupuesto:</span>{" "}
                      {summary.budget_amount != null ? (
                        <>
                          {formatCLP(summary.budget_amount)}
                          {summary.budget_currency && summary.budget_currency !== "CLP" && ` ${summary.budget_currency}`}
                          {" "}
                          <Badge variant="secondary">
                            {summary.budget_period
                              ? BUDGET_PERIOD_LABELS[summary.budget_period as keyof typeof BUDGET_PERIOD_LABELS] ??
                                summary.budget_period
                              : "periodicidad no especificada"}
                          </Badge>
                        </>
                      ) : (
                        "No especificado en el documento"
                      )}
                    </p>
                    {summary.budget_detail && (
                      <p className="text-xs text-muted-foreground">{summary.budget_detail}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Riesgos</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {((summary.risks ?? []) as Array<{ riesgo: string; nivel: string; mitigacion: string }>).map((r, k) => (
                        <li key={k} className="flex items-start gap-2">
                          <Badge variant={statusVariant(r.nivel)}>{r.nivel}</Badge>
                          <span><span className="font-medium">{r.riesgo}.</span> Mitigación: {r.mitigacion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Aspectos críticos</CardTitle></CardHeader>
                  <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{summaryList(summary.critical_points)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Obligaciones y restricciones</CardTitle></CardHeader>
                  <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{summaryList(summary.obligations)}{summaryList(summary.restrictions)}</ul></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Entregables</CardTitle></CardHeader>
                  <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{summaryList(summary.deliverables)}</ul></CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-base">Recomendaciones</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-4 text-sm">
                      {((summary.recommendations ?? []) as string[]).map((r, k) => <li key={k}>{r}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sistemas">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sistemas exigidos por el documento y sus funcionalidades. Pulsa un sistema para
              desplegarlas, marca cada funcionalidad al completarla y fija su plazo. El avance se
              guarda al instante y se conserva aunque vuelvas a procesar el documento.
            </p>
            <SystemsChecklist systems={systems} />
          </div>
        </TabsContent>

        <TabsContent value="requerimientos">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Solo los puntos críticos y obligatorios para participar: boleta de garantía,
              condiciones de servidores, SLA, plazos, multas, certificados y migración de datos.
              Las funcionalidades del software están en la pestaña{" "}
              <span className="font-medium">Sistemas</span>. Pulsa un punto para ver su detalle.
            </p>
            <ExportButtons kind="requerimientos" entityId={doc.id} />
            {requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No se identificaron puntos críticos en este documento.
              </p>
            ) : (
              <CriticalPointsAccordion requirements={requirements} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="entregas">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Entregas registradas en este documento de control. Las adicionales no responden a
              ningún requerimiento del acuerdo; las “sin costo” se realizaron gratuitamente.
            </p>
            <Table>
              <THead>
                <TR><TH>Entrega</TH><TH>Estado</TH><TH>Condición</TH><TH>Fecha</TH><TH>Req. asociado</TH><TH>Pág.</TH></TR>
              </THead>
              <TBody>
                {deliveredItems.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <p className="font-medium">{e.title}</p>
                      {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                    </TD>
                    <TD><Badge variant={statusVariant(e.delivery_state === "entregado" ? "cumplido" : "pendiente")}>{e.delivery_state.replace(/_/g, " ")}</Badge></TD>
                    <TD>
                      {e.is_additional ? (
                        <Badge variant={e.is_free ? "success" : "default"}>
                          {e.is_free ? "adicional sin costo" : "adicional"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">contractual</Badge>
                      )}
                    </TD>
                    <TD>{formatDate(e.delivered_on)}</TD>
                    <TD>{e.requirement_ref ?? "—"}</TD>
                    <TD>{e.page ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineView milestones={timeline?.milestones ?? []} />
        </TabsContent>

        <TabsContent value="chat">
          <ChatPanel documentId={doc.id} agent="analista" />
        </TabsContent>

        <TabsContent value="versiones">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cada reanálisis con otro motor de IA crea una versión nueva sin perder la anterior.
              Pulsa <span className="font-medium">Ver resumen</span> para revisar lo que produjo
              cada una.
            </p>
            <Table>
              <THead>
                <TR><TH>Versión</TH><TH>Motor</TH><TH>Nota de cambio</TH><TH>Fecha</TH><TH>Actual</TH><TH>&nbsp;</TH></TR>
              </THead>
              <TBody>
                {versions.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-medium">v{v.version}</TD>
                    <TD>
                      {v.analysis_engine ? (
                        <Badge variant="secondary">
                          {ENGINE_LABELS[v.analysis_engine as AnalysisMode] ?? v.analysis_engine}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>{v.change_note ?? "—"}</TD>
                    <TD>{formatDate(v.created_at)}</TD>
                    <TD>{v.is_current ? <Badge variant="success">actual</Badge> : "—"}</TD>
                    <TD>
                      <Link
                        href={v.is_current ? `/documents/${doc.id}` : `/documents/${doc.id}?v=${v.id}`}
                        className="text-primary underline"
                      >
                        Ver resumen
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
