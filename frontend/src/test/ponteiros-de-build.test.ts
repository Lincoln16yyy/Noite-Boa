import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guarda contra ponteiros órfãos deixados pela migração JS→TS (issue #264).
 *
 * Depois que `src/main.jsx` virou `src/main.tsx` e `src/setupTests.js` virou
 * `src/setupTests.ts` (issue #170, PR #197), o `index.html` e o `setupFiles` do
 * `vite.config.ts` continuaram apontando para os nomes antigos. O Vite resolve
 * `.jsx` → `.tsx` e `.js` → `.ts` por conta própria, então a falha não aparecia:
 * o build e a suíte seguiam verdes. Isso mascara o erro e pode quebrar numa
 * futura troca de bundler/versão, então aqui os ponteiros são checados de fato.
 *
 * O diretório de trabalho dos testes é `frontend/` (raiz do projeto Vite).
 */
const raiz = process.cwd();

function arquivoReferenciadoExiste(caminho: string): boolean {
  return existsSync(resolve(raiz, caminho.replace(/^\.?\//, '')));
}

test('o entry do index.html aponta para um arquivo que existe', () => {
  const html = readFileSync(resolve(raiz, 'index.html'), 'utf8');
  const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];

  expect(src).toBeDefined();
  expect(arquivoReferenciadoExiste(src!)).toBe(true);
});

test('o setupFiles do vite.config.ts aponta para um arquivo que existe', () => {
  const config = readFileSync(resolve(raiz, 'vite.config.ts'), 'utf8');
  const setupFiles = config.match(/setupFiles:\s*'([^']+)'/)?.[1];

  expect(setupFiles).toBeDefined();
  expect(arquivoReferenciadoExiste(setupFiles!)).toBe(true);
});
