---
title: refactor(frontend): migrar páginas simples (Home, Login, Cadastro, Privacidade, Sons)
labels: tipo:chore,area:frontend,prio:p2,agente:ok
milestone: M8 - Migração para TypeScript
---
## Contexto
Páginas com pouca lógica de dados (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Migrar as cinco páginas e seus testes
- [ ] Estados de formulário e erros tipados
- [ ] Áudio (Sons): tipar `AudioContext` e nós de forma segura, sem `any`

## Critérios de aceite
- [ ] Prints idênticos
- [ ] typecheck, lint, testes e build verdes

## Fora do escopo
Mudar textos ou estilos.

## Dependências
Depende dos componentes em TypeScript.

## Como verificar
Prints antes/depois idênticos.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
