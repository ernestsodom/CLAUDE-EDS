import { createClient } from "@/lib/supabase/server";
import { CompareForm } from "@/components/compare-form";
import { ComparisonResult } from "@/components/comparison-result";

export const metadata = { title: "Comparador" };
export const dynamic = "force-dynamic";

/** Comparador: cumplimiento (licitación vs avances) y diferencias entre documentos. */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, doc_type")
    .eq("status", "procesado")
    .is("parent_document_id", null)
    .order("created_at", { ascending: false })
    .limit(200);

  let result = null;
  if (params.r) {
    const { data } = await supabase
      .from("comparisons")
      .select("*, comparison_items(*), source:documents!comparisons_source_document_id_fkey(title), target:documents!comparisons_target_document_id_fkey(title)")
      .eq("id", params.r)
      .maybeSingle();
    result = data;
  }

  const { data: history } = await supabase
    .from("comparisons")
    .select("id, comparison_type, status, traffic_light, created_at, source:documents!comparisons_source_document_id_fkey(title), target:documents!comparisons_target_document_id_fkey(title)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Control de cumplimiento</h1>
        <p className="text-sm text-muted-foreground">
          Lo comprometido (licitación, bases técnicas o contrato) contra lo realmente entregado
          según tu propio documento de control — incluyendo trabajos adicionales fuera de acuerdo
          y realizados sin costo. También permite comparar diferencias entre dos documentos.
        </p>
      </div>

      <CompareForm documents={documents ?? []} history={(history ?? []) as never} />

      {result && <ComparisonResult comparison={result} />}
    </div>
  );
}
