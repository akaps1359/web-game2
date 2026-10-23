// 신문 제호 글꼴 내려받기: 구글 폰트(모두 SIL Open Font License)에서 제호에 쓰인 글자만 담은 woff2를 받아 fonts/에 둔다
// 사용: node tools/build-fonts.mjs   (js/data/papers.js의 제호를 바꾸면 다시 실행)
import fs from 'fs';
import path from 'path';
import url from 'url';
import { PAPERS, MAST_FONTS } from '../js/data/papers.js';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
fs.mkdirSync(path.join(root, 'fonts'), { recursive: true });
for (const [style, [family, weight]] of Object.entries(MAST_FONTS)) {
  // 대문자로 보여 주는 양식(CSS text-transform)도 있으니 대문자도 함께 담는다
  const names = Object.values(PAPERS).filter((p) => p[1] === style).map((p) => p[0]);
  const chars = [...new Set(names.join('') + names.join('').toUpperCase() + ' ')].join('');
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(chars)}`, { headers: { 'user-agent': UA } })).text();
  const src = /src:\s*url\(([^)]+)\)/.exec(css)?.[1];
  if (!src) { console.error(style, family, '실패', css.slice(0, 200)); process.exitCode = 1; continue; }
  const buf = Buffer.from(await (await fetch(src, { headers: { 'user-agent': UA } })).arrayBuffer());
  fs.writeFileSync(path.join(root, 'fonts', `${style}.woff2`), buf);
  console.log(`${style.padEnd(9)} ${family.padEnd(20)} ${String(buf.length).padStart(6)}B  ${chars}`);
}
