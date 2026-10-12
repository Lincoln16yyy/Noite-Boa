---
title: fix(backend): remover o retry do StatsService e investigar a causa do 500 intermitente (#84)
labels: tipo:bug,area:backend,prio:p1,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
O PR #133 adicionou retry em `StatsService` (commit `9087fdb`). Problemas confirmados pela leitura: (1) `summary` envolve `doSummary` em `retryWithBackoff`, que captura **qualquer** `Exception`, inclusive o 401 de usuário inexistente (token de conta excluída): o pedido espera ~600 ms e vira **500** 'Falha após 3 tentativas'; (2) `@Retryable` está em um método `private` chamado por `this`, então o proxy do Spring não o intercepta (efeito nulo); (3) `Thread.sleep` na thread da requisição; (4) a causa do 500 intermitente continua desconhecida, e a issue #84 pedia instrumentação antes de correção.

## Tarefas
- [ ] Escrever teste que falha: usuário inexistente em `GET /stats/summary` deve responder 401 rápido (hoje responde 500 após tentativas)
- [ ] Remover `retryWithBackoff`, `fetchLogsWithRetry`/`@Retryable`, `Thread.sleep` e constantes de retry; se `spring-retry` e `@EnableRetry` não forem usados em mais nada, remover também
- [ ] Manter o log com stack do `GlobalExceptionHandler` (PR #85) e conferir nos logs da Render o stack real das próximas ocorrências; registrar na issue #84 o que foi observado
- [ ] Se os logs apontarem conexão com o banco (pool, SSL, conexão ociosa), ajustar `spring.datasource.hikari` (`keepalive-time`, `max-lifetime` menor que o tempo de ociosidade do banco, `connection-timeout`) com a evidência no PR
- [ ] Só considerar retry se os logs provarem falha transitória de conexão, e então de forma limitada a essas exceções, em bean chamado por outro bean (proxy válido), sem `Thread.sleep`

## Critérios de aceite
- [ ] Usuário inexistente retorna 401 em menos de 100 ms (teste)
- [ ] Nenhum `Thread.sleep` nem retry manual em serviços
- [ ] `mvn -B verify` verde
- [ ] Comentário na #84 com o que foi observado nos logs

## Fora do escopo
Trocar de provedor de banco.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
