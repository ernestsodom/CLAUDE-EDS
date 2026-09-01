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
    .select("id, name, description, status, clients(name)")
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
          <Link href="/documents" className="text-sm text-muted-foreground hover:underline">
            ← Todas las carpetas
          </Link>
          <DocumentUploadPanel defaultProjectId={project.id} lockProject />
        </div>
      </div>

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
                    ? `procesando: ${d.processing_step}`
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
