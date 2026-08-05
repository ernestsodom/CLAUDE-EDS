"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const TYPES = [
  "licitacion", "bases_administrativas", "bases_tecnicas", "propuesta_comercial",
  "propuesta_tecnica", "carta_gantt", "contrato", "anexo", "reclamo", "informe",
  "acta", "avance", "control_entregas", "otro",
];
const STATUSES = ["subido", "procesando", "procesado", "error", "archivado"];

/** Barra de filtros de la tabla de documentos (URL-driven, compartible). */
export function DocumentFiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/documents?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => { e.preventDefault(); setParam("q", q); }}
        className="w-64"
      >
        <Input placeholder="Buscar por título…" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={searchParams.get("tipo") ?? ""}
        onChange={(e) => setParam("tipo", e.target.value)}
        aria-label="Filtrar por tipo"
      >
        <option value="">Todos los tipos</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => setParam("estado", e.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
