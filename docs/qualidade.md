# Qualidade — acessibilidade e boas práticas

Registro das auditorias do app (issue #35). Última execução: **09/10/2026**.

## Resultado

**As 8 telas principais pontuaram 100 em Acessibilidade e 100 em Boas práticas no Lighthouse, e zero violações no axe-core.**

| Tela | Rota | Lighthouse Acessibilidade | Lighthouse Boas práticas | axe-core (WCAG 2.x A/AA) |
|---|---|---|---|---|
| Landing | `/` | **100** | **100** | 0 |
| Login | `/login` | **100** | **100** | 0 |
| Cadastro | `/cadastro` | **100** | **100** | 0 |
| Registrar | `/registrar` | **100** | **100** | 0 |
| Histórico | `/historico` | **100** | **100** | 0 |
| Dashboard | `/dashboard` | **100** | **100** | 0 |
| Amigos | `/amigos` | **100** | **100** | 0 |
| Configurações | `/configuracoes` | **100** | **100** | 0 |

- **Ferramentas:** Lighthouse **13.5.0** (categorias `accessibility` e `best-practices`) e axe-core **4.14.0** (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
- **Onde:** build de produção servido por `vite preview` (não o dev server — sem o React Refresh extra).
- O axe também foi rodado **disparando as mensagens de erro** dos formulários (contraste de erro é auditado só quando a mensagem aparece).

## O que foi corrigido

| Problema | Evidência | Correção |
|---|---|---|
| Texto de erro `#E5484D` sobre fundo claro: **3,56:1** (mínimo 4,5:1) | axe `color-contrast` em 5 telas (`role="alert"`) | Token novo `--color-erro-texto: #C1272D` (**5,33:1** sobre Névoa, **5,84:1** sobre branco) em todas as mensagens de erro, no botão "Sim, excluir" e no rótulo da meta do gráfico |
| Texto de sucesso `#2FBF9B`: **2,12:1** | cálculo — mensagens "Conta criada!", "Noite salva", "Preferências salvas" | Token novo `--color-sucesso-texto: #16745A` (**5,71:1** / **5,20:1**) |
| Login e Cadastro sem `<label>` (só `placeholder`) | inspeção; placeholder some ao digitar | `<label>` visível em todos os campos, `autocomplete="email|name|current-password|new-password"`; placeholders mantidos |
| Campos e botões de login/cadastro com altura padrão do navegador (~24 px) | alvo de toque < 44 px (WCAG 2.5.8) | Campos 48 px, botões 52 px |
| Links do menu com ~25 px de altura | alvo de toque < 44 px | `min-height: 44px` no `header nav a` (`base.css`) |
| Indicador de foco índigo sobre fundo escuro (contraste baixo) | inspeção | Contorno em **Luar** no cabeçalho, hero e CTA da landing |
| Texto solto no `<head>` gerando faixa de 25 px e `lang="en"` | Lighthouse + inspeção | Removido e `lang="pt-BR"` (issue #26) |

As cores originais da paleta (`--color-erro`, `--color-sucesso`) continuam sendo usadas em **bordas, ícones e preenchimentos** (elementos não-texto exigem 3:1 e passam: 3,57:1 e 3,91:1).

## Como reproduzir

```bash
# 1. build de produção + servidor de preview
cd frontend && npm run build && npx vite preview --port 4173

# 2. API permitindo a origem do preview (o padrão é http://localhost:5173;
#    sem isso as chamadas dão CORS e poluem o console da auditoria)
cd backend && CORS_ALLOWED_ORIGINS=http://localhost:4173 SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# 3. Lighthouse em uma tela pública
CHROME_PATH=/caminho/para/chrome npx lighthouse http://localhost:4173/ \
  --only-categories=accessibility,best-practices \
  --output=json --output-path=lh.json \
  --chrome-flags="--headless --no-sandbox"
```

### Telas protegidas (sem login no Lighthouse)

O Lighthouse não tem fluxo de login. Para pontuar `/registrar`, `/historico`, `/dashboard` e `/configuracoes`:

1. Crie uma conta de teste pela API (`POST /api/auth/register`) e faça login para obter o token.
2. Abra o Chromium com perfil persistente (Playwright `launchPersistentContext('/tmp/perfil')`), vá em `http://localhost:4173/` e grave o token: `localStorage.setItem('token', <jwt>)`.
3. Rode o Lighthouse passando o mesmo perfil:
   `--chrome-flags="--headless --no-sandbox --user-data-dir=/tmp/perfil"`.
4. Ao final, apague a conta de teste (`DELETE FROM users WHERE email = ...`).

O axe-core dispensa esse passo: basta injetar `axe.min.js` na página **depois** de gravar o token no `localStorage` (o script roda antes do carregamento) e chamar `axe.run(document)`.

## PWA instalável (issue #37)

> O **Lighthouse 12+ removeu a categoria PWA** (o "Lighthouse PWA aprovado" da issue não é mais
> mensurável com a ferramenta). A verificação equivalente é a de **instalabilidade do Chrome**
> (mesmos critérios que a auditoria cobria), feita via DevTools Protocol em 09/10/2026:
>
> | Verificação | Resultado |
> |---|---|
> | Manifesto encontrado e parseado sem erro (`Page.getAppManifest`) | ✅ |
> | `name`, `short_name`, `display: standalone`, `start_url`, `scope`, `theme_color #15142E` | ✅ |
> | Ícones 192 / 512 / 512 maskable | ✅ |
> | **`Page.getInstallabilityErrors`** (prompt de instalação) | ✅ **0 erros** |
> | Service worker registrado, `activated` e controlando a página | ✅ |
> | **Offline**: servidor derrubado, recarrega o shell e navega no SPA pelo menu | ✅ |
>
> Reproduzir: `cd frontend && npm run build && npx vite preview --port 4173`, abra no Chrome e
> inspecione *Application → Manifest / Service Workers*; para o offline, derrube o preview e
> recarregue. Observações:
>
> - O service worker só registra no **build de produção** (`import.meta.env.PROD`), então não
>   interfere no hot reload do desenvolvimento.
> - **HTTPS é obrigatório em produção** (o Chrome só permite SW/instalação em contexto seguro;
>   `localhost` isento) — a issue #33 (deploy) precisa servir HTTPS.
> - A instalação no **Android** precisa de um aparelho real e fica para o dono da issue
>   (o critério "instalável no celular" depende do Chrome do dispositivo).
> - O cache guarda apenas arquivos públicos do shell (JS/CSS/ícones); **nenhum dado de sono ou
>   token vai para o cache** — chamadas de API são sempre rede.

## Fora do escopo desta issue

- **Performance e SEO**: categorias do Lighthouse não auditadas nesta issue (a de PWA sumiu do Lighthouse 12+; a instalabilidade está registrada na seção acima).
- **Auditoria automática no CI**: as rodadas acima são manuais. Para travar no CI seria preciso adicionar `axe-core` (+ Playwright) como dependência de teste — dependência nova, precisa de justificativa em PR próprio.
- **Contraste no modo escuro**: a identidade prevê um modo escuro futuro; as medições deste documento são sobre o fundo claro (`Névoa`) atual.
