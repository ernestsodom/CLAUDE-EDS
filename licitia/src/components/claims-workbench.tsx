"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { ClaimAnalysisView, type ClaimAnalysis } from "@/components/claim-analysis-view";
import { EngineSelector } from "@/components/engine-selector";
import type { AnalysisMode } from "@/lib/ai-providers";
import { formatDate } from "@/lib/utils";

/**
 * Taller de reclamos: se pega el correo, la IA lo analiza contra la evidencia
 * documental y el reclamo queda GUARDADO. La redacción y revisión de la
 * respuesta ocurren en la ficha del reclamo (/claims/:id), que se puede
 * volver a abrir cuantas veces haga falta.
 */
export function ClaimsWorkbench({
  clients,
  recentClaims,
}: {
  clients: Array<{ id: string; name: string }>;
  recentClaims: Array<{
    id: string;
    subject: string | null;
    status: string;
    created_at: string;
    clients: { name: string } | null;
  }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [clientId, setClientId] = useState("");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("gemini");

  async function analyze() {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawEmail: email,
          clientId: clientId || null,
          mode,
          ...(subject.trim() ? { subject: subject.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error analizando");
      setClaimId(json.claimId);
      setAnalysis(json.analysis);
      // El reclamo ya está guardado: refrescar deja la lista al día.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Input
              placeholder="Asunto (opcional — si lo dejas vacío se toma del análisis)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              rows={8}
              placeholder="Pega aquí el correo de reclamo del cliente…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="space-y-1">
              <p className="text-xs font-medium">Motor de análisis</p>
              <EngineSelector value={mode} onChange={setMode} hideLocal hideAuto />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                aria-label="Cliente"
              >
                <option value="">Cliente (autodetectar)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={analyze} disabled={busy || email.trim().length < 20}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analizar y guardar reclamo
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {analysis && claimId && (
          <>
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  Reclamo guardado. Redacta y revisa la respuesta en su ficha — queda registrada
                  para consultarla cuando quieras.
                </span>
                <Link href={`/claims/${claimId}`}>
                  <Button size="sm">
                    Abrir ficha del reclamo <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <ClaimAnalysisView analysis={analysis} />
          </>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Reclamos recientes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentClaims.map((c) => (
            <Link
              key={c.id}
              href={`/claims/${c.id}`}
              className="block rounded-md border p-2 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <p className="truncate font-medium">{c.subject ?? "(sin asunto)"}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                <span className="text-muted-foreground">
                  {c.clients?.name ?? "—"} · {formatDate(c.created_at)}
                </span>
              </div>
            </Link>
          ))}
          {recentClaims.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin reclamos registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
