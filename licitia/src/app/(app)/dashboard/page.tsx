import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText, Users, Landmark, Clock, CircleDollarSign, ListChecks } from "lucide-react";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/** Dashboard ejecutivo: KPIs vía RPC dashboard_stats + últimos documentos. */
export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: stats }, { data: recent }] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase
      .from("documents")
      .select("id, title, doc_type, status, amount, doc_date, clients(name)")
      .is("parent_document_id", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const s = (stats ?? {}) as Record<string, number | Record<string, number>>;
  const kpis = [
    { label: "Documentos", value: s.total_documents ?? 0, icon: FileText },
    { label: "Clientes", value: s.total_clients ?? 0, icon: Users },
    { label: "Licitaciones", value: s.total_tenders ?? 0, icon: Landmark },
    { label: "Pendientes", value: s.pending_documents ?? 0, icon: Clock },
    { label: "Requerimientos", value: s.total_requirements ?? 0, icon: ListChecks },
    { label: "Monto total", value: formatCLP(Number(s.total_amount ?? 0)), icon: CircleDollarSign },
  ];

  const byType = (s.by_type ?? {}) as Record<string, number>;
  const maxType = Math.max(1, ...Object.values(byType));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard ejecutivo</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{String(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos por tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(byType).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin documentos aún.</p>
            )}
            {Object.entries(byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <span className="w-44 truncate capitalize">{type.replace(/_/g, " ")}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${(count / maxType) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(recent ?? []).map((d) => (
              <Link
                key={d.id}
                href={`/documents/${d.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(d.clients as unknown as { name: string } | null)?.name ?? "Sin cliente"} ·{" "}
                    {formatDate(d.doc_date)} · {formatCLP(d.amount)}
                  </p>
                </div>
                <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
              </Link>
            ))}
            {(recent ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sube tu primer documento en <Link href="/upload" className="text-primary underline">Subir</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
