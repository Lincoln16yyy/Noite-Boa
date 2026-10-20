import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithAuth } from '../test/test-utils';
import Layout from './Layout';
import { esquecerSondagem } from '../lib/sonda';
import type { User } from '../api/types';

/**
 * Guard do primeiro uso no Layout (issue #215).
 *
 * Este arquivo cobre os dois ramos que o Layout decide: redirecionar para
 * /onboarding e não redirecionar. Os demais resultados da sonda — noite já
 * registrada, meta já salva, rede fora, back-end sem `hasGoal` — vivem em
 * `lib/primeiro-uso.test.ts`, que importa o módulo de novo a cada teste. Aqui
 * o módulo é o mesmo do Layout, então um segundo resultado de sonda no mesmo
 * arquivo pegaria o memoizado pelo anterior.
 */
const usuario: User = {
  id: 'u1',
  email: 'a@example.com',
  displayName: 'Ana',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: true,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  // A sonda se prende ao token; os testes reutilizam 'mock-token', então a
  // memória precisa ser descartada para não vazar de um caso para o outro.
  esquecerSondagem();
});

/** Rota-marcador: prova o destino do redirecionamento sem sair do MemoryRouter. */
function comDestino(route: string) {
  return renderWithAuth(
    <Routes>
      <Route path="/hoje" element={<p>marcador hoje</p>} />
      <Route path="/onboarding" element={<p>marcador onboarding</p>} />
      {/* Toda rota sem marcador cai no Layout, que é onde o guard mora. */}
      <Route path="*" element={<Layout />} />
    </Routes>,
    { user: usuario, route },
  );
}

describe('Layout — primeiro uso (issue #215)', () => {
  it('quem nunca registrou noite nem salvou meta cai em /onboarding', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const caminho = String(url);
      if (caminho.includes('/me')) return jsonResponse(usuario);
      if (caminho.includes('/sleep-logs')) return jsonResponse({ content: [] });
      // /goal responde 200 com um default de 8h mesmo sem meta: o que diz se
      // ela existe é `hasGoal`.
      return jsonResponse({ targetMinutes: 480, hasGoal: false });
    });

    // /dashboard não tem marcador, então passa pelo Layout antes de qualquer
    // coisa — é lá que o guard decide.
    comDestino('/dashboard');

    await screen.findByText('marcador onboarding');
    expect(screen.queryByText('marcador hoje')).not.toBeInTheDocument();
  });

  it('quem já tem o indicador no aparelho segue na rota, sem sondar o servidor', async () => {
    localStorage.setItem('noiteboa.onboarding-concluido', '1');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/me')) return jsonResponse(usuario);
      return jsonResponse({});
    });

    comDestino('/dashboard');

    // O app abre normalmente, sem cair no onboarding.
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());
    expect(screen.queryByText('marcador onboarding')).not.toBeInTheDocument();

    const sondadas = fetchMock.mock.calls.filter(([url]) => {
      const caminho = String(url);
      return caminho.includes('/sleep-logs') || caminho.includes('/goal');
    });
    expect(sondadas).toHaveLength(0);
  });

  it('sem sessão não sonda nada: em /login e /cadastro não há o que perguntar', async () => {
    // A sonda é uma propriedade da conta. Rodá-la em rota pública levaria 401
    // e, se o "false" fosse memoizado, o fluxo nunca apareceria depois do
    // cadastro — comportamento que o E2E com a API real pegou.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({}, 401));

    renderWithAuth(<Layout />, { user: null, route: '/hoje' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => {
      setTimeout(r, 300);
    });

    const sondadas = fetchMock.mock.calls.filter(([url]) => {
      const caminho = String(url);
      return caminho.includes('/sleep-logs') || caminho.includes('/goal');
    });
    expect(sondadas).toHaveLength(0);
  });

  it('quem já não precisa do fluxo não fica preso em /onboarding (#292)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const caminho = String(url);
      if (caminho.includes('/me')) return jsonResponse(usuario);
      if (caminho.includes('/sleep-logs')) return jsonResponse({ content: [{ id: 'n1' }] });
      return jsonResponse({ targetMinutes: 480, hasGoal: true });
    });

    // /onboarding dentro do Layout, com marcador próprio (como a página real).
    renderWithAuth(
      <Routes>
        <Route path="/hoje" element={<p>marcador hoje</p>} />
        <Route path="/onboarding" element={<Layout />}>
          <Route index element={<p>marcador onboarding</p>} />
        </Route>
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/onboarding' },
    );

    // Já tem noite e meta: a sonda resolve `false` e tira a pessoa do fluxo.
    await screen.findByText('marcador hoje');
    expect(screen.queryByText('marcador onboarding')).not.toBeInTheDocument();
  });

  it('falha na sonda não tira a pessoa de /onboarding (#292)', async () => {
    // /me funciona, mas as duas chamadas da sonda falham: não dá para afirmar
    // que o fluxo é dispensável, então não redireciona.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/me')) return jsonResponse(usuario);
      return jsonResponse({ detail: 'indisponível' }, 503);
    });

    renderWithAuth(
      <Routes>
        <Route path="/hoje" element={<p>marcador hoje</p>} />
        <Route path="/onboarding" element={<Layout />}>
          <Route index element={<p>marcador onboarding</p>} />
        </Route>
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/onboarding' },
    );

    // Prova que a sonda rodou e falhou (as duas chamadas), em vez de só esperar.
    await waitFor(() => {
      const sondadas = fetchMock.mock.calls.filter(([url]) => {
        const caminho = String(url);
        return caminho.includes('/sleep-logs') || caminho.includes('/goal');
      });
      expect(sondadas).toHaveLength(2);
    });
    // E continua em /onboarding: nem /hoje nem outra rota qualquer.
    expect(screen.getByText('marcador onboarding')).toBeInTheDocument();
    expect(screen.queryByText('marcador hoje')).not.toBeInTheDocument();
  });
});
