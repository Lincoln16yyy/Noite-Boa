// Fuso horário único do produto (issue #102): a fonte da verdade é o fuso do
// perfil (GET /me) — é o back-end agrupa estatísticas e ranking por ele. Aqui,
// utilitários sem dependência para converter entre instantes (UTC) e dias ou
// horas de parede no fuso do perfil (Intl.DateTimeFormat resolve).

/** Partes de parede de um instante (números; hora 0-23). */
export interface PartesNoFuso {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Fuso do aparelho/navegador, ex.: 'America/Sao_Paulo'. */
export function fusoDoAparelho(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Partes de parede de um instante no fuso dado (números; hora 0-23). */
export function partesNoFuso(date: Date, timeZone: string): PartesNoFuso {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24, // en-US pode devolver 24 à meia-noite
    minuto: Number(p.minute),
  };
}

/** Chave de dia ('YYYY-MM-DD') de um instante no fuso dado. */
export function isoDateNoFuso(date: Date, timeZone: string): string {
  const { ano, mes, dia } = partesNoFuso(date, timeZone);
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** 'YYYY-MM-DD' menos n dias, por aritmética UTC (sem armadilha de fuso). */
export function menosDiasIso(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) - n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Offset (minutos, arredondado) do fuso em um instante. */
function offsetMinutos(ms: number, timeZone: string): number {
  const { ano, mes, dia, hora, minuto } = partesNoFuso(new Date(ms), timeZone);
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  return Math.round((comoUtc - ms) / 60000);
}

/**
 * 'YYYY-MM-DDTHH:mm' (datetime-local) interpretado como hora de PAREDE no fuso
 * dado → instante real. Dois passeios no offset cobrem a virada de horário de
 * verão (o offset do instante pretendido e o do instante corrigido).
 */
export function parseNoFuso(local: string, timeZone: string): Date {
  const [data, hora] = local.split('T');
  const [a, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const pretendido = Date.UTC(a, m - 1, d, hh, mm);
  const off1 = offsetMinutos(pretendido, timeZone);
  const off2 = offsetMinutos(pretendido - off1 * 60000, timeZone);
  return new Date(pretendido - off2 * 60000);
}

/** Instante real → 'YYYY-MM-DDTHH:mm' de parede no fuso dado (input datetime-local). */
export function localInputNoFuso(date: Date, timeZone: string): string {
  const { ano, mes, dia, hora, minuto } = partesNoFuso(date, timeZone);
  return `${ano}-${pad(mes)}-${pad(dia)}T${pad(hora)}:${pad(minuto)}`;
}

/** ISO → 'dd/MM HHhmm' de parede no fuso dado (exibição do histórico). */
export function formatarNoFuso(iso: string, timeZone: string): string {
  const { mes, dia, hora, minuto } = partesNoFuso(new Date(iso), timeZone);
  return `${pad(dia)}/${pad(mes)} ${pad(hora)}h${pad(minuto)}`;
}
