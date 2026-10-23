// 저장: 캐릭터마다 따로, 보관함은 모든 캐릭터가 함께 쓴다
import { getItem, setItem, removeItem } from './store.js';

const KEY = 'hollow.v1';

export function listChars() {
  try { return JSON.parse(getItem(KEY + '.chars') || '[]'); } catch { return []; }
}
export function loadChar(id) {
  try { return JSON.parse(getItem(`${KEY}.char.${id}`) || 'null'); } catch { return null; }
}
export function saveChar(data) {
  const ok = setItem(`${KEY}.char.${data.id}`, JSON.stringify(data, (k, v) => (k === '_m' || k === '_durDone' ? undefined : v)));
  const list = listChars().filter((c) => c.id !== data.id);
  list.unshift({ id: data.id, name: data.name, cls: data.cls, lvl: data.lvl, hc: data.hc, dead: !!data.deadHC, depth: data.maxDepth || 0, t: Date.now(), done: !!data.quests?.velgath?.st && data.quests.velgath.st === 'done' });
  setItem(KEY + '.chars', JSON.stringify(list));
  return ok;
}
export function deleteChar(id) {
  removeItem(`${KEY}.char.${id}`);
  setItem(KEY + '.chars', JSON.stringify(listChars().filter((c) => c.id !== id)));
}
export function loadStash() {
  try { return JSON.parse(getItem(KEY + '.stash') || '{"items":[],"gold":0}'); } catch { return { items: [], gold: 0 }; }
}
export function saveStash(s) { setItem(KEY + '.stash', JSON.stringify(s, (k, v) => (k === '_m' ? undefined : v))); }
export function loadSettings() {
  try { return { master: 0.9, sfx: 0.9, music: 0.6, silentMode: true, labels: true, bars: true, dmg: false, autoGold: true, hiq: false, ...JSON.parse(getItem(KEY + '.settings') || '{}') }; } catch { return { master: 0.9, sfx: 0.9, music: 0.6, silentMode: true, labels: true, bars: true, dmg: false, autoGold: true, hiq: false }; }
}
export function saveSettings(s) { setItem(KEY + '.settings', JSON.stringify(s)); }
