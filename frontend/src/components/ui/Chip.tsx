import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estado de alternância (renderizado como aria-pressed). */
  selected?: boolean;
  children: ReactNode;
}

/**
 * Pílula alternável (issue #208): filtros e períodos ("7 dias", "30 dias",
 * tema). Usa os tokens `--toggle-active-*` para o estado selecionado —
 * Índigo no tema claro, Âmbar no escuro, sem hex solto.
 */
export default function Chip({
  selected = false,
  type = 'button',
  className,
  children,
  ...rest
}: ChipProps) {
  const classes = ['ui-chip', className].filter(Boolean).join(' ');

  return (
    <button {...rest} type={type} className={classes} aria-pressed={selected}>
      {children}
    </button>
  );
}
