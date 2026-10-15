import type { CSSProperties } from 'react';
import Button from './Button';
import './ui.css';

export interface ErrorStateProps {
  /** Frase em português dizendo o que falhou (mensagem amigável). */
  message: string;
  /** Detalhe técnico vindo da API, mostrado em texto secundário. */
  detail?: string;
  /** Ação "Tentar novamente"; omita quando não houver como recarregar. */
  onRetry?: () => void;
  /** Rótulo do botão de nova tentativa (padrão "Tentar novamente"). */
  retryLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Estado de erro com identidade (issue #214, seção 6 do guia): mensagem em
 * português e botão "Tentar novamente". Fica dentro de um `role="alert"` para
 * leitores de tela anunciarem o problema assim que ele aparece.
 */
export default function ErrorState({
  message,
  detail,
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
  style,
}: ErrorStateProps) {
  const classes = ['ui-state-error', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="alert" style={style}>
      <p className="ui-state-error__message">{message}</p>
      {detail && <p className="ui-state-error__detail">{detail}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
