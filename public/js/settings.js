// 기기별 설정 (브라우저에만 저장)
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let autoAim = TOUCH; // 자동 조준: 휴대폰은 켜고, 마우스로 하는 PC는 끈다 (조준도 실력)
try { const v = localStorage.getItem('et-autoaim'); if (v != null) autoAim = v === '1'; } catch { /* 무시 */ }
export const getAutoAim = () => autoAim;
export function setAutoAim(v) {
  autoAim = !!v;
  try { localStorage.setItem('et-autoaim', autoAim ? '1' : '0'); } catch { /* 무시 */ }
}

// NPC 공격: 켜 두면 누구든 때릴 수 있다 (맞은 사람은 화가 나 싸운다) · 기본은 꺼짐 (마을에서 실수로 사람을 때리지 않게)
let npcAttack = false;
try { npcAttack = localStorage.getItem('et-npcattack') === '1'; } catch { /* 무시 */ }
export const getNpcAttack = () => npcAttack;
export function setNpcAttack(v) {
  npcAttack = !!v;
  try { localStorage.setItem('et-npcattack', npcAttack ? '1' : '0'); } catch { /* 무시 */ }
}
