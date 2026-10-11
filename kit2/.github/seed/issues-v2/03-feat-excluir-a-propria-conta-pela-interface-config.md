---
title: feat: excluir a própria conta pela interface (Configurações)
labels: tipo:feat,area:frontend,prio:p1,agente:revisar,mvp
milestone: M7 - Correções e polimento
---
## Contexto
A API `DELETE /api/me` existe e tem teste (`DeleteAccountTest`), mas a tela de Configurações **não tem botão de excluir conta** (commit `dfc79d0`). A Política de Privacidade (seção 8) manda 'pedir pelo canal de contato', o que contradiz o plano (M5) e o direito do usuário de apagar os próprios dados com facilidade. Certeza: **confirmado**.

## Tarefas
- [ ] Seção 'Excluir conta' em Configurações, separada e com aviso claro de que é definitivo (registros, meta e amizades somem)
- [ ] Confirmação forte: o usuário digita o próprio e-mail (ou a palavra EXCLUIR) para habilitar o botão
- [ ] Chamar `api.delete('/me')`, limpar a sessão e levar para a página inicial com mensagem de confirmação
- [ ] Tratar erro (rede/servidor) com mensagem e sem apagar a sessão local
- [ ] Atualizar a seção 8 da Política de Privacidade: exclusão pela própria conta + canal de contato como alternativa; manter o aviso honesto sobre cópias de segurança da plataforma
- [ ] Testes: botão desabilitado sem a confirmação, chamada correta, redirecionamento e limpeza do token, erro

## Critérios de aceite
- [ ] Usuário exclui a conta sem falar com ninguém
- [ ] Depois da exclusão, o token antigo recebe 401 em qualquer rota
- [ ] Texto da política bate com o comportamento real
- [ ] `npm run lint && npm test && npm run build` verdes

## Fora do escopo
Exportar dados (portabilidade) — issue futura.

## Como verificar
Prints da tela de Configurações (celular e desktop) com o bloco de exclusão e do estado de confirmação.

---
Antes de começar, leia `AGENTS.md`, `PLANO.md` e `docs/agente/PRINCIPIOS.md`. Use a skill `verificar-visual` (`.claude/skills/verificar-visual/SKILL.md`). Abra o PR com `Closes #<número desta issue>` e diga no PR o que não foi verificado.
