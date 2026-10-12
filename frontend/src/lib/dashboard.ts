// Montagem dos dados do dashboard a partir do GET /api/stats/summary.
// O back-end agrupa por dia local do usuário (fuso do perfil, issue #102);
// aqui completamos os dias sem registro com 0 h NO MESMO FUSO, para a série
// não deslocar quando o fuso do aparelho difere do perfil (viagem).

import { fusoDoAparelho, isoDateNoFuso, menosDiasIso } from './fuso';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Série contínua de `days` dias terminando hoje, com as horas vindo do resumo.
 * Dias sem registro entram com 0 h (para o gráfico de barras não furar).
 * `timeZone` é o fuso do perfil (default: o do aparelho, comportamento antigo);
 * os dias são calculados nele, igual ao agrupamento do back-end.
 */
export function buildDailySeries(summary, days, today = new Date(), timeZone = fusoDoAparelho()) {
  const byDate = new Map((summary?.daily ?? []).map((day) => [day.date, day.hoursSlept]));
  const series = [];
  const hojeIso = isoDateNoFuso(today, timeZone);
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = menosDiasIso(hojeIso, i);
    const [, mes, dia] = key.split('-');
    series.push({
      date: key,
      label: `${dia}/${mes}`,
      hours: byDate.get(key) ?? 0,
      hasData: byDate.has(key),
    });
  }
  return series;
}

/** 7.42 → "7h25" */
export function formatHours(value) {
  const totalMinutes = Math.round((Number(value) || 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h${pad(minutes)}` : `${hours}h`;
}

/** 210 → "3h30" */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h${pad(rest)}` : `${hours}h`;
}
