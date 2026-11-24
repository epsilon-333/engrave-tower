// 탑 층마다 종족별로: 내 평타 몇 대에 보통 몬스터가 쓰러지나 · 보통 몬스터 한 대에 내 체력 몇 %를 잃나
// 기준: 권장 레벨 · 종족 첫 갈래의 좋은 시작 무기 · 주력 스탯 60% / 체력 40% · 각인 없음 (climbsim 과 같은 몸)
// 표: 평타 몇 대 · 평타만으로 몇 초 · 몬스터 한 대에 잃는 체력 % (여러 몬스터의 가운데값)
// 사용: node tools/ttkclimb.mjs [종족,…] [층,…]
const R = new URL('../public/js', import.meta.url).href;
const { World } = await import(R + '/sim/world.js');
const { computeBuild } = await import(R + '/sim/build.js');
const { buildClimbFloor } = await import(R + '/sim/climbmap.js');
const { ALL_ZONES, MONSTERS } = await import(R + '/data/monsters.js');
const { CLASSES, RACE_CLASSES } = await import(R + '/data/skills.js');
const { ITEMS } = await import(R + '/data/items.js');
const C = await import(R + '/data/climb.js');
const races = (process.argv[2] || 'dino,wizard,knight,orc,undead,assassin,elf,dragon').split(',');
const floors = (process.argv[3] || '1,5,10,20,30,40,50,60').split(',').map(Number);
const SAMPLES = 6;

function loadout(race, level) {
  const cid = RACE_CLASSES(race)[0], c = CLASSES[cid], wid = c.weapons[1] || c.weapons[0], wpn = ITEMS[wid];
  const pts = Math.floor(1.75 * (level - 1)), main = wpn.weapon.dmg === 'mag' ? 'mag' : wpn.weapon.scale === 'agi' ? 'agi' : 'str';
  return { race, cls: cid, level, alloc: { [main]: Math.ceil(pts * 0.6), vit: Math.floor(pts * 0.4) }, engravings: {}, gear: { weapon: wid, off: c.off }, skills: null };
}
const av = (a) => { const q = a.slice().sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : 0; }; // 가운데값 (벽 · 특이한 몬스터에 휘둘리지 않게)
export function measure(race, f) {
  const lv = C.recLevel(f), act = C.actOf(f), z = ALL_ZONES.find((x) => x.id === act.zone), run = C.newRun({ seed: 5 });
  run.f = f;
  const b = computeBuild({ ...loadout(race, lv), extraEffects: C.runEffects(run) });
  const hits = [], secs = [], pct = [], per = {};
  for (let k = 0; k < SAMPLES; k++) {
    const seed = 100 + k * 31 + f;
    const w = new World({ build: b, mode: 'field', zone: z, zoneId: z.id, seed, map: buildClimbFloor(z, seed, f, 'fight'), tower: { f }, climb: { run, f, kind: 'fight' } });
    const p = w.player;
    for (let i = 0; i < 80 && w.climb.waveI < 1; i++) w.step({ moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y }); w.climb.waveI = w.climb.waves.length; // 첫 물결이 나온 뒤 다음 물결은 막는다
    const mobs = w.enemies.filter((e) => !e.dead && !e.def.elite && !e.champion && !e.boss && !e.def.boss);
    const e = mobs[k % mobs.length]; if (!e) continue;
    for (const o of w.enemies) if (o !== e) o.dead = true;
    w.enemies = [e];
    const ranged = b.weapon.kind !== 'melee';
    e.x = p.x + (ranged ? 50 : 18); e.y = p.y; if (w.blocked(e.x, e.y, 6)) e.x = p.x - (ranged ? 50 : 18);
    const atk0 = e.atk, hpMax = e.maxHp; e.atk = 0; e.state = 'idle'; e.def = { ...e.def, speed: 0, ai: 'chase' }; e.trait = null;
    // 한 대 평균 피해를 재고 몬스터 체력을 나눈다 (죽은 척 · 굴 파기 같은 특성은 빼고 순수한 맞는 횟수)
    let n = 0, sum = 0;
    for (let fr = 0; fr < 60 * 6; fr++) {
      const x0 = e.x, y0 = e.y;
      w.step({ moveX: 0, moveY: 0, aimX: e.x, aimY: e.y, attack: true, autoAim: true });
      for (const ev of w.events) if (ev.t === 'dmg' && ev.id === e.id && ev.src !== 'dot' && ev.src !== 'linked') { n++; sum += ev.v || 0; }
      e.x = x0; e.y = y0; e.hp = e.maxHp; e.dead = false; e.hidden = false; e.under = false; w.events.length = 0; w.signals.length = 0; p.hp = w.d.maxHp;
    }
    hits.push(n ? hpMax / (sum / n) : 999); secs.push(sum > 0 ? hpMax / (sum / 6) : 999);
    const mh = w.d.maxHp; p.hp = mh; p.invuln = 0; p.dodgeT = 0;
    const e2 = Object.assign(Object.create(Object.getPrototypeOf(e)), e, { atk: atk0, dead: false });
    // 회피는 빼고 한 대의 크기만 본다
    const rnd = w.rng.chance; w.rng.chance = () => false;
    w.hurtPlayer(atk0, e.def.dmgType || 'phys', e2, { fromX: e.x, fromY: e.y });
    w.rng.chance = rnd;
    pct.push((mh - p.hp) / mh * 100);
    (per[e.defId] ||= []).push(n);
  }
  return { hits: av(hits), secs: av(secs), pct: av(pct), per };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('종족      ' + floors.map((f) => `${f}층`.padStart(17)).join(''));
  for (const race of races) console.log(race.padEnd(9) + floors.map((f) => { const m = measure(race, f); return `${m.hits.toFixed(1)}대 ${m.secs.toFixed(1)}s ${m.pct.toFixed(0)}%`.padStart(17); }).join(''));
}
