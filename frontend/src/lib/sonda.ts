/**
 * Memória da sonda de primeiro uso (issues #215 e #273).
 *
 * Vive num módulo sem dependências porque há dois caminhos que precisam
 * descartá-la: o logout (via `AuthContext`) e o fim de sessão no cliente de API
 * (`clearSession`, inclusive no 401). Como `lib/primeiro-uso.ts` depende do
 * cliente, importá-la de lá criaria um ciclo.
 */
let sondagem: Promise<boolean> | null = null;

export function sondagemAtual(): Promise<boolean> | null {
  return sondagem;
}

export function guardarSondagem(promessa: Promise<boolean>): void {
  sondagem = promessa;
}

/** Esquece a sonda: a próxima conta desta aba é sondada de novo. */
export function esquecerSondagem(): void {
  sondagem = null;
}
