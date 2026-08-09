import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/format';
import type { CurrencyCode, SaleCostVariance } from '@/types/database.types';

/**
 * Estimado vs real por categoria de costo (§52, §53).
 *
 * La desviacion se marca cuando supera el umbral configurable del
 * proyecto. Un sobrecosto del 18% en logistica debe saltar a la vista sin
 * que nadie tenga que restar mentalmente.
 */
export function CostVarianceTable({
  rows,
  currency,
  thresholdPct = 10,
}: {
  rows: SaleCostVariance[];
  currency: CurrencyCode;
  thresholdPct?: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 pb-4 text-sm text-content-muted">
        Todavia no hay costos registrados para esta venta.
      </p>
    );
  }

  const grouped = rows.reduce<Record<string, SaleCostVariance[]>>((acc, row) => {
    (acc[row.cost_group] ??= []).push(row);
    return acc;
  }, {});

  const totalEstimated = rows.reduce((sum, r) => sum + Number(r.estimated_amount), 0);
  const totalActual = rows.reduce((sum, r) => sum + Number(r.actual_amount), 0);
  const totalDeviation = totalActual - totalEstimated;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-line bg-elevated/40 text-2xs uppercase tracking-wider text-content-muted">
            <th className="px-4 py-2 text-left font-semibold">Categoria</th>
            <th className="px-4 py-2 text-right font-semibold">Estimado</th>
            <th className="px-4 py-2 text-right font-semibold">Real</th>
            <th className="px-4 py-2 text-right font-semibold">Desviacion</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped).map(([group, groupRows]) => (
            <>
              <tr key={group} className="bg-elevated/20">
                <td
                  colSpan={4}
                  className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-content-muted"
                >
                  {group}
                </td>
              </tr>
              {groupRows.map((row) => {
                const over = (row.deviation_pct ?? 0) > thresholdPct;
                const under = row.deviation_amount < 0;
                return (
                  <tr
                    key={`${group}-${row.category_code}`}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2 pl-6">{row.category_name}</td>
                    <td className="tabular px-4 py-2 text-right text-content-secondary">
                      {formatMoney(row.estimated_amount, currency)}
                    </td>
                    <td className="tabular px-4 py-2 text-right">
                      {row.actual_amount > 0 ? formatMoney(row.actual_amount, currency) : '—'}
                    </td>
                    <td
                      className={cn(
                        'tabular px-4 py-2 text-right font-medium',
                        over ? 'text-critical' : under ? 'text-success' : 'text-content-muted',
                      )}
                    >
                      {row.actual_amount > 0 ? (
                        <>
                          {row.deviation_amount > 0 ? '+' : ''}
                          {formatMoney(row.deviation_amount, currency)}
                          <span className="ml-1 text-2xs">({formatPercent(row.deviation_pct)})</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line-strong">
            <td className="px-4 py-3 text-xs font-medium text-content-muted">Total</td>
            <td className="tabular px-4 py-3 text-right font-semibold">
              {formatMoney(totalEstimated, currency)}
            </td>
            <td className="tabular px-4 py-3 text-right font-semibold">
              {formatMoney(totalActual, currency)}
            </td>
            <td
              className={cn(
                'tabular px-4 py-3 text-right font-semibold',
                totalDeviation > 0 ? 'text-critical' : 'text-success',
              )}
            >
              {totalDeviation > 0 ? '+' : ''}
              {formatMoney(totalDeviation, currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
