/**
 * Saudação por horário no fuso do perfil (issue #209, regra da seção 5 do
 * guia docs/design/direcao-visual.md): "Bom dia" (05h às 11h59),
 * "Boa tarde" (12h às 17h59) e "Boa noite" (demais).
 *
 * O horário é resolvido no fuso do PERFIL (`timeZone`), nunca no fuso do
 * aparelho — mesma fonte de verdade do resto das telas de sono.
 */
export function saudacao(timeZone: string, agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(agora),
  );

  if (hora >= 5 && hora <= 11) return 'Bom dia';
  if (hora >= 12 && hora <= 17) return 'Boa tarde';
  return 'Boa noite';
}

/** Primeiro nome de exibição (vira o título do cabeçalho). */
export function primeiroNome(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName.trim();
}
