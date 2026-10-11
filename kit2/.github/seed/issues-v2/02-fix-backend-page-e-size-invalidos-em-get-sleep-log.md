---
title: fix(backend): page e size inválidos em GET /sleep-logs devem retornar 400, não 500
labels: tipo:bug,area:backend,prio:p1,agente:ok,mvp
milestone: M7 - Correções e polimento
---
## Contexto
`SleepController.list` repassa `page` e `size` para `PageRequest.of` sem validar (commit `dfc79d0`). `page=-1` ou `size=0` lança `IllegalArgumentException`, que cai no handler genérico `Exception.class` e vira **500 'Erro interno'** (e um log de erro). Erro de entrada deve ser 4xx. Certeza: **confirmado** pela leitura.

## Tarefas
- [ ] Validar `page >= 0` e `size >= 1` (e manter o teto de 100) no controller, respondendo 400 com `ProblemDetail` e mensagem clara em português
- [ ] Aproveitar para checar `from <= to` quando ambos vierem; 400 se invertidos
- [ ] Testes de integração para `page=-1`, `size=0`, `size=1000` (limitado a 100) e `from > to`

## Critérios de aceite
- [ ] Os quatro casos acima retornam o status esperado (400, 400, 200 limitado, 400)
- [ ] Nenhuma dessas entradas gera log de erro de 'Erro não tratado'
- [ ] `mvn -B verify` verde

## Fora do escopo
Mudar o contrato de resposta paginada.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
