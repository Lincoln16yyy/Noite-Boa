import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Papel visual da ação (ver docs/design/direcao-visual.md, seção 4). */
  variant?: ButtonVariant;
  /** `sm` = 44 px (linha de ação), `md` = 48 px pílula (ação principal). */
  size?: ButtonSize;
  /** Mostra o indicador e desabilita o botão (aria-busy). */
  loading?: boolean;
  children: ReactNode;
}

/**
 * Botão base do app (issue #208). Substitui os `<button>` sem estilo do
 * navegador: garante cores por token, alvo de 44 px, foco visível (anel
 * Âmbar de 2 px), estado pressionado e desabilitado nos dois temas.
 *
 * `type` padrão é `"button"` (não envia formulário por acidente) — passe
 * `type="submit"` explicitamente nos botões de formulário.
 */
export default function Button({
  variant = 'primary',
  size = 'sm',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
