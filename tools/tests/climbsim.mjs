// 탑 등반 자동 플레이: 간단한 봇이 층을 깨고 → 열린 문으로 다음 층에 오른다.
// 오류가 없는지 · 층마다 얼마나 걸리고 얼마나 맞는지 · 어디서 쓰러지는지를 잰다 (밸런스 맞추기용)
// 사용: node tools/tests/climbsim.mjs [클래스=greatsword] [레벨=자동] [등반 수=3] [최대 층=100] [시작 층=1]
// 탑 안에는 각인 · 보상이 없다: 탑 밖에서 갖춘 빌드 그대로 층마다 몬스터만 상대한다
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { createRng } = await import(root + '/sim/rng.js');
const { ZONES, ALL_ZONES } = await import(root + '/data/monsters.js');
const { CLASSES, SKILLS } = await import(root + '/data/skills.js');
const { classEngravingFor } = await import(root + '/save.js');
const { ENGRAVINGS } = await import(root + '/data/engravings.js');
const { SLOTS } = await import(root + '/sim/build.js');
const { ITEMS } = await import(root + '/data/items.js');
const C = await import(root + '/data/climb.js');
const { TOWER_WEAPONS } = await import(root + '/data/weapons.js');
// WT=auto: 그 층보다 한 단계 아래 탑 무기를 든다 · WT=숫자: 그 단계 무기 고정 (클래스 시작 무기와 같은 계열 중 가장 좋은 것)
const WT = process.env.WT;

const args = process.argv.slice(2);
const clsArg = args[0] || 'greatsword', lvArg = args[1] && args[1] !== 'auto' ? +args[1] : null, RUNS = +(args[2] || 3), TOP = +(args[3] || 100), START_F = +(args[4] || 1);
const QUIET = process.env.QUIET;

function towerWeaponFor(cid, f) {
  if (!WT) return null;
  const tier = WT === 'auto' ? Math.max(1, Math.ceil(f / 10) - 1) : +WT;
  const base = ITEMS[CLASSES[cid].weapons[1] || CLASSES[cid].weapons[0]];
  const cat = base.weapon.cat || base.cat, kind = base.weapon.kind, dmg = base.weapon.dmg;
  const list = Object.keys(TOWER_WEAPONS).filter((id) => TOWER_WEAPONS[id].t === tier).map((id) => ITEMS[id]);
  const pick = list.filter((it) => it.cat === cat).sort((a, b) => b.rarity - a.rarity)[0] || list.filter((it) => it.weapon.kind === kind && it.weapon.dmg === dmg).sort((a, b) => b.rarity - a.rarity)[0];
  return pick ? Object.keys(ITEMS).find((k) => ITEMS[k] === pick) : null;
}
function loadout(cid, level, f = 1) {
  const c = CLASSES[cid], R = c.race;
  const tw = towerWeaponFor(cid, f);
  // 주력 스탯 둘에 반씩 (무기 계열에 맞춰)
  const wpn = ITEMS[tw || c.weapons[1] || c.weapons[0]];
  const main = wpn.weapon.dmg === 'mag' ? 'mag' : wpn.weapon.scale === 'agi' ? 'agi' : 'str';
  const pts = level - 1;
  // 클래스가 없다: 그 갈래 스킬의 각인을 레벨에 맞게 Q · E · R · F에 (궁극 · 마무리 먼저) · 다섯째 칸에 갈래 특성 각인
  const sks = c.skills.filter((id) => (SKILLS[id].unlock || 1) <= level).sort((a, b) => (SKILLS[b].ult - SKILLS[a].ult) || ((SKILLS[b].role === '마무리') - (SKILLS[a].role === '마무리')) || ((SKILLS[b].unlock || 1) - (SKILLS[a].unlock || 1)));
  const engs = sks.map(classEngravingFor).filter(Boolean).slice(0, 4), trait = c.skills.map(classEngravingFor).find((e) => ENGRAVINGS[e]?.effects?.some((x) => x.type === 'flag' && /갈래 특성/.test(x.text || '')));
  const engravings = Object.fromEntries(engs.map((e, i) => [SLOTS[i], e])); if (trait && !engs.includes(trait)) engravings[SLOTS[4]] = trait;
  return { race: R, cls: cid, level, allSkills: false, alloc: { [main]: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings, gear: { weapon: tw || c.weapons[1] || c.weapons[0], off: c.off }, skills: null };
}

function makeWorld(run, lo) {
  const f = run.f, act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone);
  const fk = C.floorKind(f);
  const seed = (run.seed + f * 7919) >>> 0;
  const b = computeBuild({ ...lo, extraEffects: C.runEffects(run) });
  const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed, map: buildClimbFloor(z, seed, f, fk), tower: { f }, climb: { run, f, kind: fk } });
  w.player.hp = Math.max(1, (run.hpFrac ?? 1) * w.d.maxHp);
  if (run.res != null) w.player.res = run.res;
  return w;
}

