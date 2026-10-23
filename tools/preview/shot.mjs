// 미리보기 페이지들을 아이폰 가로 화면 크기로 찍는다: node tools/preview/shot.mjs '[{"url":"tools/preview/scene.html","out":"x.png"}]'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const jobs = JSON.parse(process.argv[2]);
const browser = await chromium.launch();
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w || 874, height: j.h || 402 }, deviceScaleFactor: j.dpr || 2 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/${j.url}`);
  await page.waitForFunction(() => document.title === 'done', null, { timeout: 60000 }).catch(() => console.log('timeout', j.url));
  console.log('ms', Date.now() - t0);
  await page.screenshot({ path: j.out });
  console.log('shot', j.out);
  await page.close();
}
await browser.close();
server.close();
