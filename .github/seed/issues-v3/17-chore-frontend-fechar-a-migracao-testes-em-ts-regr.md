---
title: chore(frontend): fechar a migração (testes em TS, regra contra any, remover allowJs)
labels: tipo:chore,area:frontend,area:devops,prio:p2,agente:revisar
milestone: M8 - Migração para TypeScript
---
## Contexto
Depois de todas as fatias, fechar a migração e travar o padrão (commit `9087fdb`). Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Garantir que não restam `.js`/`.jsx` em `src` (nem de teste)
- [ ] Remover `allowJs` do `tsconfig`
- [ ] Ativar regra do `oxlint` contra `any` explícito (`no-explicit-any`) e contra `@ts-ignore`
- [ ] Revisar o `tsc` no `build` (`tsc --noEmit && vite build`) ou manter só no CI, e registrar a escolha
- [ ] Atualizar `AGENTS.md`, README e as skills (`verificar-visual`, `corrigir-bug`) para citar TypeScript e o comando `typecheck`

## Critérios de aceite
- [ ] Zero JS em `src`
- [ ] `typecheck` estrito sem exceções não justificadas
- [ ] Docs atualizadas
- [ ] CI verde

## Fora do escopo
Migrar o back-end ou ferramentas em `tools/`.

## Dependências
Depende de todas as issues anteriores do M8.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
