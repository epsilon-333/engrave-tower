// '#rrggbb' + 투명도 → 'rgba(…)' (투명도는 0~1로 자른다)
export function hexA(hex, a) {
  if (!hex) hex = '#ffffff';
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
