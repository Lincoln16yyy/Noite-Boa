import type { CSSProperties, ReactNode } from 'react';
import './ui.css';

/**
 * Ilustração do estado vazio: uma lua dormindo (issue #214, seção 6 do guia).
 * Decorativa — `aria-hidden`, sempre ao lado de um texto que diz o mesmo.
 */
function LuaDormindo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      width="88"
      height="88"
      aria-hidden="true"
      focusable="false"
    >
      {/* Lua em crescente (mesmo desenho do MoonIcon, ampliado). */}
      <path
        className="ui-empty__moon"
        d="M84 51.16A36 36 0 1 1 44.84 12 28 28 0 0 0 84 51.16z"
      />
      {/* Olhos fechados (dormindo). */}
      <path
        className="ui-empty__face"
        d="M21 48q4 4 8 0"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="ui-empty__face"
        d="M33 48q4 4 8 0"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* "z z z" crescendo na concha da lua. */}
      <path className="ui-empty__z" d="M56 30h10l-10 11h10" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path className="ui-empty__z" d="M72 16h13l-13 14h13" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface EmptyStateProps {
  /** Frase amiga: o que está vazio, em uma linha. */
  title: string;
  /** Explicação curta de por que está vazio e o que acontece aqui. */
  description?: string;
  /** Ação clara (botão ou link) — o convite para o próximo passo. */
  action?: ReactNode;
  /** 'md' (padrão) tem ilustração; 'sm' é compacto, para vazio de lista. */
  size?: 'md' | 'sm';
  className?: string;
  style?: CSSProperties;
}

/**
 * Estado vazio com identidade (issue #214, seção 6 do guia): ilustração da
 * lua dormindo, frase amiga e ação clara. Usado em Hoje, Histórico, Amigos e
 * Dashboard — e em listas internas no tamanho 'sm'.
 */
export default function EmptyState({ title, description, action, size = 'md', className, style }: EmptyStateProps) {
  const classes = ['ui-empty', size === 'sm' ? 'ui-empty--sm' : '', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      <LuaDormindo className="ui-empty__illustration" />
      <p className="ui-empty__title">{title}</p>
      {description && <p className="ui-empty__description">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
