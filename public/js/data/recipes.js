// 각인 재료(잔향) 규칙 — 모든 각인의 recipe를 여기서 다시 정한다 (숨은 각인 · 증표는 그대로).
// 손으로 하나씩 쓰지 않는다: 원래 재료의 주 잔향(설계 의도) + 각인 태그(성질)에 맞는 잔향 후보 + 등급 → 양,
// 고르는 것은 각인 id 해시로 결정적. 같은 조합 · 거의 같은 조합(같은 잔향들에 양 차이가 모두 1 이하)이 나오면 다시 고른다.
// 시험: tools/tests/recipes.mjs
export const Z = { goo: 1, wing: 1, rust: 1, venom: 1, blood: 1, spore: 1, ember: 2, magma: 2, cinder: 2, frost: 3, mirror: 3, icecore: 3, bone: 4, soul: 4, rot: 4 };
const RARE_OF = { 1: ['chief', 'queen'], 2: ['core'], 3: ['witch', 'meltcore'], 4: ['grave'] };
// 태그(성질)별 후보: 지역마다 하나 이상 — 낮은 등급도 성질에 맞는 잔향을 고를 수 있게
export const TAG_POOL = {
  slime: ['goo', 'spore', 'venom', 'magma', 'frost', 'rot'], wind: ['wing', 'spore', 'cinder', 'ember', 'mirror', 'frost', 'soul'],
  poison: ['venom', 'spore', 'goo', 'cinder', 'rot'], bleed: ['blood', 'rust', 'wing', 'ember', 'icecore', 'bone'],
  brawl: ['rust', 'blood', 'wing', 'cinder', 'magma', 'frost', 'bone'], giant: ['goo', 'rust', 'magma', 'cinder', 'icecore', 'bone'],
  fire: ['ember', 'blood', 'magma', 'cinder', 'rust'], ice: ['frost', 'icecore', 'mirror', 'goo', 'wing'],
  curse: ['venom', 'spore', 'cinder', 'mirror', 'soul', 'rot'], shadow: ['wing', 'venom', 'cinder', 'mirror', 'soul', 'rot'],
  drain: ['blood', 'goo', 'magma', 'frost', 'soul', 'bone'], undying: ['blood', 'spore', 'cinder', 'icecore', 'bone', 'soul', 'rot'],
  reflect: ['rust', 'goo', 'magma', 'mirror', 'icecore', 'bone'], light: ['ember', 'wing', 'magma', 'mirror', 'frost', 'soul'],
};
const DEFAULT_POOL = ['rust', 'goo', 'wing', 'blood', 'spore'];
// 등급별 일반 잔향 합계 (예전 5~12개 → 낮은 등급도 여러 번 사냥) · 희귀(보스) 잔향
export const RECIPE_TOTAL = [0, 14, 22, 34, 50, 72];
export const MAX_ZONE = [0, 1, 2, 3, 4, 4];
const KINDS = [0, [2, 3], [2, 3], [3, 3], [3, 4], [3, 4]];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const sameish = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) { if (!(k in b) || Math.abs(a[k] - b[k]) > 1) return false; } return true; };
export const recipeKey = (r) => Object.entries(r).sort().map(([k, n]) => k + n).join(',');
export const recipesNear = sameish;

