import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import QualitySelector from './QualitySelector';

describe('QualitySelector (issue #158)', () => {
  it('mostra as 5 notas', () => {
    render(<QualitySelector value={0} onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('expõe um único radiogroup, com o rótulo da legenda (#277)', () => {
    render(<QualitySelector value={0} onChange={() => {}} />);
    // O fieldset/legend já é o grupo: um segundo role=radiogroup no div interno
    // fazia o leitor de tela anunciar o grupo duas vezes.
    const grupos = screen.getAllByRole('radiogroup');
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toHaveAccessibleName('Como foi a noite?');
    // E as cinco notas estão DENTRO do grupo: uma nota solta fora passaria no
    // teste global de radios e deixaria o agrupamento acessível quebrado.
    expect(within(grupos[0]).getAllByRole('radio')).toHaveLength(5);
  });

  it('agrupa as 5 notas numa grade de 5 colunas (uma linha no celular)', () => {
    const { container } = render(<QualitySelector value={0} onChange={() => {}} />);
    const grupo = container.querySelector<HTMLDivElement>('[role="radiogroup"] > div');
    expect(grupo?.style.display).toBe('grid');
    expect(grupo?.style.gridTemplateColumns).toContain('repeat(5');
  });

  it('chama onChange com o valor da nota clicada', () => {
    const onChange = vi.fn();
    render(<QualitySelector value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Boa (4)' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
