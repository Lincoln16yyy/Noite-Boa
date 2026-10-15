import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState (issue #214)', () => {
  it('mostra a frase amiga e a ilustração da lua decorativa', () => {
    const { container } = render(<EmptyState title="Nenhuma noite registrada ainda." />);

    expect(screen.getByText('Nenhuma noite registrada ainda.')).toBeInTheDocument();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true'); // ilustração não fala
  });

  it('descreve o motivo e oferece a ação clara', () => {
    render(
      <EmptyState
        title="Sem dados"
        description="Registre uma noite para ver sua média."
        action={<a href="/registrar">Registrar uma noite</a>}
      />,
    );

    expect(screen.getByText('Registre uma noite para ver sua média.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar uma noite' })).toHaveAttribute('href', '/registrar');
  });

  it("tamanho 'sm' esconde a ilustração para vazio de lista", () => {
    const { container } = render(<EmptyState size="sm" title="Nenhum convite recebido." />);

    expect(container.querySelector('.ui-empty--sm')).not.toBeNull();
    expect(screen.getByText('Nenhum convite recebido.')).toBeInTheDocument();
  });

  it('sem descrição e sem ação, só a frase', () => {
    const { container } = render(<EmptyState title="Só a frase" />);

    expect(container.querySelector('.ui-empty__description')).toBeNull();
    expect(container.querySelector('.ui-empty__action')).toBeNull();
  });
});
