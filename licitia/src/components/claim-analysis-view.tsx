import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";

export interface ClaimAnalysis {
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

function ListBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant?: "success" | "warning" | "danger";
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm">
              {variant && <Badge variant={variant} className="mt-1.5 h-1.5 w-1.5 rounded-full p-0" />}
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Análisis estructurado de un reclamo. Compartido por el taller y la ficha. */
export function ClaimAnalysisView({ analysis }: { analysis: ClaimAnalysis }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Análisis del reclamo</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 text-sm sm:col-span-2">
          <p><span className="font-medium">Reclama:</span> {analysis.que_reclama}</p>
          <p><span className="font-medium">Solicita:</span> {analysis.que_solicita}</p>
          {analysis.contrato_aplicable && (
            <p><span className="font-medium">Contrato aplicable:</span> {analysis.contrato_aplicable}</p>
          )}
        </div>
        <ListBlock title="Requerimientos relacionados" items={analysis.requerimientos_relacionados} />
        <ListBlock title="Ya entregado" items={analysis.ya_entregado} variant="success" />
        <ListBlock title="Pendiente" items={analysis.pendiente} variant="warning" />
        <ListBlock title="Fuera de contrato" items={analysis.fuera_de_contrato} variant="danger" />
        <ListBlock title="Mejoras adicionales realizadas" items={analysis.mejoras_adicionales} variant="success" />
        <div>
          <p className="mb-1 text-sm font-medium">Riesgos</p>
          {analysis.riesgos.length === 0 ? (
            <p className="text-xs text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1">
              {analysis.riesgos.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant={statusVariant(r.nivel)}>{r.nivel}</Badge> {r.riesgo}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
