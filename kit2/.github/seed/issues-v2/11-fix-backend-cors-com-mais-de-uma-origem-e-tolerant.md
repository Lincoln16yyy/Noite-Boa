---
title: fix(backend): CORS com mais de uma origem e tolerante a barra final
labels: tipo:bug,area:backend,prio:p2,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
`SecurityConfig` lê uma única origem de `CORS_ALLOWED_ORIGIN` e compara exatamente: barra no final (`https://app.vercel.app/`) ou domínio alternativo derruba o front sem aviso (commit `dfc79d0`).

## Tarefas
- [ ] Aceitar lista separada por vírgula e normalizar (trim, remover barra final)
- [ ] Documentar no README e no `.env.example`; não usar curinga por padrão
- [ ] Testes: duas origens, barra final, origem não permitida recebe resposta sem cabeçalhos CORS

## Critérios de aceite
- [ ] Origens configuradas funcionam; outras não
- [ ] Testes verdes

## Fora do escopo
Permitir `*.vercel.app` por padrão.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
