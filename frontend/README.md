# Noite Boa — Front-end

React + Vite (JavaScript).

Rodar:

```bash
npm ci
npm run dev
```

Verificar:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Tipos da API (gerados)

`src/api/schema.d.ts` é **gerado** a partir do OpenAPI do back-end (não edite à mão). `src/api/types.ts` dá apelidos legíveis (`User`, `SleepLog`, `StatsSummary`, `Goal`, `Friend`, `RankingEntry`...) em cima do schema.

Para regenerar depois de mudar a API:

```bash
# 1. suba o back-end em dev (o Swagger só liga nesse perfil)
cd ../backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 2. em outro terminal, gere o schema
cd frontend && npm run gen:api
```

O script usa `http://localhost:8080/v3/api-docs` por padrão; para apontar para outro endereço, defina `API_DOCS_URL`:

```bash
API_DOCS_URL=http://outro-host:8080/v3/api-docs npm run gen:api
```

