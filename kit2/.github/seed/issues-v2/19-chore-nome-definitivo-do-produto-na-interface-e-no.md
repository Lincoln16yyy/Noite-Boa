---
title: chore: nome definitivo do produto na interface e no código
labels: tipo:chore,area:design,prio:p1,agente:humano
milestone: M7 - Correções e polimento
---
## Contexto
O produto aparece como 'Noite Boa' (menu, notificação de hora de dormir, cache do service worker, `package.json`, pacote Java `br.dev.noiteboa`, serviço na Render), o repositório é 'Sleep-Well' e a identidade foi desenhada para outros nomes (commit `dfc79d0`). Precisa de uma decisão única.

## Tarefas
- [ ] Decidir o nome definitivo (conferir domínio, lojas e INPI) e registrar em `docs/`
- [ ] Depois da decisão, abrir issues de implementação: textos da interface e notificação, título e manifesto do PWA, nome do cache do service worker (incrementar versão), `package.json`, README, logo do cabeçalho e, separado, renomeação do pacote Java e do serviço

## Critérios de aceite
- [ ] Nome registrado e issues de implementação criadas

## Fora do escopo
Renomear código nesta issue.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `auditar-repositorio` (`.claude/skills/auditar-repositorio/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
