// 탑 밖 던전 (2026-11-23): 입구에서 보여 주는 안내 · 정복 기록 (data/dungeons.js)
import { esc } from '../text.js';
import { DUNGEONS } from '../data/dungeons.js';
import { MONSTERS, ECHOES } from '../data/monsters.js';
import { ENGRAVINGS } from '../data/engravings.js';
import { ENTRANCES } from '../data/maps/overworld.js';

const SLOT = { head: '머리', arm: '팔', heart: '심장', back: '등', leg: '다리' };
// 우두머리 → 그곳에서만 나는 부산물 · 그것으로 새기는 각인
export function dungeonLoot(id) {
  const D = DUNGEONS[id]; if (!D) return null;
  const boss = MONSTERS[D.boss], part = boss?.part, eng = ENGRAVINGS['m_' + D.boss];
  return { D, boss, part, partName: ECHOES[part]?.name || '', eng, need: eng?.recipe?.[part] || 0 };
}
// 던전 안 World에 넘기는 것: 몬스터 레벨 · 권장 레벨
export function dungeonZone(id) {
  const D = DUNGEONS[id]; if (!D) return {};
  return { dungeonLv: D.lv, rec: D.lv, dungeon: id };
}
const dgOf = (save, id) => ((save.dungeons ||= {})[id] ||= { clears: 0 });

// 입구 안내: 권장 레벨 · 우두머리 · 그곳에서만 나는 부산물 → 각인 · 정복 기록
export function dungeonCardHtml(id, save, opts = {}) {
  const L = dungeonLoot(id), en = ENTRANCES[id];
  if (!L) return `<h2>${esc(en?.name || id)}</h2>`;
  const { D, boss, partName, eng, need, part } = L, rec = dgOf(save, id), have = save.echoes?.[part] || 0;
  const low = save.level < D.lv - 2;
  return `<h2>${esc(en.name)}</h2><p>${esc(D.blurb)}</p>
    <div class="sq"><p>권장 Lv <b>${D.lv}</b> · 지금 Lv ${save.level}${low ? ' <span class="warn">(위험하다)</span>' : ''}</p>
    <p>가장 깊은 곳의 우두머리: <b>${esc(boss.name)}</b></p>
    <p>이곳에서만 나는 부산물: <b>${esc(partName)}</b> <small class="muted">(우두머리가 꼭 떨어뜨린다 · 다른 곳에서는 나지 않는다)</small></p>
    ${eng ? `<p>→ 공명 제단에서 각인 「<b>${esc(eng.name)}</b>」 <small class="muted">(${'★'.repeat(eng.grade)} · ${SLOT[eng.slot] || eng.slot} · 가진 부산물 ${have}개)</small></p>` : ''}
    <p class="muted">${rec.clears ? `정복 ${rec.clears}번` : `처음 정복하면 ◆ ${D.first}`} · 시작 지점의 포탈로 언제든 밖에 나갈 수 있다</p></div>
    <div class="actions"><button id="dgGo">${opts.go || '들어간다'}</button><button data-close class="ghost">돌아간다</button></div>`;
}

// 우두머리를 쓰러뜨렸다: 정복 기록 · 처음이면 돈. 알릴 글을 돌려준다
export function dungeonCleared(save, s) {
  const L = dungeonLoot(s.id); if (!L) return null;
  const rec = dgOf(save, s.id), first = !rec.clears;
  rec.clears++; rec.best = Math.max(rec.best || 0, s.depth + 1);
  const sub = [];
  if (first) { save.gold = (save.gold || 0) + L.D.first; sub.push(`처음 정복 ◆ ${L.D.first}`); }
  sub.push(`${L.partName} → 각인 「${L.eng?.name || ''}」`);
  return { text: `${ENTRANCES[s.id]?.name || ''} 정복!`, sub: sub.join(' · ') };
}
