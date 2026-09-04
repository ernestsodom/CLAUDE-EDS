import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import { Folder, GitCompare } from "lucide-react";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { RenameDocumentButton } from "@/components/rename-document-button";
import { MoveToFolderButton } from "@/components/move-to-folder-button";
import { BackLink } from "@/components/back-link";
import { TenderMetaEditor } from "@/components/tender-meta-editor";
import { STEP_LABELS } from "@/core/services/ingestion.service";
import { TENDER_STATUS_LABELS, type TenderStatus } from "@/lib/tender-status";
import { CalendarClock, ClipboardList, Layers, TriangleAlert } from "lucide-react";

const COMPARISON_TYPE_LABELS: Record<string, string> = {
  cumplimiento: "Control de cumplimiento",
  licitacion_vs_licitacion: "Dos licitaciones",
  propuesta_vs_propuesta: "Dos propuestas",
  contrato_vs_contrato: "Dos contratos",
  version_vs_version: "Dos versiones",
};

export const dynamic = "force-dynamic";

/** Carpeta de proyecto: todos los documentos del cliente/proyecto en un lugar. */
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, tender_number, tender_status, closing_date, clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: documents }, { data: comparisons }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, doc_type, status, doc_date, amount, processing_step")
      .eq("project_id", id)
      .is("parent_document_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("comparisons")
      .select(
        "id, comparison_type, status, traffic_light, created_at, folder_id, comparison_folders(name), source:documents!comparisons_source_document_id_fkey(title), target:documents!comparisons_target_document_id_fkey(title)"
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const client = (project.clients as unknown as { name: string } | null)?.name;

  // Vista consolidada de la licitación: cuenta sistemas, puntos críticos y
  // el próximo hito a través de TODOS los documentos de la carpeta — sin
  // fusionar ni reinterpretar nada, cada dato sigue siendo el de su propio
  // documento; esto solo suma y ordena lo que ya está extraído.
  const docIds = (documents ?? []).map((d) => d.id);
  let systemsCount = 0;
  let criticalCount = 0;
  let nextMilestone: { title: string; starts_on: string | null; documentId: string; documentTitle: string } | null = null;
  const totalAmount = (documents ?? []).reduce((sum, d) => sum + (d.amount ?? 0), 0);

  if (docIds.length > 0) {
    const [{ count: sc }, { count: cc }, { data: timelines }] = await Promise.all([
      supabase.from("systems").select("id", { count: "exact", head: true }).in("document_id", docIds),
      supabase.from("requirements").select("id", { count: "exact", head: true }).in("document_id", docIds),
      supabase.from("timelines").select("id, document_id").in("document_id", docIds),
    ]);
    systemsCount = sc ?? 0;
    criticalCount = cc ?? 0;

    const timelineIds = (timelines ?? []).map((t) => t.id);
    if (timelineIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: milestones } = await supabase
        .from("milestones")
        .select("title, starts_on, timeline_id")
        .in("timeline_id", timelineIds)
        .gte("starts_on", today)
        .order("starts_on", { ascending: true })
        .limit(1);
      const m = milestones?.[0];
      if (m) {
        const timeline = timelines!.find((t) => t.id === m.timeline_id);
        const doc = (documents ?? []).find((d) => d.id === timeline?.document_id);
        nextMilestone = {
          title: m.title,
          starts_on: m.starts_on,
          documentId: doc?.id ?? "",
          documentTitle: doc?.title ?? "",
        };
      }
    }
  }

  // Las comparaciones se archivan en subcarpetas propias, distintas de la
  // lista de documentos — aunque vivan bajo la misma carpeta general.
  const comparisonGroups = new Map<
    string,
    { name: string; items: NonNullable<typeof comparisons> }
  >();
  for (const c of comparisons ?? []) {
    const key = c.folder_id ?? "sin-subcarpeta";
    const name = (c.comparison_folders as unknown as { name: string } | null)?.name ?? "Sin subcarpeta";
    const group = comparisonGroups.get(key) ?? { name, items: [] };
    group.items.push(c);
    comparisonGroups.set(key, group);
  }

  return (
    <div className="space-y-4">
      <BackLink href="/documents" label="Volver a Documentos" />
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Folder className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {client ?? "Sin cliente"}
          </p>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <DocumentUploadPanel defaultProjectId={project.id} lockProject />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Datos de la licitación</CardTitle>
          <TenderMetaEditor
            projectId={project.id}
            tenderNumber={project.tender_number}
            tenderStatus={project.tender_status as TenderStatus | null}
            closingDate={project.closing_date}
          />
        </CardHeader>
        <CardContent>
          {!project.tender_number && !project.tender_status && !project.closing_date ? (
            <p className="text-sm text-muted-foreground">
              Esta carpeta todavía no tiene datos de licitación (N°, estado, fecha de cierre) — son
              opcionales. Complétalos con el lápiz si agrupa los documentos de una licitación puntual.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {project.tender_number && (
                <p><span className="font-medium">N°:</span> {project.tender_number}</p>
              )}
              {project.tender_status && (
                <Badge variant={statusVariant(project.tender_status)}>
                  {TENDER_STATUS_LABELS[project.tender_status as TenderStatus] ?? project.tender_status}
                </Badge>
              )}
              {project.closing_date && (
                <p>
                  <span className="font-medium">Cierre:</span> {formatDate(project.closing_date)}
                </p>
              )}
            </div>
          )}

          {docIds.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold leading-none">{documents?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">documentos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold leading-none">{systemsCount}</p>
                  <p className="text-xs text-muted-foreground">sistemas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold leading-none">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">puntos críticos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  {nextMilestone ? (
                    <>
                      <Link
                        href={`/documents/${nextMilestone.documentId}?tab=timeline`}
                        className="text-sm font-medium leading-none text-primary hover:underline"
                      >
                        {nextMilestone.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(nextMilestone.starts_on)} · próximo hito
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium leading-none text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground">sin próximo hito</p>
                    </>
                  )}
                </div>
              </div>
              {totalAmount > 0 && (
                <div className="col-span-2 text-xs text-muted-foreground sm:col-span-4">
                  Monto total de los documentos: <span className="font-medium text-foreground">{formatCLP(totalAmount)}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Table>
        <THead>
          <TR>
            <TH>Documento</TH><TH>Tipo</TH><TH>Fecha</TH><TH>Monto</TH><TH>Estado</TH><TH>&nbsp;</TH>
          </TR>
        </THead>
        <TBody>
          {(documents ?? []).map((d) => (
            <TR key={d.id}>
              <TD>
                <div className="flex items-center gap-1.5">
                  <Link href={`/documents/${d.id}`} className="font-medium text-primary hover:underline">
                    {d.title}
                  </Link>
                  <RenameDocumentButton documentId={d.id} title={d.title} />
                </div>
              </TD>
              <TD className="capitalize">{d.doc_type.replace(/_/g, " ")}</TD>
              <TD>{formatDate(d.doc_date)}</TD>
              <TD>{formatCLP(d.amount)}</TD>
              <TD>
                <Badge variant={statusVariant(d.status)}>
                  {d.status === "procesando" && d.processing_step
                    ? `procesando: ${STEP_LABELS[d.processing_step] ?? d.processing_step}`
                    : d.status}
                </Badge>
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <MoveToFolderButton documentId={d.id} currentProjectId={project.id} />
                  <DeleteDocumentButton documentId={d.id} title={d.title} redirectTo={null} />
                </div>
              </TD>
            </TR>
          ))}
          {(documents ?? []).length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-muted-foreground">
                Esta carpeta aún no tiene documentos. Súbelos con el botón{" "}
                <span className="font-medium">Subir documentos</span> de arriba.
              </TD>
            </TR>
          )}
        </TBody>
      </Table>

      <div className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <GitCompare className="h-4 w-4" /> Comparaciones ({(comparisons ?? []).length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Se archivan en sus propias subcarpetas, separadas de los documentos — moverlas aquí no
          afecta dónde están archivados los documentos que compararon.
        </p>
        {comparisonGroups.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay comparaciones archivadas en esta carpeta. Muévelas aquí desde el
            {" "}<Link href="/compare" className="text-primary hover:underline">Comparador</Link>.
          </p>
        ) : (
          [...comparisonGroups.entries()].map(([key, group]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {group.name} <span className="text-muted-foreground">({group.items.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR><TH>Comparación</TH><TH>Tipo</TH><TH>Fecha</TH><TH>Estado</TH></TR>
                  </THead>
                  <TBody>
                    {group.items.map((c) => (
                      <TR key={c.id}>
                        <TD>
                          <Link href={`/compare?r=${c.id}`} className="font-medium text-primary hover:underline">
                            {(c.source as unknown as { title: string } | null)?.title ?? "?"}{" "}
                            <span className="text-muted-foreground">vs</span>{" "}
                            {(c.target as unknown as { title: string } | null)?.title ?? "?"}
                          </Link>
                        </TD>
                        <TD className="text-xs">{COMPARISON_TYPE_LABELS[c.comparison_type] ?? c.comparison_type}</TD>
                        <TD>{formatDate(c.created_at)}</TD>
                        <TD>
                          {c.traffic_light ? (
                            <Badge variant={statusVariant(c.traffic_light)} className="uppercase">
                              {c.traffic_light}
                            </Badge>
                          ) : (
                            <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
