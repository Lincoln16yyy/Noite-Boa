# Como o agente deve trabalhar (princípios)

Complementa o `AGENTS.md`. Vale para qualquer agente. As três skills em `.claude/skills/` (auditar, verificar visual, corrigir bug) aplicam estes princípios na prática.

1. **Evidência antes de afirmação.** Só diga que algo funciona, está bom ou está quebrado depois de ler o código ou rodar o comando. Cole o resultado (saída do teste, print, trecho com arquivo e linha).
2. **Diga o que NÃO foi verificado.** "Li o código mas não rodei os testes do back-end" é uma frase obrigatória quando for o caso. Nunca escreva "tudo certo" por inferência.
3. **Classifique a certeza.** Use três níveis: *confirmado* (reproduzido ou provado pelo código), *provável* (o código sugere, falta reproduzir) e *hipótese* (palpite). Não misture.
4. **Se errou antes, corrija em voz alta.** Se um achado seu anterior estava errado, diga isso no relatório e no PR, sem esconder.
5. **Reproduza antes de consertar.** Bug sem teste que falhe é palpite. Se não conseguir reproduzir, instrumente (log, métrica) em vez de adivinhar a causa.
6. **Menor mudança que resolve.** Não refatore, não renomeie, não "melhore" o que a issue não pede. Achou outra coisa? Abra outra issue.
7. **Leia antes de escrever.** Leia a issue, o `PLANO.md`, o `AGENTS.md` e os arquivos vizinhos ao que vai mexer. Imite o estilo que já existe.
8. **Teste de verdade.** Todo comportamento novo ou corrigido ganha teste. Rode a suíte inteira (`mvn -B verify`, `npm run lint && npm test && npm run build`) antes de abrir o PR.
9. **Visual se julga olhando.** Mudou tela? Rode a skill `verificar-visual`, olhe os prints no celular (390 px) e no desktop (1280 px) e anexe-os ao PR.
10. **Segurança é padrão, não extra.** Dados do usuário sempre filtrados pelo usuário autenticado; nada de segredo, token ou e-mail completo em log ou commit; entrada validada (erro de entrada é 4xx, nunca 5xx).
11. **Seja direto e honesto no relatório.** Primeiro o que está bom, depois os problemas por gravidade, depois o que fazer. Sem enfeite, sem exagero.
12. **Dúvida de produto vai para o dono.** Se a decisão não é técnica (nome, regra de negócio, texto jurídico), comente na issue com as opções e a sua recomendação, e espere.
