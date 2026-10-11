---
title: feat(frontend): modo escuro (preferência do sistema e alternância manual)
labels: tipo:feat,area:frontend,area:design,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
O app é usado principalmente à noite e a marca é noturna, mas por dentro as telas são claras (commit `dfc79d0`). `docs/identidade-visual.md` sugere o modo escuro como 'modo natural'.

## Tarefas
- [ ] Redefinir tokens sob `prefers-color-scheme: dark` e `[data-theme]`, seguindo a paleta (fundo Noite, texto Luar/Névoa, destaques Âmbar/Lavanda)
- [ ] Alternância em Configurações (Automático, Claro, Escuro) guardada no dispositivo
- [ ] Conferir contraste de todos os pares usados e documentar no PR
- [ ] Gráfico e cartões legíveis nos dois temas

## Critérios de aceite
- [ ] Todas as telas legíveis nos dois temas
- [ ] Preferência persiste
- [ ] Prints dos dois temas anexados

## Fora do escopo
Temas personalizados, troca animada.

## Dependências
Depende da issue de tokens/classes (links, botões e campos).

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
