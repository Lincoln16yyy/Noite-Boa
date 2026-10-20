# Teste de fumaça E2E (`tools/e2e`)

Teste rápido de integração no navegador (issue #159). Cobre os fluxos que já
quebraram em produção sem os testes unitários pegarem:

1. visitante vê **Entrar**;
2. login correto leva a `/hoje` (o teste **falha** se ficar em `/login`);
3. recarregar mantém a sessão;
4. registrar uma noite;
5. sair volta ao estado de visitante;
6. modo escuro mantém o texto legível (contraste ≥ 4,5:1).

## Rodar localmente

```bash
cd frontend && npm ci && npm run build   # gera frontend/dist
cd ../tools/e2e && npm ci && npm run smoke
```

O script sobe o app compilado sozinho (`vite preview`, porta 4173) e derruba ao
final. Se já houver um servidor rodando, passe `BASE_URL`.

## Como funciona

- A API é simulada por interceptação de requisições (`smoke.mjs`), **exigindo
  `Authorization`** como o back-end real (sem token → 401). Assim o app exercita
  o mesmo caminho de sessão de produção.
- As fontes do Google são respondidas vazias para o teste não pendurar offline.

## Variáveis

| Variável | Padrão | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:4173` | App já servido (não sobe o `vite preview`) |
| `CHROME_PATH` | — | Chrome/Chromium do sistema; sem isso usa o Chromium do `@sparticuz/chromium` |
| `API_PORT` | `8080` | Porta que o front chama em `VITE_API_URL` |

## No CI

O job `e2e` do [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) compila
o front-end e roda `npm run smoke` com `CHROME_PATH=/usr/bin/google-chrome`
(o Chrome do runner). Roda em poucos segundos.

## Fora do escopo

Testar contra o back-end real.
