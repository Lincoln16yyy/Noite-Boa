---
name: corrigir-bug
description: Corrige um bug deste repositório do jeito certo - reproduz com teste que falha, acha a causa-raiz, aplica a menor correção e prova que funcionou. Use ao trabalhar em issues de tipo:bug ou fix.
---

# Corrigir um bug

## Passo a passo
1. **Entenda.** Leia a issue inteira e o código envolvido. Escreva em uma frase: "quando X, deveria Y, mas acontece Z".
2. **Reproduza com um teste que FALHA.** Back-end: teste de integração no padrão dos existentes em `backend/src/test`. Front: teste Vitest + Testing Library. Rode e confirme que falha pelo motivo certo. Cole a saída no PR.
3. **Se não reproduz:** não chute a causa. Adicione instrumentação mínima e segura (log com stack, sem dado pessoal), publique, e documente na issue o que observar. Foi o caso do erro 500 intermitente do dashboard.
4. **Ache a causa-raiz**, não o sintoma. Pergunte "por que isso aconteceu?" até chegar numa regra errada, validação ausente ou suposição falsa.
5. **Menor correção.** Altere só o necessário. Não aproveite para refatorar. Outra coisa estranha vira outra issue.
6. **Rode o teste de novo** (agora passa) e depois a suíte completa (`mvn -B verify`; `npm run typecheck && npm run lint && npm test && npm run build`).
7. **Teste de regressão e bordas.** Cubra o caso do bug e os vizinhos (vazio, limite, usuário novo, usuário de outro dono).
8. **Atualize a documentação** se mudou rota, regra ou texto exibido (`PLANO.md`, README, política de privacidade quando afeta dados).
9. **PR com evidência:** "antes" (teste falhando ou print), "depois" (teste passando ou print), o que NÃO foi verificado, e `Closes #N`.

## Regras
- Erro de entrada do usuário é 4xx, nunca 5xx.
- Mudou regra de cálculo? Atualize também os testes que afirmavam o comportamento antigo, e explique no PR por que o comportamento antigo estava errado.
- Mexeu em autenticação, autorização, dados pessoais ou migração? Marque o PR para revisão humana atenta.
- Não edite migração já publicada; crie uma nova (`V<n>__descricao.sql`).
