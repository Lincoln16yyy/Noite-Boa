---
title: chore(frontend): links, botões e campos na paleta (tokens em vez de estilos soltos)
labels: tipo:chore,area:frontend,area:design,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
Links usam o azul padrão do navegador ('Cadastre-se', 'Entrar', 'Política de Privacidade') e as páginas repetem objetos de estilo com cores em hexadecimal (commit `dfc79d0`), o que atrapalha a consistência e o futuro modo escuro.

## Tarefas
- [ ] Em `base.css`: links em Índigo com sublinhado e estado de foco visível (anel Âmbar/Índigo, sem tirar o outline)
- [ ] Criar classes reutilizáveis (`.btn`, `.btn-primary`, `.btn-ghost`, `.card`, `.field`) baseadas nos tokens
- [ ] Migrar Login, Cadastro e Dashboard para essas classes (as demais telas ficam para depois)
- [ ] Garantir que nenhum teste existente quebre

## Critérios de aceite
- [ ] Nenhum link azul padrão nas telas migradas
- [ ] Sem cores hexadecimais novas em componentes
- [ ] Prints antes/depois

## Fora do escopo
Migrar todas as telas; biblioteca de UI.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