// 봇: 가장 가까운 적에게 다가가 때리고, 스킬을 돌리고, 예고가 보이면 구른다
function botInput(w, st) {
  const p = w.player, inp = { moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y, attack: false, autoAim: true };
  let tgt = null, bd = 1e9;
  for (const e of w.enemies) { if (e.dead || e.hidden) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
  for (const ev of w.events) if (ev.t === 'telegraphCircle' || ev.t === 'lineTele' || ev.t === 'windup') st.danger.push({ ...ev, t0: w.t });
  st.danger = st.danger.filter((d) => w.t - d.t0 < (d.dur || 0.5));
  if (!tgt) return inp;
  const melee = w.b.weapon.kind === 'melee', want = melee ? (w.b.weapon.range || 30) * 0.7 : 110;
  const dx = tgt.x - p.x, dy = tgt.y - p.y, l = Math.hypot(dx, dy) || 1;
  inp.aimX = tgt.x; inp.aimY = tgt.y;
  if (l > want) { inp.moveX = dx / l; inp.moveY = dy / l; } else if (!melee && l < want * 0.6) { inp.moveX = -dx / l; inp.moveY = -dy / l; }
  else { inp.moveX = -dy / l * 0.4; inp.moveY = dx / l * 0.4; }
  inp.attack = l < (melee ? want * 1.6 : 220);
  // 위험 피하기 (보통 사람 수준: 0.25초 늦게 알아채고, 둘에 하나는 제때 구른다)
  // 예고 원 → 밖으로 · 예고선 → 옆으로 · 바로 앞의 예비 동작 → 뒤로. 늦었으면 대시 (무적)
  const REACT = st.react ?? 0.25, sp = w.d.moveSpeed || 80;
  let ex = 0, ey = 0, urgent = false;
  for (const d of st.danger) {
    const age = w.t - d.t0, left = (d.dur || 0.45) - age;
    if (age < REACT || left < 0) continue;
    if (d.t === 'telegraphCircle') {
      const cx = d.follow === 'p' ? d.x : d.x, cy = d.y, ddx = p.x - cx, ddy = p.y - cy, dl = Math.hypot(ddx, ddy) || 1, out = (d.r || 30) + 8 - dl;
      if (d.follow === 'p') { if (left < 0.2) urgent = true; ex += ddx / dl; ey += ddy / dl; continue; } // 따라오는 표식: 끝날 때 구른다
      if (out > 0) { ex += ddx / dl * 2; ey += ddy / dl * 2; if (out / sp > left - 0.05) urgent = true; }
    } else if (d.t === 'lineTele') {
      const vx = d.x2 - d.x1, vy = d.y2 - d.y1, L2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((p.x - d.x1) * vx + (p.y - d.y1) * vy) / L2));
      const qx = d.x1 + vx * k, qy = d.y1 + vy * k, ddx = p.x - qx, ddy = p.y - qy, dl = Math.hypot(ddx, ddy), half = (d.w || 6) / 2 + 10;
      if (dl < half) { const nx = dl > 0.5 ? ddx / dl : -vy / Math.sqrt(L2), ny = dl > 0.5 ? ddy / dl : vx / Math.sqrt(L2); ex += nx * 2; ey += ny * 2; if ((half - dl) / sp > left - 0.05) urgent = true; }
    } else if (d.t === 'windup') {
      const e = w.enemies.find((o) => o.id === d.id); if (!e || e.dead) continue;
      const ddx = p.x - e.x, ddy = p.y - e.y, dl = Math.hypot(ddx, ddy) || 1;
      if (dl < e.r + 30) { ex += ddx / dl; ey += ddy / dl; if (left < 0.15) urgent = true; }
    }
  }
  if (ex || ey) { const el = Math.hypot(ex, ey) || 1; inp.moveX = ex / el; inp.moveY = ey / el; if (urgent && (st.dodgeOk ?? 0.6) > Math.random()) inp.dash = true; }
  if ((st.skillT -= 1 / 60) <= 0) { st.skillT = 0.4; const k = 1 + (st.si++ % 4); inp['s' + k] = true; inp['h' + k] = true; inp.wskill = st.si % 3 === 0; }
  return inp;
}

