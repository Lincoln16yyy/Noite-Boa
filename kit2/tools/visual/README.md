# tools/visual

Tira prints de todas as telas do front-end (celular 390 px e desktop 1280 px) com a API simulada.

```bash
cd frontend && npm ci && npm run build && npx vite preview --port 4173 &
cd tools/visual && npm ci && node screenshots.mjs
```

- `CHROME_PATH=/usr/bin/chromium` usa o navegador do sistema; sem isso usa o Chromium embutido (`@sparticuz/chromium`, Linux x64).
- `ONLY=home,dashboard` limita as telas. `BASE_URL` muda o endereço do app.
- Dados em `mocks.mjs` (fictícios). Rotas novas do back-end precisam de mock novo.
- Use junto com a skill `.claude/skills/verificar-visual/SKILL.md`.
