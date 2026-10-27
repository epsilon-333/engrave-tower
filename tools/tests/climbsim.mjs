// 탑 등반 자동 플레이: 간단한 봇이 층을 깨고 → 보상을 고르고 → 문을 골라 오른다.
// 오류가 없는지 · 층마다 얼마나 걸리고 얼마나 맞는지 · 어디서 쓰러지는지를 잰다 (밸런스 맞추기용)
// 사용: node tools/tests/climbsim.mjs [클래스=greatsword] [레벨=자동] [등반 수=3] [최대 층=50] [탑의 축복 단계=0]
const root = new URL('../../public/js', import.meta.url).href;
const { World } = await import(root + '/sim/world.js');
const { computeBuild } = await import(root + '/sim/build.js');
const { buildClimbFloor } = await import(root + '/sim/climbmap.js');
const { createRng } = await import(root + '/sim/rng.js');
const { ZONES } = await import(root + '/data/monsters.js');
const { CLASSES } = await import(root + '/data/skills.js');
const { ITEMS } = await import(root + '/data/items.js');
const C = await import(root + '/data/climb.js');

const args = process.argv.slice(2);
const clsArg = args[0] || 'greatsword', lvArg = args[1] && args[1] !== 'auto' ? +args[1] : null, RUNS = +(args[2] || 3), TOP = +(args[3] || 50), META_LV = +(args[4] || 0);
const QUIET = process.env.QUIET;

function loadout(cid, level) {
  const c = CLASSES[cid], R = c.race;
  // 주력 스탯 둘에 반씩 (무기 계열에 맞춰)
  const wpn = ITEMS[c.weapons[1] || c.weapons[0]];
  const main = wpn.weapon.dmg === 'mag' ? 'mag' : wpn.weapon.scale === 'agi' ? 'agi' : 'str';
  const pts = level - 1;
  return { race: R, cls: cid, level, allSkills: false, alloc: { [main]: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings: {}, gear: { weapon: c.weapons[1] || c.weapons[0] }, skills: null };
}

function makeWorld(run, door, lo, meta, prev) {
  const f = run.f, act = C.actOf(f), z = ZONES.find((x) => x.id === act.zone);
  const fk = C.floorKind(f);
  const room = fk !== 'fight' ? fk : C.REWARDS[door]?.room ? door : door === 'trial' ? 'trial' : 'fight';
  const seed = (run.seed + f * 7919) >>> 0;
  const b = computeBuild({ ...lo, runEng: run.eng, extraEffects: C.runEffects(run, meta) });
  const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed, map: buildClimbFloor(z, seed, f, room), tower: { f }, climb: { run, f, kind: room, reward: room === 'fight' ? door : null, meta } });
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

const policy = (doors, run, rng) => { // 문 고르기: 각인 · 축복을 좋아하고, 체력이 낮으면 샘
  const pref = { eng: 5, bless: 4, hone: 3, trial: 2.5, shop: 2, heal: run.hpFrac < 0.45 ? 6 : 1, rest: run.hpFrac < 0.6 ? 6 : 2, gold: 1.5, shard: 1.5, altar: 1.5 };
  return doors.slice().sort((a, b) => (pref[b.kind] || 1) - (pref[a.kind] || 1) + (rng.next() - 0.5) * 1.2)[0];
};

