// 기기별 설정 (브라우저에만 저장)
let autoAim = true;
try { autoAim = localStorage.getItem('et-autoaim') !== '0'; } catch { /* 무시 */ }
export const getAutoAim = () => autoAim;
export function setAutoAim(v) {
  autoAim = !!v;
  try { localStorage.setItem('et-autoaim', autoAim ? '1' : '0'); } catch { /* 무시 */ }
}
