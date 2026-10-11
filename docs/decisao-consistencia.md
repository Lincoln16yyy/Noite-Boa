# Decisão: "consistência" no ranking vira "Noites registradas"

**Status:** decidido em 11/10/2026 (issue #101).

## Contexto

A palavra "consistência" tinha dois significados no produto:

- **Dashboard** (`Dashboard.jsx`, cartão `Consistência (N dias)`): variação do horário
  de dormir no período (`±N min`, desvio padrão — **menor é melhor**). Este é o sentido
  canônico de `PLANO.md` §3 ("Foco em consistência de horário").
- **Ranking de amigos** (`Amigos.jsx`, `FriendshipService.ranking`): porcentagem de
  dias da janela com pelo menos um registro — **frequência de registro**, não
  regularidade de horários. O mesmo nome com sentido diferente confundia e incentivava
  "registrar por registrar".

## Opções avaliadas

| Opção | Prós | Contras |
|---|---|---|
| (a) Renomear só para "Constância" | Mudança pequena | "Constância" × "Consistência" seguem parecidos demais; não resolve a confusão de sentido |
| (b) Trocar o cálculo do ranking para a variação do horário | Mesmo significado nos dois lugares | Sai do desenho de privacidade da issue #39 (o ranking expõe só contagens/percentual, nunca horários nem comportamento); muda o escopo do compartilhamento e o sinal de frequência que a feature foi criada para mostrar |
| (c) Manter os dois, com nomes distintos | Preserva cálculo, privacidade e esforço | Requer renomear rótulos em alguns lugares |

## Decisão

**Opção (c) com renomeação: o ranking passa a se chamar "Noites registradas".**

- Seção do ranking: **"Ranking de noites registradas"**;
- Opção de compartilhar: **"Compartilhar minhas noites registradas com amigos"**;
- A linha do ranking mostra **`N noites · X% dos dias`** (mesmos dados de hoje —
  `nights` e `consistencyPercent` do JSON — só muda o rótulo);
- O **Dashboard mantém "Consistência"** com o sentido de variação do horário
  (`±N min`), o canônico do `PLANO.md`.

## Consequências

- **Sem mudança de API nem de cálculo**: os campos JSON continuam `nights` e
  `consistencyPercent`; muda só apresentação, javadocs e documentação.
- O texto do toggle de compartilhamento muda de palavra, mas **não muda o que é
  compartilhado** (continua só contagem/percentual — desenho da #39 intacto).
- `PLANO.md` (lista de features) passa a dizer "ranking de noites registradas".

## Implementação

Issue [#142](https://github.com/Lincoln16yyy/Sleep-Well/issues/142) — escopo exato
(`Amigos.jsx`, testes, javadocs do back-end e `PLANO.md`). Dashboard/estatísticas não
mudam.
