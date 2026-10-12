---
title: fix(frontend): navegação duplicada no celular (menu superior + barra inferior)
labels: tipo:bug,area:frontend,area:design,prio:p1,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
No celular o `Layout` mostra o menu superior com todos os links (3 linhas) **e** a barra de abas inferior, então o espaço que a issue de navegação queria liberar continua ocupado; e `isMobile` é calculado uma vez com `window.innerWidth`, não reage a rotação nem redimensionamento (commit `9087fdb`). Certeza: **confirmado** por print (390 px).

## Tarefas
- [ ] Trocar a detecção por JS por media queries (breakpoint 768 px)
- [ ] Celular: cabeçalho só com logo (e o que couber, como o tema), sem a lista de links; barra inferior com Registrar, Histórico, Dashboard, Amigos e Mais (Sons, Configurações, Sair)
- [ ] Desktop: menu superior completo com 'Sair'; sem barra inferior
- [ ] Conteúdo com espaço inferior suficiente para a barra fixa; foco visível e alvos de 44 px
- [ ] Atualizar testes do Layout (renderizar nos dois tamanhos)

## Critérios de aceite
- [ ] Em 390 px não há links no cabeçalho e a barra inferior aparece
- [ ] Em 1280 px o inverso
- [ ] Girar o celular ou redimensionar muda o layout sem recarregar
- [ ] Prints antes/depois anexados

## Fora do escopo
Mudar rotas ou textos.

## Como verificar
Prints mobile e desktop de dashboard e configurações, logado.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
