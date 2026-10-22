// 아이폰 세로 화면으로 게임을 띄우고 시나리오 스크립트를 실행한다.
// 사용: node tools/preview/play.mjs <시나리오.mjs> [출력 폴더]
// 시나리오: export default async function (page, { shot, wait, log }) { ... }
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
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
  const st = fs.statSync(f);
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-length': st.size });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const scenario = (await import(path.resolve(process.argv[2]))).default;
const outDir = path.resolve(process.argv[3] || '.');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const dev = devices['iPhone 13'];
const ctx = await browser.newContext({ ...dev, deviceScaleFactor: +(process.env.DPR || 2), ...(process.env.DEVW ? { viewport: { width: +process.env.DEVW, height: +(process.env.DEVH || 740) }, screen: { width: +process.env.DEVW, height: +(process.env.DEVH || 740) } } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(m.text()); console.log('[console]', m.type(), m.text()); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')); });
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.G && document.querySelector('#boot.hide'), null, { timeout: 60000 });
const helpers = {
  shot: async (name) => { const p = path.join(outDir, name + '.png'); await page.screenshot({ path: p }); console.log('shot', p); },
  wait: (ms) => page.waitForTimeout(ms),
  log: console.log,
  tap: async (x, y) => { await page.touchscreen.tap(x, y); },
};
try { await scenario(page, helpers); } catch (e) { console.log('[scenario error]', e.message); }
console.log(`errors: ${errors.length}`);
await browser.close();
server.close();
