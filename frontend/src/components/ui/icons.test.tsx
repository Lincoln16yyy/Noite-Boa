import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  BarChartIcon,
  ClockIcon,
  ListIcon,
  MoonIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
} from './icons';

const ICONE = [
  ['PlusIcon', PlusIcon],
  ['ListIcon', ListIcon],
  ['BarChartIcon', BarChartIcon],
  ['UsersIcon', UsersIcon],
  ['MoreIcon', MoreIcon],
  ['MoonIcon', MoonIcon],
  ['StarIcon', StarIcon],
  ['ClockIcon', ClockIcon],
  ['TrashIcon', TrashIcon],
  ['PencilIcon', PencilIcon],
] as const;

describe('Ícones SVG de traço (issue #209)', () => {
  it.each(ICONE)('%s é SVG 24 px com traço de 2 px', (_nome, Icone) => {
    const { container } = render(<Icone />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('stroke-width')).toBe('2');
    expect(svg?.getAttribute('stroke-linecap')).toBe('round');
  });

  it.each(ICONE)('%s é decorativo (aria-hidden)', (_nome, Icone) => {
    const { container } = render(<Icone />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(ICONE)('%s respeita o tamanho e a classe passados', (_nome, Icone) => {
    const { container } = render(<Icone size={32} className="meu-icone" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.className.baseVal ?? svg?.className).toContain('meu-icone');
  });

  it('usa a cor herdada (currentColor) — nada de cor fixa', () => {
    const { container } = render(<MoonIcon />);
    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });
});
