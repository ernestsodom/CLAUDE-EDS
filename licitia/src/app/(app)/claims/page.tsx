import { createClient } from "@/lib/supabase/server";
import { ClaimsWorkbench } from "@/components/claims-workbench";

export const metadata = { title: "Reclamos" };
export const dynamic = "force-dynamic";

/** Módulo de reclamos: pega el correo, la IA analiza contra la biblioteca
 *  contractual y redacta la respuesta profesional con evidencia. */
export default async function ClaimsPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: claims }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("claims")
      .select("id, subject, status, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reclamos</h1>
        <p className="text-sm text-muted-foreground">
          Análisis automático del reclamo y redacción de respuesta fundada en el contrato,
          la licitación y los avances — siempre con evidencia citada.
        </p>
      </div>
      <ClaimsWorkbench clients={clients ?? []} recentClaims={(claims ?? []) as never} />
    </div>
  );
}
