# tools/visual

Tira prints de todas as telas do front-end (celular 390 px e desktop 1280 px) com a API simulada.

```bash
cd frontend && npm ci && npm run build && npx vite preview --port 4173 &
cd tools/visual && npm ci && node screenshots.mjs
```

- `CHROME_PATH=/usr/bin/chromium` usa o navegador do sistema; sem isso usa o Chromium embutido (`@sparticuz/chromium`, Linux x64).
- `ONLY=home,dashboard` limita as telas. `BASE_URL` muda o endereço do app.
- `THEME=dark` ou `THEME=light` escolhe o tema (padrão: automático). `ESTADO=vazio|carregando|erro` simula estado.
- `WIDTHS=768,1280,1440` troca o par celular/desktop por larguras quaisquer (issue #217); os prints saem nomeados `w768-…`, `w1280-…`.
- Dados em `mocks.mjs` (fictícios). Rotas novas do back-end precisam de mock novo.
- Use junto com a skill `.claude/skills/verificar-visual/SKILL.md`.

## Medir em vez de olhar

- `node movimento.mjs` (issue #216) — prova que as animações rodam e desligam com `prefers-reduced-motion`.
- `node larguras.mjs` (issue #217) — mede a geometria do layout em 390, 768, 1280 e 1440 px: container de 1100 px, alinhamento entre cabeçalho e conteúdo, trilhas da grade e qual navegação está no ar. Sai 1 se alguma conferência falhar.
