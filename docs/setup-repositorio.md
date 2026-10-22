# Setup inicial do repositório

> Movido do `README.md` na issue #320. Registro histórico de como o repositório foi preparado; útil para recriar em outro projeto.

1. **Crie o repositório** no GitHub (vazio) e envie este kit:
   ```bash
   git init && git add . && git commit -m "chore: kit inicial do projeto"
   git branch -M main
   git remote add origin git@github.com:SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
2. **Crie labels, milestones e as issues** (precisa do [GitHub CLI](https://cli.github.com)):
   ```bash
   gh auth login
   scripts/seed-github.sh --dry-run   # confira o que será criado
   scripts/seed-github.sh             # cria de verdade
   ```
3. **Faça as issues `agente:humano` do M0**: nome/identidade e proteção da `main`.
4. **(Opcional) Ative o `@claude`** nas issues e PRs:
   - Instale o GitHub App do Claude no repositório e crie o segredo `ANTHROPIC_API_KEY` (a forma mais fácil é rodar `/install-github-app` dentro do Claude Code).
   - Comente `@claude implemente esta issue seguindo o AGENTS.md` em uma issue `agente:ok`.
   - Isso consome créditos da API e minutos do GitHub Actions; acompanhe os custos.
5. **Crie um quadro (GitHub Projects)**, opcional: aba *Projects* > *New project* > Board, e adicione as issues. Colunas sugeridas: Backlog, Pronto para fazer, Em andamento, Em revisão, Feito.
6. **Trabalhe em ordem**: M0 → M1 → M2 ... Só avance quando o critério "Pronto quando" do milestone (PLANO.md, seção 7) for cumprido.
