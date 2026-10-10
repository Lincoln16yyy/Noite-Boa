/**
 * Sons de relaxamento — fase 1 da issue #91: ruído gerado no navegador.
 *
 * Os sons são criados com a Web Audio API nativa: nenhum arquivo é baixado,
 * nenhum tráfego de rede é gerado e não há licença de áudio envolvida
 * (ver docs/audio.md). Reprodução sempre a partir de gesto do usuário —
 * o autoplay é bloqueado pelos navegadores.
 */

const SEGUNDOS_BUFFER = 2;

let contexto = null;
let fonteAtual = null;
let ganhoAtual = null;

export const TIPOS_RUIDO = [
  { id: 'branco', nome: 'Ruído branco' },
  { id: 'rosa', nome: 'Ruído rosa' },
  { id: 'marrom', nome: 'Ruído marrom' },
];

export function suportaAudio() {
  return (
    typeof window !== 'undefined' &&
    (typeof window.AudioContext === 'function' ||
      typeof window.webkitAudioContext === 'function')
  );
}

/**
 * Amostras do ruído escolhido em [-1, 1].
 * - branco: aleatório puro;
 * - rosa: filtro de Paul Kellet (curva suave, "chuva");
 * - marrom: integração do sinal (grave, "ondas").
 */
export function amostrasRuido(tipo, quantidade) {
  const dados = new Float32Array(quantidade);
  if (tipo === 'branco') {
    for (let i = 0; i < quantidade; i += 1) {
      dados[i] = Math.random() * 2 - 1;
    }
  } else if (tipo === 'rosa') {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < quantidade; i += 1) {
      const branco = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + branco * 0.0555179;
      b1 = 0.99332 * b1 + branco * 0.0750759;
      b2 = 0.969 * b2 + branco * 0.153852;
      b3 = 0.8665 * b3 + branco * 0.3104856;
      b4 = 0.55 * b4 + branco * 0.5329522;
      b5 = -0.7616 * b5 - branco * 0.016898;
      dados[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + branco * 0.5362) * 0.11;
      b6 = branco * 0.115926;
    }
  } else if (tipo === 'marrom') {
    let ultima = 0;
    for (let i = 0; i < quantidade; i += 1) {
      const branco = Math.random() * 2 - 1;
      ultima = (ultima + 0.02 * branco) / 1.02;
      dados[i] = ultima * 3.5;
    }
  } else {
    throw new Error(`Tipo de ruído desconhecido: ${tipo}`);
  }
  return dados;
}

function contextoAudio() {
  if (!contexto) {
    const Classe = window.AudioContext || window.webkitAudioContext;
    if (!Classe) throw new Error('Web Audio API indisponível neste navegador');
    contexto = new Classe();
  }
  return contexto;
}

/**
 * Toca o ruído escolhido em loop (repara o anterior, se houver).
 * Deve ser chamado a partir de gesto do usuário (política de autoplay).
 * @throws {Error} se a Web Audio API não estiver disponível.
 */
export function tocarRuido(tipo, volume = 0.5) {
  pararRuido();
  const ctx = contextoAudio();
  if (ctx.state === 'suspended') ctx.resume();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * SEGUNDOS_BUFFER, ctx.sampleRate);
  buffer.getChannelData(0).set(amostrasRuido(tipo, buffer.length));
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.loop = true;
  const ganho = ctx.createGain();
  ganho.gain.value = volume;
  fonte.connect(ganho);
  ganho.connect(ctx.destination);
  fonte.start();
  fonteAtual = fonte;
  ganhoAtual = ganho;
}

/** Para a reprodução atual (se houver) e libera os nós. */
export function pararRuido() {
  if (fonteAtual) {
    try {
      fonteAtual.stop();
    } catch {
      /* fonte já estava parada */
    }
    fonteAtual.disconnect();
    fonteAtual = null;
  }
  if (ganhoAtual) {
    ganhoAtual.disconnect();
    ganhoAtual = null;
  }
}

/** Ajusta o volume (0 a 1) do que estiver tocando; sem efeito se parado. */
export function ajustarVolume(volume) {
  if (ganhoAtual) ganhoAtual.gain.value = volume;
}

/** true se há som tocando agora. */
export function tocando() {
  return fonteAtual !== null;
}
