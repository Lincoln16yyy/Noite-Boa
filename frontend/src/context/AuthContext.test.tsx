import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

// O logout precisa esquecer a sondagem do primeiro uso (#273). A sonda em si
// tem testes próprios em lib/primeiro-uso.test.ts; aqui interessa a ligação.
const { esquecerSondagem } = vi.hoisted(() => ({ esquecerSondagem: vi.fn() }));
vi.mock('../lib/primeiro-uso', () => ({ esquecerSondagem }));

function BotaoSair() {
  const { logout } = useAuth();
  return <button onClick={logout}>Sair</button>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    esquecerSondagem.mockClear();
    // Carga inicial do /me sem sessão.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));
  });

  it('logout esquece a sondagem do primeiro uso (#273)', async () => {
    render(
      <AuthProvider>
        <BotaoSair />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(esquecerSondagem).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('token')).toBeNull();
  });
});
