import { createClient } from "@/lib/supabase/server";
import { getDocumentDetail } from "@/core/repositories/documents.repo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TimelineView } from "@/components/timeline-view";
import { ChatPanel } from "@/components/chat-panel";
import { ExportButtons } from "@/components/export-buttons";
import { NotesPanel } from "@/components/notes-panel";
import { formatCLP, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Ficha de documento: metadatos, resumen ejecutivo, variables, requerimientos,
 *  línea de tiempo, chat IA con citas, notas y versiones. */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getDocumentDetail(supabase, id);
  const { document: doc, summary, variables, requirements, timeline, versions, notes, deliveredItems } = detail;

  const meta: Array<[string, string]> = [
    ["Tipo", doc.doc_type.replace(/_/g, " ")],
    ["N° Licitación", doc.tender_number ?? "—"],
    ["ID Mercado Público", doc.market_id ?? "—"],
    ["Fecha", formatDate(doc.doc_date)],
    ["Monto", formatCLP(doc.amount)],
    ["Duración", doc.contract_duration ?? "—"],
    ["Proveedor", doc.provider ?? "—"],
    ["Área", doc.area ?? "—"],
    ["Ubicación", [doc.city, doc.region, doc.country].filter(Boolean).join(", ") || "—"],
    ["Idioma", doc.language ?? "es"],
    ["Páginas", String(doc.page_count ?? "—")],
    ["OCR", doc.is_scanned ? "Sí (documento escaneado)" : "No"],
  ];

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
          <p className="text-sm text-muted-foreground">{doc.tender_name ?? ""}</p>
        </div>
        <Badge variant={statusVariant(doc.status)}>
          {doc.status === "procesando" && doc.processing_step
            ? `procesando: ${doc.processing_step}`
            : doc.status}
        </Badge>
      </div>

      {doc.status === "error" && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">
            Error de procesamiento: {doc.processing_error}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="metadatos">Metadatos</TabsTrigger>
          <TabsTrigger value="variables">Variables ({variables.length})</TabsTrigger>
          <TabsTrigger value="requerimientos">Requerimientos ({requirements.length})</TabsTrigger>
          {deliveredItems.length > 0 && (
            <TabsTrigger value="entregas">Entregas ({deliveredItems.length})</TabsTrigger>
          )}
          <TabsTrigger value="timeline">Línea de tiempo</TabsTrigger>
          <TabsTrigger value="chat">Chat IA</TabsTrigger>
          <TabsTrigger value="notas">Notas ({notes.length})</TabsTrigger>
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

        <TabsContent value="metadatos">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {meta.map(([label, value]) => (
                <div key={label} className="text-sm">
                  <span className="text-muted-foreground">{label}: </span>
                  <span className="font-medium capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables">
          <div className="space-y-3">
            <ExportButtons kind="variables" entityId={doc.id} />
            <Table>
              <THead>
                <TR><TH>Categoría</TH><TH>Nombre</TH><TH>Descripción</TH><TH>Pág.</TH><TH>Confianza</TH></TR>
              </THead>
              <TBody>
                {variables.map((v) => (
                  <TR key={v.id}>
                    <TD><Badge variant="secondary" className="capitalize">{v.category.replace(/_/g, " ")}</Badge></TD>
                    <TD className="font-medium">{v.name}</TD>
                    <TD className="text-muted-foreground">{v.description ?? "—"}</TD>
                    <TD>{v.page ?? "—"}</TD>
                    <TD>{v.confidence != null ? `${Math.round(v.confidence * 100)}%` : "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="requerimientos">
          <div className="space-y-3">
            <ExportButtons kind="requerimientos" entityId={doc.id} />
            <Table>
              <THead>
                <TR><TH>Código</TH><TH>Título</TH><TH>Categoría</TH><TH>Obligatorio</TH><TH>Pág.</TH><TH>Prioridad</TH></TR>
              </THead>
              <TBody>
                {requirements.map((r) => (
                  <TR key={r.id}>
                    <TD>{r.code ?? "—"}</TD>
                    <TD>
                      <p className="font-medium">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </TD>
                    <TD>{r.category ?? "—"}</TD>
                    <TD>{r.mandatory ? "Sí" : "No"}</TD>
                    <TD>{r.page ?? "—"}</TD>
                    <TD><Badge variant={statusVariant(r.priority)}>{r.priority}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
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

        <TabsContent value="notas">
          <NotesPanel documentId={doc.id} initialNotes={notes} />
        </TabsContent>

        <TabsContent value="versiones">
          <Table>
            <THead>
              <TR><TH>Versión</TH><TH>Nota de cambio</TH><TH>Fecha</TH><TH>Actual</TH></TR>
            </THead>
            <TBody>
              {versions.map((v) => (
                <TR key={v.id}>
                  <TD className="font-medium">v{v.version}</TD>
                  <TD>{v.change_note ?? "—"}</TD>
                  <TD>{formatDate(v.created_at)}</TD>
                  <TD>{v.is_current ? <Badge variant="success">actual</Badge> : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
