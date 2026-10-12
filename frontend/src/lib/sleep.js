// Regras de tela para registrar uma noite de sono.
// Espelham as validações do back-end (SleepService/CreateSleepLogRequest):
// início e fim obrigatórios, fim > início, duração máxima de 24h,
// qualidade 1-5 e observação de no máximo 2000 caracteres.
//
// Fuso horário (issue #102): quando a tela informa o fuso do perfil (GET /me),
// os horários de parede digitados são interpretados e exibidos NELE — igual ao
// agrupamento do back-end. Sem fuso, vale o do aparelho (comportamento antigo).

import { formatarNoFuso, isoDateNoFuso, localInputNoFuso, menosDiasIso, parseNoFuso, partesNoFuso } from './fuso';

const pad = (n) => String(n).padStart(2, '0');

/** Converte Date (ou ISO vindo da API) para o formato dos inputs datetime-local. */
export function toLocalInput(date, timeZone) {
  if (timeZone) return localInputNoFuso(date, timeZone);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function at(date, hours, minutes = 0) {
  const d = new Date(date.getTime());
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Padrões inteligentes: dormiu ontem às 23:00 e acordou hoje às 07:00.
 * Se a pessoa está registrando de madrugada (antes das 07:00), o fim vira "agora".
 * Com `timeZone`, os "ontem/hoje" são de parede no fuso do perfil (issue #102).
 */
export function smartDefaults(now = new Date(), timeZone) {
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

export function validateSleepForm({ sleepStart, sleepEnd, quality, notes }) {
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

export function toApiPayload({ sleepStart, sleepEnd, quality, notes }, timeZone) {
  const start = timeZone ? parseNoFuso(sleepStart, timeZone) : new Date(sleepStart);
  const end = timeZone ? parseNoFuso(sleepEnd, timeZone) : new Date(sleepEnd);
  return {
    sleepStart: start.toISOString(),
    sleepEnd: end.toISOString(),
    quality: Number(quality),
    notes: notes || null,
  };
}

export function formatDuration(startIso, endIso) {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  const signal = minutes < 0 ? '-' : '';
  return rest ? `${signal}${hours}h${pad(rest)}m` : `${signal}${hours}h`;
}

const twoDigits = (n) => String(n).padStart(2, '0');

export function formatLocal(iso, timeZone) {
  if (timeZone) return formatarNoFuso(iso, timeZone);
  const d = new Date(iso);
  return `${twoDigits(d.getDate())}/${twoDigits(d.getMonth() + 1)} ${twoDigits(d.getHours())}h${twoDigits(d.getMinutes())}`;
}
