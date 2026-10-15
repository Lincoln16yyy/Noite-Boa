import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorState from './ErrorState';

describe('ErrorState (issue #214)', () => {
  it('anuncia a mensagem em português como alerta', () => {
    render(<ErrorState message="Não foi possível carregar suas noites." />);

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar suas noites.');
  });

  it('oferece "Tentar novamente" e dispara a nova tentativa', async () => {
    const tentar = vi.fn();
    render(<ErrorState message="Falhou" onRetry={tentar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it('mostra o detalhe técnico em texto secundário', () => {
    render(<ErrorState message="Falhou" detail="HTTP 500" />);

    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('sem onRetry não mostra botão', () => {
    render(<ErrorState message="Falhou" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aceita rótulo de botão próprio', () => {
    render(<ErrorState message="Falhou" onRetry={() => {}} retryLabel="Recarregar" />);

    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
  });
});
