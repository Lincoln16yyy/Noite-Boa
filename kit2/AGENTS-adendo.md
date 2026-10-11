
## Princípios de trabalho e skills

Leia também `docs/agente/PRINCIPIOS.md`. Para tarefas recorrentes use as skills em `.claude/skills/`:

- `auditar-repositorio`: revisar o código e produzir um relatório com evidências, por gravidade.
- `corrigir-bug`: reproduzir com teste que falha, achar a causa-raiz, corrigir e provar.
- `verificar-visual`: subir o front-end, tirar prints (celular e desktop) e avaliar contra `docs/identidade-visual.md`.

Em PRs que mudam tela, anexe os prints. Em PRs de bug, descreva o teste que falhava antes.
