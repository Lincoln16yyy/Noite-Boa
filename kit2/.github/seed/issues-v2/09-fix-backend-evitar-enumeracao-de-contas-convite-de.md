---
title: fix(backend): evitar enumeração de contas (convite de amigos e login)
labels: tipo:bug,area:backend,prio:p2,agente:revisar
milestone: M7 - Correções e polimento
---
## Contexto
`FriendshipService.sendRequest` responde 404 'Não encontramos ninguém com este e-mail' quando a conta não existe e 409/200 quando existe, o que permite a qualquer usuário logado descobrir quais e-mails têm conta. No login, e-mail inexistente responde mais rápido (não roda BCrypt) que senha errada (commit `dfc79d0`). Para um app com dados de sono, isso é vazamento de privacidade. Certeza: **confirmado** pela leitura.

## Tarefas
- [ ] Convite: responder sempre a mesma mensagem neutra ('Se este e-mail tiver conta, o convite foi enviado'), criando o convite apenas se a conta existir; registrar o trade-off de usabilidade no PR
- [ ] Login: comparar a senha contra um hash falso quando o e-mail não existe, para igualar o tempo de resposta
- [ ] Testes: respostas idênticas (corpo e status) para e-mail existente e inexistente no convite

## Critérios de aceite
- [ ] Corpo e status do convite são idênticos nos dois casos
- [ ] Login não diferencia e-mail inexistente de senha errada nem em mensagem nem de forma grosseira em tempo
- [ ] Texto na tela de Amigos ajustado para a nova mensagem

## Fora do escopo
Convites por link ou código.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
