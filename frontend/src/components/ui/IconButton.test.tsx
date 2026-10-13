import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import IconButton from './IconButton';

describe('IconButton (issue #208)', () => {
  it('expõe o aria-label como nome acessível', () => {
    render(
      <IconButton aria-label="Sair da conta">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Fechar menu" onClick={onClick}>
        ✕
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respeita disabled (não dispara click)', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Reproduzir" disabled onClick={onClick}>
        ▶
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'Reproduzir' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('tem alvo mínimo de 44 px garantido pela classe do componente', () => {
    const { container } = render(
      <IconButton aria-label="Opções">
        ⋯
      </IconButton>,
    );
    expect(container.querySelector('.ui-icon-btn')).not.toBeNull();
  });
});
