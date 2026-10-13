import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Ring from './Ring';

describe('Ring (issue #208)', () => {
  it('tem role=img com aria-label (nunca anel mudo)', () => {
    render(<Ring label="Média de 7 dias: 78%" value={78} />);
    expect(screen.getByRole('img', { name: 'Média de 7 dias: 78%' })).toBeInTheDocument();
  });

  it('desenha o arco proporcional ao valor (stroke-dashoffset)', () => {
    const { container } = render(<Ring label="Meta" value={25} />);
    const arco = container.querySelector('.ui-ring__value');
    const dash = arco?.getAttribute('stroke-dasharray');
    const offset = Number(arco?.getAttribute('stroke-dashoffset'));
    expect(Number(dash)).toBeGreaterThan(0);
    // 25% da circunferência "vazio" no fim.
    expect(offset).toBeCloseTo(Number(dash) * 0.75, 3);
  });

  it('corta o valor acima do máximo', () => {
    const { container } = render(<Ring label="Meta" value={200} max={100} />);
    const arco = container.querySelector('.ui-ring__value');
    expect(Number(arco?.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 3);
  });

  it('mostra o conteúdo do centro (número de destaque)', () => {
    render(<Ring label="Média" value={50}>7h21</Ring>);
    expect(screen.getByText('7h21')).toBeInTheDocument();
  });
});
