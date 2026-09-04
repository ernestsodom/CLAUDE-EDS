import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import {
  getDocumentDetail,
  getVersionSummary,
  getAnalysisParts,
  type AnalysisPartStatus as PartStatus,
} from "@/core/repositories/documents.repo";
import { checklistProgress } from "@/core/repositories/checklist.repo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TimelineView } from "@/components/timeline-view";
import { ChatPanel } from "@/components/chat-panel";
import { DocumentChatHistory } from "@/components/document-chat-history";
import { ExportButtons } from "@/components/export-buttons";
import { SystemsChecklist } from "@/components/systems-checklist";
import { BackLink } from "@/components/back-link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DocumentProcessButton } from "@/components/document-process-button";
import { AnalysisPartButton } from "@/components/analysis-part-button";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { ReanalyzeButton } from "@/components/reanalyze-button";
import { RenameDocumentButton } from "@/components/rename-document-button";
import { MoveToFolderButton } from "@/components/move-to-folder-button";
import { BUDGET_PERIOD_LABELS, CRITICAL_TYPE_LABELS } from "@/core/ai/schemas";
import { ANALYSIS_PARTS, PART_LABELS, PART_DESCRIPTIONS, STEP_LABELS } from "@/core/services/ingestion.service";
import { ENGINE_LABELS, type AnalysisMode } from "@/lib/ai-providers";
import { formatCLP, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Un documento cargado antes de esta versión del pipeline llegó a "procesado"
// (el terminal viejo, que ya traía todo analizado); uno cargado después llega
// a "cargado" (solo el texto listo, cada análisis se pide aparte). Ambos
// significan "la carga terminó, ya se puede trabajar con este documento".
const LOADED_STATUSES = new Set(["cargado", "procesado"]);

/** Ficha de documento: resumen, sistemas, línea de tiempo, evaluación y
 *  anexos, puntos críticos, chat IA y versiones — cada análisis a pedido. */
export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; c?: string }>;
}) {
  const { id } = await params;
  const { v: viewVersionId, c: requestedConversationId } = await searchParams;
  const { supabase } = await requireUser();
  const detail = await getDocumentDetail(supabase, id);
  const {
    document: doc,
    projectName,
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
  const [summary, analysisParts] = viewingVersion
    ? await Promise.all([
        getVersionSummary(supabase, viewingVersion.id),
        getAnalysisParts(supabase, viewingVersion.id),
      ])
    : [detail.summary, detail.analysisParts];

  const partStatus = (part: (typeof ANALYSIS_PARTS)[number]): "pendiente" | "procesando" | "listo" | "error" =>
    (analysisParts as Record<string, PartStatus>)[part]?.status ?? "pendiente";
  const partError = (part: (typeof ANALYSIS_PARTS)[number]) =>
    (analysisParts as Record<string, PartStatus>)[part]?.error ?? null;
  const partEngine = (part: (typeof ANALYSIS_PARTS)[number]) =>
    (analysisParts as Record<string, PartStatus>)[part]?.engine ?? null;

  const progress = checklistProgress(systems);

  // El Chat IA ya guardaba cada conversación en la base de datos (igual que
  // el resumen u otro dato procesado), pero la pantalla nunca las mostraba:
  // cada visita arrancaba en blanco. Ahora se listan las conversaciones de
  // ESTE documento y, si no se pidió una en particular (?c=) ni "nueva"
  // (?c=new), se retoma la más reciente automáticamente — igual que el
  // resumen, que también muestra lo último ya procesado sin pedirlo.
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("document_id", id)
    .order("updated_at", { ascending: false })
    .limit(20);
  const conversationList = conversations ?? [];

  const startingNew = requestedConversationId === "new";
  const activeConversationId = startingNew
    ? undefined
    : (requestedConversationId ?? conversationList[0]?.id);

  let chatInitialMessages: Array<{
    role: "user" | "assistant";
    content: string;
    citations?: never[];
    confidence?: number | null;
  }> = [];
  if (activeConversationId) {
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content, citations, confidence")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true });
    chatInitialMessages = (messages ?? []).filter((m) => m.role !== "system") as never;
  }

  const defaultTab = requestedConversationId ? "chat" : "resumen";

  const summaryList = (items: unknown) =>
    ((items ?? []) as Array<{ titulo: string; detalle: string }>).map((i, k) => (
      <li key={k}>
        <span className="font-medium">{i.titulo}:</span> {i.detalle}
      </li>
    ));

  const isoBadge = (c: unknown) => {
    const cert = c as { exigida: boolean | null; detalle: string | null; pagina: number | null } | null;
    if (!cert || cert.exigida == null) {
      return <Badge variant="secondary">no mencionada</Badge>;
    }
    return <Badge variant={cert.exigida ? "danger" : "success"}>{cert.exigida ? "exigida" : "no exigida"}</Badge>;
  };

  const evaluationCriteria = (summary?.evaluation_criteria ?? []) as Array<{
    criterio: string;
    ponderacion: string | null;
    pauta: string | null;
    pagina: number | null;
    cita: string | null;
  }>;
  const requestedAnnexes = (summary?.requested_annexes ?? []) as Array<{
    nombre: string;
    tipo: string | null;
    descripcion: string | null;
    accion_oferente: string | null;
    obligatorio: boolean | null;
    pagina: number | null;
    cita: string | null;
  }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Documentos", href: "/documents" },
            ...(doc.project_id && projectName
              ? [{ label: projectName, href: `/projects/${doc.project_id}` }]
              : []),
            { label: doc.title },
          ]}
        />
        <BackLink
          href={doc.project_id ? `/projects/${doc.project_id}` : "/documents"}
          label={doc.project_id ? "Volver a la carpeta" : "Volver a Documentos"}
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <RenameDocumentButton documentId={doc.id} title={doc.title} />
          </div>
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
              ? `cargando: ${STEP_LABELS[doc.processing_step] ?? doc.processing_step}`
              : doc.status}
          </Badge>
          {LOADED_STATUSES.has(doc.status) && <ReanalyzeButton documentId={doc.id} />}
          <MoveToFolderButton documentId={doc.id} currentProjectId={doc.project_id} />
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

      {!LOADED_STATUSES.has(doc.status) && (
        <Card className={doc.status === "error" ? "border-destructive/50" : undefined}>
          <CardContent className="space-y-2 p-4">
            {doc.status === "error" ? (
              <p className="text-sm text-destructive">Error al cargar: {doc.processing_error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este documento todavía no está cargado: falta extraer su texto, dividirlo y
                clasificarlo. Una vez cargado, se puede pedir cada análisis por separado (resumen,
                sistemas, línea de tiempo, evaluación y anexos, puntos críticos, chat).
              </p>
            )}
            <DocumentProcessButton documentId={doc.id} status={doc.status} />
          </CardContent>
        </Card>
      )}

      {LOADED_STATUSES.has(doc.status) && (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="sistemas">
              Sistemas ({systems.length}){progress.total > 0 && ` · ${progress.pct}%`}
            </TabsTrigger>
            <TabsTrigger value="evaluacion">Evaluación y anexos</TabsTrigger>
            <TabsTrigger value="criticos">Puntos críticos ({requirements.length})</TabsTrigger>
            {deliveredItems.length > 0 && (
              <TabsTrigger value="entregas">Entregas ({deliveredItems.length})</TabsTrigger>
            )}
            <TabsTrigger value="timeline">Línea de tiempo</TabsTrigger>
            <TabsTrigger value="chat">Chat IA</TabsTrigger>
            <TabsTrigger value="versiones">Versiones ({versions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <div className="space-y-4">
              <AnalysisPartButton
                documentId={doc.id}
                part="resumen"
                label={PART_LABELS.resumen}
                description={PART_DESCRIPTIONS.resumen}
                status={partStatus("resumen")}
                errorMessage={partError("resumen")}
                engine={partEngine("resumen")}
              />

              {summary && (
                <>
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
                      <CardHeader><CardTitle className="text-base">Obligaciones y restricciones</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{summaryList(summary.obligations)}{summaryList(summary.restrictions)}</ul></CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Certificaciones</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {(() => {
                          type Cert = {
                            detalle: string | null;
                            a_quien: string | null;
                            obligatoria_o_deseable: "obligatoria" | "deseable" | null;
                          };
                          const renderCert = (label: string, raw: unknown) => {
                            const c = raw as Cert | null;
                            return (
                              <div key={label}>
                                <p className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{label}:</span> {isoBadge(raw)}
                                  {c?.obligatoria_o_deseable && (
                                    <Badge variant="secondary">{c.obligatoria_o_deseable}</Badge>
                                  )}
                                </p>
                                {c?.a_quien && (
                                  <p className="text-xs text-muted-foreground">A quién: {c.a_quien}</p>
                                )}
                                {c?.detalle && <p className="text-xs text-muted-foreground">{c.detalle}</p>}
                              </div>
                            );
                          };
                          return (
                            <>
                              {renderCert("ISO 9001", summary.iso_9001)}
                              {renderCert("ISO 27001", summary.iso_27001)}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Migración de datos</CardTitle></CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {(() => {
                          const m = summary.data_migration as
                            | {
                                exigida: boolean | null;
                                plazo: string | null;
                                volumen: string | null;
                                informacion_a_migrar: string | null;
                                responsable: string | null;
                                detalle: string | null;
                              }
                            | null;
                          if (!m || m.exigida == null) {
                            return <p className="text-muted-foreground">No se menciona en el documento.</p>;
                          }
                          if (!m.exigida) return <p>No se exige migración de datos.</p>;
                          return (
                            <>
                              <p><span className="font-medium">Qué migrar:</span> {m.informacion_a_migrar ?? "no especificado en el documento"}</p>
                              <p><span className="font-medium">Volumen:</span> {m.volumen ?? "no cuantificado en el documento"}</p>
                              <p><span className="font-medium">Plazo:</span> {m.plazo ?? "no especificado"}</p>
                              {m.responsable && <p><span className="font-medium">Responsable:</span> {m.responsable}</p>}
                              {m.detalle && <p className="text-xs text-muted-foreground">{m.detalle}</p>}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sistemas">
            <div className="space-y-3">
              <AnalysisPartButton
                documentId={doc.id}
                part="sistemas"
                label={PART_LABELS.sistemas}
                description={PART_DESCRIPTIONS.sistemas}
                status={partStatus("sistemas")}
                errorMessage={partError("sistemas")}
                engine={partEngine("sistemas")}
              />
              {systems.length > 0 && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sistemas que la licitación solicita. Abre cada uno y pide sus funcionalidades por
                    separado — es lo que usa el comparador Checklist vs Excel.
                  </p>
                  <SystemsChecklist documentId={doc.id} systems={systems} />
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="evaluacion">
            <div className="space-y-4">
              <AnalysisPartButton
                documentId={doc.id}
                part="evaluacion"
                label={PART_LABELS.evaluacion}
                description={PART_DESCRIPTIONS.evaluacion}
                status={partStatus("evaluacion")}
                errorMessage={partError("evaluacion")}
                engine={partEngine("evaluacion")}
              />
              {partStatus("evaluacion") === "listo" && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">Criterios de evaluación</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {evaluationCriteria.length === 0 ? (
                        <p className="text-muted-foreground">
                          No se identificaron criterios de evaluación en el documento.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {evaluationCriteria.map((c, k) => (
                            <li key={k} className="rounded-md border p-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{c.criterio}</span>
                                {c.ponderacion && <Badge variant="secondary">{c.ponderacion}</Badge>}
                              </div>
                              {c.pauta && <p className="mt-1 text-xs text-muted-foreground">{c.pauta}</p>}
                              {c.cita && (
                                <p className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                                  “{c.cita}”{c.pagina != null && ` — pág. ${c.pagina}`}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {summary?.evaluation_methodology && (
                        <p className="border-t pt-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Metodología general: </span>
                          {summary.evaluation_methodology}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">Anexos solicitados</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                      {requestedAnnexes.length === 0 ? (
                        <p className="text-muted-foreground">
                          No se identificaron anexos solicitados en el documento.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {requestedAnnexes.map((a, k) => (
                            <li key={k} className="rounded-md border p-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{a.nombre}</span>
                                {a.tipo && <Badge variant="secondary">{a.tipo}</Badge>}
                                {a.obligatorio != null && (
                                  <Badge variant={a.obligatorio ? "danger" : "secondary"}>
                                    {a.obligatorio ? "obligatorio" : "opcional"}
                                  </Badge>
                                )}
                              </div>
                              {a.descripcion && <p className="mt-1 text-xs text-muted-foreground">{a.descripcion}</p>}
                              {a.accion_oferente && (
                                <p className="mt-1 text-xs">
                                  <span className="font-medium">Qué hacer: </span>
                                  {a.accion_oferente}
                                </p>
                              )}
                              {a.cita && (
                                <p className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                                  “{a.cita}”{a.pagina != null && ` — pág. ${a.pagina}`}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="criticos">
            <div className="space-y-3">
              <AnalysisPartButton
                documentId={doc.id}
                part="criticos"
                label={PART_LABELS.criticos}
                description={PART_DESCRIPTIONS.criticos}
                status={partStatus("criticos")}
                errorMessage={partError("criticos")}
                engine={partEngine("criticos")}
              />
              {requirements.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">Puntos críticos ({requirements.length})</CardTitle>
                    <ExportButtons kind="requerimientos" entityId={doc.id} />
                  </CardHeader>
                  <CardContent className="text-sm">
                    <ul className="space-y-2">
                      {requirements.map((r) => (
                        <li key={r.id} className="rounded-md border p-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{r.title}</span>
                            <Badge variant={statusVariant(r.priority)}>{r.priority}</Badge>
                            {r.mandatory && <Badge variant="secondary">obligatorio</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.critical_type &&
                              (CRITICAL_TYPE_LABELS[r.critical_type as keyof typeof CRITICAL_TYPE_LABELS] ??
                                r.critical_type)}
                            {r.deadline_text && ` · plazo: ${r.deadline_text}`}
                            {r.value_text && ` · valor: ${r.value_text}`}
                            {r.page != null && ` · pág. ${r.page}`}
                          </p>
                          {r.description && <p className="mt-1 text-xs">{r.description}</p>}
                          {r.condition_text && (
                            <p className="mt-1 text-xs">
                              <span className="font-medium">Se gatilla si: </span>
                              {r.condition_text}
                            </p>
                          )}
                          {r.calc_base && (
                            <p className="mt-1 text-xs">
                              <span className="font-medium">Cálculo/tope: </span>
                              {r.calc_base}
                            </p>
                          )}
                          {r.quote && (
                            <p className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                              “{r.quote}”
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
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
            <div className="space-y-3">
              <AnalysisPartButton
                documentId={doc.id}
                part="timeline"
                label={PART_LABELS.timeline}
                description={PART_DESCRIPTIONS.timeline}
                status={partStatus("timeline")}
                errorMessage={partError("timeline")}
                engine={partEngine("timeline")}
              />
              {partStatus("timeline") === "listo" && <TimelineView milestones={timeline?.milestones ?? []} />}
            </div>
          </TabsContent>

          <TabsContent value="chat">
            <div className="space-y-3">
              <AnalysisPartButton
                documentId={doc.id}
                part="chat"
                label={PART_LABELS.chat}
                description={PART_DESCRIPTIONS.chat}
                status={partStatus("chat")}
                errorMessage={partError("chat")}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Las conversaciones quedan guardadas en el documento — se retoma la más reciente al
                  volver. El chat funciona con o sin "Preparar chat": buscará por texto si no se
                  prepararon los vectores.
                </p>
                <DocumentChatHistory
                  documentId={doc.id}
                  conversations={conversationList}
                  activeId={activeConversationId}
                />
              </div>
              <ChatPanel
                key={activeConversationId ?? "new"}
                documentId={doc.id}
                agent="analista"
                initialConversationId={activeConversationId}
                initialMessages={chatInitialMessages}
              />
            </div>
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
      )}
    </div>
  );
}
