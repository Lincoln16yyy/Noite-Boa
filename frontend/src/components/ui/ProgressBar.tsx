import './ui.css';

export type ProgressTone = 'accent' | 'within' | 'below';

export interface ProgressBarProps {
  /** Valor de 0 a 100 (fora da faixa é cortado). */
  value: number;
  /** Nome acessível da barra (vira aria-label do role=progressbar). */
  label: string;
  /** Significado da cor: ação/destaque, dentro da meta ou abaixo da meta. */
  tone?: ProgressTone;
}

/**
 * Barra de progresso de 8 px (issue #208, seção 2 do guia): trilho
 * `--progress-track`, preenchimento por significado. Acessível via
 * role="progressbar" com valor numérico.
 */
export default function ProgressBar({ value, label, tone = 'accent' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const fillClasses = ['ui-progress__fill', tone !== 'accent' ? `ui-progress__fill--${tone}` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={fillClasses} style={{ width: `${pct}%` }} />
    </div>
  );
}
