import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../lib/noise', () => ({
  TIPOS_RUIDO: [
    { id: 'branco', nome: 'Ruído branco' },
    { id: 'rosa', nome: 'Ruído rosa' },
    { id: 'marrom', nome: 'Ruído marrom' },
  ],
  suportaAudio: vi.fn(() => true),
  tocarRuido: vi.fn(),
  pararRuido: vi.fn(),
  ajustarVolume: vi.fn(),
}));

// importa o módulo mockado para configurar por teste
import * as noise from '../lib/noise';

function abrirSons() {
  window.history.pushState({}, '', '/sons');
  render(<App />);
}

describe('tela de Sons', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'jwt-123');
    vi.clearAllMocks();
    // limpa retornos deixados por testes anteriores (ex.: suportaAudio falso)
    noise.suportaAudio.mockReturnValue(true);
    noise.tocarRuido.mockImplementation(() => {});
  });

  it('exige login (sem token leva para o login)', () => {
    localStorage.removeItem('token');
    window.history.pushState({}, '', '/sons');
    render(<App />);
    expect(window.location.pathname).toBe('/login');
  });

  it('tocar e pausar alternam o estado e chamam a lib', () => {
    abrirSons();
    const botao = screen.getByRole('button', { name: 'Tocar som' });
    fireEvent.click(botao);
    expect(noise.tocarRuido).toHaveBeenCalledWith('rosa', 0.5);
    expect(screen.getByRole('button', { name: 'Pausar som' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pausar som' }));
    expect(noise.pararRuido).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeInTheDocument();
  });

  it('trocar o tipo durante a reprodução reinicia com o novo som', () => {
    abrirSons();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    vi.clearAllMocks();
    fireEvent.click(screen.getByLabelText('Ruído marrom'));
    expect(noise.tocarRuido).toHaveBeenCalledWith('marrom', 0.5);
  });

  it('mudar o volume ajusta a lib', () => {
    abrirSons();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    fireEvent.change(screen.getByLabelText(/Volume do som/i), { target: { value: '80' } });
    expect(noise.ajustarVolume).toHaveBeenCalledWith(0.8);
  });

  it('sem suporte a Web Audio mostra alerta e desativa o botão', () => {
    noise.suportaAudio.mockReturnValue(false);
    abrirSons();
    expect(screen.getByRole('alert')).toHaveTextContent(/não oferece suporte/i);
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeDisabled();
  });

  it('erro inesperado ao tocar vira mensagem amigável', () => {
    noise.tocarRuido.mockImplementation(() => {
      throw new Error('boom');
    });
    abrirSons();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível iniciar/i);
  });

  it('para o som ao desmontar a página (cleanup)', () => {
    window.history.pushState({}, '', '/sons');
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    vi.clearAllMocks();
    unmount();
    expect(noise.pararRuido).toHaveBeenCalled();
  });

  it('pausa sozinho quando a aba fica oculta, sem retomar automática', () => {
    abrirSons();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar som' }));
    vi.clearAllMocks();

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(noise.pararRuido).toHaveBeenCalled();
    expect(noise.tocarRuido).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tocar som' })).toBeInTheDocument();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
