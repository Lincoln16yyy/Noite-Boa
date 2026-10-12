---
title: chore(frontend): infraestrutura TypeScript (tsconfig, typecheck, CI)
labels: tipo:chore,area:frontend,area:devops,prio:p1,agente:ok
milestone: M8 - Migração para TypeScript
---
## Contexto
Primeiro passo da migração do front-end (28 arquivos de código, ~3.850 linhas; 20 de teste, ~2.300 linhas) (commit `9087fdb`). `@types/react` já está instalado. Convivência JS e TS (`allowJs`) permite migrar aos poucos. Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Adicionar `typescript` (versão estável atual) e `@types/node` como dependências de desenvolvimento
- [ ] Criar `tsconfig.json`: `strict: true`, `allowJs: true`, `checkJs: false`, `noEmit: true`, `jsx: react-jsx`, `moduleResolution: bundler`, `isolatedModules: true`, `skipLibCheck: true`, tipos `vite/client`, `vitest/globals` e `@testing-library/jest-dom`
- [ ] Script `typecheck` (`tsc --noEmit`) e passo no CI depois do lint
- [ ] Converter `vite.config.js` em `vite.config.ts`
- [ ] Confirmar que `npm run lint`, `npm test` e `npm run build` seguem iguais

## Critérios de aceite
- [ ] `npm run typecheck` passa (só verifica o que já é TS)
- [ ] Mesmo número de testes passando de antes
- [ ] CI com o passo novo e verde

## Fora do escopo
Converter qualquer arquivo de código ou teste.

## Dependências
Fazer depois das issues de CI verde e de teste de fumaça (M7).

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
