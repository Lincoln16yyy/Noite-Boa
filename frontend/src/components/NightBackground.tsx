/**
 * Fundo noturno decorativo (issue #207).
 *
 * Camada fixa, atrás de todo o conteúdo (z-index -1), sem interação
 * (pointer-events: none) e oculta de leitores de tela (aria-hidden): é só
 * cenário. No tema escuro pinta o gradiente de fundo (seção 2 do guia) com um
 * brilho suave no topo e estrelas discretas; no tema claro fica neutro (fundo
 * Névoa chapado, sem estrelas — paridade, seção 3).
 */
export default function NightBackground() {
  return <div className="night-background" aria-hidden="true" />;
}
