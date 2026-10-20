import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

function BotaoSair() {
  const { logout } = useAuth();
  return <button onClick={logout}>Sair</button>;
}

/** Respostas das duas chamadas da sonda do primeiro uso (mais o /me da sessão). */
function simularSonda({ comNoite, comMeta }: { comNoite: boolean; comMeta: boolean }) {
  vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
    const caminho = String(url);
    if (caminho.includes('/api/me')) return new Response('null', { status: 200 });
    if (caminho.includes('/sleep-logs')) {
      return new Response(JSON.stringify({ content: comNoite ? [{ id: 'n1' }] : [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ targetMinutes: 480, hasGoal: comMeta }), { status: 200 });
  });
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));
  });

  it('logout encerra a sessão e descarta a sondagem do primeiro uso (#273)', async () => {
    localStorage.setItem('token', 'jwt-A');
    const { precisaDePrimeiroUso } = await import('../lib/primeiro-uso');

    simularSonda({ comNoite: false, comMeta: false });
    await expect(precisaDePrimeiroUso()).resolves.toBe(true); // conta A: primeiro uso

    render(
      <AuthProvider>
        <BotaoSair />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());

    // Conta B já tem noite: se herdasse a sonda memoizada de A, receberia `true`.
    simularSonda({ comNoite: true, comMeta: true });
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
  });
});
