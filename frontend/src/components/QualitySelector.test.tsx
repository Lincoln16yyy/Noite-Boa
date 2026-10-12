import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QualitySelector from './QualitySelector';

describe('QualitySelector (issue #158)', () => {
  it('mostra as 5 notas', () => {
    render(<QualitySelector value={0} onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('agrupa as 5 notas numa grade de 5 colunas (uma linha no celular)', () => {
    const { container } = render(<QualitySelector value={0} onChange={() => {}} />);
    // O <fieldset> e o <div> interno têm role=radiogroup; o grupo das opções é o <div>.
    const grupo = container.querySelector('[role="radiogroup"] > div');
    expect(grupo.style.display).toBe('grid');
    expect(grupo.style.gridTemplateColumns).toContain('repeat(5');
  });

  it('chama onChange com o valor da nota clicada', () => {
    const onChange = vi.fn();
    render(<QualitySelector value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Boa (4)' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
