import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecklistComparator } from "@/components/checklist-comparator";
import { CompareForm } from "@/components/compare-form";
import { ComparisonResult } from "@/components/comparison-result";

export const metadata = { title: "Comparador" };
export const dynamic = "force-dynamic";

/**
 * Comparador. Dos modos:
 *  1. Checklist vs Excel (el principal): los sistemas y funcionalidades que
 *     exige el documento base contra el Excel de control con formato
 *     predeterminado. Determinista, instantáneo y sin consumo de IA.
 *  2. Dos documentos: diferencias/cumplimiento entre documentos analizados.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

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
          Los sistemas y funcionalidades comprometidos en la licitación, bases técnicas o contrato,
          contra tu propio control de entregas — destacando lo que entregaste de más, incluido lo
          realizado sin costo.
        </p>
      </div>

      <Tabs defaultValue={params.r ? "documentos" : "checklist"}>
        <TabsList>
          <TabsTrigger value="checklist">Checklist vs Excel</TabsTrigger>
          <TabsTrigger value="documentos">Comparar dos documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist">
          <ChecklistComparator />
        </TabsContent>

        <TabsContent value="documentos">
          <div className="space-y-4">
            <CompareForm history={(history ?? []) as never} />
            {result && <ComparisonResult comparison={result} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
