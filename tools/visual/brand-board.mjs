// Gera docs/brand-board.png — a marca e as telas reais do app (issue #218).
//
// O quadro tem duas partes: a identidade (marca, paleta e tipografia, as
// mesmas regras de docs/identidade-visual.md) e as telas — prints reais de
// Hoje, Dashboard, Registrar e Histórico, capturados aqui com a API simulada,
// 390 px e tema escuro.
//
// Pré-requisito (o mesmo dos prints): o front buildado em preview.
//   cd frontend && npm ci && npm run build && npx vite preview --port 4173 &
//   cd tools/visual && npm ci && node brand-board.mjs
//
// A Nunito é embutida em base64 na primeira execução (cache em out/nunito-embed.css);
// sem rede e sem cache, o quadro sai com a fonte do sistema e o script avisa.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const MARCA = path.resolve(AQUI, '../../docs/assets/brand');
const OUT = path.join(AQUI, 'out');
const DESTINO = path.resolve(AQUI, '../../docs/brand-board.png');
const BASE = process.env.BASE_URL || 'http://localhost:4173';

/** [nome da tela em tools/visual/mocks.mjs, rótulo no quadro] */
const TELAS = [
  ['hoje', 'Hoje'],
  ['dashboard', 'Dashboard'],
  ['registrar-preenchido', 'Registrar'],
  ['historico', 'Histórico'],
];

/** [nome, hex, texto claro por cima?] */
const PALETA = [
  ['Noite', '#15142E', true],
  ['Índigo', '#3F3CBB', true],
  ['Lavanda', '#B9B6FF', false],
  ['Luar', '#FFE9B5', false],
  ['Âmbar', '#FFB347', false],
  ['Névoa', '#F5F3FF', false],
  ['Sucesso', '#2FBF9B', true],
  ['Erro', '#E5484D', true],
];

const ICONE = [
  [80, '80 px'],
  [56, '56 px'],
  [40, '40 px'],
  [24, '24 px'],
];

// ---------- 1. prints reais ----------
console.log('1/3 Prints reais (390 px, tema escuro)…');
const prints = spawnSync(process.execPath, [path.join(AQUI, 'screenshots.mjs')], {
  env: {
    ...process.env,
    ONLY: TELAS.map(([nome]) => nome).join(','),
    THEME: 'dark',
    MODO: 'tela', // barra inferior fixa no pé da imagem, não no meio
  },
  stdio: 'inherit',
});
if (prints.status !== 0) {
  console.error(`\nFalha ao gerar os prints. O preview está no ar em ${BASE}?`);
  process.exit(1);
}

// ---------- 2. fonte ----------
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CACHE_FONTE = path.join(OUT, 'nunito-embed.css');

async function fonteNunito() {
  if (fs.existsSync(CACHE_FONTE)) return fs.readFileSync(CACHE_FONTE, 'utf8');
  try {
    const url = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';
    const css = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
    // Só os subconjuntos latinos: a interface do app é pt-BR.
    const blocos = css.split('/*').filter((b) => /^ (latin|latin-ext) \*\//.test(b));
    const embutidos = await Promise.all(
      blocos.map(async (b) => {
        const alvo = b.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
        if (!alvo) return null;
        const buf = Buffer.from(await (await fetch(alvo[1])).arrayBuffer());
        return `/*${b.replace(alvo[0], `url(data:font/woff2;base64,${buf.toString('base64')})`)}`;
      }),
    );
    const pronto = embutidos.filter(Boolean).join('\n');
    if (!pronto) throw new Error('nenhum bloco latino no CSS');
    fs.writeFileSync(CACHE_FONTE, pronto);
    console.log('  Nunito embutida (cache em out/nunito-embed.css)');
    return pronto;
  } catch (e) {
    console.warn(`  aviso: não embuti a Nunito (${e.message}); a fonte vem do Google Fonts online.`);
    return `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`;
  }
}

// ---------- 3. montagem ----------
const arq = (nome) => pathToFileURL(path.join(MARCA, nome)).href;
const print = (nome) => pathToFileURL(path.join(OUT, `mobile-${nome}-dark.png`)).href;

const amostras = PALETA.map(([nome, hex, claro]) => {
  const cor = claro ? '#FFE9B5' : '#15142E';
  const borda = hex === '#F5F3FF' ? ' bordero' : '';
  return `        <div class="amostra${borda}" style="background:${hex};color:${cor}">
          <b>${nome}</b><span>${hex}</span>
        </div>`;
}).join('\n');

const icones = ICONE.map(
  ([px, legenda]) => `        <figure>
          <img src="${arq('icon-512.png')}" alt="" width="${px}" height="${px}">
          <figcaption>${legenda}</figcaption>
        </figure>`,
).join('\n');

const telas = TELAS.map(
  ([nome, rotulo]) => `        <figure class="tela">
          <figcaption>${rotulo}</figcaption>
          <img src="${print(nome)}" alt="Tela ${rotulo} do app, tema escuro">
        </figure>`,
).join('\n');

const fonte = await fonteNunito();

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Quadro da marca — Noite Boa</title>
<style>
${fonte}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1600px;
  font-family: 'Nunito', system-ui, sans-serif;
  background: #F5F3FF;
  color: #15142E;
  -webkit-font-smoothing: antialiased;
}
.rotulo {
  font-size: 15px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; color: #3F3CBB; margin-bottom: 22px;
}

