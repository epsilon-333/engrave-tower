// '#rrggbb' + 투명도 → 'rgba(…)' (투명도는 0~1로 자른다)
const HEXA = new Map(); // 렉 줄이기: 투명도를 1/64 단계로 묶어 같은 색 글자를 다시 쓴다 (그림판이 색 글자를 매번 새로 읽지 않게)
export function hexA(hex, a) {
  if (!hex) hex = '#ffffff';
  const q = Math.round(Math.max(0, Math.min(1, a)) * 64), key = hex + q;
  let v = HEXA.get(key);
  if (v === undefined) { const n = parseInt(hex.slice(1), 16); v = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${q / 64})`; if (HEXA.size > 6000) HEXA.clear(); HEXA.set(key, v); }
  return v;
}
