import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from './ProgressBar';

describe('ProgressBar (issue #208)', () => {
  it('tem role=progressbar com valor numérico', () => {
    render(<ProgressBar value={72} label="Consistência da semana" />);
    const bar = screen.getByRole('progressbar', { name: 'Consistência da semana' });
    expect(bar).toHaveAttribute('aria-valuenow', '72');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('corta o valor fora da faixa (0–100)', () => {
    const { rerender } = render(<ProgressBar value={150} label="x" />);
    expect(screen.getByRole('progressbar', { name: 'x' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    rerender(<ProgressBar value={-5} label="x" />);
    expect(screen.getByRole('progressbar', { name: 'x' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('aplica a largura do preenchimento e o tom da cor', () => {
    const { container } = render(<ProgressBar value={40} label="Meta" tone="within" />);
    const fill = container.querySelector('.ui-progress__fill');
    expect(fill?.getAttribute('style')).toContain('width: 40%');
    expect(fill?.className).toContain('ui-progress__fill--within');
  });
});
