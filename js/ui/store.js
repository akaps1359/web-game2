// 브라우저 저장소: 사생활 보호 모드·샌드박스 등에서 localStorage 접근이 막혀도 게임은 계속된다
export function getItem(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function setItem(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
export function removeItem(k) { try { localStorage.removeItem(k); } catch { /* 무시 */ } }
