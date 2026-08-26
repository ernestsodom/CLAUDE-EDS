import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChecklistComparator } from "@/components/checklist-comparator";
import { CompareForm } from "@/components/compare-form";
import { ComparisonResult } from "@/components/comparison-result";
import { ClaimsWorkbench } from "@/components/claims-workbench";
import { ComparativeMatrixPanel } from "@/components/comparative-matrix-panel";

export const metadata = { title: "Comparador" };
export const dynamic = "force-dynamic";

/**
 * Comparador. Cuatro modos:
 *  1. Checklist vs Excel (el principal): los sistemas y funcionalidades que
 *     exige el documento base contra el Excel de control con formato
 *     predeterminado. Determinista, instantáneo y sin consumo de IA.
 *  2. Dos documentos: diferencias/cumplimiento entre documentos analizados.
 *  3. Cuadro comparativo: varias licitaciones lado a lado en un Excel (número,
 *     cliente, software, plazos, presupuesto, servidores, multas, SLA,
 *     experiencia, migración, certificaciones, pauta de evaluación).
 *  4. Reclamos: análisis de reclamos contra la biblioteca contractual — vive
 *     aquí porque también es, en esencia, comparar lo reclamado contra lo
 *     acordado y lo entregado.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let result = null;
  if (params.r) {
    const { data } = await supabase
      .from("comparisons")
      .select("*, comparison_items(*), comparison_folders(name), source:documents!comparisons_source_document_id_fkey(title), target:documents!comparisons_target_document_id_fkey(title)")
      .eq("id", params.r)
      .maybeSingle();
    result = data;
  }

  const [{ data: history }, { data: clients }, { data: claims }, { data: allDocuments }] = await Promise.all([
    supabase
      .from("comparisons")
      .select("id, comparison_type, status, traffic_light, created_at, source:documents!comparisons_source_document_id_fkey(title), target:documents!comparisons_target_document_id_fkey(title)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("claims")
      .select("id, subject, status, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select("id, title, status, tender_number, clients(name)")
      .is("parent_document_id", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const comparativeDocuments = (allDocuments ?? []).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    status: d.status as string,
    tender_number: d.tender_number as string | null,
    client_name: (d.clients as unknown as { name: string } | null)?.name ?? null,
  }));

  const defaultTab =
    params.tab === "reclamos" ? "reclamos" : params.tab === "cuadro" ? "cuadro" : params.r ? "documentos" : "checklist";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Control de cumplimiento</h1>
        <p className="text-sm text-muted-foreground">
          Los sistemas y funcionalidades comprometidos en la licitación, bases técnicas o contrato,
          contra tu propio control de entregas — destacando lo que entregaste de más, incluido lo
          realizado sin costo. Los reclamos también viven aquí: es la misma lógica de comparar lo
          reclamado contra lo acordado.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="checklist">Checklist vs Excel</TabsTrigger>
          <TabsTrigger value="documentos">Comparar dos documentos</TabsTrigger>
          <TabsTrigger value="cuadro">Cuadro comparativo</TabsTrigger>
          <TabsTrigger value="reclamos">Reclamos ({claims?.length ?? 0})</TabsTrigger>
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

        <TabsContent value="cuadro">
          <ComparativeMatrixPanel documents={comparativeDocuments} />
        </TabsContent>

        <TabsContent value="reclamos">
          <ClaimsWorkbench clients={clients ?? []} recentClaims={(claims ?? []) as never} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