function simRun(cid, seed) {
  const rng = createRng(seed);
  const meta = META_LV ? { hp: META_LV, dmg: META_LV, luck: Math.min(4, META_LV), reroll: Math.min(3, META_LV), revive: Math.min(2, Math.floor(META_LV / 2)), spring: Math.min(3, META_LV) } : {};
  const run = C.newRun({ seed, meta });
  const log = [];
  let door = 'eng', w = null;
  while (run.f < TOP) {
    run.f++;
    const lv = lvArg || C.recLevel(run.f);
    const lo = loadout(cid, lv);
    w = makeWorld(run, door, lo, meta);
    const st = { danger: [], skillT: 0, si: 0, skill: 0.7 };
    let frames = 0, hurt0 = 0, next = null;
    const T0 = w.t;
    while (frames < 60 * 240 && w.state === 'play' && !next) {
      const inp = w.climb.phase === 'fight' ? botInput(w, st) : { moveX: 0, moveY: 0, aimX: w.player.x, aimY: w.player.y };
      w.events.length = 0;
      w.step(inp);
      frames++;
      for (const s of w.signals.splice(0)) {
        if (s.t === 'climbReward') {
          if (s.reward === 'eng') { const o = C.offerEngravings(run, rng, { minGrade: s.minGrade, legendary: s.legendary, luck: meta.luck || 0 }); if (o.length) C.addEngraving(run, o[0].id); }
          else if (s.reward === 'hone') { const h = C.offerHone(run, rng); if (h.length) C.addEngraving(run, h[0]); }
          else if (s.reward === 'bless') { const b = C.offerBless(run, rng)[0]; run.bless[b] = (run.bless[b] || 0) + 1; }
          else if (s.reward === 'gold') run.gold += C.goldGain(C.goldReward(run.f), run, meta);
          else if (s.reward === 'heal') w.heal(w.d.maxHp * 0.4, 'spring');
          else if (s.reward === 'shard') run.shards += C.shardGain(C.shardReward(run.f), run, meta);
          const k = w.player.hp / w.d.maxHp; w.setBuild(computeBuild({ ...lo, runEng: run.eng, extraEffects: C.runEffects(run, meta) })); w.player.hp = k * w.d.maxHp;
          w.climbRewardTaken();
        } else if (s.t === 'climbCleared') {
          run.shards += C.shardGain(1 + (C.clearReward(w.climb.reward || w.climb.kind).shards || 0), run, meta);
          const o = w.objects.find((x) => x.kind === 'climbReward'); if (o) w.interact(o);
        } else if (s.t === 'climbRoom') { /* 봇은 방을 그냥 지나간다 */ }
        else if (s.t === 'climbDoor') next = s.next;
        else if (s.t === 'climbTop') next = 'top';
      }
      if (w.climb.phase === 'room' && frames === 30) { const o = w.objects.find((x) => x.kind === 'climbRoom'); if (o?.room === 'rest') w.heal(w.d.maxHp * 0.5, 'spring'); if (o?.room === 'shop') { const items = C.rollShop(run, rng, meta); const hl = items.find((x) => x.kind === 'heal'); if (hl && w.player.hp < w.d.maxHp * 0.6 && run.gold >= hl.price) { run.gold -= hl.price; w.heal(w.d.maxHp * 0.35, 'spring'); } for (const it of items) if (it.kind === 'eng' && run.gold >= it.price) { run.gold -= it.price; C.addEngraving(run, it.id); } } }
      if ((w.climb.phase === 'reward' || w.climb.phase === 'room') && w.climb.doorsOpen && !next) {
        const doors = w.objects.filter((o) => o.kind === 'climbDoor');
        if (doors.length) { const d = policy(doors.map((o) => ({ kind: o.next, o })), run, rng); w.interact(d.o); }
      }
      if (w.climb.phase === 'reward' && !w.climb.doorsOpen) { const o = w.objects.find((x) => x.kind === 'climbReward' && !x.opened); if (o && frames % 30 === 0) w.interact(o); }
    }
    const took = (w.t - T0), hurt = w.tower.hurt, maxHp = w.d.maxHp;
    log.push({ f: run.f, kind: w.climb.kind, took: Math.round(took), hurtPct: Math.round((hurt / maxHp) * 100), hpLeft: Math.round((w.player.hp / maxHp) * 100), dead: w.state !== 'play', lv: lvArg || C.recLevel(run.f), eng: run.eng.length, timeout: frames >= 60 * 240 });
    if (w.state !== 'play' || !next || frames >= 60 * 240) break;
    run.hpFrac = Math.max(0.05, w.player.hp / w.d.maxHp); run.res = w.player.res;
    door = next === 'top' ? null : next;
    if (door === 'shop') run.lastShop = run.f + 1;
    if (next === 'top') break;
  }
  return { reached: log.filter((x) => !x.dead && !x.timeout).length ? log[log.length - 1].dead || log[log.length - 1].timeout ? log[log.length - 1].f - 1 : log[log.length - 1].f : 0, log, run };
}

const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = simRun(clsArg, 1000 + i * 77);
  results.push(r);
  if (!QUIET) {
    console.log(`\n# ${clsArg} 등반 ${i + 1}: ${r.reached}층까지 · 각인 ${r.run.eng.length} · 축복 ${Object.values(r.run.bless).reduce((a, b) => a + b, 0)} · 별빛 ${r.run.shards}`);
    for (const x of r.log) if (process.env.ALL || x.f % 5 === 0 || x.dead || x.timeout || x.f <= 3) console.log(`  ${String(x.f).padStart(2)}층 ${x.kind.padEnd(8)} Lv${String(x.lv).padStart(2)} ${String(x.took).padStart(4)}초 · 받은 피해 ${String(x.hurtPct).padStart(4)}% · 남은 체력 ${x.hpLeft}%${x.dead ? ' · 쓰러짐' : ''}${x.timeout ? ' · 시간 초과' : ''}`);
  }
}
const avg = results.reduce((a, r) => a + r.reached, 0) / results.length;
console.log(`\n${clsArg} · 레벨 ${lvArg || '권장'} · 축복 ${META_LV} · 평균 ${avg.toFixed(1)}층 (${results.map((r) => r.reached).join(', ')})`);
