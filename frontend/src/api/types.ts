// Apelidos legíveis para os tipos da API (issue #163).
//
// A fonte da verdade é `src/api/schema.d.ts`, GERADO a partir do OpenAPI do
// back-end. Não escreva os formatos à mão (nomes como `shareWithFriends`,
// `sharesData` e `isMe` mudam e o gerador pega isso). Para regenerar:
//
//   1. suba o back-end em dev (Swagger ligado): mvn spring-boot:run -Dspring-boot.run.profiles=dev
//   2. npm run gen:api
//
// Depois use estes apelidos nas telas (as issues seguintes do M8 fazem isso).
import type { components } from './schema';

type Schemas = components['schemas'];

// --- Usuário / sessão ---
/** Usuário autenticado (GET e PUT /api/me). */
export type User = Schemas['MeResponse'];
/** Corpo do PUT /api/me (fuso e/ou compartilhamento). */
export type UserUpdate = Schemas['UpdateMeRequest'];

// --- Autenticação ---
export type LoginRequest = Schemas['LoginRequest'];
export type LoginResult = Schemas['LoginResponse'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type RegisterResult = Schemas['RegisterResponse'];

// --- Sono ---
/** Registro de sono como a API devolve (GET/POST/PUT /api/sleep-logs). */
export type SleepLog = Schemas['SleepLogResponse'];
/** Corpo para criar ou editar um registro. */
export type SleepLogInput = Schemas['CreateSleepLogRequest'];
/** Página de registros (GET /api/sleep-logs). */
export type SleepLogPage = Schemas['PageSleepLogResponse'];

// --- Estatísticas ---
/** Resumo do dashboard (GET /api/stats/summary). */
export type StatsSummary = Schemas['Summary'];
/** Um dia do resumo. */
export type DayStats = Schemas['DayStats'];

// --- Meta de sono ---
export type Goal = Schemas['GoalResponse'];
export type GoalInput = Schemas['GoalRequest'];

// --- Amigos ---
/** Amigo na listagem (GET /api/friends). */
export type Friend = Schemas['FriendListItem'];
/** Amigo com os dados da amizade (ex.: resposta de aceitar convite). */
export type FriendDetail = Schemas['FriendResponse'];
/** Convites enviados e recebidos (GET /api/friends/requests). */
export type FriendRequests = Schemas['RequestsResponse'];
export type FriendRequest = Schemas['RequestResponse'];
/** Corpo do POST /api/friends/requests (convite por e-mail). */
export type InviteRequest = Schemas['InviteRequest'];
export type SendResult = Schemas['SendResult'];

// --- Ranking ---
export type Ranking = Schemas['RankingResponse'];
export type RankingEntry = Schemas['RankingEntry'];
