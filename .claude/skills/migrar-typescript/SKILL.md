---
name: migrar-typescript
description: Migra uma fatia do front-end de JavaScript para TypeScript sem mudar nenhum comportamento. Use nas issues do milestone M8 (migração para TypeScript).
---

# Migrar uma fatia para TypeScript

Regra de ouro: **migração não muda comportamento.** Mesmos testes, mesma tela, mesmas chamadas. Só muda o que o compilador sabe.

## Passo a passo
1. **Leia a issue** e liste os arquivos da fatia. Confira que a issue anterior do M8 já foi mergeada.
2. **Linha de base:** rode e anote `npm run lint`, `npm test` (número de testes passando) e `npm run build`. Tudo deve estar verde antes de começar.
3. **Renomeie primeiro, sozinho:** `git mv x.js x.ts` (e `.jsx` para `.tsx`) num commit só de renomeação, sem editar o conteúdo. Isso preserva o histórico.
4. **Tipe de verdade:**
   - Tipos de resposta da API vêm de `src/api/schema.d.ts` (gerado), nunca escritos à mão.
   - Estados com opções fechadas viram união (`'loading' | 'error' | 'ready'`), não `string`.
   - Valores que podem não existir (`user`, resultado de `find`) são `T | null` e tratados no código.
   - Props de componentes com `interface`/`type` explícitos.
5. **Proibido para calar o compilador:** `any`, `as unknown as`, `// @ts-ignore`, `!` sem checagem prévia. Se for inevitável, comente o motivo na linha e cite no PR. Em testes, `@ts-expect-error` com justificativa é aceitável.
6. **Se o tipo revelar um bug:** não corrija na migração. Abra uma issue com a descrição e um teste que falha, e siga a migração. (Exceção: erro de digitação trivial, dito no PR.)
7. **Verifique:** `npm run typecheck && npm run lint && npm test && npm run build`. O número de testes passando deve ser igual ou maior que a linha de base; nenhum teste pode ser pulado ou apagado.
8. **PR:** liste os arquivos migrados, os tipos novos criados, cada `any`/`as` restante com o motivo, e confirme "sem mudança de comportamento". Para telas, rode a skill `verificar-visual` e confirme que os prints ficaram idênticos aos de antes.

## Não faça
- Reformatar, renomear variáveis, trocar bibliotecas ou "melhorar" a lógica aproveitando a migração.
- Migrar arquivos fora da fatia da issue (PRs paralelos mexendo nos mesmos arquivos geram conflito).
- Desativar regras do `tsconfig` para passar (`strict` fica ligado).
