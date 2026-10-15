import type { ComponentType, SVGProps } from 'react';

/**
 * Ícones SVG de traço do app (issue #209): 24 px, traço de 2 px, cantos
 * arredondados, cor herdada (`currentColor`). Sem dependência nova — o
 * conjunto é pequeno e autocontido.
 *
 * Por padrão são decorativos (`aria-hidden`): use sempre junto de um
 * texto ou de um `aria-label` no elemento pai.
 */
export interface IconProps {
  /** Tamanho do quadrado em px (padrão 24). */
  size?: number;
  className?: string;
}

function svgProps({ size = 24, className }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    focusable: 'false',
    className,
  };
}

/** Registrar: sinal de mais (mockup da barra inferior). */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Histórico: lista com marcadores. */
export function ListIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}

/** Dashboard: barras do gráfico. */
export function BarChartIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 20v-6M12 20v-12M18 20v-9" />
    </svg>
  );
}

/** Amigos: duas pessoas. */
export function UsersIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Mais: reticências. */
export function MoreIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)} stroke="none" fill="currentColor">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

/** Lua crescente (marca e aba Hoje). */
export function MoonIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Estrela. */
export function StarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Relógio. */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Lixeira. */
export function TrashIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Lápis (editar). */
export function PencilIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Tipo de um componente de ícone (para listas de navegação). */
export type IconComponent = ComponentType<IconProps>;
