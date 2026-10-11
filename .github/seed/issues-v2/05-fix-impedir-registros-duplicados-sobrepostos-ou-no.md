---
title: fix: impedir registros duplicados, sobrepostos ou no futuro
labels: tipo:bug,area:backend,area:frontend,prio:p1,agente:revisar,mvp
milestone: M7 - Correções e polimento
---
## Contexto
O back-end aceita dois registros iguais ou sobrepostos, datas no futuro e datas de séculos atrás; o botão 'Salvar registro' da tela Registrar não tem estado de 'enviando', então um duplo clique cria duplicata (commit `dfc79d0`). Duplicatas inflam a média, as noites do ranking e distorcem a dívida. Certeza: **confirmado** pela leitura.

## Tarefas
- [ ] Back-end: rejeitar (409) registro que se sobreponha a outro do mesmo usuário, na criação e na edição (ignorando o próprio registro)
- [ ] Back-end: rejeitar (400) `sleepEnd` mais de 5 minutos no futuro e `sleepStart` anterior a 1 ano atrás (valores em constantes, fáceis de ajustar)
- [ ] Front-end: desabilitar o botão e mostrar 'Salvando…' durante o envio em Registrar e no salvar da edição do Histórico
- [ ] Testes: sobreposição parcial, total, adjacente (fim = início de outro é permitido), edição sem conflito consigo mesma, futuro, passado distante, duplo envio no front

## Critérios de aceite
- [ ] Registro sobreposto retorna 409 com mensagem clara exibida na tela
- [ ] Duplo clique rápido cria apenas um registro
- [ ] Registros adjacentes continuam permitidos
- [ ] Testes de back e front verdes

## Fora do escopo
Restrição de exclusão no banco (btree_gist).

## Como verificar
Teste do front simulando dois cliques; teste de integração para a regra de sobreposição.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `corrigir-bug` (`.claude/skills/corrigir-bug/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
