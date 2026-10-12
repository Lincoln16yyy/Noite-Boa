---
title: fix(frontend): testes dependem do fuso da máquina e 10 testes estão pulados (CI verde)
labels: tipo:bug,area:frontend,area:devops,prio:p0,agente:ok
milestone: M7 - Correções e polimento
---
## Contexto
`Historico.test.jsx > edita um registro pelo formulário inline` passa com `TZ=America/Sao_Paulo` e falha com `TZ=UTC` (esperado 23:00, recebido 20:00) (commit `9087fdb`). O runner do GitHub usa UTC, então o CI tende a ficar vermelho. Além disso `Home.test.jsx` e `Privacidade.test.jsx` estão com 10 testes `it.skip` ('follow-up em PR separado' que não veio) e o `oxlint` reporta 2 avisos. Certeza: **confirmado** (rodado nos dois fusos).

## Tarefas
- [ ] Reproduzir: `TZ=UTC npm test` falha e `TZ=America/Sao_Paulo npm test` passa
- [ ] Tornar o teste independente da máquina: usar o fuso do perfil mockado e comparar com os helpers de `lib/fuso.js` (preferível a fixar o fuso global)
- [ ] No CI, rodar os testes do front em dois fusos (`TZ=UTC` e `TZ=America/Sao_Paulo`)
- [ ] Destravar os 10 testes pulados (usar `renderWithProviders` com `MemoryRouter`; os problemas de roteamento citados vêm de renderizar sem providers)
- [ ] Corrigir os 2 avisos do `oxlint`
- [ ] Acrescentar ao `AGENTS.md`: nunca pular, comentar ou apagar teste para deixar o CI verde

## Critérios de aceite
- [ ] `TZ=UTC npm test` e `TZ=America/Sao_Paulo npm test` passam
- [ ] Zero `it.skip`/`describe.skip` no front
- [ ] `npm run lint` sem avisos
- [ ] CI verde

## Fora do escopo
Mudar regras de fuso do produto.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
