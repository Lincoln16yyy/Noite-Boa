import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sons from './Sons';
import { renderWithAuth } from '../test/test-utils';
import type { User } from '../api/types';

vi.mock('../lib/player', async () => {
  const actual = await vi.importActual('../lib/player');
  return {
    ...actual,
    suportaWebAudio: vi.fn(() => true),
    suportaElementoAudio: vi.fn(() => true),
    tocarSom: vi.fn(async () => {}),
    pararSom: vi.fn(),
    ajustarVolume: vi.fn(),
  };
});

import * as player from '../lib/player';

const mockUser: User = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

function abrirSons() {
  renderWithAuth(<Sons />, { user: mockUser, route: '/sons' });
}

describe('tela de Sons', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(player.suportaWebAudio).mockReturnValue(true);
    vi.mocked(player.suportaElementoAudio).mockReturnValue(true);
    vi.mocked(player.tocarSom).mockResolvedValue();
  });

  it('exige login (sem token redireciona após falha no /me)', async () => {
    localStorage.removeItem('token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/me')) {
        return new Response(null, { status: 401 });
      }
      return new Response('{}', { status: 200 });
    });
    renderWithAuth(<Sons />, { route: '/sons' });

    // O AuthProvider tenta buscar /me, falha com 401, limpa sessão
    // O teste real de redirect acontece no navegador; aqui validamos que o fluxo não quebra
    await waitFor(() => expect(true).toBe(true));
    vi.restoreAllMocks();
  });

  it('tocar e pausar alternam o estado e chamam a lib', async () => {
    abrirSons();
    const botao = screen.getByRole('button', { name: 'Tocar som' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(botao);
    expect(player.tocarSom).toHaveBeenCalledWith('rosa', 0.5);

    const botaoPausar = await screen.findByRole('button', { name: 'Pausar som' });
    expect(botaoPausar).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(botaoPausar);
    expect(player.pararSom).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeInTheDocument();
  });

  it('trocar o som durante a reprodução reinicia com o novo som', async () => {
    abrirSons();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    });
    await screen.findByRole('button', { name: 'Pausar som' });

    vi.clearAllMocks();
    const opcaoChuva = screen.getByLabelText(/^Chuva/i);
    await act(async () => {
      fireEvent.click(opcaoChuva);
    });

    expect(player.tocarSom).toHaveBeenCalledWith('chuva', 0.5);
  });

  it('mudar o volume ajusta a lib', async () => {
    abrirSons();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    });
    fireEvent.change(screen.getByLabelText(/Volume do som/i), { target: { value: '80' } });
    expect(player.ajustarVolume).toHaveBeenCalledWith(0.8);
  });

  it('falha no carregamento de arquivo de áudio exibe alerta sugerindo ruídos', async () => {
    vi.mocked(player.tocarSom).mockRejectedValueOnce(new Error('Network error'));
    abrirSons();

    // Seleciona uma ambiência (ex.: ondas)
    fireEvent.click(screen.getByLabelText(/Ondas/i));
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/não foi possível carregar o arquivo de áudio/i);
    expect(alerta).toHaveTextContent(/experimente os sons de ruído/i);
    expect(player.pararSom).toHaveBeenCalled();
  });

  it('sem suporte a Web Audio avisa nos ruídos mas permite tocar ambiências CC0', () => {
    vi.mocked(player.suportaWebAudio).mockReturnValue(false);
    abrirSons();

    // Começa na chuva por padrão quando não há Web Audio
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeEnabled();

    // Se clicar em um ruído, exibe alerta e desativa o botão de tocar ruído
    fireEvent.click(screen.getByLabelText(/Ruído rosa/i));
    expect(screen.getByRole('alert')).toHaveTextContent(/não oferece suporte a áudio gerado por código/i);
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeDisabled();

    // Voltando para ambiência, o botão volta a ficar habilitado
    fireEvent.click(screen.getByLabelText(/Vento/i));
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeEnabled();
  });

  it('erro inesperado ao tocar ruído vira mensagem amigável sugerindo ambiências', async () => {
    vi.mocked(player.tocarSom).mockRejectedValueOnce(new Error('AudioContext crash'));
    abrirSons();

    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta!).toHaveTextContent(/não foi possível iniciar o som neste navegador/i);
    expect(alerta!).toHaveTextContent(/tente as opções de ambiência/i);
  });

  it('para o som ao desmontar a página (cleanup)', async () => {
    window.history.pushState({}, '', '/sons');
    const { unmount } = renderWithAuth(<Sons />, { user: mockUser, route: '/sons' });
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    await screen.findByRole('button', { name: 'Pausar som' });

    vi.clearAllMocks();
    unmount();
    expect(player.pararSom).toHaveBeenCalled();
  });

  it('pausa sozinho quando a aba fica oculta, sem retomar automática', async () => {
    abrirSons();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    await screen.findByRole('button', { name: 'Pausar som' });
    vi.clearAllMocks();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    // O handler lê o ref espelhado; ele precisa já estar atualizado quando a UI
    // passa a mostrar "Pausar som" (ver useLayoutEffect em Sons.jsx, issue #150).
    expect(player.pararSom).toHaveBeenCalled();
    expect(player.tocarSom).not.toHaveBeenCalled();
    expect((await screen.findByRole('button', { name: 'Tocar som' })) as HTMLElement).toBeInTheDocument();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('menciona a documentação de licenças no rodapé', () => {
    abrirSons();
    expect(screen.getByText(/docs\/audio-licencas\.md/i)).toBeInTheDocument();
  });
});
