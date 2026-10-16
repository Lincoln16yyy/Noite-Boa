# Direção visual v2 do Noite Boa

Alvo visual das telas-chave: `docs/design/mockups/` (`hoje.png`, `dashboard.png`, `registrar.png`, `historico.png`). Os mockups são o **alvo**; os números nas telas são fictícios e vêm da API de verdade. Complementa `docs/identidade-visual.md` (marca, paleta e fonte continuam valendo).

## 1. Princípios
1. **Cena noturna por padrão:** fundo em gradiente (Noite) com brilho suave no topo e poucas estrelas discretas.
2. **Cartões translúcidos:** uma única linguagem de superfície para tudo.
3. **Um número gigante por tela**, o resto é apoio.
4. **Cor com significado:** Âmbar = ação principal e "abaixo da meta"; Lavanda = "dentro da meta"; Luar = números de destaque. Nunca só cor: sempre texto ou ícone junto.
5. **Calmo e gentil:** sem alarmismo, sem culpa. Textos curtos e acolhedores.

## 2. Tokens (modo escuro, o padrão)
| Token | Valor |
|---|---|
| Fundo da tela | `radial-gradient(120% 60% at 50% -10%, #3A3796 0%, #1E1C52 38%, #15142E 75%)` |
| Superfície (cartão) | `rgba(255,255,255,.06)`, borda `1px rgba(185,182,255,.22)`, raio 24 px, padding 18 px |
| Texto principal | Luar `#FFE9B5` |
| Texto secundário | Lavanda `#B9B6FF` |
| Rótulo (overline) | 12 px, peso 800, `letter-spacing .12em`, maiúsculas, Lavanda |
| Número de destaque | Nunito 800; 56 a 64 px (tela inteira), 30 px (cartão pequeno) |
| Botão principal | altura 54 px, pílula, Âmbar `#FFB347`, texto Noite, peso 800, 17 px |
| Barra de progresso | altura 8 px, trilho `rgba(185,182,255,.2)`, preenchimento Lavanda ou Âmbar |
| Barras do gráfico | gradiente Lavanda (`#D9D6FF` → `#8B88C9`) se ≥ meta; Âmbar (`#FFD27A` → `#FFB347`) se < meta; raio 10 px |
| Barra inferior | altura 78 px, fundo `rgba(21,20,46,.94)`, borda superior sutil, ícone ativo Luar, inativo `#8B88C9` |
| Espaçamento | grade de 4 px; telas com 20 px de margem lateral |

**Contraste conferido (WCAG):** Lavanda/Noite 9,56:1; Âmbar/Noite 10,07:1; Sucesso/Noite 7,72:1; Erro/Noite 4,58:1; aba inativa/Noite 5,52:1.

## 3. Tema claro (precisa ter paridade)
Fundo Névoa `#F5F3FF`; cartões brancos com borda `rgba(63,60,187,.18)` e sombra `0 8px 24px rgba(21,20,46,.08)`; texto Noite; destaques Índigo `#3F3CBB` (8,15:1 sobre branco). Botão principal continua Âmbar com texto Noite. Em fundo claro, "abaixo da meta" usa **Âmbar escuro `#B8690A`** nas barras e ícones (4,15:1 sobre branco; só para elementos gráficos, **nunca para texto**) e "dentro da meta" usa Índigo. O Âmbar claro `#FFB347` não tem contraste sobre fundo claro.

## 4. Componentes
Button (primary, ghost, danger, loading, disabled), Card, Chip/pill (7 dias | 30 dias), IconButton (com `aria-label`), Field (label + input + erro), ProgressBar, Ring (anel de progresso, com `role="img"` e `aria-label` com a porcentagem), BarChart, TabBar, Skeleton, EmptyState. Estados obrigatórios: hover, foco visível (anel Âmbar de 2 px), pressionado, desabilitado e carregando. Alvos de toque de pelo menos 44 px. Nenhum `<button>` com estilo padrão do navegador.

## 5. Telas

### Hoje (nova tela inicial depois do login, rota `/hoje`)
- **Saudação:** "Bom dia" (05h às 11h59), "Boa tarde" (12h às 17h59), "Boa noite" (demais), pelo fuso do perfil, mais o nome do usuário.
- **Anel da última noite:** o registro mais recente; porcentagem = `min(100, minutos dormidos / meta × 100)`; centro com a duração (ex.: `7h42`) e o rótulo "N% da meta de 8h"; abaixo, "Dormiu 23:10 · Acordou 06:52" no fuso do perfil. Sem registros: estado vazio convidando a registrar.
- **Hora de dormir:** contagem até o horário-alvo de dormir da meta (fuso do perfil): "em 3h12". Se já passou há menos de 3 h: "agora". Depois: "amanhã às 23:00".
- **Botão Registrar noite** (principal) leva a `/registrar`.
- **Esta semana:** barras dos últimos 7 dias (mesma regra de cores do Dashboard) e, se a API devolver a média do período anterior, "+22 min vs. semana passada" (Âmbar se for pior, Lavanda se melhor); sem o dado, esconda o trecho.

