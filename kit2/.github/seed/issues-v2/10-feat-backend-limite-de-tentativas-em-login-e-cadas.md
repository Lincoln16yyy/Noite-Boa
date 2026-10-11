---
title: feat(backend): limite de tentativas em login e cadastro
labels: tipo:feat,area:backend,prio:p2,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
Não há limite de tentativas em `/api/auth/login` e `/api/auth/register` (commit `dfc79d0`), o que facilita adivinhar senhas e criar contas em massa.

## Tarefas
- [ ] Limitador em memória (sem dependência nova) por IP + e-mail: por exemplo 5 tentativas por minuto no login e 5 cadastros por hora por IP; resposta 429 com `ProblemDetail` e cabeçalho `Retry-After`
- [ ] Configurar `server.forward-headers-strategy` para obter o IP real atrás do proxy da Render, documentando no PR
- [ ] Limites configuráveis por variável de ambiente, com padrões seguros
- [ ] Testes: estouro do limite, janela que reinicia, IPs diferentes

## Critérios de aceite
- [ ] Excesso de tentativas recebe 429
- [ ] Uso normal não é afetado
- [ ] Documentado em README (variáveis) e no PLANO

## Fora do escopo
Captcha, bloqueio permanente de conta, Redis.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
