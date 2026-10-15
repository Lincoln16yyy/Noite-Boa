// Regras puras da tela Histórico (issue #213) — seção 5 de
// docs/design/direcao-visual.md: cartões agrupados por semana ("Esta
// semana", "Semana passada", depois a data). Nada de React aqui.

import { isoDateNoFuso, menosDiasIso } from './fuso';

const pad = (n: number): string => String(n).padStart(2, '0');

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

/** Uma noite no formato da tela (campos obrigatórios). */
export interface Noite {
  id: string;
  sleepStart: string;
  sleepEnd: string;
  quality: number;
  notes?: string | null;
}

/** Grupo de noites de uma mesma semana (domingo a sábado, como no pt-BR). */
export interface GrupoSemana {
  /** 'Esta semana' | 'Semana passada' | 'Semana de dd/MM'. */
  rotulo: string;
  noites: Noite[];
}

/** Domingo da semana de uma data ISO (semanas pt-BR começam no domingo). */
export function inicioDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - data.getUTCDay()); // volta ao domingo
  return `${data.getUTCFullYear()}-${pad(data.getUTCMonth() + 1)}-${pad(data.getUTCDate())}`;
}

/** '2026-10-12' → 'Segunda, 12/10' (título do cartão). */
export function rotuloNoite(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return `${DIAS[data.getUTCDay()]}, ${pad(dia)}/${pad(mes)}`;
}

/**
 * Agrupa as noites por semana (do mais recente para o mais antigo, como a
 * API devolve). `hojeIso` é hoje no fuso do perfil — é ele que decide
 * "Esta semana"/"Semana passada", nunca o relógio do aparelho.
 */
export function agruparPorSemana(noites: Noite[], hojeIso: string, timeZone: string): GrupoSemana[] {
  const estaSemana = inicioDaSemana(hojeIso);
  const semanaPassada = inicioDaSemana(menosDiasIso(estaSemana, 7));
  const grupos: GrupoSemana[] = [];

  for (const noite of noites) {
    const dataNoite = isoDateNoFuso(new Date(noite.sleepStart), timeZone);
    const semana = inicioDaSemana(dataNoite);
    const rotulo =
      semana === estaSemana
        ? 'Esta semana'
        : semana === semanaPassada
          ? 'Semana passada'
          : `Semana de ${rotuloNoite(semana).split(', ')[1]}`;

    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rotulo === rotulo) {
      ultimo.noites.push(noite);
    } else {
      grupos.push({ rotulo, noites: [noite] });
    }
  }

  return grupos;
}
