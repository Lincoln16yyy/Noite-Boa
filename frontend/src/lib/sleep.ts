// Regras de tela para registrar uma noite de sono.
// Espelham as validações do back-end (SleepService/CreateSleepLogRequest):
// início e fim obrigatórios, fim > início, duração máxima de 24h,
// qualidade 1-5 e observação de no máximo 2000 caracteres.
//
// Fuso horário (issue #102): quando a tela informa o fuso do perfil (GET /me),
// os horários de parede digitados são interpretados e exibidos NELE — igual ao
// agrupamento do back-end. Sem fuso, vale o do aparelho (comportamento antigo).

import { formatarNoFuso, fusoDoAparelho, isoDateNoFuso, localInputNoFuso, menosDiasIso, parseNoFuso, partesNoFuso } from './fuso';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Horários de dormir/acordar preenchidos na tela (valores dos inputs). */
export interface SleepForm {
  sleepStart: string;
  sleepEnd: string;
  quality: number;
  notes?: string | null;
}

/**
 * Entrada de `toApiPayload`: aceita `quality` como número OU string (o input do
 * formulário pode entregar string; a função normaliza com `Number`).
 */
export interface SleepPayloadInput extends Omit<SleepForm, 'quality'> {
  quality: number | string;
}

/** Padrões iniciais do formulário de registro. */
export interface SleepDefaults {
  sleepStart: string;
  sleepEnd: string;
}

/** Corpo enviado à API para criar/editar um registro. */
export interface SleepLogPayload {
  sleepStart: string;
  sleepEnd: string;
  quality: number;
  notes: string | null;
}

/** Converte Date (ou ISO vindo da API) para o formato dos inputs datetime-local. */
export function toLocalInput(date: Date, timeZone?: string): string {
  if (timeZone) return localInputNoFuso(date, timeZone);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function at(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date.getTime());
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Padrões inteligentes: dormiu ontem às 23:00 e acordou hoje às 07:00.
 * Se a pessoa está registrando de madrugada (antes das 07:00), o fim vira "agora".
 * Com `timeZone`, os "ontem/hoje" são de parede no fuso do perfil (issue #102).
 */
export function smartDefaults(now: Date = new Date(), timeZone?: string): SleepDefaults {
  if (timeZone) {
    const agora = partesNoFuso(now, timeZone);
    const hoje = isoDateNoFuso(now, timeZone);
    return {
      sleepStart: `${menosDiasIso(hoje, 1)}T23:00`,
      sleepEnd: agora.hora < 7 ? localInputNoFuso(now, timeZone) : `${hoje}T07:00`,
    };
  }
  const start = at(now, 23);
  start.setDate(start.getDate() - 1);

  const sevenAm = at(now, 7);
  const end = now.getTime() < sevenAm.getTime() ? new Date(now.getTime()) : sevenAm;

  return { sleepStart: toLocalInput(start), sleepEnd: toLocalInput(end) };
}

export function validateSleepForm({ sleepStart, sleepEnd, quality, notes }: SleepForm): string {
  if (!sleepStart || !sleepEnd) return 'Preencha os horários de dormir e de acordar.';
  const start = new Date(sleepStart);
  const end = new Date(sleepEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Horário inválido.';
  if (end.getTime() <= start.getTime()) return 'O horário de acordar precisa ser depois de dormir.';
  if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) return 'A duração máxima é de 24 horas.';
  if (!quality || quality < 1 || quality > 5) return 'Escolha uma qualidade de 1 a 5.';
  if (notes && notes.length > 2000) return 'A observação pode ter no máximo 2000 caracteres.';
  return '';
}

export function toApiPayload({ sleepStart, sleepEnd, quality, notes }: SleepPayloadInput, timeZone?: string): SleepLogPayload {
  const start = timeZone ? parseNoFuso(sleepStart, timeZone) : new Date(sleepStart);
  const end = timeZone ? parseNoFuso(sleepEnd, timeZone) : new Date(sleepEnd);
  return {
    sleepStart: start.toISOString(),
    sleepEnd: end.toISOString(),
    quality: Number(quality),
    notes: notes || null,
  };
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  const signal = minutes < 0 ? '-' : '';
  return rest ? `${signal}${hours}h${pad(rest)}m` : `${signal}${hours}h`;
}

/** Formato de `datetime-local` (`YYYY-MM-DDTHH:mm`) — o que o formulário entrega. */
const FORMATO_DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u;

/**
 * Minutos entre dois valores `datetime-local` do formulário (issue #212).
 * Com `timeZone`, os horários de parede são interpretados no fuso do perfil
 * (mesma regra do payload). Devolve `null` quando algum lado falta, é
 * inválido, não está no formato do input ou quando o fim não é depois do
 * início (acordar antes de dormir não tem duração) — a tela mostra "—" em
 * vez de uma duração falsa.
 */
export function minutosEntre(inicio: string, fim: string, timeZone?: string): number | null {
  if (!inicio || !fim) return null;
  if (!FORMATO_DATETIME_LOCAL.test(inicio) || !FORMATO_DATETIME_LOCAL.test(fim)) return null;
  const start = timeZone ? parseNoFuso(inicio, timeZone) : new Date(inicio);
  const end = timeZone ? parseNoFuso(fim, timeZone) : new Date(fim);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const minutos = (end.getTime() - start.getTime()) / 60000;
  return minutos > 0 ? minutos : null;
}

/** 456 → "7h 36min"; 45 → "45min"; 120 → "2h" (formato do mockup). */
export function formatarDuracaoLonga(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}min`;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

/** 450 → "7h30"; 480 → "8h"; 45 → "45min" (formato compacto do histórico). */
export function formatarDuracaoCurta(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}min`;
  return rest ? `${hours}h${pad(rest)}` : `${hours}h`;
}

/** ISO → 'HH:mm' de parede no fuso dado (intervalo do cartão do histórico). */
export function formatarHora(iso: string, timeZone?: string): string {
  if (!iso) return '--:--';
  const { hora, minuto } = partesNoFuso(new Date(iso), timeZone ?? fusoDoAparelho());
  return `${pad(hora)}:${pad(minuto)}`;
}

/** ISO → minutos entre dois instantes (0 se algum lado faltar). */
export function minutosDoRegistro(inicioIso: string, fimIso: string): number {
  if (!inicioIso || !fimIso) return 0;
  return Math.max(0, Math.round((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60000));
}

/**
 * Porcentagem da meta, cortada em 100 (mesma regra do anel da tela Hoje).
 * Meta inválida/zerada → 0.
 */
export function porcentagemDaMeta(minutos: number, metaMinutos: number): number {
  if (!metaMinutos || metaMinutos <= 0) return 0;
  return Math.min(100, Math.round((minutos / metaMinutos) * 100));
}

/**
 * Rótulo relativo do dia de um registro ('hoje', 'ontem' ou 'dd/MM'),
 * pela data ISO (`YYYY-MM-DD`) no fuso do perfil — issue #212.
 */
export function rotuloDiaRelativo(isoDate: string, hojeIso: string): string {
  if (isoDate === hojeIso) return 'hoje';
  if (isoDate === menosDiasIso(hojeIso, 1)) return 'ontem';
  const [, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}`;
}

const twoDigits = (n: number): string => String(n).padStart(2, '0');

export function formatLocal(iso: string, timeZone?: string): string {
  if (timeZone) return formatarNoFuso(iso, timeZone);
  const d = new Date(iso);
  return `${twoDigits(d.getDate())}/${twoDigits(d.getMonth() + 1)} ${twoDigits(d.getHours())}h${twoDigits(d.getMinutes())}`;
}
