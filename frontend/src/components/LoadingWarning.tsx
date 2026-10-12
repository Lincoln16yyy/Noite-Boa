import { useEffect, useState } from 'react';

/**
 * Props de `LoadingWarning`.
 * `isLoading` fica true enquanto a requisição está em andamento;
 * `delayMs` é o tempo antes de mostrar o aviso (padrão 4000ms).
 */
export interface LoadingWarningProps {
  isLoading: boolean;
  delayMs?: number;
}

/**
 * Componente que exibe aviso "Acordando o servidor…" após um atraso.
 * Usado quando o primeiro acesso ao servidor Render gratuito pode demorar.
 */
export default function LoadingWarning({ isLoading, delayMs = 4000 }: LoadingWarningProps) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowWarning(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowWarning(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  if (!showWarning) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        background: '#FFF8E1',
        border: '1px solid #FFE082',
        borderRadius: '10px',
        color: '#7C6A00',
        fontSize: '15px',
        fontWeight: 500,
        marginBottom: '0.75rem',
      }}
    >
      <span aria-hidden="true">⏳</span>
      <span>Acordando o servidor… isso pode levar alguns segundos</span>
    </div>
  );
}