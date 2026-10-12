import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Fake mínimo de AudioContext para os testes (jsdom não tem Web Audio). */
class AudioContextFake {
  state = 'running';
  sampleRate = 8000;
  destination = { id: 'destination' };
  resume = vi.fn();
  createBuffer = vi.fn((canais, amostras) => {
    const dados = new Float32Array(amostras);
    return {
      length: amostras,
      getChannelData: () => dados,
    };
  });
  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn((destino) => destino),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 0 },
    connect: vi.fn((destino) => destino),
    disconnect: vi.fn(),
  }));
}

async function carregarModulo() {
  vi.resetModules();
  return import('./noise');
}

/** Instala um duplo de teste em window.AudioContext (sem exigir o tipo real). */
function instalarAudioContext(fake: unknown): void {
  Object.defineProperty(window, 'AudioContext', { value: fake, configurable: true, writable: true });
}

describe('gerador de ruído (Web Audio API)', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'AudioContext');
    delete window.webkitAudioContext;
  });

  describe('amostrasRuido', () => {
    it('gera amostras de ruído branco dentro de [-1, 1]', async () => {
      const { amostrasRuido } = await carregarModulo();
      const amostras = amostrasRuido('branco', 1000);
      expect(amostras).toBeInstanceOf(Float32Array);
      expect(amostras).toHaveLength(1000);
      for (const valor of amostras) {
        expect(valor).toBeGreaterThanOrEqual(-1);
        expect(valor).toBeLessThanOrEqual(1);
      }
      // não é tudo zero nem constante
      expect(amostras.some((v) => v !== 0)).toBe(true);
      expect(new Set(amostras).size).toBeGreaterThan(1);
    });

    it('gera amostras de ruído rosa e marrom não nulas e limitadas', async () => {
      const { amostrasRuido } = await carregarModulo();
      for (const tipo of ['rosa', 'marrom'] as const) {
        const amostras = amostrasRuido(tipo, 4000);
        expect(amostras.some((v) => v !== 0)).toBe(true);
        for (const valor of amostras) {
          expect(Math.abs(valor)).toBeLessThanOrEqual(1.5);
        }
      }
    });

    it('rejeita tipo de ruído desconhecido', async () => {
      const { amostrasRuido } = await carregarModulo();
      // @ts-expect-error 'sereia' não é um TipoRuido — exercita o erro em runtime
      expect(() => amostrasRuido('sereia', 10)).toThrow(/desconhecido/i);
    });
  });

  describe('suportaAudio', () => {
    it('retorna false sem AudioContext', async () => {
      const { suportaAudio } = await carregarModulo();
      expect(suportaAudio()).toBe(false);
    });

    it('retorna true com AudioContext', async () => {
      instalarAudioContext(AudioContextFake);
      const { suportaAudio } = await carregarModulo();
      expect(suportaAudio()).toBe(true);
    });
  });

  describe('tocar/parar/volume', () => {
    beforeEach(() => {
      instalarAudioContext(AudioContextFake);
    });

    it('tocarRuido cria fonte em loop ligada ao destino', async () => {
      const { tocarRuido, tocando } = await carregarModulo();
      expect(tocando()).toBe(false);
      tocarRuido('rosa', 0.7);
      expect(tocando()).toBe(true);
    });

    it('pararRuido para a fonte e limpa o estado', async () => {
      const { tocarRuido, pararRuido, tocando } = await carregarModulo();
      tocarRuido('marrom');
      pararRuido();
      expect(tocando()).toBe(false);
    });

    it('tocarRuido duas vezes para a fonte anterior (sem som órfão)', async () => {
      const instancias: AudioContextFake[] = [];
      class ContextoComRegistro extends AudioContextFake {
        constructor() {
          super();
          instancias.push(this);
        }
      }
      instalarAudioContext(ContextoComRegistro);
      const { tocarRuido } = await carregarModulo();
      tocarRuido('branco');
      const primeiraFonte = instancias[0].createBufferSource.mock.results[0].value;
      tocarRuido('rosa');
      expect(primeiraFonte.stop).toHaveBeenCalled();
    });

    it('lança erro claro sem suporte a Web Audio', async () => {
      Reflect.deleteProperty(window, 'AudioContext');
      delete window.webkitAudioContext;
      const { tocarRuido } = await carregarModulo();
      expect(() => tocarRuido('rosa')).toThrow(/Web Audio API/i);
    });

    it('ajustarVolume sem som tocando não lança erro', async () => {
      const { ajustarVolume } = await carregarModulo();
      expect(() => ajustarVolume(0.3)).not.toThrow();
    });

    it('resume o contexto suspenso ao tocar (liberação por gesto)', async () => {
      const instancias: AudioContextFake[] = [];
      class ContextoSuspenso extends AudioContextFake {
        constructor() {
          super();
          this.state = 'suspended';
          instancias.push(this);
        }
      }
      instalarAudioContext(ContextoSuspenso);
      const { tocarRuido } = await carregarModulo();
      tocarRuido('rosa');
      expect(instancias[0].resume).toHaveBeenCalled();
    });
  });
});
