import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { buildDailySeries } from '../lib/dashboard';
import type { StatsSummary } from '../api/types';

/** Props de `SleepChart`. */
export interface SleepChartProps {
  /** Resumo do back-end (pode faltar `daily`); ver `buildDailySeries`. */
  summary: Pick<StatsSummary, 'daily'> | null;
  /** Número de dias da série. */
  days: number;
  /** Meta de horas (linha tracejada). */
  goalHours: number;
  /** Fuso do perfil para calcular os dias (default: o do aparelho). */
  timeZone?: string;
}

/**
 * Gráfico de barras das horas dormidas por dia com a linha da meta.
 * Carregado com React.lazy para não pesar no bundle inicial (Recharts é pesado).
 * Cores da identidade visual:
 * - Barras normais: Lavanda (#B9B6FF)
 * - Barras abaixo da meta: Âmbar (#FFB347)
 * - Linha da meta tracejada: Luar (#FFE9B5)
 */
export default function SleepChart({ summary, days, goalHours, timeZone }: SleepChartProps) {
  const data = buildDailySeries(summary, days, new Date(), timeZone);

  // Determina cor de cada barra baseado na meta
  const getBarColor = (hours: number): string =>
    hours > 0 && hours < goalHours ? 'var(--color-ambar)' : 'var(--color-lavanda)';

  return (
    <div
      role="img"
      aria-label={`Gráfico de barras das horas dormidas nos últimos ${days} dias, com a meta de ${goalHours} horas`}
      style={{ width: '100%', height: '240px' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-indigo)" opacity={0.15} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--color-lavanda)' }}
            interval={days > 7 ? 3 : 0}
            axisLine={{ stroke: 'var(--color-lavanda)', opacity: 0.3 }}
            tickLine={{ stroke: 'var(--color-lavanda)', opacity: 0.3 }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-lavanda)' }}
            domain={[0, 'auto']}
            width={45}
            axisLine={{ stroke: 'var(--color-lavanda)', opacity: 0.3 }}
            tickLine={{ stroke: 'var(--color-lavanda)', opacity: 0.3 }}
          />
          <Tooltip
            formatter={(value) => [`${value} h`, 'Dormido']}
            contentStyle={{
              backgroundColor: 'var(--color-noite)',
              border: '1px solid var(--color-lavanda)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-card)',
            }}
            labelStyle={{ color: 'var(--color-luar)', fontWeight: 700 }}
            itemStyle={{ color: 'var(--color-luar)' }}
          />
          <ReferenceLine
            y={goalHours}
            stroke="var(--color-luar)"
            strokeDasharray="6 4"
            strokeWidth={2}
            label={{
              // Acima da linha (fora da área das barras): antes, "insideTopRight"
              // encostava na última barra (#158).
              value: `Meta ${goalHours}h`,
              position: 'top',
              fontSize: 11,
              fill: 'var(--color-luar)',
              fontWeight: 700,
              offset: 6,
            }}
          />
          <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`bar-${index}`} fill={getBarColor(entry.hours)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}