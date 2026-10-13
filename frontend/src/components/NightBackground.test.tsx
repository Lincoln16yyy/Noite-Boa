import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import NightBackground from './NightBackground';

describe('NightBackground (issue #207)', () => {
  it('renderiza a camada de fundo', () => {
    const { container } = render(<NightBackground />);
    const camada = container.querySelector('.night-background');
    expect(camada).not.toBeNull();
  });

  it('é decorativa: oculta de leitores de tela (aria-hidden)', () => {
    const { container } = render(<NightBackground />);
    const camada = container.querySelector('.night-background');
    expect(camada?.getAttribute('aria-hidden')).toBe('true');
  });

  it('não participa da ordem de tabulação (aria-hidden implica focável=false)', () => {
    const { container } = render(<NightBackground />);
    const camada = container.querySelector<HTMLElement>('.night-background');
    // Uma camada puramente cenográfica nunca deve receber foco.
    expect(camada?.tabIndex).toBeLessThan(0);
  });
});
