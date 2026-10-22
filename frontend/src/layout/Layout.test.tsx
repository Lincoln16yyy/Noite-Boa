import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { mockMe, renderWithAuth } from '../test/test-utils';
import Layout from './Layout';
import BottomBar from './BottomBar';
import type { User } from '../api/types';

const usuario: User = {
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
function instalarMatchMedia(celularInicial: boolean) {
  let celular = celularInicial;
  const listeners = new Set<(evento: MediaQueryListEvent) => void>();
  const criar = (query: string) => ({
    matches: String(query).includes('max-width') ? celular : false,
    media: query,
    onchange: null,
    addEventListener: (tipo: string, cb: (evento: MediaQueryListEvent) => void) => {
      if (tipo === 'change') listeners.add(cb);
    },
    removeEventListener: (tipo: string, cb: (evento: MediaQueryListEvent) => void) => {
      if (tipo === 'change') listeners.delete(cb);
    },
    addListener: (cb: (evento: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (evento: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  });
  // Dublê de MediaQueryList instalado como propriedade própria do window via
  // defineProperty (o "value" do descriptor é `any`, então não precisamos
  // replicar as sobrecargas de addEventListener do tipo real).
  Object.defineProperty(window, 'matchMedia', { value: vi.fn(criar), configurable: true, writable: true });
  return {
    ativarCelular(novoValor: boolean) {
      celular = novoValor;
      listeners.forEach((cb) =>
        cb(Object.assign(new Event('change'), { matches: celular, media: '(max-width: 767px)' })),
      );
    },
  };
}

async function renderLayout({ celular, user, route }: { celular: boolean; user: User | null; route: string }) {
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
  Object.defineProperty(window, 'matchMedia', { value: matchMediaOriginal, configurable: true, writable: true });
});

/**
 * Issue #210: /hoje é a tela inicial do app logado. A rota-marcador prova o
 * destino do redirecionamento sem sair do MemoryRouter.
 */
function renderLayoutComDestino(route: string) {
  instalarMatchMedia(false);
  mockMe(usuario);
  return renderWithAuth(
    <Routes>
      <Route path="/hoje" element={<p>marcador hoje</p>} />
      <Route path="*" element={<Layout />} />
    </Routes>,
    { user: usuario, route },
  );
}

describe('Layout — navegação responsiva (issue #157)', () => {
  it('desktop (1280px): menu completo no cabeçalho e sem barra inferior', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/dashboard' });

    const cabecalho = screen.getByRole('banner');
    expect(within(cabecalho).getByRole('link', { name: 'Hoje' })).toBeInTheDocument();
    expect(within(cabecalho).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(cabecalho).getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais opções' })).not.toBeInTheDocument();
  });

  it('celular (390px): cabeçalho com saudação + lua e barra inferior com as abas', async () => {
    await renderLayout({ celular: true, user: usuario, route: '/dashboard' });

    const cabecalho = screen.getByRole('banner');
    // Sem links de navegação nem Sair no cabeçalho: nada duplicado.
    expect(within(cabecalho).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(within(cabecalho).queryByRole('button', { name: 'Sair da conta' })).not.toBeInTheDocument();
    // Saudação por horário (fuso do perfil) + primeiro nome (issue #209).
    expect(within(cabecalho).getByText(/^(Bom dia|Boa tarde|Boa noite),$/)).toBeInTheDocument();
    expect(within(cabecalho).getByText('Teste')).toBeInTheDocument();

    // Barra inferior: 5 abas (Hoje é a primeira) + "Mais".
    expect(screen.getByRole('link', { name: 'Hoje' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amigos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais opções' })).toBeInTheDocument();
    // Sem emoji como ícone: as abas têm SVG com traço (decorativo).
    const svgAba = screen.getByRole('link', { name: 'Hoje' }).querySelector('svg');
    expect(svgAba).toHaveAttribute('aria-hidden', 'true');
    expect(svgAba).toHaveAttribute('stroke', 'currentColor');
  });

  it('marca a aba corrente com aria-current="page" e a cor de ativo', async () => {
    await renderLayout({ celular: true, user: usuario, route: '/historico' });

    const ativa = screen.getByRole('link', { name: 'Histórico' });
    expect(ativa).toHaveAttribute('aria-current', 'page');
    expect(ativa.style.color).toBe('var(--tab-active)');

    const inativa = screen.getByRole('link', { name: 'Amigos' });
    expect(inativa).not.toHaveAttribute('aria-current');
    expect(inativa.style.color).toBe('var(--tab-inactive)');
  });

  it('o menu "Mais" abre Sons, Configurações e Sair e fecha ao escolher', async () => {
    await renderLayout({ celular: true, user: usuario, route: '/hoje' });

    fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Sons' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Configurações' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sons' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // Issue #210: /hoje é a tela inicial do app logado — destino depois do login
  // e da raiz.
  it('logado em /login cai em /hoje', async () => {
    renderLayoutComDestino('/login');
    expect(await screen.findByText('marcador hoje')).toBeInTheDocument();
  });

  it('logado na raiz (/) cai em /hoje', async () => {
    renderLayoutComDestino('/');
    expect(await screen.findByText('marcador hoje')).toBeInTheDocument();
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

/** Abas e rótulos do menu logado, na ordem em que aparecem no desktop. */
const ROTULOS_DESKTOP = [
  'Hoje',
  'Registrar',
  'Histórico',
  'Dashboard',
  'Amigos',
  'Sons',
  'Configurações',
];

/** As abas que também são ícones da barra inferior (celular). */
const ROTULOS_BARRA = ['Hoje', 'Registrar', 'Histórico', 'Dashboard', 'Amigos'];

/**
 * O desenho do ícone (traços e círculos), ignorando o tamanho em px: a barra
 * inferior usa 24 px e o cabeçalho 18 px, mas o glifo tem de ser o mesmo.
 */
function desenhoDoIcone(link: HTMLElement) {
  const figuras = [...link.querySelectorAll('svg > path, svg > circle')];
  return figuras.map((figura) => figura.outerHTML).join('');
}

describe('Layout — desktop v2 (issue #217)', () => {
  it('cabeçalho e conteúdo ficam dentro do mesmo container centralizado', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/hoje' });

    expect(screen.getByRole('banner').querySelector('.app-container')).not.toBeNull();
    expect(screen.getByRole('main')).toHaveClass('app-container');
  });

  it('todo link do menu desktop traz um único ícone decorativo', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/hoje' });
    const menu = within(screen.getByRole('banner')).getByRole('navigation');

    for (const rotulo of ROTULOS_DESKTOP) {
      const link = within(menu).getByRole('link', { name: rotulo });
      const icones = link.querySelectorAll('svg');
      // Um só, e decorativo: o nome acessível continua sendo o rótulo.
      expect(icones).toHaveLength(1);
      expect(icones[0]).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('o menu desktop usa os mesmos ícones da barra inferior', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/hoje' });
    const menu = within(screen.getByRole('banner')).getByRole('navigation');
    const { container: barra } = renderWithAuth(<BottomBar />, { user: usuario, route: '/hoje' });

    for (const rotulo of ROTULOS_BARRA) {
      expect(desenhoDoIcone(within(menu).getByRole('link', { name: rotulo }))).toBe(
        desenhoDoIcone(within(barra).getByRole('link', { name: rotulo })),
      );
    }
  });

  it('Sons e Configurações viram links diretos no desktop (sem menu "Mais")', async () => {
    await renderLayout({ celular: false, user: usuario, route: '/hoje' });
    const menu = within(screen.getByRole('banner')).getByRole('navigation');

    expect(within(menu).getByRole('link', { name: 'Sons' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais opções' })).not.toBeInTheDocument();
  });
});

describe('Layout — falha de sessão (#294)', () => {
  it('não manda para /login quando o /me falha e o token continua', async () => {
    instalarMatchMedia(false);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderWithAuth(
      <Routes>
        <Route path="/login" element={<p>marcador login</p>} />
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/hoje' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    expect(screen.queryByText('marcador login')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('mock-token');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();

    // Sem o layout normal, ainda dá para sair e trocar de conta.
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    expect(await screen.findByText('marcador login')).toBeInTheDocument();
  });

  it('falha ao sair mantém a tela de erro e explica, sem fingir logout (#310)', async () => {
    instalarMatchMedia(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    renderWithAuth(
      <Routes>
        <Route path="/login" element={<p>marcador login</p>} />
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/hoje' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    // O token não saiu: em vez de sumir com o aviso e parecer que saiu, a tela
    // continua com a explicação e o botão de tentar de novo (#310).
    expect(await screen.findByText('Não foi possível sair. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('mock-token');
    expect(screen.queryByText('marcador login')).not.toBeInTheDocument();
  });

  it('retry da sessão limpa o aviso do logout que falhou (#310)', async () => {
    instalarMatchMedia(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    renderWithAuth(
      <Routes>
        <Route path="/login" element={<p>marcador login</p>} />
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/hoje' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Não foi possível sair. Tente de novo.')).toBeInTheDocument();

    // Retry que também falha: o aviso da saída continua, porque o token ficou.
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument());
    expect(screen.getByText('Não foi possível sair. Tente de novo.')).toBeInTheDocument();

    // A sessão volta: o aviso daquele clique falho não pode ficar na tela nova.
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(usuario), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    // Espera o layout normal (o cabeçalho) antes de conferir: durante o retry a
    // tela de erro desmonta, e conferir só a ausência da mensagem passaria
    // mesmo que ela voltasse depois com a sessão recuperada (#310).
    expect(await screen.findByRole('banner')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível sair. Tente de novo.')).not.toBeInTheDocument();
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
  });

  it('401 no /me limpa a sessão e manda para /login, sem tela de erro', async () => {
    instalarMatchMedia(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    renderWithAuth(
      <Routes>
        <Route path="/login" element={<p>marcador login</p>} />
        <Route path="*" element={<Layout />} />
      </Routes>,
      { user: usuario, route: '/hoje' },
    );

    expect(await screen.findByText('marcador login')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
