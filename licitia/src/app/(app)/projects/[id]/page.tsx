import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import { Folder } from "lucide-react";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { RenameDocumentButton } from "@/components/rename-document-button";
import { MoveToFolderButton } from "@/components/move-to-folder-button";

export const dynamic = "force-dynamic";

/** Carpeta de proyecto: todos los documentos del cliente/proyecto en un lugar. */
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, status, clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, doc_type, status, doc_date, amount, processing_step")
    .eq("project_id", id)
    .is("parent_document_id", null)
    .order("created_at", { ascending: false });

  const client = (project.clients as unknown as { name: string } | null)?.name;

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
    </div>
  );
}
