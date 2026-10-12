import {
  ajustarVolume as ajustarVolumeRuido,
  pararRuido,
  suportaAudio as suportaWebAudioApi,
  tocarRuido,
  tocando as tocandoRuido,
} from './noise';

/**
 * Catálogo de sons de relaxamento (issue #91):
 * - Ambiências CC0 (fase 2): arquivos sob demanda em /audio/, preload="none";
 * - Ruídos Web Audio API (fase 1): sintetizados no cliente, zero tráfego.
 */
export const SONS_DISPONIVEIS = [
  {
    id: 'chuva',
    nome: 'Chuva',
    descricao: 'Gravação contínua de chuva suave',
    categoria: 'ambiencia',
    arquivo: '/audio/rain.mp3',
  },
  {
    id: 'ondas',
    nome: 'Ondas',
    descricao: 'Ondas suaves de água natural',
    categoria: 'ambiencia',
    arquivo: '/audio/waves.mp3',
  },
  {
    id: 'vento',
    nome: 'Vento',
    descricao: 'Ambiência contínua de vento relaxante',
    categoria: 'ambiencia',
    arquivo: '/audio/wind.mp3',
  },
  {
    id: 'rosa',
    nome: 'Ruído rosa',
    descricao: 'Frequências balanceadas 1/f (som similar a chuva constante)',
    categoria: 'ruido',
    tipoRuido: 'rosa',
  },
  {
    id: 'marrom',
    nome: 'Ruído marrom',
    descricao: 'Frequências graves predominantes (som similar a cachoeira ao longe)',
    categoria: 'ruido',
    tipoRuido: 'marrom',
  },
  {
    id: 'branco',
    nome: 'Ruído branco',
    descricao: 'Todas as frequências audíveis na mesma intensidade',
    categoria: 'ruido',
    tipoRuido: 'branco',
  },
];

let elementoAudio = null;
let somAtivo = null;

export function suportaWebAudio() {
  return suportaWebAudioApi();
}

export function suportaElementoAudio() {
  return typeof window !== 'undefined' && typeof window.Audio === 'function';
}

function obterElementoAudio() {
  if (!elementoAudio) {
    const AudioConstructor = window.Audio;
    elementoAudio = new AudioConstructor();
    elementoAudio.preload = 'none';
    elementoAudio.loop = true;
  }
  return elementoAudio;
}

/**
 * Toca o som especificado pelo identificador (garante um som por vez: para o anterior).
 * Sempre deve ser acionado por gesto direto do usuário.
 *
 * @param {string} id - Identificador presente em SONS_DISPONIVEIS
 * @param {number} volume - Fração de 0 a 1
 * @returns {Promise<void>}
 */
export async function tocarSom(id, volume = 0.5) {
  const som = SONS_DISPONIVEIS.find((item) => item.id === id);
  if (!som) {
    throw new Error(`Som não encontrado: ${id}`);
  }

  // Interrompe qualquer som em reprodução para garantir um por vez
  pararSom();

  if (som.categoria === 'ruido') {
    if (!suportaWebAudio()) {
      throw new Error('Web Audio API indisponível neste navegador');
    }
    tocarRuido(som.tipoRuido, volume);
    somAtivo = som;
    return;
  }

  if (som.categoria === 'ambiencia') {
    if (!suportaElementoAudio()) {
      throw new Error('Elemento de áudio não suportado neste ambiente');
    }
    const audio = obterElementoAudio();
    audio.src = som.arquivo;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = true;
    audio.preload = 'none';
    somAtivo = som;
    try {
      await audio.play();
    } catch (erro) {
      somAtivo = null;
      throw erro;
    }
  }
}

/**
 * Para qualquer som em reprodução (Web Audio ou elemento nativo de áudio).
 */
export function pararSom() {
  if (somAtivo?.categoria === 'ruido' || tocandoRuido()) {
    pararRuido();
  }
  if (elementoAudio) {
    try {
      elementoAudio.pause();
      elementoAudio.currentTime = 0;
    } catch {
      /* elemento já parado */
    }
  }
  somAtivo = null;
}

/**
 * Ajusta o volume (0 a 1) do som ativo no momento.
 */
export function ajustarVolume(volume) {
  const v = Math.max(0, Math.min(1, volume));
  if (somAtivo?.categoria === 'ruido') {
    ajustarVolumeRuido(v);
  }
  if (elementoAudio) {
    elementoAudio.volume = v;
  }
}

/**
 * Indica se há áudio reproduzindo ativamente no momento.
 */
export function estaTocando() {
  if (somAtivo?.categoria === 'ruido') {
    return tocandoRuido();
  }
  if (elementoAudio && somAtivo?.categoria === 'ambiencia') {
    return !elementoAudio.paused;
  }
  return false;
}

/**
 * Retorna o descritor do som que está selecionado/ativo.
 */
export function obterSomAtivo() {
  return somAtivo;
}

/**
 * Utilitário interno para limpeza completa do estado entre baterias de testes.
 */
export function _resetarEstadoParaTestes() {
  pararSom();
  elementoAudio = null;
  somAtivo = null;
}
