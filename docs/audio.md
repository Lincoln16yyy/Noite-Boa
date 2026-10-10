# Sons e música de relaxamento — pesquisa de fontes, licenças e custos

> Documento de decisão da issue #40. Pesquisa e documentação apenas: **nenhum player foi
> implementado e nenhum arquivo de áudio foi baixado ou adicionado ao repositório.**
> Data da pesquisa: 10/10/2026.

## 1. Objetivo e escopo

Investigar de onde virão os sons de relaxamento do Noite Boa (M6), registrando licenças,
custos e limites técnicos, e recomendar uma abordagem para uma implementação futura.

Dentro do escopo: fontes de áudio com licença verificável, condições de uso em aplicativo
público, custos de hospedagem e entrega, e o custo de manutenção (atribuições).

Fora do escopo: implementar o player; baixar áudios; usar músicas protegidas por direitos
autorais (extraídas de streaming, vídeos etc.).

## 2. Fontes pesquisadas

| # | Fonte | Tipo | URL oficial consultada |
|---|-------|------|------------------------|
| 1 | Produção própria (Web Audio API / gravações) | domínio do projeto | [MDN — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) |
| 2 | Kenney (pacotes de game assets, inclui sons) | domínio público (CC0) | [kenney.nl/support](https://kenney.nl/support) |
| 3 | Freesound (sons de usuários) | CC0, CC-BY ou CC-BY-NC **por arquivo** | [FAQ](https://freesound.org/help/faq/), [TOS](https://freesound.org/help/tos_web/), [API terms](https://freesound.org/docs/api/terms_of_use.html) |
| 4 | Pixabay (música e efeitos) | Licença própria ("Content License") + CC0 só para conteúdo anterior a 09/01/2019 | [Termos](https://pixabay.com/service/terms/) |
| 5 | incompetech — Kevin MacLeod | CC-BY (grátis) ou Licença Standard (paga) | [Página de licenças](https://incompetech.com/music/royalty-free/licenses/) |
| 6 | Bensound | Licença própria (Free limitada a vídeos; app exige licença paga) | [Termos](https://www.bensound.com/terms-and-conditions), [Pricing](https://www.bensound.com/pricing) |
| 7 | Artlist | Assinatura; apps exigem licença Enterprise | [Licença](https://artlist.io/help-center/privacy-terms/artlist-license/) |
| 8 | Epidemic Sound | Assinatura (planos Business/Enterprise) | [Pricing](https://www.epidemicsound.com/pricing/) |
| 9 | YouTube Audio Library | Licença restrita a vídeos no YouTube | [Ajuda oficial](https://support.google.com/youtube/answer/3376882) |
| 10 | Hospedagem: Vercel (plano atual) | serviço do projeto | [Pricing](https://vercel.com/pricing) |
| 11 | Hospedagem alternativa: Cloudflare R2 | serviço externo | [Pricing](https://developers.cloudflare.com/r2/pricing/) |

Não foram considerados (e portanto não constam como opção viável): músicas de plataformas de
streaming, "royalty-free" de canais de vídeo sem licença de distribuição, e bibliotecas cujos
termos não foram verificados na fonte oficial.

## 3. Tabela comparativa de licenças e condições

Legenda: ✅ permitido · ⚠️ com condição · ❌ não permitido / não coberto · ❔ não verificado

| Fonte | Licença | Uso em app público | Modificar / converter | Distribuir os arquivos | Crédito obrigatório | Comercial | Hospedar no projeto | Risco principal |
|---|---|---|---|---|---|---|---|---|
| **Produção própria** (Web Audio API, gravações próprias) | Domínio do autor | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Custo de produção/qualidade própria |
| **Kenney** | CC0 (domínio público) | ✅ | ✅ | ✅ | ❌ (crédito a "Kenney" é opcional; sem uso do logo) | ✅ | ✅ | Catálogo limitado (sons de interface/ambiente) |
| **Freesound — CC0** | CC0, escolhido por arquivo | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Conteúdo é de usuários: risco residual de upload indevido (ver §7) |
| **Freesound — CC-BY** | CC-BY 4.0, por arquivo | ✅ | ✅ | ✅ | ✅ (formato do próprio Freesound) | ✅ | ✅ | Mesmo risco residual + obrigatoriedade de manter crédito |
| **Freesound — CC-BY-NC** | CC-BY-NC, por arquivo | ❌ | ⚠️ | ❌ | ✅ | ❌ | ❌ | Proibido: uso não-comercial apenas |
| **Pixabay** (conteúdo pós-09/01/2019) | Licença própria | ⚠️ zona cinzenta | ✅ | ❌ (proibido "Standalone") | ❌ | ✅ | ⚠️ risco | Áudio entregue "em si mesmo" pode configurar distribuição Standalone, proibida pelos termos; Pixabay isenta responsabilidade pela licença e exige indenização do usuário |
| **incompetech** | CC-BY (grátis) ou Standard paga | ✅ (CC-BY) | ✅ | ✅ | ✅ | ✅ | ✅ | Crédito obrigatório; preço da licença Standard não visível (❔ §7) |
| **Bensound — Free** | Licença própria, revogável | ❌ | ⚠️ | ❌ | ✅ (texto por vídeo) | ❌ (só vídeos gratuitos/educacionais) | ❌ | Termos: app/software exige licença **Professional** paga (desde €34 por faixa) |
| **Artlist** | Assinatura (Social/Pro) | ❌ para plano padrão | ✅ dentro do catálogo | ❌ ("standalone" proibido) | ❌ | ✅ | ❌ | Licença oficial: apps/software só com licença **Enterprise** sob medida |
| **Epidemic Sound** | Assinatura (Business/Enterprise) | ❔ (não verificado para apps) | ✅ | ❌ | ❌ | ✅ | ❔ | Preços e cobertura para app não confirmados (§7); custo recorrente |
| **YouTube Audio Library** | Licença do YouTube | ❌ | ⚠️ | ❌ | ✅ (faixas CC) | ✅ (monetização em vídeos) | ❌ | Página oficial: uso previsto em **vídeos** no YouTube; YouTube não responde por usos fora da plataforma |

Resumo jurídico: **CC0** (Kenney, sons CC0 do Freesound, produção própria) é a única classe
sem condições — crédito nenhum, modificação e distribuição livres, uso comercial livre.
**CC-BY** é segura desde que a página de créditos exista (incompetech e sons CC-BY do
Freesound). Todas as licenças próprias de bancos comerciais pesquisados **não cobrem** o caso
"arquivos hospedados dentro de um app de sono", ou exigem planos caros — por isso foram
descartadas. Nenhuma licença foi inferida por terceiros: cada linha acima vem do texto oficial
da fonte (§8).

## 4. Custos e impacto técnico

### 4.1 Situação atual do frontend

- Bundle JavaScript: `index` ~300 KB (94 KB gzip) + `SleepChart` ~356 KB (105 KB gzip,
  carregado sob demanda). CSS ~8 KB.
- O app é PWA com service worker que faz precache apenas do shell estático — **áudios não
  devem entrar no precache** (poupa banda e quota de armazenamento do usuário); carregar sob
  demanda com `<audio>` e `preload="none"`.
- Os arquivos de áudio são assets estáticos: ficam fora do bundle JS e não pesam no load
  inicial.

### 4.2 Tamanho e tráfego (estimativas de cálculo, não medições)

| Formato | Aprox. por minuto | Loop de 10 min |
|---|---|---|
| WAV 44,1 kHz/16 bits estéreo | ~10,6 MB | ~106 MB (inviável) |
| MP3 128 kbps | ~0,96 MB | ~9,6 MB |
| MP3 96 kbps | ~0,72 MB | ~7,2 MB |
| Ruído gerado por Web Audio API | 0 (sem arquivo) | 0 |

- Reproduzir um loop **não** gera tráfego contínuo: o arquivo é baixado uma vez e fica no
  cache do navegador/CDN (a Vercel usa ETag e cache automático de assets estáticos).
- Estimativa de uso mensal por usuário ouvinte 30 min/noite em MP3 96 kbps: ≈ 16 MB/mês.
- Custo marginal: 0 (arquivos no repositório, servidos pela Vercel já contratada).

### 4.3 Hospedagem dos arquivos

| Opção | O que foi verificado | Custo | Veredito |
|---|---|---|---|
| **Arquivos em `frontend/public/` (Vercel)** | Vercel Hobby: 100 GB/mês de transferência e 1M de requisições CDN; plano é "personal, non-commercial" | R$ 0 | **Recomendada.** ≈ 6 mil usuários-escuta/mês cabem no limite (estimativa acima). Se um dia houver monetização, os termos da Vercel exigem plano Pro (US$ 20/mês + 1 TB) |
| **Vercel Blob** | 1 GB de armazenamento + 10 GB de transferência/mês no Hobby | R$ 0 | Alternativa se o catálogo passar de ~1 GB ou quiser separar do bundle |
| **Cloudflare R2** | Free tier: 10 GB de armazenamento, 10M leituras/mês, **egress sempre grátis**; depois disso, US$ 0,015/GB-mês | R$ 0 no MVP | Boa alternativa externa se o tráfego explodir; exige CORS e mais uma peça de infraestrutura |
| **Streaming via API de serviço pago (Epidemic etc.)** | Existe oferta comercial/API, mas preços e cobertura para app não confirmados | Recorrente, a confirmar | Não recomendada para o MVP (custo fixo + dependência externa) |

## 5. Recomendação final

**Recomendação: somente sons de licença livre — CC0 e produção própria — com página de
créditos desde o início.**

**Fase 1 (MVP do M6) — zero arquivos:**
1. **Sons gerados no navegador com a Web Audio API**: ruído rosa/marrom/branco (necessita
   apenas de `OscillatorNode`/filtros/gain — sem dependência nova, sem arquivo, sem tráfego,
   sem licença). É o padrão de mercado para apps de sono e entrega o essencial.
2. Detalhe de implementação: exigir gesto do usuário para iniciar (política de autoplay dos
   navegadores) e pausar o `AudioContext` quando a aba ficar oculta.

**Fase 2 — ambiências (chuva, vento, ondas) com arquivos CC0:**
3. Baixar manualmente **CC0 apenas** de duas fontes: **Kenney** (CC0 incondicional, sem
   crédito) e **Freesound filtrando por CC0** (filtro de licença existe na busca). Alternar
   para CC-BY (Freesound/incompetech) só se o responsável quiser a página de créditos —
   decisão pendente (§7).
4. Hospedar em `frontend/public/audio/`, convertidos para MP3 mono ~96 kbps, loops de
   10 min, total ≤ 30 MB no lançamento; registro de fonte/licença por arquivo (§6).
5. Nenhuma dependência nova de npm: usar `<audio>` nativo (o bundle atual já mostra que dá
   para evoluir sem inflar).

**Por que não as outras:** Pixabay (cláusula "Standalone" proíbe distribuir áudio em si —
risco jurídico alto para um app de sono), YouTube Audio Library (uso previsto em vídeos),
Bensound Free (só vídeos; app exige licença paga), Artlist e Epidemic (apps fora do plano
padrão; custo recorrente; preços não confirmados). Critérios da decisão: custo (≈ R$ 0),
segurança jurídica (CC0 = sem condições), simplicidade (sem dependência nova, sem API
externa) e experiência (ruído + ambiência é exatamente o esperado num app de sono).

## 6. Créditos e atribuições exigidos pelas licenças escolhidas

- **CC0 (Kenney, sons CC0 do Freesound) e produção própria:** nenhuma atribuição é exigida.
  Ainda assim, como boa prática, a tela de créditos pode citar "Kenney" (o próprio autor
  pede que o crédito, se dado, seja apenas "Kenney", sem usar o logo).
- **CC-BY (caso o responsável opte por esses arquivos):** a atribuição passa a ser
  obrigatória — manter página de créditos no app com, por arquivo: título, autor, URL de
  origem e licença (formato sugerido pelo próprio Freesound):
  `"nome" por autor (URL) licenciado sob CC BY 4.0`.
- **Arquivo de licenças:** gravar em `docs/audio-licencas.md` (ou na issue de implementação)
  uma tabela por arquivo usado: nome do arquivo, autor, URL de origem, licença, data do
  download. Sem esse registro, nenhuma fonte deve ser adicionada.

## 7. Riscos e pontos ainda não confirmados

1. **Risco residual do Freesound**: os arquivos são enviados por usuários; o próprio FAQ
   admite que pode existir conteúdo indevido. Mitigação: só CC0, de contas antigas/bem
   avaliadas, com registro de URL. Revisão jurídica final é decisão do responsável.
2. **CC-BY vs só CC0**: recomendo CC0 por padrão; decidir se a página de créditos (e
   eventual CC-BY de música no incompetech) entra no escopo é **pendência do responsável**.
3. **incompetech — Licença Standard (sem crédito)**: o preço não foi verificado na página
   (gerado por script); precisa ser confirmado antes de qualquer decisão por essa via.
4. **Epidemic Sound**: preços e cobertura de licença para aplicativo não foram confirmados
   na fonte; descartada por enquanto.
5. **Vercel Hobby é "personal, non-commercial"**: se o projeto monetizar (anúncios,
   assinatura), mudar para Pro (US$ 20/mês) — decisão do responsável quando chegar a hora.
6. **Formato de áudio**: recomendação técnica é MP3 mono ~96 kbps (compatibilidade universal
   com iOS/Android). Conversão WAV→MP3 exige ferramenta externa (ex.: `ffmpeg`) fora do
   CI — definir no fluxo da issue de implementação.
7. **Autoplay**: navegadores exigem gesto do usuário para iniciar áudio — o player deve
   refletir isso na UX (botão explícito "Começar a tocar").

## 8. Fontes oficiais consultadas

Todas as URLs abaixo foram acessadas durante a pesquisa (10/10/2026) e o conteúdo de cada
termo foi lido na fonte oficial. Na verificação automatizada de links do PR, 14 de 16
responderam HTTP 200; Pixabay e Artlist retornam 403 para requisições automatizadas
(proteção anti-bot), mas as páginas foram integralmente consultadas na pesquisa — o texto
dos termos citados vem dessas leituras.

- Kenney — suporte/licença: <https://kenney.nl/support>
- Freesound — FAQ (licenças por arquivo, CC0/CC-BY/CC-BY-NC, formato de crédito):
  <https://freesound.org/help/faq/>
- Freesound — Termos de uso (sons distribuídos sob a licença CC escolhida pelo autor):
  <https://freesound.org/help/tos_web/>
- Freesound — Termos da API (API gratuita só para fins não-comerciais):
  <https://freesound.org/docs/api/terms_of_use.html>
- Pixabay — Termos de serviço (versão de 18/11/2024; cláusula "Standalone", §5):
  <https://pixabay.com/service/terms/>
- incompetech — licenças (CC-BY grátis com crédito; Licença Standard paga):
  <https://incompetech.com/music/royalty-free/licenses/>
- Bensound — termos (Free License restrita; Professional cobre "application, software"):
  <https://www.bensound.com/terms-and-conditions>
- Bensound — preços (a partir de €34 por faixa, pay-per-track):
  <https://www.bensound.com/pricing>
- Artlist — licença (apps/software exigem Enterprise; "standalone" proibido):
  <https://artlist.io/help-center/privacy-terms/artlist-license/>
- Epidemic Sound — planos: <https://www.epidemicsound.com/pricing/>
- YouTube — Audio Library (uso em vídeos; sem orientação fora da plataforma):
  <https://support.google.com/youtube/answer/3376882>
- Vercel — preços (Hobby: 100 GB/mês, personal/non-commercial):
  <https://vercel.com/pricing>
- Cloudflare R2 — preços (free tier 10 GB, egress grátis):
  <https://developers.cloudflare.com/r2/pricing/>
- MDN — Web Audio API (geração de áudio no navegador, sem arquivos):
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API>
- Creative Commons — visão geral das licenças (CC BY permite comercial com crédito):
  <https://creativecommons.org/cc-licenses/>
- Creative Commons — CC0 (dedicação ao domínio público):
  <https://creativecommons.org/publicdomain/zero/1.0/>
