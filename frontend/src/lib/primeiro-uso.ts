import { api, getToken } from '../api/client';
import type { Goal, SleepLogPage } from '../api/types';

/**
 * Primeiro uso (issue #215).
 *
 * O indicador fica NO APARELHO (localStorage), não na conta. Quem conclui ou
 * pula o fluxo não vê de novo ao trocar de aba, deslogar e logar neste mesmo
 * dispositivo; em outro aparelho o fluxo aparece porque lá não há indicador.
 * A preferência não é apagada no logout de propósito: é preferência do
 * aparelho, não da sessão.
 */
export const CHAVE_ONBOARDING = 'noiteboa.onboarding-concluido';

export { esquecerSondagem } from './sonda';

export function onboardingConcluido(): boolean {
  return localStorage.getItem(CHAVE_ONBOARDING) === '1';
}

/**
 * Sonda do primeiro uso: só com quem NÃO tem noite registrada E NÃO tem meta
 * salva. Um dos dois já basta para sair do fluxo — quem já usa o app não deve
 * ser apresentado a ele de novo.
 *
 * `GET /api/goal` responde 200 com um default de 8h quando nunca houve meta,
 * por isso a API ganhou `hasGoal` (issue #215): sem esse campo não haveria
 * como separar "nunca configurou" de "escolheu 8h de propósito". Se o campo
 * não vier (back-end antigo), assumimos que há meta — na dúvida, não se
 * empurra ninguém para o fluxo.
 *
 * Erro de rede também não empurra: sem resposta não dá para saber, e travar
 * o app na primeira tela por causa de um timeout seria pior que a Hoje vazia.
 *
 * O resultado é memoizado por sessão, para as rotas não refazerem as duas
 * chamadas a cada navegação. O estado da memória fica em `lib/sonda.ts`, que o
 * cliente de API também usa para esquecê-la quando a sessão termina (#273).
 */
import { esquecerSondagem, esquecerSondagemSe, guardarSondagem, sondagemAtual } from './sonda';

async function sondar(): Promise<boolean> {
  const [logs, goal] = await Promise.all([
    api.get<SleepLogPage>('/sleep-logs?page=0&size=1'),
    api.get<Goal>('/goal'),
  ]);
  const semNoite = (logs.content?.length ?? 0) === 0;
  const semMeta = goal.hasGoal === false;
  return semNoite && semMeta;
}

/**
 * `true` = primeiro uso; `false` = não é; `null` = não deu para saber (falha
 * de rede/API). Quem redireciona não pode tratar `null` como "não é": um erro
 * momentâneo não confirma nada (review do PR #292).
 */
export function precisaDePrimeiroUso(): Promise<boolean | null> {
  if (onboardingConcluido()) return Promise.resolve(false);
  const cache = sondagemAtual();
  if (cache) return cache;

  // As duas chamadas da sonda leem o token dentro do cliente de API. Se a
  // sessão trocar no meio, elas podem sair de contas diferentes: o resultado
  // não vale para nenhuma e não deve ser usado nem memoizado (review do PR
  // #292).
  const tokenDaSonda = getToken();
  const atual = sondar()
    .then((resultado) => {
      if (getToken() === tokenDaSonda) return resultado;
      // A sessão mudou no meio: o resultado não vale para conta nenhuma. Se
      // esta sonda chegou a ser memoizada sob o token antigo, descarta — senão
      // um `null` ficaria guardado e, ao voltar para aquele token, a próxima
      // consulta o reaproveitaria (review do PR #292).
      esquecerSondagemSe(atual);
      return null;
    })
    .catch(() => {
      // Falha NÃO memoiza: sem resposta não dá para saber se é primeiro uso, e
      // prender esse resultado até o fim da sessão esconderia o fluxo de quem
      // acabou de criar a conta — foi o que o teste ponta a ponta com a API
      // real pegou (a sonda rodava em /login, sem sessão, e levava 401).
      // Só descarta se esta ainda for a sonda corrente: uma sessão nova pode ter
      // começado enquanto esta estava em voo (review do PR #292).
      esquecerSondagemSe(atual);
      return null;
    });
  if (getToken() === tokenDaSonda) guardarSondagem(atual);
  return atual;
}

export function marcarOnboardingConcluido(): void {
  localStorage.setItem(CHAVE_ONBOARDING, '1');
  esquecerSondagem(); // quem estava observando reavalia na próxima rota
}
