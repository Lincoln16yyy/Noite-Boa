import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as noise from './noise';
import {
  SONS_DISPONIVEIS,
  _resetarEstadoParaTestes,
  ajustarVolume,
  estaTocando,
  obterSomAtivo,
  pararSom,
  suportaElementoAudio,
  suportaWebAudio,
  tocarSom,
} from './player';

class AudioFake {
  src = '';
  preload = 'none';
  loop = false;
  volume = 1;
  paused = true;
  currentTime = 0;
  play = vi.fn().mockImplementation(async () => {
    this.paused = false;
  });
  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
  });
}

/** Instala um duplo de teste em window.Audio (sem exigir o HTMLAudioElement real). */
function instalarAudio(fake: unknown): void {
  Object.defineProperty(window, 'Audio', { value: fake, configurable: true, writable: true });
}

describe('player de sons (ruídos e ambiências CC0)', () => {
  beforeEach(() => {
    _resetarEstadoParaTestes();
    vi.restoreAllMocks();
    instalarAudio(AudioFake);
  });

  describe('catálogo de sons', () => {
    it('contém ao menos 3 ambiências CC0 e 3 tipos de ruído', () => {
      const ambiencias = SONS_DISPONIVEIS.filter((s) => s.categoria === 'ambiencia');
      const ruidos = SONS_DISPONIVEIS.filter((s) => s.categoria === 'ruido');

      expect(ambiencias.length).toBeGreaterThanOrEqual(3);
      expect(ruidos.length).toBeGreaterThanOrEqual(3);

      expect(ambiencias.map((s) => s.id)).toEqual(
        expect.arrayContaining(['chuva', 'ondas', 'vento']),
      );
      expect(ruidos.map((s) => s.id)).toEqual(
        expect.arrayContaining(['rosa', 'marrom', 'branco']),
      );

      for (const amb of ambiencias) {
        expect(amb.arquivo).toMatch(/^\/audio\/[a-z0-9_-]+\.mp3$/);
      }
    });
  });

  describe('suporte de navegadores', () => {
    it('suportaElementoAudio retorna true quando window.Audio está disponível', () => {
      expect(suportaElementoAudio()).toBe(true);
    });

    it('suportaElementoAudio retorna false se window.Audio não existir', () => {
      const originalAudio = window.Audio;
      Reflect.deleteProperty(window, 'Audio');
      expect(suportaElementoAudio()).toBe(false);
      window.Audio = originalAudio;
    });

    it('suportaWebAudio consulta a detecção de AudioContext', () => {
      const spy = vi.spyOn(noise, 'suportaAudio').mockReturnValue(true);
      expect(suportaWebAudio()).toBe(true);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('reprodução de ambiências (<audio> nativo)', () => {
    it('toca arquivo de áudio com preload=none e loop=true', async () => {
      await tocarSom('chuva', 0.6);

      const ativo = obterSomAtivo();
      expect(ativo).not.toBeNull();
      expect(ativo?.id).toBe('chuva');
      expect(ativo && 'arquivo' in ativo ? ativo.arquivo : undefined).toBe('/audio/rain.mp3');
      expect(estaTocando()).toBe(true);
    });

    it('pararSom pausa o elemento e zera o tempo', async () => {
      await tocarSom('ondas', 0.5);
      expect(estaTocando()).toBe(true);

      pararSom();
      expect(estaTocando()).toBe(false);
      expect(obterSomAtivo()).toBeNull();
    });

    it('ajusta volume da ambiência', async () => {
      await tocarSom('vento', 0.3);
      ajustarVolume(0.8);
      // Volume mantido dentro de [0, 1]
      ajustarVolume(1.5);
    });

    it('trata falha de carregamento do arquivo sem quebrar o estado', async () => {
      instalarAudio(class extends AudioFake {
        play = vi.fn().mockRejectedValue(new Error('Falha de rede ao baixar o áudio'));
      });

      await expect(tocarSom('chuva', 0.5)).rejects.toThrow(/Falha de rede/i);
      expect(estaTocando()).toBe(false);
      expect(obterSomAtivo()).toBeNull();
    });
  });

  describe('reprodução de ruídos (Web Audio API)', () => {
    it('toca ruído delegando para tocarRuido', async () => {
      const spyTocarRuido = vi.spyOn(noise, 'tocarRuido').mockImplementation(() => {});
      vi.spyOn(noise, 'suportaAudio').mockReturnValue(true);
      vi.spyOn(noise, 'tocando').mockReturnValue(true);

      await tocarSom('rosa', 0.7);

      expect(spyTocarRuido).toHaveBeenCalledWith('rosa', 0.7);
      expect(obterSomAtivo()?.id).toBe('rosa');
      expect(estaTocando()).toBe(true);
    });

    it('rejeita ruído com mensagem clara se Web Audio API não estiver disponível', async () => {
      vi.spyOn(noise, 'suportaAudio').mockReturnValue(false);

      await expect(tocarSom('marrom', 0.5)).rejects.toThrow(/Web Audio API indisponível/i);
    });
  });

  describe('comportamento unificado (um som por vez)', () => {
    it('trocar de som para o anterior antes de iniciar o novo', async () => {
      const spyPararRuido = vi.spyOn(noise, 'pararRuido');
      vi.spyOn(noise, 'tocarRuido').mockImplementation(() => {});
      vi.spyOn(noise, 'suportaAudio').mockReturnValue(true);

      // Começa com ruído
      await tocarSom('branco', 0.5);
      // Muda para ambiência: deve parar o ruído
      await tocarSom('ondas', 0.5);
      expect(spyPararRuido).toHaveBeenCalled();
      expect(obterSomAtivo()?.id).toBe('ondas');

      // Muda de volta para ruído: deve parar o áudio nativo
      await tocarSom('marrom', 0.5);
      expect(obterSomAtivo()?.id).toBe('marrom');
    });

    it('rejeita som inexistente com erro claro', async () => {
      await expect(tocarSom('som-invalido', 0.5)).rejects.toThrow(/não encontrado/i);
    });
  });
});
