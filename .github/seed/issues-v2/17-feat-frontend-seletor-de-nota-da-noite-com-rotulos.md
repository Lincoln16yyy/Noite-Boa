---
title: feat(frontend): seletor de nota da noite com rótulos e ícones
labels: tipo:feat,area:frontend,area:design,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
Em 'Como foi a noite?' a nota é só de 1 a 5, sem significado visível (commit `dfc79d0`).

## Tarefas
- [ ] Grupo de opções acessível (radiogroup) com rótulos: Péssima, Ruim, Ok, Boa, Ótima, mais ícone ou emoji discreto
- [ ] Estado selecionado claro (Índigo + contraste), navegação por teclado e leitor de tela
- [ ] Mesmo componente na edição do Histórico
- [ ] Testes de seleção, teclado e valor enviado

## Critérios de aceite
- [ ] Valor continua 1 a 5 na API
- [ ] Usável com uma mão no celular
- [ ] Prints anexados

## Fora do escopo
Mudar a escala da API.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
