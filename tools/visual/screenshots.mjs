// Tira prints de todas as telas (celular e desktop) com a API simulada.
// Uso: node screenshots.mjs   (veja .claude/skills/verificar-visual/SKILL.md)
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { mocks, telas } from './mocks.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const API_PORT = process.env.API_PORT || '8080'; // porta que o front chama (VITE_API_URL)
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = new URL('./out/', import.meta.url).pathname;

async function lancarNavegador() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

const viewports = [
  ['mobile', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }],
  ['desktop', { width: 1280, height: 800, deviceScaleFactor: 1 }],
];

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

fs.mkdirSync(OUT, { recursive: true });
const browser = await lancarNavegador();
let falhas = 0;

for (const [vpNome, vp] of viewports) {
  for (const [nome, caminho, precisaLogin] of telas) {
    if (ONLY.length && !ONLY.includes(nome)) continue;
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.hostname === 'localhost' && u.port === API_PORT) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
        const corpo = mocks[u.pathname.replace(/^\/api/, '')];
        if (corpo !== undefined) {
          return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(corpo) });
        }
        return req.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"detail":"mock não definido"}' });
      }
      return req.continue();
    });
    if (precisaLogin) await page.evaluateOnNewDocument(() => localStorage.setItem('token', 'fake.jwt.token'));
    try {
      await page.goto(BASE + caminho, { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: `${OUT}${vpNome}-${nome}.png`, fullPage: true });
      console.log('ok  ', vpNome, nome);
    } catch (e) {
      falhas += 1;
      console.log('FALHA', vpNome, nome, e.message);
    }
    await page.close();
  }
}
await browser.close();
console.log(`\nPrints em ${OUT}${falhas ? `  (${falhas} falha(s))` : ''}`);
process.exit(falhas ? 1 : 0);
