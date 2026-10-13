---
name: implementar-do-mockup
description: Implementa ou ajusta uma tela do front-end para ficar fiel ao mockup em docs/design/mockups, comparando lado a lado com prints do app e iterando até bater. Use nas issues do milestone M9 (visual v2).
---

# Implementar uma tela a partir do mockup

O mockup é o alvo. Você só termina quando o print do app, lado a lado com o mockup, não tiver diferenças que não sejam dados.

## Passo a passo
1. **Leia** a issue, `docs/design/direcao-visual.md` (tokens, componentes e regras da tela) e `docs/identidade-visual.md`.
2. **Olhe o mockup** (`docs/design/mockups/<tela>.png`, abra a imagem). Anote: hierarquia (qual é o número gigante), espaçamentos, raios, cores por significado, o que muda com dados.
3. **Use só tokens e componentes base** (Button, Card, Chip, ProgressBar, Ring...). Não escreva cor em hexadecimal solta nem botão nativo sem estilo. Se faltar componente, abra issue ou crie dentro do escopo da issue, com teste.
4. **Dados de verdade:** número, texto e cor vêm da API e das regras de `direcao-visual.md` (por exemplo a regra da dica e a cor por meta). Nunca copie os números do mockup.
5. **Gere o print do app e compare:**
   ```bash
   cd frontend && npm run build && npx vite preview --port 4173 &
   cd tools/visual && npm ci
   ONLY=<tela> node screenshots.mjs          # adicione a tela e o mock em mocks.mjs se for nova
   node compare.mjs <tela>                   # gera out/compare-<tela>.png (mockup | app)
   ```
   Abra `compare-<tela>.png` e liste as diferenças (tamanho, espaçamento, cor, alinhamento, texto cortado). Corrija e repita até sobrar só diferença de dados.
6. **Cheque os dois temas e as duas larguras:** claro e escuro, 390 px e 1280 px. O tema claro precisa ter paridade (veja a seção 3 do guia).
7. **Acessibilidade:** foco visível, alvos de 44 px, `aria-label` em ícones, contraste conferido, `prefers-reduced-motion` respeitado.
8. **Verifique:** `npm run typecheck && npm run lint && npm test && npm run build`. Sem `any`, sem testes pulados.
9. **PR:** anexe `compare-<tela>.png` (claro e escuro) e liste as diferenças que restaram e o porquê. Diga o que não foi verificado (fonte, dados reais, outros navegadores).

## Não faça
- Mudar o desenho do mockup por gosto. Achou algo ruim no mockup? Comente na issue com uma proposta e espere.
- Copiar números ou textos de exemplo do mockup para o código.
- Usar emoji como ícone, estilo inline com cor fixa, ou animação sem respeitar `prefers-reduced-motion`.
