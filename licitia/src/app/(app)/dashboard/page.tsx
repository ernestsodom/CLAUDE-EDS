import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatCLP, formatDate } from "@/lib/utils";
import { CRITICAL_TYPE_LABELS } from "@/core/ai/schemas";
import {
  DashboardKpis,
  type DashboardDrilldown,
  type DashboardTotals,
} from "@/components/dashboard-kpis";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type CriticalKey = keyof typeof CRITICAL_TYPE_LABELS;

/**
 * Dashboard ejecutivo. Cada KPI es desplegable: al pulsarlo muestra su
 * contenido real (qué documentos, qué clientes, qué licitaciones, qué falta
 * por procesar) con enlaces directos, en vez de dejar un número suelto.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: documents },
    { data: clients },
    { data: requirements },
    { data: systems },
    { data: features },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, doc_type, status, amount, doc_date, tender_number, tender_name, processing_step, processing_error, client_id, clients(name)")
      .is("parent_document_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("requirements").select("id, title, critical_type, document_id"),
    supabase.from("systems").select("id, document_id"),
    supabase.from("system_features").select("id, document_id, is_completed"),
    supabase
      .from("documents")
      .select("id, title, doc_type, status, amount, doc_date, clients(name)")
      .is("parent_document_id", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  type DocRow = {
    id: string; title: string; doc_type: string; status: string;
    amount: number | null; doc_date: string | null;
    tender_number: string | null; tender_name: string | null;
    processing_step: string | null; processing_error: string | null;
    client_id: string | null; clients: { name: string } | null;
  };
  const docs = (documents ?? []) as unknown as DocRow[];
  const titleOf = new Map(docs.map((d) => [d.id, d.title]));

  // ─── Clientes con su número de documentos ─────────────────────────────────
  const docsPerClient = new Map<string, number>();
  for (const d of docs) {
    if (d.client_id) docsPerClient.set(d.client_id, (docsPerClient.get(d.client_id) ?? 0) + 1);
  }
  const clientRows = (clients ?? [])
    .map((c) => ({ id: c.id as string, name: c.name as string, documents: docsPerClient.get(c.id) ?? 0 }))
    .sort((a, b) => b.documents - a.documents);

  // ─── Licitaciones (agrupadas por número) ──────────────────────────────────
  const tenderMap = new Map<string, { number: string; name: string | null; documents: number; amount: number | null }>();
  for (const d of docs) {
    if (!d.tender_number) continue;
    const t = tenderMap.get(d.tender_number) ?? {
      number: d.tender_number,
      name: d.tender_name,
      documents: 0,
      amount: null,
    };
    t.documents++;
    t.name = t.name ?? d.tender_name;
    // El monto de la licitación es el mayor de sus documentos: el total suele
    // repetirse en varios y sumarlos lo multiplicaría.
    if (d.amount != null) t.amount = Math.max(t.amount ?? 0, d.amount);
    tenderMap.set(d.tender_number, t);
  }
  const tenders = [...tenderMap.values()].sort((a, b) => b.documents - a.documents);

  // ─── Puntos críticos por tipo ─────────────────────────────────────────────
  const criticalMap = new Map<string, { count: number; samples: Array<{ id: string; title: string; document_id: string }> }>();
  for (const r of (requirements ?? []) as Array<{ id: string; title: string; critical_type: string | null; document_id: string }>) {
    const key = r.critical_type ?? "otros";
    const entry = criticalMap.get(key) ?? { count: 0, samples: [] };
    entry.count++;
    if (entry.samples.length < 4) entry.samples.push({ id: r.id, title: r.title, document_id: r.document_id });
    criticalMap.set(key, entry);
  }
  const critical = [...criticalMap.entries()]
    .map(([type, v]) => ({
      type,
      label: type === "otros" ? "Otros" : CRITICAL_TYPE_LABELS[type as CriticalKey] ?? type,
      ...v,
    }))
    .sort((a, b) => b.count - a.count);

  // ─── Avance del checklist de sistemas ─────────────────────────────────────
  const featureRows = (features ?? []) as Array<{ document_id: string; is_completed: boolean }>;
  const perDoc = new Map<string, { total: number; done: number }>();
  for (const f of featureRows) {
    const entry = perDoc.get(f.document_id) ?? { total: 0, done: 0 };
    entry.total++;
    if (f.is_completed) entry.done++;
    perDoc.set(f.document_id, entry);
  }
  const completedFeatures = featureRows.filter((f) => f.is_completed).length;

  // ─── Montos por cliente ───────────────────────────────────────────────────
  const amountByClient = new Map<string, number>();
  for (const d of docs) {
    if (d.amount == null) continue;
    const key = d.clients?.name ?? "Sin cliente";
    amountByClient.set(key, (amountByClient.get(key) ?? 0) + d.amount);
  }

  const pending = docs.filter((d) => d.status !== "procesado");

  const totals: DashboardTotals = {
    documents: docs.length,
    clients: clientRows.length,
    tenders: tenders.length,
    pending: pending.length,
    critical: (requirements ?? []).length,
    amount: docs.reduce((sum, d) => sum + (d.amount ?? 0), 0),
  };

  const drilldown: DashboardDrilldown = {
    documents: docs.slice(0, 12).map((d) => ({
      id: d.id,
      title: d.title,
      doc_type: d.doc_type,
      status: d.status,
      doc_date: d.doc_date,
      client: d.clients?.name ?? null,
    })),
    clients: clientRows,
    tenders,
    pending: pending.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      step: d.processing_step,
      error: d.processing_error,
    })),
    critical,
    systems: {
      systems: (systems ?? []).length,
      features: featureRows.length,
      completed: completedFeatures,
      pct: featureRows.length === 0 ? 0 : Math.round((completedFeatures / featureRows.length) * 100),
      byDocument: [...perDoc.entries()]
        .map(([id, v]) => ({
          id,
          title: titleOf.get(id) ?? "Documento",
          total: v.total,
          done: v.done,
          pct: Math.round((v.done / v.total) * 100),
        }))
        .sort((a, b) => b.total - a.total),
    },
    amounts: [...amountByClient.entries()]
      .map(([client, amount]) => ({ client, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
  };

  const byType = new Map<string, number>();
  for (const d of docs) byType.set(d.doc_type, (byType.get(d.doc_type) ?? 0) + 1);
  const maxType = Math.max(1, ...byType.values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard ejecutivo</h1>
        <p className="text-sm text-muted-foreground">
          Pulsa cualquier indicador para desplegar su contenido.
        </p>
      </div>

      <DashboardKpis totals={totals} data={drilldown} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos por tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byType.size === 0 && <p className="text-sm text-muted-foreground">Sin documentos aún.</p>}
            {[...byType.entries()]
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <Link
                  key={type}
                  href={`/documents?tipo=${type}`}
                  className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-accent"
                >
                  <span className="w-44 truncate capitalize">{type.replace(/_/g, " ")}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div className="h-full rounded bg-primary" style={{ width: `${(count / maxType) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{count}</span>
                </Link>
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
                Sube tu primer documento desde <Link href="/documents" className="text-primary underline">Documentos</Link>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
