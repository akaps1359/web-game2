// 헤드리스 시뮬레이션: node tools/simulate.mjs [일수] [플레이어태그]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MapData } from '../js/engine/mapdata.js';
import { createGame, tick, serialize, deserialize } from '../js/engine/game.js';
import { fmtDate } from '../js/engine/world.js';
import { divsOf } from '../js/engine/military.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'data', 'map.json'), 'utf8'));
const map = new MapData(json);
const days = +(process.argv[2] || 60);
const player = process.argv[3] || 'NONE';
const t0 = Date.now();
const G = createGame(map, { player, seed: +(process.env.SEED || 12345) });
console.log('created in', Date.now() - t0, 'ms; divisions', Object.keys(G.divs).length);
G.onNews = (n) => { if (n.big || process.env.ALLNEWS) console.log(`  [${fmtDate(n.h)}] ${n.text}`); };

const summary = (tags) => {
  for (const t of tags) {
    const C = G.countries[t];
    if (!C) continue;
    const divs = divsOf(G, t);
    const states = G.st.filter((s) => s.ctrl === t).length;
    const avgStr = divs.length ? divs.reduce((s, d) => s + d.str, 0) / divs.length : 0;
    console.log(`${t.padEnd(4)} ${C.alive ? '' : '(dead)'} st:${String(states).padStart(3)} div:${String(divs.length).padStart(3)} str:${avgStr.toFixed(2)} civ:${C.eco.civ?.toFixed(0)} mil:${C.eco.mil?.toFixed(0)} free:${C.eco.civFree?.toFixed(1)} pp:${C.pp.toFixed(0)} stab:${C.stability.toFixed(2)} ws:${C.warSupport.toFixed(2)} mp:${Math.round(C.mp.total - C.mp.inDivs - C.mp.training)} fuel:${Math.round(C.fuel)} inf:${Math.round(C.stock.inf_eq || 0)} focus:${C.focus.cur || '-'} res:[${C.research.cur.map((r) => r?.id || '-').join(',')}] train:${C.training.length} surr:${(C.surrender || 0).toFixed(2)}`);
  }
};

const t1 = Date.now();
import { declareWar } from '../js/engine/diplomacy.js';
for (let d = 0; d < days; d++) {
  if (d === +(process.env.WARDAY || 2) && process.env.WAR) for (const pair of process.env.WAR.split(',')) { const [a, b] = pair.split(':'); declareWar(G, a, b, { forced: true }); }
  for (let h = 0; h < 24; h++) tick(G);
  if ((d + 1) % (+process.env.EVERY || 30) === 0) {
    console.log(`== ${fmtDate(G.hour)} tension ${(G.tension * 100).toFixed(0)}% wars ${G.wars.map((w) => w.name).join(' | ')} battles ${Object.keys(G.battles).length}`);
    summary((process.env.TAGS || 'GER,ENG,FRA,ITA,SOV,POL,ETH,USA').split(','));
  }
}
const dt = Date.now() - t1;
console.log(`simulated ${days} days in ${dt} ms (${(dt / days).toFixed(1)} ms/day)`);
const s = serialize(G);
console.log('save size', (s.length / 1024).toFixed(0), 'KB');
const G2 = deserialize(s, map);
console.log('reload ok, divs', Object.keys(G2.divs).length);
