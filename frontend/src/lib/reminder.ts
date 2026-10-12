import { api } from '../api/client';

/**
 * Lembrete de hora de dormir (issue #38) — melhor esforço.
 *
 * Limitação honesta (PLANO.md §3): notificação web só é garantida com o app
 * aberto (aba aberta ou instalado). Aqui NÃO prometemos alarme.
 */
const CHAVE = 'noiteboa.lembrete';
let timer = null;

/** Preferência fica neste dispositivo (localStorage), não na conta. */
export function lembreteAtivo() {
  return localStorage.getItem(CHAVE) === '1';
}

export function setLembreteAtivo(ativo) {
  if (ativo) localStorage.setItem(CHAVE, '1');
  else localStorage.removeItem(CHAVE);
}

export function suportaNotificacao() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'default' | 'granted' | 'denied' | 'unsupported' */
export function permissaoNotificacao() {
  return suportaNotificacao() ? window.Notification.permission : 'unsupported';
}

/** ms até a próxima ocorrência de "HH:MM" no relógio local (se já passou, amanhã). */
export function msAte(hora, agora = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora).trim());
  if (!m) return null;
  const alvo = new Date(agora);
  alvo.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime() - agora.getTime();
}

async function notificar(titulo, corpo) {
  const opcoes = { body: corpo, icon: '/icon-192.png', badge: '/icon-192.png' };

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

/** Agenda o disparo na próxima ocorrência de `hora` e rearma para o dia seguinte. */
export function agendarLembrete(hora) {
  cancelarLembrete();
  const atraso = msAte(hora);
  if (atraso === null) return false;
  timer = window.setTimeout(() => {
    timer = null;
    void notificar('Noite Boa — hora de dormir', `${hora}: seu horário de dormir. Durma melhor, no seu ritmo.`);
    agendarLembrete(hora);
  }, atraso);
  return true;
}

export function cancelarLembrete() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/**
 * Liga o lembrete na abertura do app: só se a preferência estiver ativa,
 * a permissão de notificação concedida e a meta tiver horário de dormir.
 */
export async function iniciarLembrete() {
  if (!lembreteAtivo() || permissaoNotificacao() !== 'granted') return false;
  try {
    const goal = await api.get('/goal');
    if (!goal?.bedtime) return false;
    return agendarLembrete(String(goal.bedtime).slice(0, 5));
  } catch {
    return false;
  }
}
