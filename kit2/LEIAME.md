# Kit v2: issues de correção/polimento + skills para o agente

## O que tem aqui
| Caminho | Para quê |
|---|---|
| `.github/seed/issues-v2/` | 19 issues (13 correções, 5 melhorias visuais e 1 decisão de nome) no formato do repositório, milestone "M7 - Correções e polimento" |
| `scripts/criar-issues.sh` | Cria o milestone e as issues com o GitHub CLI (seguro para repetir) |
| `docs/agente/PRINCIPIOS.md` | 12 princípios de como o agente deve trabalhar (evidência, honestidade, reproduzir antes de consertar...) |
| `.claude/skills/auditar-repositorio/` | Skill: auditar o código e entregar relatório com evidências |
| `.claude/skills/corrigir-bug/` | Skill: reproduzir com teste que falha, causa-raiz, menor correção |
| `.claude/skills/verificar-visual/` | Skill: subir o app, tirar prints (celular/desktop) e avaliar contra a marca |
| `tools/visual/` | Script que tira os prints com a API simulada (testado) |
| `AGENTS-adendo.md` | Trecho para acrescentar ao seu `AGENTS.md` |

## Instalação (na raiz do repositório)
```bash
# 1) copie tudo (inclui pastas ocultas)
cp -r kit2/. ~/projetos/Meu-soninho/      # ajuste os caminhos
cd ~/projetos/Meu-soninho

# 2) acrescente o adendo ao AGENTS.md
cat AGENTS-adendo.md >> AGENTS.md && rm AGENTS-adendo.md LEIAME.md

# 3) crie as issues (confira antes)
gh auth login
scripts/criar-issues.sh --dry-run .github/seed/issues-v2
scripts/criar-issues.sh .github/seed/issues-v2

# 4) commit
git add -A && git commit -m "docs: princípios e skills do agente, issues v2" && git push
```
Os números das issues serão os que o GitHub atribuir. Para listar: `gh issue list --milestone "M7 - Correções e polimento"`.

## Como usar com o agente
As skills ficam em `.claude/skills/` (formato do Claude Code). Outros agentes não as carregam sozinhos, mas o `AGENTS.md` aponta para `docs/agente/` e para os arquivos das skills, que são Markdown comum.

Prompts prontos:
```text
# auditoria
Use a skill auditar-repositorio e me entregue o relatório. Não corrija nada.

# corrigir uma issue de bug (troque o número)
Use a skill corrigir-bug na issue #N (gh issue view N). Siga o AGENTS.md. Abra o PR com Closes #N e não faça merge.

# issue visual
Use a skill verificar-visual e execute a issue #N. Anexe no PR os prints antes/depois (celular e desktop).
```

## Ordem sugerida das issues
1. Correções que o usuário vê: dívida de sono, page/size, duplicados, timeout/"servidor acordando".
2. Excluir conta pela interface e atualizar a política de privacidade.
3. Navegação, dashboard e tokens/links (visual), depois nota da noite e modo escuro.
4. Segurança (limite de tentativas, enumeração, CORS, 409 em corrida) e desempenho.
5. Decisões suas: nome do produto e o que "consistência" significa.

## Observações
- Os achados vêm da leitura do código no commit `dfc79d0` e da execução do front-end; o back-end não foi compilado nem testado por mim. Cada issue marca o nível de certeza (confirmado ou provável).
- `tools/visual` usa Chromium embutido (Linux x64). Se não abrir no seu sistema, use `CHROME_PATH=/usr/bin/chromium` (ou o caminho do seu Chrome).
