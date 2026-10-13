---
name: verificar-visual
description: Sobe o front-end com a API simulada, tira prints de todas as telas (celular 390 px e desktop 1280 px) e avalia o visual contra a identidade da marca. Use depois de qualquer mudança de interface e ao revisar a aparência do app.
---

# Verificar o visual de verdade

Não julgue interface só pelo código. Renderize, olhe e compare com `docs/identidade-visual.md` e `docs/brand-board.png`.

## Como rodar
```bash
cd frontend && npm ci && npm run typecheck && npm run build
npx vite preview --port 4173 &          # sobe o app compilado
cd ../tools/visual && npm ci
node screenshots.mjs                     # prints em tools/visual/out/
```
- Variáveis úteis: `BASE_URL` (padrão `http://localhost:4173`), `CHROME_PATH` (usa o Chrome/Chromium do sistema; sem isso, usa o Chromium embutido do pacote), `ONLY=home,dashboard` (só algumas telas).
- A API é simulada em `tools/visual/mocks.mjs`. Ao criar rota nova, adicione o mock correspondente. Os dados são fictícios: não tire conclusões sobre números.
- Fontes do Google podem não carregar offline: o texto cai numa fonte genérica. Registre isso no relatório e não critique a tipografia por causa disso.

## Como avaliar (abra cada imagem de `out/`)
1. **Celular (390 px):** o menu cabe sem ocupar a tela? Botões com 44 px ou mais? Nada cortado ou rolando para o lado?
2. **Desktop (1280 px):** o conteúdo aproveita o espaço ou fica numa coluna estreita com o resto vazio?
3. **Marca:** cores só da paleta, links em Índigo (nunca azul padrão), logo e nome corretos, gráficos com as cores da identidade.
4. **Contraste:** texto e elementos gráficos legíveis. Âmbar e Lavanda sobre fundo claro NÃO servem para texto nem barras de dado.
5. **Estados:** vazio, carregando, erro e sucesso estão bonitos e claros?
6. **Consistência:** a tela nova parece do mesmo app que as outras?

## Relatório
Liste por tela: o que está bom, o que quebra a identidade, e o que mudar, em ordem de impacto. Anexe os prints no PR (arraste as imagens no comentário) e diga o que não foi possível verificar (fonte, dados reais, navegador diferente).
