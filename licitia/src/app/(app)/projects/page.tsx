import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder } from "lucide-react";
import { NewProjectButton } from "@/components/new-project-button";

export const metadata = { title: "Carpetas" };
export const dynamic = "force-dynamic";

/** Carpetas de proyecto: una por cliente/proyecto, con todo lo relacionado. */
export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, clients(name), documents(count)")
    .order("created_at", { ascending: false });

  const rows = (projects ?? []) as unknown as Array<{
    id: string;
    name: string;
    status: string;
    clients: { name: string } | null;
    documents: Array<{ count: number }>;
  }>;

  // Agrupar por cliente para lectura tipo explorador
  const byClient = new Map<string, typeof rows>();
  for (const p of rows) {
    const key = p.clients?.name ?? "Sin cliente";
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key)!.push(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Carpetas</h1>
          <p className="text-sm text-muted-foreground">
            Una carpeta por cliente/proyecto con todos sus documentos: licitación, bases,
            contrato, control de entregas, actas y reclamos.
          </p>
        </div>
        <NewProjectButton />
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no hay carpetas. Créala aquí o directamente al subir un documento.
        </p>
      )}

      {[...byClient.entries()].map(([clientName, clientProjects]) => (
        <section key={clientName} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{clientName}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.documents?.[0]?.count ?? 0} documentos
                      </p>
                    </div>
                    {p.status !== "activo" && <Badge variant="secondary">{p.status}</Badge>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
