title: fix(frontend): modo escuro deixa textos ilegíveis (claros sobre claro)
state: OPEN
author: Lincoln16yyy
labels: agente:ok, area:frontend, area:design, prio:p0, tipo:bug, mvp
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
number: 131
--
## Contexto
No commit `07e5c23` o modo escuro está **quebrado**: títulos, textos e bordas claras sobre fundo claro, quase invisíveis (veja print `front-v2-modo-escuro-e-desktop.png`). O app é usado à noite; o modo escuro é o "modo natural" segundo `docs/identidade-visual.md`.

**Causa raiz** (provável, pela leitura):
- `Layout.jsx` usa cor fixa `background: '#F5F3FF'` (Névoa) no container raiz em vez de `var(--bg-primary)`.
- Vários componentes usam hex fixos (`#FFFFFF`, `#15142E`, `#C9C6F0`, etc.) em vez dos tokens semânticos (`var(--bg-secondary)`, `var(--text-primary)`, `var(--card-bg)`, `var(--card-border)`).
- O `ThemeProvider` troca `data-theme="dark"` no `<html>`, mas os tokens CSS em `tokens.css` definem as variáveis para ambos os temas — só não estão sendo usados consistentemente.
- `Configuracoes.jsx` mostra o toggle de tema, mas o Layout não reage porque o container raiz tem cor fixa.

## Tarefas
- [ ] Em `Layout.jsx`: substituir `background: '#F5F3FF'` por `var(--bg-primary)` no container raiz.
- [ ] Auditar todos os arquivos `.jsx` e `.css` substituindo hex fixos por tokens semânticos:
  - `#FFFFFF` / `#F5F3FF` → `var(--bg-secondary)` ou `var(--bg-primary)`
  - `#15142E` → `var(--text-primary)` ou `var(--color-noite)`
  - `#C9C6F0` / `#E3E0F5` → `var(--card-border)` ou `var(--color-lavanda)`
  - `#4B4A6B` → `var(--text-muted)`
  - `#FFE9B5` → `var(--color-luar)` (apenas em fundo escuro)
  - `#FFB347` → `var(--color-ambar)` (apenas em fundo escuro)
  - `#B9B6FF` → `var(--color-lavanda)` (apenas em fundo escuro)
- [ ] Verificar se `ThemeProvider` aplica `data-theme="dark"|"light"` no `<html>` (já faz).
- [ ] Garantir que tokens em `tokens.css` cubram ambos os temas (já definidos em `:root` e `[data-theme="dark"]`).

## Critérios de aceite
- [ ] Modo escuro: títulos, textos e bordas **legíveis** (contraste ≥ 4.5:1 WCAG AA).
- [ ] Modo claro: continua legível (regressão zero).
- [ ] Toggle em Configurações (Claro / Escuro / Automático) troca o tema instantaneamente sem reload.
- [ ] Preferência persiste no `localStorage` (`noiteboa.theme`).
- [ ] `npm run lint && npm test && npm run build` verdes.

## Fora do escopo
- Temas personalizados, transições animadas.
- Troca automática por horário (apenas `prefers-color-scheme`).

## Como verificar
1. Abra o app no celular com tema escuro do sistema → deve abrir no modo escuro legível.
2. No desktop, use o toggle em Configurações → alterna Claro ↔ Escuro ↔ Automático instantaneamente.
3. Confira contraste no Dashboard, Histórico, Amigos, Configurações, Login, Cadastro, Sons, Registrar.

## Skill recomendada
`verificar-visual` — sobe o front-end com API simulada, tira prints mobile (390px) e desktop (1280px) e avalia contra `docs/identidade-visual.md`.