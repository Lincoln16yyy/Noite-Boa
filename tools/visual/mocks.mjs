// Dados fictícios para simular a API. Ao criar rota nova no back-end, adicione aqui.
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const daysAgo = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);

const horas = [6.8, 7.4, 8.1, 5.9, 7.7, 8.4];
const camas = ['23:40', '23:15', '22:50', '00:20', '23:05', '22:45'];
const daily = [6, 5, 4, 3, 2, 1].map((n, i) => ({ date: iso(daysAgo(n)), hoursSlept: horas[i], bedtime: camas[i] }));

const logs = [1, 2, 3, 4, 5].map((n, i) => {
  const s = daysAgo(n);
  s.setHours(23, [10, 40, 5, 50, 20][i]);
  const e = new Date(s.getTime() + [7.5, 6.8, 8.2, 6, 7.7][i] * 3600e3);
  return {
    id: `id-${i}`,
    sleepStart: s.toISOString(),
    sleepEnd: e.toISOString(),
    quality: [4, 3, 5, 2, 4][i],
    notes: i === 0 ? 'Dormi bem, sem acordar.' : null,
  };
});

export const me = { id: 'u1', email: 'lincoln@example.com', displayName: 'Lincoln', timezone: 'America/Sao_Paulo', shareWithFriends: true };

// chave = caminho depois de /api
export const mocks = {
  '/me': me,
  '/goal': { targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' },
  '/stats/summary': { days: 7, averageHours: 7.35, consistencyMinutes: 38, sleepDebtMinutes: 150, daily },
  '/sleep-logs': { content: logs, totalPages: 1, totalElements: 5, number: 0, size: 20 },
  '/friends': [
    { id: 'f1', displayName: 'Evillyn', email: 'e@example.com', sharesData: true },
    { id: 'f2', displayName: 'Kassio', email: 'k@example.com', sharesData: false },
  ],
  '/friends/requests': {
    sent: [],
    received: [{ id: 'r1', friend: { id: 'u9', displayName: 'Nailan', email: 'n@example.com', sharesData: true }, createdAt: now.toISOString() }],
  },
  '/friends/ranking': {
    days: 7,
    ranking: [
      { userId: 'u2', displayName: 'Evillyn', isMe: false, consistencyPercent: 86, nights: 6 },
      { userId: 'u1', displayName: 'Lincoln', isMe: true, consistencyPercent: 71, nights: 5 },
    ],
  },
};

// nome, caminho, precisa de login?
export const telas = [
  ['home', '/', false],
  ['login', '/login', false],
  ['cadastro', '/cadastro', false],
  ['hoje', '/hoje', true],
  ['registrar', '/registrar', true],
  ['historico', '/historico', true],
  ['dashboard', '/dashboard', true],
  ['amigos', '/amigos', true],
  ['sons', '/sons', true],
  ['configuracoes', '/configuracoes', true],
  ['home-conta-excluida', '/?deleted=true', false],
  ['privacidade', '/privacidade', false],
];

// ===== Simulação de estados (issue #214) =====
// 'ok' (padrão) devolve os dados fictícios acima. Os outros modos servem para
// tirar prints dos estados de vazio, carregando e erro sem tocar na API.
export const ESTADOS = ['ok', 'vazio', 'carregando', 'erro'];

/** Dados no formato de uma resposta vazia (nenhuma noite, nenhum amigo). */
export const mocksVazio = {
  '/me': me,
  '/goal': { targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' },
  '/stats/summary': { days: 7, averageHours: 0, consistencyMinutes: 0, sleepDebtMinutes: 0, daily: [] },
  '/sleep-logs': { content: [], totalPages: 0, totalElements: 0, number: 0, size: 20 },
  '/friends': [],
  '/friends/requests': { sent: [], received: [] },
  '/friends/ranking': { days: 7, ranking: [] },
};
