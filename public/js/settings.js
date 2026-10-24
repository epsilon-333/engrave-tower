// 기기별 설정 (브라우저에만 저장)
let autoAim = true;
try { autoAim = localStorage.getItem('et-autoaim') !== '0'; } catch { /* 무시 */ }
export const getAutoAim = () => autoAim;
export function setAutoAim(v) {
  autoAim = !!v;
  try { localStorage.setItem('et-autoaim', autoAim ? '1' : '0'); } catch { /* 무시 */ }
}

// NPC 공격: 켜 두면 누구든 때릴 수 있다 (맞은 사람은 화가 나 싸운다) · 기본은 켜짐
let npcAttack = true;
try { npcAttack = localStorage.getItem('et-npcattack') !== '0'; } catch { /* 무시 */ }
export const getNpcAttack = () => npcAttack;
export function setNpcAttack(v) {
  npcAttack = !!v;
  try { localStorage.setItem('et-npcattack', npcAttack ? '1' : '0'); } catch { /* 무시 */ }
}
