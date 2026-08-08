"use client";

import { useEffect, useState } from "react";

import type { ProviderId } from "@/lib/ai-providers";

export interface AiProvider {
  id: ProviderId;
  label: string;
  supportsEmbeddings: boolean;
  supportsFiles: boolean;
  /** Se cobra por uso desde el primer token (hoy: Claude). */
  isPaid: boolean;
}

let cache: AiProvider[] | null = null;
let inflight: Promise<AiProvider[]> | null = null;

function fetchProviders(): Promise<AiProvider[]> {
  return fetch("/api/ai/providers")
    .then((res) => (res.ok ? res.json() : { providers: [] }))
    .then((json): AiProvider[] => json.providers ?? [])
    .catch((): AiProvider[] => []);
}

/** Proveedores de IA con API key configurada (además de "Sin IA", siempre disponible). */
export function useAiProviders(): { providers: AiProvider[]; loading: boolean } {
  const [providers, setProviders] = useState<AiProvider[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = fetchProviders();
    inflight.then((p) => {
      cache = p;
      setProviders(p);
      setLoading(false);
    });
  }, []);

  return { providers, loading };
}