function simRun(cid, seed) {
  const run = C.newRun({ seed, startF: START_F });
  const log = [];
  let w = null;
  while (run.f < TOP) {
    run.f++;
    const lv = lvArg || C.recLevel(run.f);
    const lo = loadout(cid, lv, run.f);
    w = makeWorld(run, lo);
    const st = { danger: [], skillT: 0, si: 0, skill: 0.7 };
    let frames = 0, next = null;
    const T0 = w.t;
    while (frames < 60 * 240 && w.state === 'play' && !next) {
      const inp = w.climb.phase === 'fight' ? botInput(w, st) : { moveX: 0, moveY: 0, aimX: w.player.x, aimY: w.player.y };
      w.events.length = 0;
      w.step(inp);
      frames++;
      for (const s of w.signals.splice(0)) {
        if (s.t === 'climbDoor') next = s.next;
        else if (s.t === 'climbTop') next = 'top';
      }
      if (w.climb.phase !== 'fight' && w.climb.doorsOpen && !next) { const d = w.objects.find((o) => o.kind === 'climbDoor'); if (d) w.interact(d); }
    }
    const took = (w.t - T0), hurt = w.tower.hurt, maxHp = w.d.maxHp;
    log.push({ f: run.f, kind: w.climb.kind, took: Math.round(took), hurtPct: Math.round((hurt / maxHp) * 100), hpLeft: Math.round((w.player.hp / maxHp) * 100), dead: w.state !== 'play', lv, timeout: frames >= 60 * 240 });
    if (w.state !== 'play' || !next || frames >= 60 * 240) break;
    run.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); run.res = w.player.res;
    if (next === 'top') break;
  }
  const last = log[log.length - 1];
  return { reached: !last ? 0 : last.dead || last.timeout ? last.f - 1 : last.f, log, run };
}

const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = simRun(clsArg, 1000 + i * 77);
  results.push(r);
  if (!QUIET) {
    console.log(`\n# ${clsArg} 등반 ${i + 1}: ${START_F}층부터 ${r.reached}층까지`);
    for (const x of r.log) if (process.env.ALL || x.f % 5 === 0 || x.dead || x.timeout || x.f <= 3) console.log(`  ${String(x.f).padStart(2)}층 ${x.kind.padEnd(8)} Lv${String(x.lv).padStart(2)} ${String(x.took).padStart(4)}초 · 받은 피해 ${String(x.hurtPct).padStart(4)}% · 남은 체력 ${x.hpLeft}%${x.dead ? ' · 쓰러짐' : ''}${x.timeout ? ' · 시간 초과' : ''}`);
  }
}
const avg = results.reduce((a, r) => a + r.reached, 0) / results.length;
console.log(`\n${clsArg} · 레벨 ${lvArg || '권장'} · ${START_F}층부터 · 평균 ${avg.toFixed(1)}층 (${results.map((r) => r.reached).join(', ')})`);
