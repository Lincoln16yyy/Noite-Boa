// Regras puras da tela Hoje (issue #210) — seção 5 de
// docs/design/direcao-visual.md. Nada de React aqui: só cálculo, para dar
// para testar fuso, virada de dia e meta sem renderizar a tela.

import { buildDailySeries, formatMinutes } from './dashboard';
import { isoDateNoFuso, partesNoFuso, parseNoFuso } from './fuso';
import type { Goal, SleepLog, StatsSummary } from '../api/types';

/**
 * Resumo com a média do período ANTERIOR (issue #206 do back-end, opcional).
 * O campo ainda não existe no schema público: quando o back-end passar a
 * devolvê-lo, a comparação da semana aparece sozinha; sem o dado, o trecho
 * fica escondido (regra da issue).
 */
export type ResumoComAnterior = StatsSummary & { previousAverageHours?: number };

/** Meta de sono normalizada (defaults do app quando a API não manda). */
export interface MetaNormalizada {
  minutos: number;
  /** Alvo de dormir 'HH:mm' (pode vir 'HH:mm:ss'), vazio quando não definido. */
  dormir: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Meta padrão do app quando o /goal não informa: 8h. */
export const META_PADRAO_MINUTOS = 480;

/** Normaliza o Goal da API: minutos e alvo de dormir 'HH:mm'. */
export function normalizarMeta(goal: Goal | null | undefined): MetaNormalizada {
  const minutos = goal?.targetMinutes && goal.targetMinutes > 0 ? goal.targetMinutes : META_PADRAO_MINUTOS;
  const partes = (goal?.bedtime ?? '').split(':');
  const dormir =
    partes.length >= 2 && partes[0] !== undefined && partes[1] !== undefined && !Number.isNaN(Number(partes[0]))
      ? `${pad(Number(partes[0]))}:${pad(Number(partes[1]))}`
      : '';
  return { minutos, dormir };
}

/** Resumo da última noite registrada (o registro mais recente pelo início). */
export interface UltimaNoite {
  /** Minutos dormidos. */
  minutos: number;
  /** Porcentagem da meta, cortada em 100 (seção 5 do guia). */
  porcentagem: number;
  /** Hora de dormir 'HH:MM' no fuso do perfil. */
  dormiu: string;
  /** Hora de acordar 'HH:MM' no fuso do perfil. */
  acordou: string;
}

function horaNoFuso(iso: string | undefined, timeZone: string): string {
  if (!iso) return '--:--';
  const { hora, minuto } = partesNoFuso(new Date(iso), timeZone);
  return `${pad(hora)}:${pad(minuto)}`;
}

/**
 * Registro mais recente (pelo início — a API já vem DESC, mas não confiamos
 * na ordem) com duração, porcentagem da meta e horários de parede no fuso.
 * `null` quando não há nenhum registro com horários completos.
 */
export function ultimaNoite(
  logs: SleepLog[] | null | undefined,
  metaMinutos: number,
  timeZone: string,
): UltimaNoite | null {
  const completos = (logs ?? []).filter((log) => Boolean(log.sleepStart && log.sleepEnd));
  if (completos.length === 0) return null;

  const ultimo = completos.reduce((a, b) =>
    new Date(b.sleepStart ?? 0).getTime() > new Date(a.sleepStart ?? 0).getTime() ? b : a,
  );
  const inicio = new Date(ultimo.sleepStart ?? 0).getTime();
  const fim = new Date(ultimo.sleepEnd ?? 0).getTime();
  const minutos = Math.max(0, Math.round((fim - inicio) / 60000));
  const porcentagem = metaMinutos > 0 ? Math.min(100, Math.round((minutos / metaMinutos) * 100)) : 0;

  return {
    minutos,
    porcentagem,
    dormiu: horaNoFuso(ultimo.sleepStart, timeZone),
    acordou: horaNoFuso(ultimo.sleepEnd, timeZone),
  };
}

/** 45 → "45 min"; 192 → "3h12" (min abaixo de 1h ficam em minutos). */
function formatarContagem(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  return formatMinutes(minutos);
}

/**
 * Contagem até a hora de dormir da meta, no fuso do perfil (seção 5):
 * - antes do alvo de hoje: `em 3h12`
 * - até 3 h depois do alvo: `agora`
 * - mais de 3 h depois: `amanhã às 23:00`
 *
 * `dormir` é o alvo 'HH:mm' já normalizado (vazio → '').
 */
export function contagemParaDormir(dormir: string, agora: Date, timeZone: string): string {
  const [horaStr, minutoStr = '0'] = dormir.split(':');
  const hora = Number(horaStr);
  const minuto = Number(minutoStr);
  if (!dormir || Number.isNaN(hora) || Number.isNaN(minuto)) return '';

  const alvoHoje = parseNoFuso(`${isoDateNoFuso(agora, timeZone)}T${pad(hora)}:${pad(minuto)}`, timeZone);
  const diferencaMin = Math.round((alvoHoje.getTime() - agora.getTime()) / 60000);

  if (diferencaMin > 0) return `em ${formatarContagem(diferencaMin)}`;
  if (diferencaMin >= -180) return 'agora'; // passou há menos de 3 h
  return `amanhã às ${pad(hora)}:${pad(minuto)}`;
}

/** Significado da cor da barra/anel (mesma regra do Dashboard). */
export type CorMeta = 'within' | 'below';

/** Uma barra da semana: dia, horas e cor pelo significado. */
export interface BarraDia {
  date: string;
  label: string;
  hours: number;
  hasData: boolean;
  cor: CorMeta;
  /** Altura em % da trilha (0 quando o dia não tem registro). */
  altura: number;
}

/**
 * Últimos 7 dias para o bloco "Esta semana": dias do fuso do perfil, cor
 * Âmbar quando abaixo da meta e Lavanda quando dentro (igual ao Dashboard),
 * altura proporcional à maior noite (nunca acima da meta visualmente).
 */
export function barrasDaSemana(
  summary: ResumoComAnterior | null | undefined,
  metaHoras: number,
  agora: Date = new Date(),
  timeZone: string = 'America/Sao_Paulo',
): BarraDia[] {
  const serie = buildDailySeries(summary, 7, agora, timeZone);
  const maiorNoite = serie.reduce((max, dia) => Math.max(max, dia.hours), 0);
  const teto = Math.max(metaHoras, maiorNoite) || 1;

  return serie.map((dia) => ({
    date: dia.date,
    label: etiquetaDia(dia.date, timeZone),
    hours: dia.hours,
    hasData: dia.hasData,
    // Regra do Dashboard: Âmbar abaixo da meta, Lavanda dentro (dia sem
    // registro entra como Lavanda, igual ao gráfico).
    cor: dia.hours > 0 && dia.hours < metaHoras ? 'below' : 'within',
    altura: dia.hasData ? Math.max(6, Math.round((dia.hours / teto) * 100)) : 0,
  }));
}

/** Inicial do dia da semana em pt-BR ('S','T','Q','S','D') no fuso dado. */
export function etiquetaDia(iso: string, timeZone: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow', timeZone }).format(
    new Date(Date.UTC(ano, mes - 1, dia, 12)), // meio-dia: evita borda de fuso
  );
}

/**
 * Comparação com a semana anterior (só quando a API manda
 * `previousAverageHours`). `null` = esconder o trecho (regra da issue).
 */
export function comparacaoSemana(resumo: ResumoComAnterior | null | undefined): {
  texto: string;
  cor: CorMeta;
} | null {
  const anterior = resumo?.previousAverageHours;
  const atual = resumo?.averageHours;
  if (anterior === undefined || anterior === null || atual === undefined || atual === null) return null;

  const diferenca = Math.round((atual - anterior) * 60);
  const sinal = diferenca >= 0 ? '+' : '−';
  return {
    texto: `${sinal}${Math.abs(diferenca)} min vs. semana passada`,
    // Pior = Ámbar (abaixo), melhor = Lavanda (dentro).
    cor: diferenca < 0 ? 'below' : 'within',
  };
}
