import type { CSSProperties } from 'react';
import './ui.css';

export interface SkeletonProps {
  /** Largura (qualquer valor CSS; padrão 100%). */
  width?: number | string;
  /** Altura (qualquer valor CSS; padrão 16 px). */
  height?: number | string;
  /** Raio do canto (padrão 8 px; use --surface-radius para cartão). */
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Bloco de carregamento com brilho suave (issue #214, seção 6 do guia).
 * Decorativo: sai da árvore de acessibilidade — o texto "Carregando…" é
 * responsabilidade de quem o usa (role="status" ou sr-only). O brilho respeita
 * `prefers-reduced-motion` (ui.css).
 */
export default function Skeleton({ width = '100%', height = 16, radius = 8, className, style }: SkeletonProps) {
  const classes = ['ui-skeleton', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />
  );
}
