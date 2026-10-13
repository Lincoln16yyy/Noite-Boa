import type { CSSProperties, ReactNode } from 'react';
import './ui.css';

export interface CardProps {
  children: ReactNode;
  /** Classe extra (útil para testes ou layout da tela). */
  className?: string;
  style?: CSSProperties;
}

/**
 * Superfície do visual v2 (issue #208, seção 2 do guia): usa os tokens
 * `--surface`, `--surface-border`, `--surface-radius` (24 px) e
 * `--surface-padding` (18 px) — claros e escuros por tema.
 */
export default function Card({ children, className, style }: CardProps) {
  const classes = ['ui-card', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
