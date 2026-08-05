import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/core/repositories/documents.repo";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import { DocumentFiltersBar } from "@/components/document-filters";
import type { DocumentType } from "@/core/domain/types";

export const metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

/** Panel de documentos con filtros avanzados (tipo, estado, texto) y paginación. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; estado?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { documents, total } = await listDocuments(supabase, {
    search: params.q,
    docType: params.tipo as DocumentType | undefined,
    status: params.estado,
    page,
    pageSize: 25,
  });
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">{total} en total</p>
      </div>

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
          </TR>
        </THead>
        <TBody>
          {documents.map((d) => (
            <TR key={d.id}>
              <TD>
                <Link href={`/documents/${d.id}`} className="font-medium text-primary hover:underline">
                  {d.title}
                </Link>
              </TD>
              <TD className="capitalize">{d.doc_type.replace(/_/g, " ")}</TD>
              <TD>{d.clients?.name ?? "—"}</TD>
              <TD>{d.tender_number ?? "—"}</TD>
              <TD>{formatDate(d.doc_date)}</TD>
              <TD>{formatCLP(d.amount)}</TD>
              <TD>
                <Badge variant={statusVariant(d.status)}>
                  {d.status === "procesando" && d.processing_step
                    ? `${d.status}: ${d.processing_step}`
                    : d.status}
                </Badge>
              </TD>
            </TR>
          ))}
          {documents.length === 0 && (
            <TR>
              <TD colSpan={7} className="py-8 text-center text-muted-foreground">
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
    </div>
  );
}