### Dashboard
- Chips 7 e 30 dias; cartão grande com a média (56 px), "Meta de 8h · faltam 39 min por noite" (ou "meta atingida") e barras.
- Cartões **Consistência** (±N min, barra de progresso) e **Dívida de sono** (Âmbar se > 0, barra proporcional a 7 × meta).
- **Dica**, regra determinística e testada: se a dívida > 0, "Dormir X minutos mais cedo nas próximas 7 noites zera sua dívida de Yh Zmin", com `X = ceil(dívida / 7)`; senão, "Você está dentro da meta. Mantenha o ritmo!". Nada de dica médica.

### Registrar noite
- **Duração ao vivo** em destaque (ex.: `7h 30min`) com a porcentagem da meta, atualizada ao mudar os horários.
- Dois blocos grandes **Dormiu às** e **Acordou às**: cada bloco é um `<label>` que envolve um campo `datetime-local` real (acessível, com o seletor nativo), estilizado como o mockup.
- **Qualidade:** cinco opções (1 Péssima, 2 Ruim, 3 Ok, 4 Boa, 5 Ótima) em uma linha, como `radiogroup`; selecionada em Âmbar.
- Observação opcional, botão **Salvar registro** (Âmbar) com estado "Salvando…" e desabilitado durante o envio.

### Histórico
- Cartões agrupados por semana ("Esta semana", "Semana passada", depois a data). Cada cartão: dia da semana e data, intervalo, **barra de duração contra a meta**, duração e qualidade (ponto colorido **mais texto**).
- Cores da qualidade: Péssima Erro, Ruim Âmbar, Ok Luar, Boa Lavanda, Ótima Sucesso.
- Ações Editar e Excluir como IconButtons com `aria-label` (ou menu), confirmação ao excluir.

## 6. Estados e movimento
- **Vazio:** ilustração simples (lua dormindo em SVG) e uma frase amiga com ação clara.
- **Carregando:** skeleton com brilho suave nos cartões; aviso "Acordando o servidor…" depois de ~4 s.
- **Erro:** mensagem em português e botão "Tentar novamente".
- **Movimento (sutil):** anel preenche em ~600 ms, barras crescem em ~400 ms, números contam, botão afunda ao pressionar. **Tudo desligado com `prefers-reduced-motion`.**

## 7. Regras de copy
Português do Brasil, frases curtas, sem culpa ("Que tal dormir um pouco mais cedo hoje?"), sem exclamação em excesso, sem jargão. Evite emoji na interface (use os ícones SVG de traço).

## 8. Contraste (WCAG) — verificado na fundação (issue #207)
Mínimos: **4,5:1 em texto** e **3:1 em elementos gráficos**. Pares conferidos (ferramenta de luminância relativa WCAG):

| Par | Razão | Uso |
|---|---|---|
| Lavanda `#B9B6FF` / Noite `#15142E` | 9,56:1 | texto secundário no escuro |
| Luar `#FFE9B5` / Noite `#15142E` | 15,00:1 | texto principal no escuro |
| Âmbar `#FFB347` / Noite `#15142E` | 10,07:1 | ação principal / abaixo da meta no escuro |
| Sucesso `#2FBF9B` / Noite `#15142E` | 7,72:1 | "dentro da meta" no escuro |
| Erro `#E5484D` / Noite `#15142E` | 4,58:1 | alertas no escuro |
| Aba inativa `#8B88C9` / Noite `#15142E` | 5,52:1 | ícones/texto inativos na barra inferior |
| Noite `#15142E` / Âmbar `#FFB347` | 10,07:1 | texto do botão primário |
| Índigo `#3F3CBB` / branco `#FFFFFF` | 8,15:1 | destaques no tema claro |
| Noite `#15142E` / branco `#FFFFFF` | 17,93:1 | texto principal no claro |
| Âmbar escuro `#B8690A` / branco `#FFFFFF` | 4,15:1 | **só elementos gráficos** no claro (nunca texto) |

> O Âmbar escuro `#B8690A` fica abaixo de 4,5:1 para texto, por isso a regra da seção 3: em fundo claro, "abaixo da meta" usa-o **apenas em barras e ícones** (3:1 gráfico), nunca em texto.

## 9. Largura e layout (issue #217)
O alvo dos mockups é o celular (390 px). O desktop não tem mockup próprio: estas são as regras que governam a largura lá.

| Regra | Valor |
|---|---|
| Container de todas as telas | `max-width: 1100px`, centrado, `padding-inline: 1rem` |
| Coluna legível (formulários e listas) | 560 px; o Dashboard, 720 px — centrados no container |
| Grade de duas colunas (Hoje e Dashboard) | a partir de **960 px**; abaixo disso, coluna única |
| Navegação | no celular (até 767 px), barra inferior fixa; no desktop, links no cabeçalho |
| Ícones | os **mesmos** da barra inferior (fonte única `src/layout/nav-items.ts`) |

- **Uma coluna só ocupa a largura toda** (`.app-grade > .app-coluna:only-child`), para não sobrar metade da tela vazia quando não há gráfico.
- **`align-items: start`:** o cartão curto não estica para igualar o vizinho.
- **O esqueleto de carregamento tem a mesma forma do conteúdo carregado** (mesma ordem de nós), para a tela não trocar de forma quando a resposta chega.
- O container é só `max-width`/`margin`/`padding`: **nunca** `transform` ou `filter`, que quebrariam o `position: fixed` da barra e do cabeçalho.
- Prints de conferência em 768, 1280 e 1440 px nos dois temas: `docs/design/prints/217-layout-desktop/`.