function build(id, e, ECHOES, salt) {
  const R = rng(hash(id + '#' + salt)), g = Math.max(1, Math.min(5, e.grade || 1));
  const old = Object.entries(e.recipe || {});
  const isRare = (k) => ECHOES[k]?.rare;
  const out = {};
  if (e.from && old.some(([k]) => ECHOES[k]?.part)) {
    // 몬스터 부산물 각인: 그 몬스터의 부산물 + 계열 잔향 (+ 3등급부터 태그 잔향 하나)
    const part = old.find(([k]) => ECHOES[k]?.part)[0], fam = ECHOES[part].fam;
    out[part] = 2 * g + 1 + Math.floor(R() * 2);
    const rareFam = fam && isRare(fam);
    if (fam) out[fam] = rareFam ? Math.max(1, g - 2) + Math.floor(R() * 2) : Math.round([0, 8, 14, 22, 32, 44][g] * (0.85 + R() * 0.35));
    if (g >= 3 || rareFam) {
      const pool = (e.tags || []).flatMap((t) => TAG_POOL[t] || []).filter((k) => k !== fam && (Z[k] || 9) <= MAX_ZONE[g]);
      // 보스 계열이면 태그 잔향 몫이 커서, 한 가지에 몰리지 않게 두 가지로 나눈다 (태그마다 하나씩 먼저)
      const n = rareFam ? 2 : 1, picks = [];
      for (const t of [...(e.tags || [])].reverse()) { const c = (TAG_POOL[t] || []).filter((k) => pool.includes(k) && !picks.includes(k)); if (picks.length < n && c.length) picks.push(c[Math.floor(R() * c.length)]); }
      while (picks.length < n) { const c = pool.filter((k) => !picks.includes(k)); if (!c.length) break; picks.push(c[Math.floor(R() * c.length)]); }
      const amt = Math.round(RECIPE_TOTAL[g] * (rareFam ? 0.5 + R() * 0.2 : 0.15 + R() * 0.12));
      picks.forEach((k, i) => { out[k] = Math.round(amt / picks.length) + (i ? 0 : amt % picks.length); });
    }
    for (const k in out) if (out[k] < 1) out[k] = 1;
    // 합계가 등급 목표보다 모자라면 성질 · 계열 잔향(보스 잔향 · 부산물 빼고)에 나눠 채운다
    const fill = Object.keys(out).filter((k) => k !== part && !isRare(k));
    const have = Object.entries(out).filter(([k]) => !isRare(k)).reduce((a, [, v]) => a + v, 0);
    const want = Math.round(RECIPE_TOTAL[g] * (0.95 + R() * 0.15));
    if (fill.length && have < want) fill.forEach((k, i) => { out[k] += Math.floor((want - have) / fill.length) + (i < (want - have) % fill.length ? 1 : 0); });
    return out;
  }
  const common = old.filter(([k]) => !isRare(k)).sort((a, b) => b[1] - a[1]);
  const lim = MAX_ZONE[g], ok = (k) => ECHOES[k] && (Z[k] || 9) <= lim;
  const tagPool = [...new Set((e.tags || []).flatMap((t) => TAG_POOL[t] || []))].filter(ok);
  // 주 잔향: 원래 주 잔향이 등급 지역 안이면 그대로, 아니면 성질 후보에서(없으면 원래 재료 → 기본 후보)
  let primary = common[0]?.[0];
  if (!primary || !ok(primary)) {
    const alt = tagPool.length ? tagPool : common.map(([k]) => k).filter(ok);
    primary = alt.length ? alt[Math.floor(R() * alt.length)] : DEFAULT_POOL[Math.floor(R() * DEFAULT_POOL.length)];
  }
  const nk = KINDS[g][0] + Math.floor(R() * (KINDS[g][1] - KINDS[g][0] + 1));
  let pool = [...new Set([...tagPool, ...common.slice(1).map(([k]) => k).filter(ok)])].filter((k) => k !== primary);
  // 기본 후보는 성질 후보가 정말 모자랄 때만
  if (pool.length < nk - 1) pool = [...new Set([...pool, ...DEFAULT_POOL])].filter((k) => k !== primary && ok(k));
  const kinds = [primary];
  while (kinds.length < nk && pool.length) kinds.push(pool.splice(Math.floor(R() * Math.min(pool.length, 5)), 1)[0]);
  const w = kinds.map((_, i) => (i === 0 ? 1.6 : 1) * (0.7 + R() * 0.6));
  const sw = w.reduce((a, b) => a + b, 0), total = Math.round(RECIPE_TOTAL[g] * (0.9 + R() * 0.25));
  kinds.forEach((k, i) => { out[k] = Math.max(2, Math.round(total * w[i] / sw)); });
  if (g >= 4) {
    let rares = old.filter(([k]) => isRare(k)).map(([k]) => k);
    if (!rares.length) { const c = RARE_OF[Math.min(4, Z[primary] || 1)] || RARE_OF[1]; rares = [c[Math.floor(R() * c.length)]]; }
    for (const k of rares) out[k] = (g === 5 ? 3 : 2) + Math.floor(R() * 2);
  }
  return out;
}

// 모든 각인 등록이 끝난 뒤 한 번 (engravings.js)
export function retuneRecipes(ENGRAVINGS, ECHOES) {
  const done = [];
  for (const id of Object.keys(ENGRAVINGS).sort()) {
    const e = ENGRAVINGS[id];
    if (e.hidden || !e.recipe || Object.keys(e.recipe).some((k) => !ECHOES[k] || ECHOES[k].hidden)) continue;
    let r, salt = 0;
    do { r = build(id, e, ECHOES, salt++); } while (salt < 400 && done.some((d) => sameish(d, r)));
    e.recipe = r; done.push(r);
  }
}
