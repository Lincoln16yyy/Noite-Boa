/**
 * Memória da sonda de primeiro uso (issues #215 e #273).
 *
 * Vive num módulo sem dependências porque há dois caminhos que precisam
 * descartá-la: o logout (via `AuthContext`) e o fim de sessão no cliente de API
 * (`clearSession`, inclusive no 401). Como `lib/primeiro-uso.ts` depende do
 * cliente, importá-la de lá criaria um ciclo.
 *
 * A memória é presa ao token da sessão. O token é compartilhado entre abas e
 * outra aba pode trocar de conta sem disparar `session-change` (o evento é
 * desta janela), então comparar o token na leitura evita que a conta nova
 * herde a sondagem da anterior (#273, review do PR #292).
 */
let sondagem: Promise<boolean | null> | null = null;
let tokenDaSondagem: string | null = null;

export function sondagemAtual(): Promise<boolean | null> | null {
  if (tokenDaSondagem !== localStorage.getItem('token')) return null;
  return sondagem;
}

export function guardarSondagem(promessa: Promise<boolean | null>): void {
  sondagem = promessa;
  tokenDaSondagem = localStorage.getItem('token');
}

/** Esquece a sonda: a próxima conta desta aba é sondada de novo. */
export function esquecerSondagem(): void {
  sondagem = null;
  tokenDaSondagem = null;
}
