import { api } from '../api/client';
import type { Goal } from '../api/types';
import {
  fusoDoAparelho,
  isoDateNoFuso,
  menosDiasIso,
  offsetMinutos,
  partesNoFuso,
  parseNoFuso,
} from './fuso';

/**
 * Lembrete de hora de dormir (issue #38) — melhor esforço.
 *
 * Limitação honesta (PLANO.md §3): notificação web só é garantida com o app
 * aberto (aba aberta ou instalado). Aqui NÃO prometemos alarme.
 */
const CHAVE = 'noiteboa.lembrete';
let timer: number | null = null;
/**
 * Versão da agenda: muda a cada agendamento/cancelamento explícito. Uma
 * leitura de `/goal` que começou antes não pode rearmar por cima do que a
 * pessoa acabou de salvar/desligar (review do #278).
 */
let versaoDaAgenda = 0;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Preferência fica neste dispositivo (localStorage), não na conta. */
export function lembreteAtivo(): boolean {
  return localStorage.getItem(CHAVE) === '1';
}

export function setLembreteAtivo(ativo: boolean): void {
  if (ativo) localStorage.setItem(CHAVE, '1');
  else localStorage.removeItem(CHAVE);
}

export function suportaNotificacao(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'default' | 'granted' | 'denied' | 'unsupported' */
export function permissaoNotificacao(): NotificationPermission | 'unsupported' {
  return suportaNotificacao() ? window.Notification.permission : 'unsupported';
}

/**
 * Instantes (ms) em que o relógio de parede no fuso marca `dia` + `hh:mm`.
 * Pode haver dois (volta do horário de verão) ou nenhum (buraco na ida).
 */
function instantesDaHora(dia: string, hh: number, mm: number, fuso: string): number[] {
  const [ano, mes, d] = dia.split('-').map(Number);
  const naive = Date.UTC(ano, mes - 1, d, hh, mm);
  // O offset perto da transição assume no máximo dois valores; amostrar antes,
  // no ponto e depois cobre os dois (e o caso normal).
  const offsets = new Set([
    offsetMinutos(naive - 86400000, fuso),
    offsetMinutos(naive, fuso),
    offsetMinutos(naive + 86400000, fuso),
  ]);
  const instantes: number[] = [];
  for (const off of offsets) {
    const t = naive - off * 60000;
    const p = partesNoFuso(new Date(t), fuso);
    if (p.ano === ano && p.mes === mes && p.dia === d && p.hora === hh && p.minuto === mm) {
      instantes.push(t);
    }
  }
  return [...new Set(instantes)];
}

/**
 * Primeiro instante em que o relógio de parede alcança `hh:mm` quando esse
 * horário não existe naquele dia (buraco do horário de verão): o fim do
 * buraco. Sem isso o alvo cairia uma hora antes/depois do horário pedido.
 */
function fimDoBuraco(dia: string, hh: number, mm: number, fuso: string): number {
  const [ano, mes, d] = dia.split('-').map(Number);
  const naive = Date.UTC(ano, mes - 1, d, hh, mm);
  // Começa bem antes e avança até o relógio de parede passar do horário.
  const inicio = naive - 14 * 3600000;
  for (let k = 0; k <= 16 * 60; k += 1) {
    const t = inicio + k * 60000;
    const p = partesNoFuso(new Date(t), fuso);
    if (
      p.ano === ano &&
      p.mes === mes &&
      p.dia === d &&
      (p.hora > hh || (p.hora === hh && p.minuto >= mm))
    ) {
      return t;
    }
  }
  return parseNoFuso(`${dia}T${pad(hh)}:${pad(mm)}`, fuso).getTime();
}

/**
 * ms até a próxima ocorrência de "HH:MM" (se já passou, amanhã).
 *
 * "HH:MM" é hora de PAREDE no fuso do perfil — o mesmo que rege dias e
 * estatísticas (#102, #278). O fuso do aparelho só entra como fallback quando
 * o perfil ainda não trouxe o dele. Assim o lembrete dispara na hora de dormir
 * configurada, mesmo que o aparelho esteja em outro fuso.
 *
 * Horário de verão: na volta, escolhe a ocorrência que ainda está à frente
 * (não pula a segunda 01:30); na ida, se o horário não existe, usa o fim do
 * buraco.
 */
export function msAte(
  hora: string,
  agora: Date = new Date(),
  fuso: string = fusoDoAparelho(),
): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora).trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);

  const proximo = (dia: string): number | undefined => {
    const instantes = instantesDaHora(dia, hh, mm, fuso);
    const candidatos = instantes.length > 0 ? instantes : [fimDoBuraco(dia, hh, mm, fuso)];
    // No máximo dois candidatos (volta do horário de verão): pega o menor que
    // ainda está à frente, sem depender da ordem de inserção.
    const agoraMs = agora.getTime();
    let melhor: number | undefined;
    for (const t of candidatos) {
      if (t > agoraMs && (melhor === undefined || t < melhor)) melhor = t;
    }
    return melhor;
  };

  const hoje = isoDateNoFuso(agora, fuso);
  const alvoHoje = proximo(hoje);
  if (alvoHoje !== undefined) return alvoHoje - agora.getTime();
  const amanha = menosDiasIso(hoje, -1);
  const alvoAmanha = proximo(amanha);
  return alvoAmanha === undefined ? null : alvoAmanha - agora.getTime();
}

