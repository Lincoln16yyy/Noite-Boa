// Monta uma grade com os prints dos estados (vazio, carregando, erro) nas
// quatro telas e nos dois temas, em docs/design/prints/214-estados/.
// Uso: node estados.mjs
// Antes: rode o screenshots.mjs com ESTADO=vazio|carregando|erro e
// THEME=light|dark, e sem ESTADO para o print normal de referência.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const TELAS = ['hoje', 'historico', 'dashboard', 'amigos'];
const ESTADOS = ['vazio', 'carregando', 'erro'];
const TEMAS = ['light', 'dark'];
const OUT = new URL('./out/', import.meta.url).pathname;
const DESTINO = new URL('../../docs/design/prints/214-estados/', import.meta.url).pathname;

fs.mkdirSync(DESTINO, { recursive: true });

const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const existe = (f) => fs.existsSync(f);

async function lancar() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

const browser = await lancar();
let faltando = 0;

for (const estado of ESTADOS) {
  for (const tema of TEMAS) {
    const colunas = TELAS.map((tela) => {
      const arquivo = `${OUT}mobile-${tela}-${estado}-${tema}.png`;
      if (!existe(arquivo)) {
        faltando += 1;
        console.log('falta  ', arquivo);
        return '';
      }
      return `<div><div class="rotulo">${tela} · ${estado} · ${tema}</div><img src="${b64(arquivo)}"></div>`;
    }).join('');

    if (!colunas) continue;

    const html = `<body style="margin:0;background:#15142E;font:700 15px system-ui;color:#FFE9B5;display:flex;gap:16px;padding:20px">
      <style>img{width:280px;display:block;border-radius:12px}.rotulo{margin-bottom:8px;text-transform:capitalize}</style>
      ${colunas}
    </body>`;

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 1 });
    await page.setContent(html);
    const saida = `${DESTINO}estados-${estado}-${tema}.png`;
    await page.screenshot({ path: saida, fullPage: true });
    await page.close();
    console.log('ok    ', saida);
  }
}

await browser.close();
if (faltando) console.log(`\n${faltando} print(s) faltando — rode o screenshots.mjs antes.`);
process.exit(faltando ? 1 : 0);
