# Como contribuir no Noite Boa

Guia curto para quem for contribuir — humano ou agente de IA. O produto (escopo, arquitetura e API) está em [`PLANO.md`](PLANO.md); as regras de comportamento do agente, em [`AGENTS.md`](AGENTS.md).

## 1. Antes de começar

1. Leia a **issue inteira**: contexto, tarefas, critérios de aceite e "Fora do escopo".
2. Só pegue issues com label `agente:ok` ou `agente:revisar`. Issues `agente:humano` pertencem ao dono do repositório.
3. **Uma issue por vez** — finalize (e mergeie) a atual antes de começar a próxima.
4. Dúvida? **Comente na issue** em vez de adivinhar.

## 2. Branch

```bash
git checkout main
git pull
git checkout -b tipo/NUMERO-slug
```

| Parte | Regra | Exemplo |
|---|---|---|
| `tipo` | `feat`, `fix`, `docs`, `test`, `chore`, `infra` | `feat` |
| `NUMERO` | número da issue | `34` |
| `slug` | resumo em kebab-case | `documentar-api` |

Exemplo completo: `docs/34-documentar-api`.

- Faça a menor mudança que cumpre os critérios de aceite (não refatore o que não foi pedido).
- **Nunca** faça push direto na `main` nem force-push nela.

## 3. Commits

[Conventional Commits](https://www.conventionalcommits.org/) em **português (pt-BR)**:

```
feat(frontend): tela de configurações com meta de sono
fix(backend): trata e-mail duplicado em corrida
docs: adiciona guia de contribuição
test(frontend): cobre estado vazio do histórico
chore: atualiza dependências
```

O escopo entre parênteses (`frontend`, `backend`, `docs`...) é opcional, mas recomendado.

## 4. Verificações antes do PR

```bash
docker compose up -d               # PostgreSQL local

cd backend && mvn -B verify        # compila + testes
cd frontend && npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

A CI (`.github/workflows/ci.yml`) repete essas verificações em todo PR e roda ainda um job **`e2e`** (`npm ci` + `npm run build` no front e o smoke do `tools/e2e` no navegador). **Não desative nem apague testes para fazer o CI passar.**

## 5. Pull Request

- Use o template do PR e comece a descrição com **`Closes #NUMERO`** (a issue fecha sozinha no merge).
- Explique **o que mudou** e **como testar** (comandos ou passos manuais).
- Preencha o checklist apenas com o que for verdade.
- Justifique no PR qualquer dependência nova ou mudança fora do escopo da issue.
- **Quem revisa faz o merge**: quem abriu o PR não mergeia o próprio PR.
- PRs com a label `agente:revisar` merecem revisão extra do dono (segurança e dados).

## 6. Limites

- Nenhuma dependência nova sem justificar no PR.
- Nunca commite segredos, tokens, `.env` ou dados reais.
- Não altere `.github/workflows/`, configurações de segurança ou permissões, a menos que a issue peça.
- Banco de dados só muda com **nova migração Flyway** (`V<n>__descricao.sql`); nunca edite uma migração já commitada.
- Rotas de dados do usuário sempre filtram pelo usuário autenticado; entrada validada; senha só com BCrypt e nunca logada.

## 7. Labels (resumo)

| Label | Significado |
|---|---|
| `agente:ok` | Agente pode executar sozinho |
| `agente:revisar` | Agente faz, humano revisa com atenção |
| `agente:humano` | Só o humano do projeto |
| `prio:p0`–`p2`, `mvp` / `pos-mvp` | Prioridade e fase |
