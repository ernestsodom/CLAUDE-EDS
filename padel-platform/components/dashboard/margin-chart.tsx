'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode } from '@/types/database.types';

/**
 * Margen estimado vs real por venta (§52).
 *
 * Cuando una venta aun no tiene costos reales imputados, la barra "real"
 * no se dibuja: es preferible un hueco honesto a una barra que insinua un
 * margen del 100%.
 */
export function MarginChart({
  data,
  currency,
}: {
  data: { name: string; estimado: number; real: number | null }[];
  currency: CurrencyCode;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(32 32 32)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgb(115 115 115)', fontSize: 11 }}
            axisLine={{ stroke: 'rgb(32 32 32)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgb(115 115 115)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: 'rgb(21 21 21)' }}
            contentStyle={{
              background: 'rgb(21 21 21)',
              border: '1px solid rgb(48 48 48)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: 'rgb(245 245 245)', fontWeight: 600 }}
            formatter={(value, name) => [
              typeof value === 'number' ? formatMoney(value, currency) : 'sin costo real aun',
              name === 'estimado' ? 'Margen estimado' : 'Margen real',
            ]}
          />
          <Bar dataKey="estimado" fill="rgb(64 64 64)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="real" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.real !== null && entry.real < entry.estimado
                    ? 'rgb(255 176 32)' // por debajo de lo presupuestado
                    : 'rgb(255 90 0)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex items-center justify-center gap-4 text-2xs text-content-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[rgb(64,64,64)]" /> Estimado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent" /> Real
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-warning" /> Real por debajo del estimado
        </span>
      </div>
    </div>
  );
}
