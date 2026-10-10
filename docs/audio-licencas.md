# Fontes e Licenças dos Arquivos de Áudio (Fase 2)

Este documento registra as fontes, autores, termos de licença, parâmetros técnicos de conversão e hashes SHA-256 dos arquivos de áudio incluídos em `frontend/public/audio/`, conforme definido em `docs/audio.md` e na issue #91.

Em conformidade estrita com os critérios de aceite da issue #91, **este registro foi documentado antes da inclusão de qualquer arquivo de áudio no repositório**.

---

## 1. Tabela de Arquivos e Licenças

Todos os arquivos utilizam exclusivamente a dedicação ao domínio público **Creative Commons Zero 1.0 Universal (CC0)**. Nenhuma música ou efeito sob licença comercial, proprietária ou com restrições como "no standalone", "video only" ou "YouTube only" foi utilizado.

| Arquivo no repositório | Obra original | Autor / Criador | URL da fonte original | Licença declarada | URL da licença |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public/audio/rain.mp3` | *Rain (loopable)* | Ylmir | [opengameart.org/content/rain-loopable](https://opengameart.org/content/rain-loopable) | Creative Commons Zero (CC0 1.0) | [creativecommons.org/publicdomain/zero/1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/waves.mp3` | *Sea and river wave sounds* | RandomMind | [opengameart.org/content/sea-and-river-wave-sounds](https://opengameart.org/content/sea-and-river-wave-sounds) | Creative Commons Zero (CC0 1.0) | [creativecommons.org/publicdomain/zero/1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `public/audio/wind.mp3` | *wind1 (1 a 5)* | Luke.RUSTLTD | [opengameart.org/content/wind1](https://opengameart.org/content/wind1) | Creative Commons Zero (CC0 1.0) | [creativecommons.org/publicdomain/zero/1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

> **Nota sobre autoria e créditos:** Pela licença CC0 1.0 Universal, atribuição formal não é uma exigência legal. No entanto, por transparência técnica e respeito ao trabalho comunitário dos criadores, todos os autores e links originais constam documentados nesta tabela.

---

## 2. Especificações Técnicas e Metas de Desempenho

| Parâmetro | Meta / Restrição da issue #91 | Realizado | Status |
| :--- | :--- | :--- | :--- |
| **Formato e codec** | MP3 mono, CBR ~96 kbps, 44.1 kHz | MP3 mono, libmp3lame, 96 kbps, 44.1 kHz | Conforme |
| **Normalização de volume** | EBU R128 consistente entre sons | Filtro `loudnorm=I=-20:TP=-2:LRA=11` | Conforme |
| **Transição de loop** | Sem cliques ou saltos na emenda | Crossfade suave de início e fim (`acrossfade`) | Conforme |
| **Tamanho máximo por arquivo** | ≤ 5,0 MB | Máximo: 3,40 MB (`waves.mp3`) | Conforme (≤ 68% do limite) |
| **Tamanho total do catálogo** | ≤ 30,0 MB no lançamento | 9,62 MB (3 arquivos) | Conforme (32% da cota) |
| **Precache do Service Worker** | **Nenhum** áudio no precache | Excluído do shell/precache e do cache de assets | Conforme |
| **Carregamento** | Sob demanda com `preload="none"` | Elemento `<audio preload="none">` | Conforme |

---

## 3. Detalhamento dos Arquivos

### 3.1. Chuva (`public/audio/rain.mp3`)
- **Duração:** 4 min 14 s (254,0 s)
- **Tamanho:** 3.048.847 bytes (~2,91 MB)
- **Taxa de bits:** 96 kbps mono (44.100 Hz)
- **Hash SHA-256:** `045f0d4a667361013f7a6b138cd53c238dc1832d1ea53a1806851ffe94a4a6eb`
- **Origem:** Gravação real de chuva contínua (arquivos originais do autor concatenados e cruzados para loop contínuo).

### 3.2. Ondas (`public/audio/waves.mp3`)
- **Duração:** 4 min 57 s (297,0 s)
- **Tamanho:** 3.568.019 bytes (~3,40 MB)
- **Taxa de bits:** 96 kbps mono (44.100 Hz)
- **Hash SHA-256:** `26a8557d100b78b4909330c4b7d5dc07b3ff043f9c7b727f1b9e1359b135ec16`
- **Origem:** Gravação de áudio real de ondas naturais gravadas pelo autor no rio Vístula, com transição suave entre o início e o fim.

### 3.3. Vento (`public/audio/wind.mp3`)
- **Duração:** 4 min 49 s (289,0 s)
- **Tamanho:** 3.468.896 bytes (~3,31 MB)
- **Taxa de bits:** 96 kbps mono (44.100 Hz)
- **Hash SHA-256:** `9a56f8a731d1ed9232d448427202691eebb6c9e276ed63f38567ccf5822bee98`
- **Origem:** Vento sintetizado contínuo (PureData) pelo autor, interpolado com crossfade suave entre as 5 variações para ambiência rica sem repetição óbvia.

---

## 4. Pipeline Reproduzível de Conversão (FFmpeg)

Todos os arquivos foram gerados de forma reproduzível a partir das fontes brutas com os seguintes comandos FFmpeg:

```bash
# 1. Ondas (corte de ponta com crossfade de 3s e normalização EBU R128)
ffmpeg -y -i waves_vistula.mp3 \
  -filter_complex "[0:a]asplit=2[w1][w2];[w1]atrim=start=3[wbody];[w2]atrim=end=3[whead];[wbody][whead]acrossfade=d=3[wfade];[wfade]loudnorm=I=-20:TP=-2:LRA=11[wout]" \
  -map "[wout]" -ac 1 -ar 44100 -b:a 96k waves.mp3

# 2. Vento (interpolação das 5 faixas com crossfade de 2s, emenda de pontas e normalização)
ffmpeg -y -i wind1.wav -i wind2.wav -i wind3.wav -i wind4.wav -i wind5.wav \
  -filter_complex "[0:a][1:a]acrossfade=d=2[w01];[w01][2:a]acrossfade=d=2[w02];[w02][3:a]acrossfade=d=2[w03];[w03][4:a]acrossfade=d=2[wfull];[wfull]asplit=2[wa][wb];[wa]atrim=start=3[wbody];[wb]atrim=end=3[whead];[wbody][whead]acrossfade=d=3[wloop];[wloop]loudnorm=I=-20:TP=-2:LRA=11[wout]" \
  -map "[wout]" -ac 1 -ar 44100 -b:a 96k wind.mp3

# 3. Chuva (interpolação e duplicação com crossfades para 4+ minutos e normalização)
ffmpeg -y -i rain/1.mp3 -i rain/2.mp3 -i rain/3.mp3 -i rain/4.mp3 -i rain/1.mp3 -i rain/2.mp3 -i rain/3.mp3 -i rain/4.mp3 \
  -filter_complex "[0:a][1:a]acrossfade=d=2[r01];[r01][2:a]acrossfade=d=2[r02];[r02][3:a]acrossfade=d=2[r03];[r03][4:a]acrossfade=d=2[r04];[r04][5:a]acrossfade=d=2[r05];[r05][6:a]acrossfade=d=2[r06];[r06][7:a]acrossfade=d=2[rfull];[rfull]asplit=2[ra][rb];[ra]atrim=start=3[rbody];[rb]atrim=end=3[rhead];[rbody][rhead]acrossfade=d=3[rloop];[rloop]loudnorm=I=-20:TP=-2:LRA=11[rout]" \
  -map "[rout]" -ac 1 -ar 44100 -b:a 96k rain.mp3
```