async function notificar(titulo: string, corpo: string): Promise<void> {
  const opcoes: NotificationOptions = { body: corpo, icon: '/icon-192.png', badge: '/icon-192.png' };

  // 1) Service worker já registrado: é o caminho suportado no Chrome/Android
  //    (new Notification lança lá). getRegistration() não pendura quando não
  //    há SW — diferente de serviceWorker.ready, que esperaria para sempre.
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) {
      await registration.showNotification(titulo, opcoes);
      return;
    }
  } catch {
    // sem SW utilizável: tenta o construtor clássico
  }

  // 2) Construtor clássico (desktop). Em navegadores móveis pode lançar —
  //    aí é melhor esforço: sem notificação, sem quebrar o app.
  try {
    const notificacao = new window.Notification(titulo, opcoes);
    void notificacao;
  } catch {
    /* melhor esforço (PLANO.md §3) */
  }
}

/**
 * Agenda o disparo na próxima ocorrência de `hora` e rearma para o dia
 * seguinte, no mesmo fuso (o do perfil — #278).
 */
export function agendarLembrete(hora: string, fuso: string = fusoDoAparelho()): boolean {
  cancelarLembrete();
  const atraso = msAte(hora, new Date(), fuso);
  if (atraso === null) return false;
  timer = window.setTimeout(() => {
    timer = null;
    void notificar('Noite Boa — hora de dormir', `${hora}: seu horário de dormir. Durma melhor, no seu ritmo.`);
    agendarLembrete(hora, fuso);
  }, atraso);
  return true;
}

export function cancelarLembrete(): void {
  versaoDaAgenda += 1;
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/**
 * Liga o lembrete na abertura do app: só se a preferência estiver ativa,
 * a permissão de notificação concedida e a meta tiver horário de dormir.
 */
export async function iniciarLembrete(fusoDoPerfil?: string): Promise<boolean> {
  if (!lembreteAtivo() || permissaoNotificacao() !== 'granted') return false;
  // A versão da leitura: salvar ou desligar o lembrete durante o `/goal` não
  // pode ser desfeito quando a resposta velha chegar (review do #278).
  const versaoDaLeitura = versaoDaAgenda;
  try {
    const goal = await api.get<Goal>('/goal');
    if (versaoDaLeitura !== versaoDaAgenda) return false;
    if (!lembreteAtivo()) return false;
    if (!goal?.bedtime) return false;
    return agendarLembrete(
      String(goal.bedtime).slice(0, 5),
      fusoDoPerfil || fusoDoAparelho(),
    );
  } catch {
    return false;
  }
}
