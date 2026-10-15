import type { CSSProperties, ReactNode } from 'react';
import './ui.css';

export type RingTone = 'accent' | 'within' | 'below';

export interface RingProps {
  /** Nome acessível do anel (obrigatório: vira aria-label do role=img). */
  label: string;
  /** Valor atual (cortado entre 0 e `max`). */
  value: number;
  /** Máximo da escala (padrão 100). */
  max?: number;
  /** Diâmetro em px (padrão 120). */
  size?: number;
  /** Espessura do traço em px (padrão 10). */
  strokeWidth?: number;
  /** Significado da cor do arco. */
  tone?: RingTone;
  /** Conteúdo do centro (número de destaque). */
  children?: ReactNode;
}

/**
 * Anel de progresso (issue #208). `role="img"` + `aria-label` obrigatório
 * (WCAG) — o arco é gráfico, o número no centro é o conteúdo real.
 */
export default function Ring({
  label,
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  tone = 'accent',
  children,
}: RingProps) {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(1, value / safeMax));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const valueClasses = ['ui-ring__value', tone !== 'accent' ? `ui-ring__value--${tone}` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="ui-ring"
      style={
        {
          width: size,
          height: size,
          // Circunferência "vazia" para o keyframe da animação de preenchimento
          // (issue #216) saber de onde começar, sem tocar no atributo do arco.
          '--ui-ring-cheio': circumference,
        } as CSSProperties
      }
    >
      <svg
        className="ui-ring__svg"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        focusable="false"
      >
        <circle
          className="ui-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className={valueClasses}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children != null && <span className="ui-ring__center">{children}</span>}
    </div>
  );
}
