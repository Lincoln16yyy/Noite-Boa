title: fix(frontend): login não redireciona após submit — usuário fica em /login
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
number: 130
--
## Contexto
No commit `07e5c23` o login parou de funcionar: após submit com credenciais válidas o usuário permanece em `/login` e só entra ao recarregar a página (F5). O fluxo correto deveria ser: login → token salvo → navegação para `/registrar` → `AuthContext` carrega usuário → `Layout` deixa passar.

**Causa raiz** (confirmada): `Login.jsx` chama `api.post('/auth/login')`, salva o token no `localStorage` e faz `navigate('/registrar')` **sem disparar o evento `noiteboa:session-change`** que o `AuthContext` escuta para carregar o usuário. O `Layout` usa `useAuth()` → vê `loading=true` ou `user=null` → redireciona para `/login` via `<Navigate to="/login" replace />`. Ao recarregar a página, o `AuthProvider` inicializa corretamente (chama `/me`) e o app abre.

**Evidência:** O script `e2e-login.mjs` (anexado no zip) reproduz o problema de ponta a ponta com a API simulada e serve como teste de regressão.

## Tarefas
- [ ] Em `Login.jsx`: substituir a lógica manual de `localStorage.setItem('token')` + `navigate()` por uma chamada ao hook `useAuth()` → `auth.login(email, password)` (já existe no `AuthContext` e dispara o evento `noiteboa:session-change`).
- [ ] Remover a lógica manual de `localStorage.setItem('token')` e `navigate()` do `Login.jsx`.
- [ ] Garantir que `AuthContext.login()` dispare `window.dispatchEvent(new CustomEvent('noiteboa:session-change'))` após salvar o token (já faz isso, confirmar).
- [ ] **Bônus / robustez:** Tratar erro de rede / 401 no login mostrando mensagem amigável (não apenas "Credenciais inválidas" genérica).

## Critérios de aceite
- [ ] Login com credenciais válidas redireciona para `/registrar` **sem precisar recarregar a página**.
- [ ] Login com credenciais inválidas mostra mensagem amigável e **não** navega.
- [ ] Erro de rede / servidor "acordando" mostra mensagem amigável e **não** desloga o usuário.
- [ ] Script `e2e-login.mjs` passa (rodar localmente: `node e2e-login.mjs`).
- [ ] `npm run lint && npm test && npm run build` verdes.

## Fora do escopo
- Cadastro de usuário (funciona).
- Refresh token / renovação silenciosa.

## Como testar
```bash
cd frontend && node ../e2e-login.mjs
# Deve imprimir: "LOGIN OK → redirecionou para /registrar"
```

## Script de regressão (já pronto)
`e2e-login.mjs` no zip anexado. Ele:
1. Sobe o front-end com API simulada (`tools/visual/`)
2. Faz login com credenciais válidas
3. Verifica se navega para `/registrar` sem reload
4. Verifica se `AuthContext` carrega o usuário
5. Tenta login inválido → deve mostrar erro e não navegar

## Referências
- `AuthContext.login()` já existe em `src/context/AuthContext.jsx`
- `Layout` redireciona para `/login` quando `!user && loading === false` (linha ~42 em `Layout.jsx`)
- `Login.jsx` linhas 39-49 (lógica atual quebrada)

## Skill recomendada
`corrigir-bug` — reproduz com teste que falha, acha causa-raiz, correção mínima, prova que funcionou.