title: fix(frontend): 22 testes falham e 10 pulados — infraestrutura de teste sem AuthProvider/ThemeProvider
state: OPEN
author: Lincoln16yyy
labels: agente:ok, area:frontend, prio:p0, tipo:bug, mvp
comments: 0
assignees: 
projects: 
milestone: M7 - Correções e polimento
issue-type: 
parent: 
sub-issues: 
sub-issues-completed: 
blocked-by: 
blocking: 
number: 132
--
## Contexto
No commit `07e5c23`: **22 testes falham** e **10 estão pulados (`it.skip`)** de 131 total. A causa é infraestrutura de teste: os testes renderizam `<App />` sem `AuthProvider` nem `ThemeProvider` (que só existem no `main.jsx`).

**Sintomas:**
- `Configuracoes.test.jsx`: 12 testes falham — `useAuth()` / `useTheme()` fora de provider.
- `Login.test.jsx`: 2/3 falham — `useAuth()` não disponível.
- `ProtectedRoute.test.jsx`: 3/3 falham — mesmo motivo.
- `App.test.jsx`: 1 teste falha — roteamento sem providers.
- `Sons.test.jsx`: 1 teste falha — `useAuth()` em `Layout`.
- `Privacidade.test.jsx`, `Home.test.jsx`, `Cadastro.test.jsx`: testes usam `renderWithAuth` mas o helper não provê `ThemeProvider`.

**Raiz:** O helper `renderWithAuth` em `src/test/test-utils.jsx` só envolve com `AuthProvider` + `MemoryRouter`, mas **não** inclui `ThemeProvider` (adicionado no `main.jsx` após o PR do modo escuro). Além disso, `App.jsx` agora usa `ThemeProvider` + `AuthProvider` na raiz, mas os testes não replicam essa estrutura.

## Tarefas
- [ ] Atualizar `src/test/test-utils.jsx`:
  - [ ] Exportar `renderWithProviders(ui, { user, theme, route })` que envolve: `MemoryRouter` → `ThemeProvider` → `AuthProvider`.
  - [ ] Aceitar parâmetros opcionais: `user` (para `mockMe`), `theme` ('light'|'dark'|'auto'), `route`.
  - [ ] Exportar `mockMe(user)` e `mockTheme(theme)` helpers.
- [ ] Atualizar **todos** os testes que usam `renderWithAuth` ou `render(<App />)`:
  - [ ] `Configuracoes.test.jsx` (12 testes)
  - [ ] `Login.test.jsx` (3 testes)
  - [ ] `ProtectedRoute.test.jsx` (3 testes)
  - [ ] `App.test.jsx` (1 teste)
  - [ ] `Sons.test.jsx` (1 teste falha + 9 passam)
  - [ ] `Home.test.jsx` (5 testes skip)
  - [ ] `Privacidade.test.jsx` (5 testes skip)
  - [ ] `Cadastro.test.jsx` (4 testes)
- [ ] Remover todos os `it.skip` — os testes devem passar.
- [ ] Garantir que `mockMe(user)` e `mockTheme(theme)` funcionem nos testes que precisam.

## Critérios de aceite
- [ ] `npm test` → **131 testes passando**, 0 falhas, 0 skip (exceto os legítimos `it.skip` documentados).
- [ ] `npm run lint && npm run build` verdes.
- [ ] `mvn -B verify` verde (back-end não mudou).

## Fora do escopo
- Adicionar novos testes de funcionalidade.
- Testes E2E com Playwright (isso é `verificar-visual`).

## Como testar
```bash
cd frontend && npm run lint && npm test && npm run build
# Deve sair: "Test Files 19 passed | 131 passed"
```

## Skill recomendada
`corrigir-bug` — reproduz com teste que falha, acha causa-raiz (falta provider), correção mínima, prova que funcionou.