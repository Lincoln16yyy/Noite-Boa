import { getToken } from '../api/client';

/** Aviso padrão quando a tela foi carregada por outra sessão (#298). */
export const MSG_SESSAO_MUDOU =
  'A sessão mudou. Recarregue a página antes de continuar.';

/**
 * A tela só pode escrever na conta que a carregou. O token é compartilhado
 * entre abas: se outra aba trocou o login, até o evento `storage` chegar esta
 * tela ainda mostra os dados de A, mas a requisição sairia como B (#298).
 *
 * O predicate estreita o token para `string`: depois da checagem, quem chama
 * pode passar o valor como token explícito da mutação. `sessaoAtual` é a
 * sessão do `AuthContext` (o que a tela está representando).
 */
export function sessaoDaTelaAindaVale(
  tokenDaTela: string | null,
  sessaoAtual: string | null,
): tokenDaTela is string {
  // O `localStorage` sozinho não basta: outra aba pode ir de A para B e voltar
  // a A antes do evento `storage` chegar, e a tela ainda representar B (#298).
  return tokenDaTela !== null && sessaoAtual === tokenDaTela && getToken() === tokenDaTela;
}