/* ---------- Identidade ---------- */
.identidade { padding: 46px 56px 44px; }
.marca-linha { display: flex; gap: 28px; }
.marca {
  flex: 0 0 340px; width: 340px; height: 340px; border-radius: 76px;
  background: linear-gradient(135deg, #2D2A78 0%, #15142E 100%);
  display: flex; align-items: center; justify-content: center;
}
.marca img { width: 206px; height: 206px; display: block; }
.coluna { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.logos { display: flex; gap: 18px; }
.logo-card {
  flex: 1; height: 150px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
}
.logo-card.claro { background: #fff; border: 1px solid rgba(63,60,187,.18); }
.logo-card.escuro { background: #15142E; }
.logo-card img { height: 56px; display: block; }
.slogan { font-size: 38px; font-weight: 800; letter-spacing: -.5px; }
.sub { font-size: 17px; font-weight: 600; color: #55537A; }
.icones { display: flex; align-items: flex-end; gap: 20px; margin-top: 2px; }
.icones figure { text-align: center; }
.icones img { display: block; margin: 0 auto 5px; }
.icones figcaption { font-size: 12px; font-weight: 700; color: #55537A; }
.nota-icone { font-size: 15px; font-weight: 800; color: #3F3CBB; align-self: center; }

/* ---------- Paleta ---------- */
.paleta { margin-top: 34px; }
.amostras { display: flex; gap: 16px; }
.amostra {
  flex: 1; height: 166px; border-radius: 18px; padding: 16px 18px;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.amostra.bordero { border: 1px solid rgba(63,60,187,.28); }
.amostra b { font-size: 19px; font-weight: 800; }
.amostra span { font-size: 14px; font-weight: 700; opacity: .92; }

/* ---------- Tipografia e conceito ---------- */
.dual { margin-top: 34px; display: flex; gap: 32px; align-items: stretch; }
.tipografia {
  flex: 0 0 640px; background: #fff; border: 1px solid rgba(63,60,187,.14);
  border-radius: 24px; padding: 30px 36px; display: flex; gap: 30px; align-items: center;
}
.aa { font-size: 116px; font-weight: 800; line-height: .92; }
.tipo b.titulo { font-size: 28px; font-weight: 800; }
.tipo .ofl { font-size: 15px; font-weight: 600; color: #55537A; margin: 4px 0 14px; }
.tipo p { font-size: 18px; font-weight: 600; }
.tipo p.peso8 { font-weight: 800; }
.tipo p.peso4 { font-weight: 400; color: #3B3960; }
.tipo .credo { font-size: 19px; font-weight: 800; color: #3F3CBB; margin-top: 14px; }
.conceito {
  flex: 1; background: #fff; border: 1px solid rgba(63,60,187,.14);
  border-radius: 24px; padding: 30px 36px;
}
.conceito h3 { font-size: 26px; font-weight: 800; margin-bottom: 16px; }
.conceito p { font-size: 18px; font-weight: 600; line-height: 1.5; }
.conceito p + p { margin-top: 12px; }
.conceito b { color: #3F3CBB; font-weight: 800; }
.conceito .fala { color: #3F3CBB; font-weight: 800; }

/* ---------- Telas ---------- */
.telas { background: #15142E; padding: 40px 56px 52px; }
.telas .rotulo { color: #B9B6FF; }
.grade { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; }
.tela { width: 340px; }
.tela figcaption {
  font-size: 15px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: #FFE9B5; margin-bottom: 12px;
}
.tela img {
  width: 340px; display: block; border-radius: 18px;
  border: 1px solid rgba(185,182,255,.22);
}
.rodape {
  margin-top: 30px; display: flex; justify-content: space-between; gap: 24px;
  font-size: 14px; font-weight: 600; color: #8B88C9;
}
</style>
</head>
<body>
  <section class="identidade">
    <p class="rotulo">Identidade visual</p>
    <div class="marca-linha">
      <div class="marca"><img src="${arq('mark-dark.svg')}" alt="Marca do Noite Boa: lua em berço com estrela"></div>
      <div class="coluna">
        <div class="logos">
          <div class="logo-card claro"><img src="${arq('logo-horizontal-light.svg')}" alt="Noite Boa (versão para fundo claro)"></div>
          <div class="logo-card escuro"><img src="${arq('logo-horizontal-dark.svg')}" alt="Noite Boa (versão para fundo escuro)"></div>
        </div>
        <p class="slogan">Durma melhor, no seu ritmo.</p>
        <p class="sub">Registre suas noites, entenda seu padrão e crie constância.</p>
        <div class="icones">
${icones}
          <p class="nota-icone">Ícone do app e favicon</p>
        </div>
      </div>
    </div>

    <div class="paleta">
      <p class="rotulo">Paleta</p>
      <div class="amostras">
${amostras}
      </div>
    </div>

    <div class="dual">
      <div class="tipografia">
        <div class="aa">Aa</div>
        <div class="tipo">
          <b class="titulo">Nunito</b>
          <p class="ofl">Google Fonts · licença OFL</p>
          <p class="peso8">ExtraBold 800 · títulos</p>
          <p>SemiBold 600 · rótulos e botões</p>
          <p class="peso4">Regular 400 · texto corrido</p>
          <p class="credo">Dormir bem é um hábito, não um acaso.</p>
        </div>
      </div>
      <div class="conceito">
        <h3>Conceito e tom de voz</h3>
        <p><b>Personalidade:</b> calma, acolhedora, confiável e simples.</p>
        <p><b>Tom de voz:</b> próximo e gentil, sem culpa — o app pergunta, não recrimina.</p>
        <p class="fala">“Que tal dormir um pouco mais cedo hoje?”</p>
      </div>
    </div>
  </section>

  <section class="telas">
    <p class="rotulo">As telas do app</p>
    <div class="grade">
${telas}
    </div>
    <div class="rodape">
      <span>Prints reais · 390 px · tema escuro · gerados por tools/visual/brand-board.mjs</span>
      <span>Alvo: docs/design/mockups/ · regras: docs/design/direcao-visual.md</span>
    </div>
  </section>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
const arquivo = path.join(OUT, 'brand-board.html');
fs.writeFileSync(arquivo, html);

async function lancarNavegador() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
}

const browser = await lancarNavegador();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }),
    ),
  );
});
await page.screenshot({ path: DESTINO, fullPage: true });
await browser.close();

// Dimensões lidas do cabeçalho IHDR do PNG (evita dependência extra).
const png = fs.readFileSync(DESTINO);
const largura = png.readUInt32BE(16);
const altura = png.readUInt32BE(20);
console.log(`\n2/3 Quadro salvo em ${DESTINO} (${largura}×${altura} px)`);
console.log('3/3 Abra a imagem e confira: 4 telas nítidas, barra inferior no pé de cada uma.');
