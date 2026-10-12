import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { mockMe, renderWithAuth } from '../test/test-utils';
import Layout from './Layout';

const usuario = {
  id: 'u1',
  email: 'a@example.com',
  displayName: 'Teste',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: true,
};

const matchMediaOriginal = window.matchMedia;

/**
 * matchMedia controlável: o teste decide se a media query de celular casa e
 * pode trocar isso em tempo real para simular rotação/redimensionamento.
 */
function instalarMatchMedia(celularInicial) {
  let celular = celularInicial;
  const listeners = new Set();
  const criar = (query) => ({
    matches: String(query).includes('max-width') ? celular : false,
    media: query,
    onchange: null,
    addEventListener: (tipo, cb) => { if (tipo === 'change') listeners.add(cb); },
    removeEventListener: (tipo, cb) => { if (tipo === 'change') listeners.delete(cb); },
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
    dispatchEvent: () => true,
  });
  window.matchMedia = vi.fn(criar);
  return {
    ativarCelular(novoValor) {
      celular = novoValor;
      listeners.forEach((cb) => cb({ matches: celular, media: '(max-width: 767px)' }));
    },
  };
}

async function renderLayout({ celular, user, route }) {
  instalarMatchMedia(celular);
  if (user) mockMe(user);
  else vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

  const resultado = renderWithAuth(<Layout />, { user, route });
  // Espera a sessão carregar (o esqueleto mostra "Carregando…").
  await waitFor(() => expect(screen.queryByText('Carregando…')).not.toBeInTheDocument());
  return resultado;
}

afterEach(() => {
  vi.restoreAllMocks();
  window.matchMedia = matchMediaOriginal;
});

describe('Layout — navegação responsiva (issue #157)', () => {
  it('desktop (1280px): menu completo no cabeçalho e sem barra inferior', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/dashboard' });

    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(cabecalho).getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais opções' })).not.toBeInTheDocument();
  });

  it('celular (390px): cabeçalho só com logo e barra inferior com as abas', async () => {
    await renderLayout({ celular: true, user: usuario, route: '/dashboard' });

    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(within(cabecalho).queryByRole('button', { name: 'Sair da conta' })).not.toBeInTheDocument();

    // Barra inferior: 4 abas + "Mais".
    expect(screen.getByRole('link', { name: 'Registrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amigos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais opções' })).toBeInTheDocument();
  });

  it('visitante no celular mantém Entrar/Cadastrar e não vê barra inferior', async () => {
    await renderLayout({ celular: true, user: null, route: '/' });

    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(within(cabecalho).getByRole('link', { name: 'Cadastrar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais opções' })).not.toBeInTheDocument();
  });

  it('redimensionar troca o layout sem recarregar a página', async () => {
    const media = instalarMatchMedia(true);
    mockMe(usuario);
    renderWithAuth(<Layout />, { user: usuario, route: '/dashboard' });
    await waitFor(() => expect(screen.queryByText('Carregando…')).not.toBeInTheDocument());

    // Começa no celular: barra inferior, sem menu no cabeçalho.
    expect(screen.getByRole('button', { name: 'Mais opções' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();

    // Alarga para desktop.
    act(() => media.ativarCelular(false));
    await waitFor(() =>
      expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Mais opções' })).not.toBeInTheDocument();

    // Estreita de novo (rotação): volta a barra inferior.
    act(() => media.ativarCelular(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais opções' })).toBeInTheDocument());
  });
});
