"use client";

import { useState } from "react";
import { Check, Loader2, PenLine, Save } from "lucide-react";
import { saveClaimResponse, toggleClaimResponseApproval } from "@/actions/claim-responses";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { EngineSelector } from "@/components/engine-selector";
import type { AnalysisMode } from "@/lib/ai-providers";

export interface ClaimResponse {
  id: string;
  content: string;
  model: string | null;
  approved: boolean;
  created_at: string;
}

/**
 * Respuestas de un reclamo: quedan guardadas y se pueden volver a ver, editar
 * y aprobar. El borrador de la IA es un punto de partida — lo que se envía al
 * cliente es lo que aquí se revisa y se marca como aprobado.
 */
export function ClaimResponses({
  claimId,
  initialResponses,
}: {
  claimId: string;
  initialResponses: ClaimResponse[];
}) {
  const [responses, setResponses] = useState<ClaimResponse[]>(initialResponses);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("gemini");

  const contentOf = (r: ClaimResponse) => drafts[r.id] ?? r.content;
  const isDirty = (r: ClaimResponse) => drafts[r.id] != null && drafts[r.id] !== r.content;

  async function save(response: ClaimResponse) {
    setBusy(response.id);
    setError(null);
    const content = contentOf(response);
    const { error: dbError } = await saveClaimResponse(response.id, content);
    if (dbError) setError(`No se pudo guardar: ${dbError}`);
    else {
      setResponses((prev) => prev.map((r) => (r.id === response.id ? { ...r, content } : r)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[response.id];
        return next;
      });
    }
    setBusy(null);
  }

  async function approve(response: ClaimResponse) {
    setBusy(response.id);
    setError(null);
    const approved = !response.approved;
    const { error: dbError } = await toggleClaimResponseApproval(response.id, approved);
    if (dbError) setError(`No se pudo aprobar: ${dbError}`);
    else setResponses((prev) => prev.map((r) => (r.id === response.id ? { ...r, approved } : r)));
    setBusy(null);
  }

  async function draftNew() {
    setBusy("new");
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error redactando la respuesta");
      setResponses((prev) => [
        {
          id: json.responseId,
          content: json.content,
          model: json.model ?? null,
          approved: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          Respuestas ({responses.length})
        </h2>
        <EngineSelector value={mode} onChange={setMode} hideLocal hideAuto compact />
        <Button variant="secondary" size="sm" onClick={draftNew} disabled={busy !== null}>
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          Redactar {responses.length > 0 ? "otra respuesta" : "respuesta"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {responses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no hay respuestas. Redacta la primera con la evidencia contractual del análisis.
        </p>
      )}

      {responses.map((response) => (
        <Card key={response.id}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Borrador del {formatDate(response.created_at)}
              {response.model && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {response.model}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {response.approved && <Badge variant="success">aprobada</Badge>}
              {isDirty(response) && (
                <Button size="sm" onClick={() => save(response)} disabled={busy === response.id}>
                  {busy === response.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar
                </Button>
              )}
              <Button
                variant={response.approved ? "ghost" : "outline"}
                size="sm"
                onClick={() => approve(response)}
                disabled={busy === response.id}
              >
                <Check className="h-4 w-4" />
                {response.approved ? "Quitar aprobación" : "Aprobar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              rows={14}
              value={contentOf(response)}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [response.id]: e.target.value }))
              }
              className="font-sans text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Borrador generado con evidencia contractual citada. Edítalo y guárdalo antes de
              enviarlo; queda registrado aquí para consultarlo después.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
