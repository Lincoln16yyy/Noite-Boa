import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: botão só de ícone precisa de nome acessível (WCAG 4.1.2). */
  'aria-label': string;
  children: ReactNode;
}

/**
 * Botão quadrado de só ícone (issue #208). Exige `aria-label` no tipo —
 * é impossível criar um sem nome acessível. Alvo mínimo de 44 px e foco
 * visível (anel Âmbar de 2 px) garantidos pelo componente.
 */
export default function IconButton({
  type = 'button',
  className,
  children,
  ...rest
}: IconButtonProps) {
  const classes = ['ui-icon-btn', className].filter(Boolean).join(' ');

  return (
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
}
