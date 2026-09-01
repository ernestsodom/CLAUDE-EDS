import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { ClaimAnalysisView, type ClaimAnalysis } from "@/components/claim-analysis-view";
import { ClaimResponses, type ClaimResponse } from "@/components/claim-responses";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Ficha del reclamo: el correo original, el análisis y todas las respuestas
 *  guardadas — consultables, editables y aprobables después de generarlas. */
export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const [{ data: claim }, { data: responses }] = await Promise.all([
    supabase
      .from("claims")
      .select("id, subject, raw_email, status, analysis, created_at, clients(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("claim_responses")
      .select("id, content, model, approved, created_at")
      .eq("claim_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!claim) notFound();
  const client = (claim.clients as unknown as { name: string } | null)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/compare?tab=reclamos" className="text-sm text-muted-foreground hover:underline">
            ← Reclamos
          </Link>
          <h1 className="text-2xl font-semibold">{claim.subject ?? "Reclamo sin asunto"}</h1>
          <p className="text-sm text-muted-foreground">
            {client ?? "Sin cliente"} · {formatDate(claim.created_at)}
          </p>
        </div>
        <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Correo del cliente</CardTitle></CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm">
            {claim.raw_email}
          </pre>
        </CardContent>
      </Card>

      {claim.analysis ? (
        <ClaimAnalysisView analysis={claim.analysis as ClaimAnalysis} />
      ) : (
        <p className="text-sm text-muted-foreground">Este reclamo aún no tiene análisis.</p>
      )}

      <ClaimResponses claimId={id} initialResponses={(responses ?? []) as ClaimResponse[]} />
    </div>
  );
}
