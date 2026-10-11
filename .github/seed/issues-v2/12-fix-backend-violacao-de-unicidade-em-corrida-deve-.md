---
title: fix(backend): violação de unicidade em corrida deve virar 409, não 500
labels: tipo:bug,area:backend,prio:p2,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
Convite de amigos duplo (duplo clique) e `PUT /goal` simultâneo podem violar restrições de unicidade/PK e cair no handler genérico, virando 500 (commit `dfc79d0`). Só o cadastro trata `DataIntegrityViolationException`. Certeza: **provável**.

## Tarefas
- [ ] Tratar `DataIntegrityViolationException` de forma específica nesses fluxos (409 com mensagem, ou resposta idempotente quando fizer sentido, como repetir o convite pendente)
- [ ] Não engolir outras violações como 409 sem log
- [ ] Testes que simulam a segunda gravação concorrente

## Critérios de aceite
- [ ] Segundo pedido simultâneo não gera 500
- [ ] Testes verdes

## Fora do escopo
Refazer o modelo de amizade.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
