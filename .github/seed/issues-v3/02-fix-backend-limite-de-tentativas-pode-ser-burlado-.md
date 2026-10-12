---
title: fix(backend): limite de tentativas pode ser burlado com X-Forwarded-For forjado
labels: tipo:bug,area:backend,prio:p1,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
`AuthController.limitar` usa chave IP+e-mail, e `ipDe` devolve `getRemoteAddr()` com `server.forward-headers-strategy=framework` (commit `9087fdb`). Com essa estratégia o IP vem do cabeçalho `X-Forwarded-For`, que o cliente também pode enviar. Um atacante pode mandar um IP diferente a cada tentativa e nunca estourar o limite (adivinhar senha de uma conta, criar contas em massa). Certeza: **provável** (falta reproduzir contra a configuração real). Além disso, não existe teto por e-mail independente de IP.

## Tarefas
- [ ] Teste que reproduz: 10 logins com o mesmo e-mail e `X-Forwarded-For` diferente em cada um; hoje nenhum recebe 429
- [ ] Definir de onde vem o IP confiável: conferir na documentação da Render como o IP do cliente chega e usar apenas o valor acrescentado pelo proxy (por exemplo, a configuração de proxies confiáveis do Tomcat ou o último valor do cabeçalho), documentando a escolha
- [ ] Adicionar teto por e-mail independente do IP (padrão sugerido: 20 tentativas por hora, configurável por variável de ambiente), com resposta 429 sem revelar se a conta existe
- [ ] Cadastro: aplicar a mesma regra de IP confiável
- [ ] Atualizar `AuthRateLimitTest` e documentar variáveis novas no README

## Critérios de aceite
- [ ] Cabeçalho forjado não escapa do limite (teste)
- [ ] Teto por e-mail funciona com IPs variados (teste)
- [ ] Uso normal não é afetado
- [ ] `mvn -B verify` verde

## Fora do escopo
Redis, captcha, bloqueio permanente de conta.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
