# Nome do produto: Noite Boa

**Status:** decidido em 11/10/2026 (issue #113).
**Nome definitivo:** **Noite Boa** — com complemento de busca "Noite Boa — Diário do Sono"
(é o que o `manifest.webmanifest` já usa como `name`).

## Contexto

Conviviam três nomes: "Noite Boa" (código e interface), "Sleep-Well" (repositório no
GitHub e projeto na Vercel) e uma identidade antiga com o wordmark "Sleep Well". A issue
#113 pedia uma decisão única.

## Decisão

**Noite Boa.** Motivos:

- Já é o nome usado em README, todas as telas, `<title>`, manifest PWA, notificação de
  hora de dormir, cache do service worker (`noiteboa-v1`), `package.json`, pacote Java
  (`br.dev.noiteboa`) e serviço na Render (`noiteboa-api`);
- A identidade visual (`docs/identidade-visual.md`, brand board e SVGs em
  `docs/assets/brand/`) foi desenhada para ele (lua em formato de berço abraçando
  estrela);
- "Sleep Well" só sobrevive no repositório GitHub, no projeto/URL da Vercel e no logo
  antigo do cabeçalho (ver pendências abaixo).

Consequência para a issue #113: a tarefa "renomear pacote Java e serviço" ficou
**desnecessária** — `br.dev.noiteboa` e `noiteboa-api` já são o nome definitivo.

## Conferências de marca (melhor esforço, 11/10/2026)

| O quê | Resultado |
|---|---|
| Lojas (App Store / Play Store) | Sem app "Noite Boa" de diário de sono. Existem apps de recados ("Bom Dia Boa Tarde Boa Noite") e um infantil "Boa Noite — histórias bíblicas" (`boanoite.app`) — categorias diferentes; o complemento "Diário do Sono" evita confusão nas buscas. |
| Domínio | **Não verificado** — a consulta automática do registro.br não respondeu. Conferir `noiteboa.com.br` (e variantes `noiteboa.app`, `noiteboa.dev`) em [registro.br](https://registro.br) antes de publicar. |
| INPI | **Não verificado** — a busca oficial (`busca.inpi.gov.br`) exige interface logada. Fazer pesquisa de anterioridade (classes Nice 09 e 42, softwares) antes de publicar/comercializar. |

## Estado atual e pendências

| Item | Estado |
|---|---|
| README, telas, `<title>`, manifest, notificação, cache SW, `package.json` | Noite Boa |
| Pacote Java `br.dev.noiteboa` e serviço Render `noiteboa-api` | Noite Boa (não mudam) |
| Logo do cabeçalho (`frontend/public/logo-horizontal-light.svg`) | Ainda o wordmark antigo "Sleep Well" → issue de implementação aberta pela #113 |
| Repositório GitHub `Lincoln16yyy/Noite-Boa` | ✅ Concluído (rename mantém redirect dos links antigos) |
| Projeto/URL da Vercel `noiteboa.vercel.app` | Pendência humana (rename muda o domínio de preview e as referências em `docs/deploy.md`) |

## Consequências

- Textos novos de interface e docs usam **Noite Boa**; nomes técnicos derivam de
  `noiteboa` (chaves de localStorage, eventos, variáveis).
- Antes de publicar fora do GitHub/Vercel: conferir domínio e INPI (acima).
