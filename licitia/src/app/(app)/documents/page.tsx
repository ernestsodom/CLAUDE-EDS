import Link from "next/link";
import { Folder, FolderPlus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { listDocuments } from "@/core/repositories/documents.repo";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import { DocumentFiltersBar } from "@/components/document-filters";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { NewProjectButton } from "@/components/new-project-button";
import { DocumentUploadPanel } from "@/components/document-upload-panel";
import { RenameDocumentButton } from "@/components/rename-document-button";
import { MoveToFolderButton } from "@/components/move-to-folder-button";
import type { DocumentType } from "@/core/domain/types";
import { STEP_LABELS } from "@/core/services/ingestion.service";

export const metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

/**
 * Documentos: carpetas por cliente/proyecto y listado completo en una sola
 * pantalla. Antes eran dos opciones de menú («Documentos» y «Carpetas») que
 * mostraban lo mismo desde dos ángulos; ahora las carpetas son el índice y el
 * listado de abajo es la vista plana con filtros.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireUser();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [{ documents, total }, { data: projects }] = await Promise.all([
    listDocuments(supabase, {
      search: params.q,
      docType: params.tipo as DocumentType | undefined,
      status: params.estado,
      page,
      pageSize: 25,
    }),
    supabase
      .from("projects")
      .select("id, name, status, clients(name), documents(count)")
      .order("created_at", { ascending: false }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  const folders = (projects ?? []) as unknown as Array<{
    id: string;
    name: string;
    status: string;
    clients: { name: string } | null;
    documents: Array<{ count: number }>;
  }>;

  const byClient = new Map<string, typeof folders>();
  for (const f of folders) {
    const key = f.clients?.name ?? "Sin cliente";
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key)!.push(f);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            {total} documentos en {folders.length} {folders.length === 1 ? "carpeta" : "carpetas"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DocumentUploadPanel />
          <NewProjectButton />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Carpetas por cliente</h2>
        {folders.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <FolderPlus className="h-5 w-5 shrink-0" />
              Aún no hay carpetas. Créala aquí o directamente al subir un documento: cada carpeta
              agrupa todo lo de un proyecto (licitación, bases, contrato, control de entregas, actas
              y reclamos).
            </CardContent>
          </Card>
        ) : (
          [...byClient.entries()].map(([clientName, clientFolders]) => (
            <div key={clientName} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {clientName}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clientFolders.map((f) => (
                  <Link key={f.id} href={`/projects/${f.id}`}>
                    <Card className="transition-colors hover:border-primary/50">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.documents?.[0]?.count ?? 0} documentos
                          </p>
                        </div>
                        {f.status !== "activo" && <Badge variant="secondary">{f.status}</Badge>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Todos los documentos</h2>
        <DocumentFiltersBar />

        <Table>
          <THead>
            <TR>
              <TH>Título</TH>
              <TH>Tipo</TH>
              <TH>Cliente</TH>
              <TH>N° Licitación</TH>
              <TH>Fecha</TH>
              <TH>Monto</TH>
              <TH>Estado</TH>
              <TH>&nbsp;</TH>
            </TR>
          </THead>
          <TBody>
            {documents.map((d) => (
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
                <TD>{d.clients?.name ?? "—"}</TD>
                <TD>{d.tender_number ?? "—"}</TD>
                <TD>{formatDate(d.doc_date)}</TD>
                <TD>{formatCLP(d.amount)}</TD>
                <TD>
                  <Badge variant={statusVariant(d.status)}>
                    {d.status === "procesando" && d.processing_step
                      ? `${d.status}: ${STEP_LABELS[d.processing_step] ?? d.processing_step}`
                      : d.status}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <MoveToFolderButton documentId={d.id} currentProjectId={d.project_id} />
                    <DeleteDocumentButton documentId={d.id} title={d.title} redirectTo={null} />
                  </div>
                </TD>
              </TR>
            ))}
            {documents.length === 0 && (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-muted-foreground">
                  No hay documentos que coincidan con los filtros.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            {page > 1 && (
              <Link className="text-primary underline" href={`?page=${page - 1}`}>← Anterior</Link>
            )}
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            {page < totalPages && (
              <Link className="text-primary underline" href={`?page=${page + 1}`}>Siguiente →</Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
