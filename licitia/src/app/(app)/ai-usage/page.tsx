import { createClient } from "@/lib/supabase/server";
import { getUsageSummary, type ProviderTotals } from "@/core/repositories/ai-usage.repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { FEATURE_LABELS, type UsageFeature } from "@/core/services/ai-usage.service";
import { ENGINE_LABELS, type ProviderId } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

const PROVIDER_ORDER: ProviderId[] = ["gemini", "groq", "claude"];

const dateTimeFmt = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" });

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  return n === 0 ? "—" : `US$ ${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Una fila de totales (hoy/mes/total) para un proveedor. */
function ProviderRow({ t, isPaid }: { t: ProviderTotals; isPaid: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{ENGINE_LABELS[t.provider]}</span>
      <span className="text-right tabular-nums">
        {t.requests === 0 ? (
          "—"
        ) : (
          <>
            {fmtTokens(t.inputTokens + t.outputTokens)} tok · {t.requests}{" "}
            {t.requests === 1 ? "llamado" : "llamados"}
            {isPaid && <span className="ml-2 font-medium text-foreground">{fmtUsd(t.costUsd)}</span>}
          </>
        )}
      </span>
    </div>
  );
}

function PeriodCard({ title, totals }: { title: string; totals: ProviderTotals[] }) {
  const isPaid = (p: ProviderId) => p === "claude";
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {PROVIDER_ORDER.map((id) => {
          const t = totals.find((x) => x.provider === id);
          return t ? <ProviderRow key={id} t={t} isPaid={isPaid(id)} /> : null;
        })}
      </CardContent>
    </Card>
  );
}

/** Ficha de consumo de IA: cuánto se ha usado cada motor (Gemini, Groq,
 *  Claude Haiku 4.5) y en qué — medido por LicitIA a partir de los tokens
 *  reales que cada proveedor reportó en cada respuesta. */
export default async function AiUsagePage() {
  const supabase = await createClient();
  const summary = await getUsageSummary(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Uso de IA</h1>
        <p className="text-sm text-muted-foreground">
          Consumo real de cada motor de IA, medido a partir de los tokens que el propio proveedor
          reporta en cada respuesta — no una estimación.
        </p>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="space-y-1.5 p-4 text-sm">
          <p>
            <span className="font-medium">Gemini y Groq</span> no exponen un saldo o crédito
            restante por API con una API key normal — solo límites de tasa por minuto/día,
            visibles en el panel de cada uno (
            <span className="font-medium">Google AI Studio</span> /{" "}
            <span className="font-medium">Groq Console</span>). Lo que ves aquí es lo que{" "}
            <span className="font-medium">LicitIA consumió</span>, que es exacto, no un saldo de cuenta.
          </p>
          <p>
            <span className="font-medium">Claude Haiku 4.5</span> es el único motor de pago: el
            costo mostrado se calcula con los tokens reales de cada llamado y el precio publicado
            por Anthropic (US$1 / US$5 por millón de tokens de entrada / salida).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <PeriodCard title="Hoy" totals={summary.today} />
        <PeriodCard title="Este mes" totals={summary.thisMonth} />
        <PeriodCard title={summary.truncated ? "Total (últimos registros)" : "Total"} totals={summary.overall} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por función</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byFeature.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay consumo registrado.</p>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Función</TH><TH>Llamados</TH><TH>Tokens</TH></TR>
                </THead>
                <TBody>
                  {summary.byFeature.map((f) => (
                    <TR key={f.feature}>
                      <TD>{FEATURE_LABELS[f.feature as UsageFeature] ?? f.feature}</TD>
                      <TD>{f.requests}</TD>
                      <TD>{fmtTokens(f.inputTokens + f.outputTokens)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay consumo registrado.</p>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Motor</TH><TH>Función</TH><TH>Documento</TH><TH>Tokens</TH><TH>Fecha</TH></TR>
                </THead>
                <TBody>
                  {summary.recent.map((r) => (
                    <TR key={r.id}>
                      <TD><Badge variant="secondary">{ENGINE_LABELS[r.provider]}</Badge></TD>
                      <TD className="text-xs">{FEATURE_LABELS[r.feature as UsageFeature] ?? r.feature}</TD>
                      <TD className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {r.documentTitle ?? "—"}
                      </TD>
                      <TD className="text-xs">{fmtTokens(r.inputTokens + r.outputTokens)}</TD>
                      <TD className="text-xs">{dateTimeFmt.format(new Date(r.createdAt))}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
