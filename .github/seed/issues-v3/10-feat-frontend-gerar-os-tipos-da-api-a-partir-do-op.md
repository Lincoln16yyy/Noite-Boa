---
title: feat(frontend): gerar os tipos da API a partir do OpenAPI do back-end
labels: tipo:feat,area:frontend,area:backend,prio:p1,agente:revisar
milestone: M8 - Migração para TypeScript
---
## Contexto
O back-end já usa springdoc (commit `9087fdb`). Gerar os tipos a partir do contrato evita escrever à mão os formatos das respostas (um risco real: nomes de campo como `sharesData` ou `isMe`). O Swagger fica só no perfil de desenvolvimento, então a geração roda contra o back-end local. Regra: **migração não muda comportamento**. Siga a skill `migrar-typescript`.

## Tarefas
- [ ] Adicionar `openapi-typescript` como dependência de desenvolvimento e o script `gen:api` (URL configurável por `API_DOCS_URL`, padrão `http://localhost:8080/v3/api-docs`; confirmar o caminho no perfil dev)
- [ ] Gerar e commitar `src/api/schema.d.ts`; documentar no README como regenerar (subir o back-end em dev e rodar o script)
- [ ] Criar `src/api/types.ts` com apelidos legíveis (`User`, `SleepLog`, `StatsSummary`, `Goal`, `Friend`, `RankingEntry`...) derivados do schema
- [ ] Se algum DTO sair sem tipo útil (campo opcional demais, `object`), anotar o back-end com `@Schema` na mesma PR ou abrir issue de back-end
- [ ] Opcional: passo de CI que avisa quando o `schema.d.ts` está desatualizado, só se for simples

## Critérios de aceite
- [ ] `schema.d.ts` gerado e commitado
- [ ] `types.ts` cobre todas as respostas usadas pelo front
- [ ] README explica como regenerar
- [ ] `npm run typecheck`, lint, testes e build verdes

## Fora do escopo
Usar os tipos nas telas (issues seguintes).

## Dependências
Depende da infraestrutura TypeScript.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `migrar-typescript` (`.claude/skills/migrar-typescript/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
