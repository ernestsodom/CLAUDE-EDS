'use client';

import { useRef, useState } from 'react';
import { Database, Loader2, Send } from 'lucide-react';
import { askAssistantAction } from '@/actions/ai';
import { Card } from '@/components/ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  sources?: { tool: string; rows: number }[];
}

const SUGGESTIONS = [
  'Que ventas tienen margen bajo',
  'Cuanto tenemos pendiente de cobro y de quien',
  'Que proyectos de fabricacion van retrasados',
  'Resumen financiero del proyecto',
];

/**
 * Asistente conversacional (FASE 14, §44).
 *
 * Cada respuesta muestra de que consultas sale. No es decoracion: si el
 * asistente dice una cifra, se puede ver que herramienta la produjo y
 * cuantas filas leyo. Una respuesta sin fuentes es una respuesta que no
 * ha mirado los datos, y eso conviene que se note.
 */
export function AssistantChat({ projectCode }: { projectCode: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setQuestion('');
    setError(null);
    setBusy(true);

    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const result = await askAssistantAction({ projectCode, question: trimmed, history });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTurns((prev) => [...prev, {
        role: 'assistant',
        content: result.data.text,
        sources: result.data.sources,
      }]);
      if (!result.data.ok && result.data.error) setError(result.data.error);
    } catch {
      setError('No se ha podido consultar. Intentalo de nuevo.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  return (
    <Card className="flex h-[36rem] flex-col p-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold">Asistente</h2>
        <p className="mt-0.5 text-2xs text-content-muted">
          Consulta datos reales de esta unidad de negocio. Solo ve lo que tu ves: las consultas
          se ejecutan con tu sesion y RLS decide.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-content-muted">Prueba con:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}
                  className="rounded border border-line bg-surface-2 px-3 py-1.5 text-2xs text-content-secondary transition hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) => (
          <div key={i} className={turn.role === 'user' ? 'flex justify-end' : ''}>
            <div className={
              turn.role === 'user'
                ? 'max-w-[80%] rounded-lg bg-accent/15 px-3.5 py-2.5 text-sm text-content'
                : 'max-w-[90%] space-y-2'
            }>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</p>
              {turn.sources && turn.sources.length > 0 ? (
                <p className="flex flex-wrap items-center gap-1.5 text-2xs text-content-muted">
                  <Database size={11} />
                  {turn.sources.map((s, j) => (
                    <span key={j} className="rounded border border-line px-1.5 py-0.5">
                      {s.tool}: {s.rows} filas
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        ))}

        {busy ? (
          <p className="flex items-center gap-2 text-sm text-content-muted">
            <Loader2 size={14} className="animate-spin" /> Consultando los datos...
          </p>
        ) : null}

        {error ? <p className="text-sm text-critical">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(question); }}
        className="flex gap-2 border-t border-line px-5 py-4"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta sobre ventas, cobros, fabricacion..."
          className="input flex-1"
          disabled={busy}
        />
        <button type="submit" className="btn-primary" disabled={busy || !question.trim()}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </Card>
  );
}
