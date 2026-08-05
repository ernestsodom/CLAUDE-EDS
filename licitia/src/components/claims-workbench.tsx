"use client";

import { useState } from "react";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface ClaimAnalysis {
  que_reclama: string;
  que_solicita: string;
  contrato_aplicable: string | null;
  requerimientos_relacionados: string[];
  ya_entregado: string[];
  pendiente: string[];
  fuera_de_contrato: string[];
  mejoras_adicionales: string[];
  riesgos: Array<{ riesgo: string; nivel: string }>;
}

export function ClaimsWorkbench({
  clients,
  recentClaims,
}: {
  clients: Array<{ id: string; name: string }>;
  recentClaims: Array<{ id: string; subject: string | null; status: string; created_at: string; clients: { name: string } | null }>;
}) {
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ClaimAnalysis | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyze" | "respond" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy("analyze");
    setError(null);
    setResponse(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawEmail: email, clientId: clientId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error analizando");
      setClaimId(json.claimId);
      setAnalysis(json.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function respond() {
    if (!claimId) return;
    setBusy("respond");
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/respond`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error redactando");
      setResponse(json.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  const listBlock = (title: string, items: string[], variant?: "success" | "warning" | "danger") => (
    <div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm">
              {variant && <Badge variant={variant} className="mt-0.5 h-1.5 w-1.5 rounded-full p-0" />}
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Textarea
              rows={8}
              placeholder="Pega aquí el correo de reclamo del cliente…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Cliente (autodetectar)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={analyze} disabled={busy !== null || email.trim().length < 20}>
                {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analizar reclamo
              </Button>
              {analysis && (
                <Button variant="secondary" onClick={respond} disabled={busy !== null}>
                  {busy === "respond" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Redactar respuesta
                </Button>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {analysis && (
          <Card>
            <CardHeader><CardTitle className="text-base">Análisis del reclamo</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1 text-sm">
                <p><span className="font-medium">Reclama:</span> {analysis.que_reclama}</p>
                <p><span className="font-medium">Solicita:</span> {analysis.que_solicita}</p>
                {analysis.contrato_aplicable && (
                  <p><span className="font-medium">Contrato aplicable:</span> {analysis.contrato_aplicable}</p>
                )}
              </div>
              {listBlock("Requerimientos relacionados", analysis.requerimientos_relacionados)}
              {listBlock("Ya entregado", analysis.ya_entregado, "success")}
              {listBlock("Pendiente", analysis.pendiente, "warning")}
              {listBlock("Fuera de contrato", analysis.fuera_de_contrato, "danger")}
              {listBlock("Mejoras adicionales realizadas", analysis.mejoras_adicionales, "success")}
              <div>
                <p className="mb-1 text-sm font-medium">Riesgos</p>
                <ul className="space-y-1">
                  {analysis.riesgos.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Badge variant={statusVariant(r.nivel)}>{r.nivel}</Badge> {r.riesgo}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {response && (
          <Card>
            <CardHeader><CardTitle className="text-base">Respuesta redactada</CardTitle></CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm">{response}</pre>
              <p className="mt-2 text-xs text-muted-foreground">
                Borrador generado con evidencia contractual citada. Revisa y aprueba antes de enviar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Reclamos recientes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentClaims.map((c) => (
            <div key={c.id} className="rounded-md border p-2 text-xs">
              <p className="truncate font-medium">{c.subject ?? "(sin asunto)"}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                <span className="text-muted-foreground">
                  {c.clients?.name ?? "—"} · {formatDate(c.created_at)}
                </span>
              </div>
            </div>
          ))}
          {recentClaims.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin reclamos registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
