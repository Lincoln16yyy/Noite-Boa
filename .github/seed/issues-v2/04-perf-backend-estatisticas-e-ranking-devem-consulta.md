---
title: perf(backend): estatísticas e ranking devem consultar só o período, não o histórico inteiro
labels: tipo:chore,area:backend,prio:p1,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
`StatsService.summary` e `FriendshipService.ranking` chamam `findByUserIdOrderBySleepStartDesc` (todos os registros do usuário) e filtram em memória por data (commit `dfc79d0`). O custo cresce com o uso, e o ranking repete isso para cada amigo. O servidor gratuito tem 512 MB e o pool do banco é de 5 conexões. Certeza: **confirmado**; não explica sozinho o 500 do #84.

## Tarefas
- [ ] Criar consulta no repositório com limite inferior de data (ex.: `findByUserIdAndSleepStartGreaterThanEqualOrderBySleepStartDesc`) e usar nos dois serviços
- [ ] Garantir que o intervalo cobre também o necessário para a dívida de sono (7 dias)
- [ ] Teste com registros antigos (fora da janela) provando que não entram no cálculo e que o resultado é idêntico ao anterior para dados dentro da janela

## Critérios de aceite
- [ ] Resultados das duas rotas iguais aos de hoje para os mesmos dados
- [ ] Nenhuma chamada de `findByUserIdOrderBySleepStartDesc` restante nesses serviços
- [ ] `mvn -B verify` verde

## Fora do escopo
Cache, paginação de estatísticas, mudança de índices.

## Dependências
Fazer depois da issue da dívida de sono, para não gerar conflito no mesmo arquivo.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
