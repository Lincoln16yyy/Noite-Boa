import { api } from '../api/client';
import type { Goal, User } from '../api/types';
import { fusoDoAparelho, isoDateNoFuso, menosDiasIso, parseNoFuso } from './fuso';

/**
 * Lembrete de hora de dormir (issue #38) — melhor esforço.
 *
 * Limitação honesta (PLANO.md §3): notificação web só é garantida com o app
 * aberto (aba aberta ou instalado). Aqui NÃO prometemos alarme.
 */
const CHAVE = 'noiteboa.lembrete';
let timer: number | null = null;

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
 * ms até a próxima ocorrência de "HH:MM" (se já passou, amanhã).
 *
 * "HH:MM" é hora de PAREDE no fuso do perfil — o mesmo que rege dias e
 * estatísticas (#102, #278). O fuso do aparelho só entra como fallback quando
 * o perfil ainda não trouxe o dele. Assim o lembrete dispara na hora de dormir
 * configurada, mesmo que o aparelho esteja em outro fuso.
 */
export function msAte(
  hora: string,
  agora: Date = new Date(),
  fuso: string = fusoDoAparelho(),
): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora).trim());
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = m[2];
  const hoje = isoDateNoFuso(agora, fuso);
  const alvoHoje = parseNoFuso(`${hoje}T${hh}:${mm}`, fuso);
  if (alvoHoje.getTime() > agora.getTime()) return alvoHoje.getTime() - agora.getTime();
  const amanha = menosDiasIso(hoje, -1);
  return parseNoFuso(`${amanha}T${hh}:${mm}`, fuso).getTime() - agora.getTime();
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
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

/**
 * Liga o lembrete na abertura do app: só se a preferência estiver ativa,
 * a permissão de notificação concedida e a meta tiver horário de dormir.
 */
export async function iniciarLembrete(): Promise<boolean> {
  if (!lembreteAtivo() || permissaoNotificacao() !== 'granted') return false;
  try {
    // `/me` traz o fuso do perfil; sem ele (rede/5xx) o aparelho é o fallback,
    // para o lembrete não deixar de ser armado (#278).
    const [goal, me] = await Promise.all([
      api.get<Goal>('/goal'),
      api.get<User>('/me').catch(() => null),
    ]);
    if (!goal?.bedtime) return false;
    return agendarLembrete(
      String(goal.bedtime).slice(0, 5),
      me?.timezone || fusoDoAparelho(),
    );
  } catch {
    return false;
  }
}
