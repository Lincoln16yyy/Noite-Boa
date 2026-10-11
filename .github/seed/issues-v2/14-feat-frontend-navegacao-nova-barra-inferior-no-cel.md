---
title: feat(frontend): navegação nova - barra inferior no celular e menu coerente com a sessão
labels: tipo:feat,area:frontend,area:design,prio:p1,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
No celular os 8 links do menu quebram em 3 linhas e ocupam cerca de um quarto da tela; 'Login' e 'Cadastro' aparecem mesmo logado; não há 'Sair' no menu; não há indicação da página atual (commit `dfc79d0`). Veja os prints em `docs/` se existirem, ou gere com a skill `verificar-visual`.

## Tarefas
- [ ] Estado de sessão reativo (pequeno contexto de autenticação, atualizado no login, logout e 401) para o Layout reagir sem recarregar
- [ ] Logado no celular: barra de abas fixa embaixo (Registrar, Histórico, Dashboard, Amigos, Mais) com a página atual destacada; 'Mais' abre Sons, Configurações e Sair
- [ ] Logado no desktop: menu superior com os mesmos itens e 'Sair'; Login/Cadastro só para visitantes
- [ ] Usar o logo oficial (`assets/brand/logo-horizontal-*.svg`, copiar para `frontend/public`) no cabeçalho
- [ ] Alvos de toque de pelo menos 44 px, foco visível e `aria-current` na página atual
- [ ] Testes: itens por estado de sessão, destaque da rota atual

## Critérios de aceite
- [ ] Menu cabe sem quebrar linhas em 390 px
- [ ] Visitante vê Entrar/Cadastrar; logado vê Sair
- [ ] Prints antes/depois anexados ao PR
- [ ] `npm run lint && npm test && npm run build` verdes

## Fora do escopo
Mudar o nome do produto (issue própria).

## Como verificar
Prints mobile e desktop de home, dashboard e configurações, logado e deslogado.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
