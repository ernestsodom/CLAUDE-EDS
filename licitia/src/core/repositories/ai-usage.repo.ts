import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCostUsd } from "@/lib/ai-usage-pricing";
import type { ProviderId } from "@/lib/ai-providers";

// ============================================================================
// Agregación del consumo de IA para la pantalla "Uso de IA". RLS ya limita
// ai_usage_log a la organización del usuario, así que aquí solo se suma lo
// que la consulta trajo — sin cálculos de permisos.
// ============================================================================

export interface ProviderTotals {
  provider: ProviderId;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface UsageSummary {
  today: ProviderTotals[];
  thisMonth: ProviderTotals[];
  overall: ProviderTotals[];
  byFeature: Array<{ feature: string; requests: number; inputTokens: number; outputTokens: number }>;
  recent: Array<{
    id: string;
    provider: ProviderId;
    model: string;
    feature: string;
    inputTokens: number;
    outputTokens: number;
    documentTitle: string | null;
    createdAt: string;
  }>;
  /** true si el histórico tiene más filas de las traídas — "overall" es un
   *  piso, no el total exacto desde el principio de los tiempos. */
  truncated: boolean;
}

const ROW_LIMIT = 20_000;
const PROVIDERS: ProviderId[] = ["gemini", "groq", "claude"];

function emptyTotals(): Record<ProviderId, ProviderTotals> {
  return {
    gemini: { provider: "gemini", requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    groq: { provider: "groq", requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    claude: { provider: "claude", requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
}

export async function getUsageSummary(supabase: SupabaseClient): Promise<UsageSummary> {
  const { data, count } = await supabase
    .from("ai_usage_log")
    .select("id, provider, model, feature, input_tokens, output_tokens, created_at, documents(title)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT);

  const rows = data ?? [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const today = emptyTotals();
  const thisMonth = emptyTotals();
  const overall = emptyTotals();
  const featureTotals = new Map<string, { requests: number; inputTokens: number; outputTokens: number }>();

  for (const r of rows) {
    const provider = r.provider as ProviderId;
    if (!PROVIDERS.includes(provider)) continue;
    const createdAt = new Date(r.created_at);
    const cost = estimateCostUsd(provider, r.model, r.input_tokens, r.output_tokens) ?? 0;

    const add = (bucket: Record<ProviderId, ProviderTotals>) => {
      bucket[provider].requests++;
      bucket[provider].inputTokens += r.input_tokens;
      bucket[provider].outputTokens += r.output_tokens;
      bucket[provider].costUsd += cost;
    };
    add(overall);
    if (createdAt >= startOfMonth) add(thisMonth);
    if (createdAt >= startOfToday) add(today);

    const f = featureTotals.get(r.feature) ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
    f.requests++;
    f.inputTokens += r.input_tokens;
    f.outputTokens += r.output_tokens;
    featureTotals.set(r.feature, f);
  }

  const recent = rows.slice(0, 25).map((r) => ({
    id: r.id,
    provider: r.provider as ProviderId,
    model: r.model,
    feature: r.feature,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    documentTitle: (r.documents as unknown as { title: string } | null)?.title ?? null,
    createdAt: r.created_at,
  }));

  return {
    today: PROVIDERS.map((p) => today[p]),
    thisMonth: PROVIDERS.map((p) => thisMonth[p]),
    overall: PROVIDERS.map((p) => overall[p]),
    byFeature: [...featureTotals.entries()]
      .map(([feature, t]) => ({ feature, ...t }))
      .sort((a, b) => b.requests - a.requests),
    recent,
    truncated: (count ?? 0) > rows.length,
  };
}
