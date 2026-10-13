// Compara o mockup com o print do app, lado a lado.
// Uso: node compare.mjs hoje        (usa docs/design/mockups/hoje.png e out/mobile-hoje.png)
// Antes: gere o print com `ONLY=hoje node screenshots.mjs` (adicione a tela em mocks.mjs > telas).
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const nome = process.argv[2];
if (!nome) { console.error('Informe o nome da tela (ex.: hoje, dashboard, registrar, historico)'); process.exit(1); }
const mockup = new URL(`../../docs/design/mockups/${nome}.png`, import.meta.url).pathname;
const app = new URL(`./out/mobile-${nome}.png`, import.meta.url).pathname;
for (const f of [mockup, app]) if (!fs.existsSync(f)) { console.error('Arquivo não encontrado:', f); process.exit(1); }

const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const html = `<body style="margin:0;background:#222;font:600 20px sans-serif;color:#fff;display:flex;gap:24px;padding:24px">
<div><div style="margin-bottom:8px">MOCKUP</div><img src="${b64(mockup)}" style="width:390px;display:block"></div>
<div><div style="margin-bottom:8px">APP</div><img src="${b64(app)}" style="width:390px;display:block"></div></body>`;

async function lancar() {
  if (process.env.CHROME_PATH) return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}
const browser = await lancar();
const page = await browser.newPage();
await page.setViewport({ width: 860, height: 900, deviceScaleFactor: 1 });
await page.setContent(html);
const saida = new URL(`./out/compare-${nome}.png`, import.meta.url).pathname;
await page.screenshot({ path: saida, fullPage: true });
await browser.close();
console.log('Comparação em', saida);
