// 스킬 변형 (2026-11-24): 같은 스킬을 나눠 쓰던 각인마다 그 스킬을 뼈대로 한 자기 스킬을 준다 (같은 스킬을 쓰는 각인 0개)
// 손으로 쓰지 않는다: 각인 이름 · 태그(성질) · 등급 · 능력치에서 고른다. 같은 뼈대 안에서 「성질 | 덧붙는 효과 | 표식 | 대가」 조합은 겹치지 않는다
// 실행: sim/skillrun.js (skillHit → vxHit · runOp 'vxEcho' · castSkillId0의 대가) · 시험 tools/tests/variants.mjs
// 뼈대의 연출을 그대로 쓰고 성질 색만 바뀐다 (def.elem → 이펙트 색) · 높은 등급(4 · 5)은 앞에 성질 폭발이 하나 더

// 태그 → 성질 (ELEM 키)
const TAG_ELEM = { fire: 'fire', ice: 'ice', poison: 'poison', slime: 'poison', shadow: 'dark', curse: 'dark', undying: 'dark', light: 'light', reflect: 'lightning', wind: 'wind' };
const NAME_ELEM = [[/번개|폭풍|뇌|전격|천둥|벼락/, 'lightning'], [/빛|성스|태양|성광/, 'light'], [/불|화염|용암|불씨|잿/, 'fire'], [/서리|얼음|냉|눈보라|빙/, 'ice'], [/독|맹독|부패|썩/, 'poison']];
// 성질이 거는 상태이상 (빛은 약화 · 바람은 밀쳐내기로)
const ELEM_ST = { fire: 'burn', ice: 'chill', poison: 'poison', dark: 'curse', lightning: 'shock' };
const ST_KO = { burn: '화상', chill: '냉기', poison: '독', curse: '저주', shock: '감전', bleed: '출혈' };
const ELEM_KO = { fire: '화염', ice: '냉기', poison: '독', dark: '암흑', light: '빛', lightning: '번개', wind: '바람' };
const POOL_KIND = { fire: 'fire', ice: 'frost', poison: 'poison' }; // 그 밖은 늪(둔화) 장판
const POOL_KO = { fire: '불길', frost: '서리', poison: '독', slow: '끈적한 늪' };
const STAT_KO = { str: '근력', agi: '민첩', mag: '마력', vit: '체력', sen: '감각', spi: '정신' };
// 태그가 좋아하는 덧붙는 효과
const TAG_ADD = { bleed: ['status'], drain: ['drain'], giant: ['stun', 'knock'], brawl: ['knock', 'echo'], wind: ['knock', 'wide'], reflect: ['echo'], curse: ['status'], shadow: ['pull', 'narrow'], undying: ['drain'], slime: ['pool'], poison: ['pool', 'status'], fire: ['status', 'pool'], ice: ['status', 'pool'] };

// 덧붙는 효과의 값 · 힘 보정(k: 세진 만큼 피해를 낮춘다)
export const VX_K = {
  add: { status: 0.9, pull: 0.9, knock: 0.95, pool: 0.85, echo: 0.75, wide: 0.85, narrow: 1.15, drain: 0.85, stun: 0.9 },
  mark: { crit: 0.7, scale: 0.75 },
  cost: { none: 1, hp: 1.15, res: 1.12, self: 1.18 },
  flair: 0.9, // 4 · 5등급: 앞쪽 성질 폭발
};
export const VX_VAL = { hp: 0.03, costK: 1.5, knock: 70, stun: 0.4, drain: 0.01, drainN: 5, pool: { r: 40, dur: 3 }, echoT: 0.35, echoK: 0.4, wide: 1.3, narrow: 0.75, weak: 2, burstR: 60, flairR: 44, flairMul: 0.35, burstMul: 0.5 };
const COST_BONUS = { hp: 15, res: 12, self: 18 };

const DIRECT = new Set(['aoe', 'cone', 'single', 'proj', 'chain', 'line', 'dash', 'comboSpin']);
const ECHO_OK = new Set(['aoe', 'cone', 'single', 'proj', 'chain', 'line']);
const hitsOf = (o) => (o.op === 'channel' && o.sub ? [o.sub] : [o]);
const firstHit = (def) => def.do.flatMap(hitsOf).find((o) => DIRECT.has(o.op) && o.mul > 0);
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const rot = (a, n) => (a.length ? [...a.slice(n % a.length), ...a.slice(0, n % a.length)] : a);
const GEO = (o, k) => { for (const f of ['r', 'angle', 'w', 'splash']) if (o[f]) o[f] = Math.round(o[f] * k * 100) / 100; if (o.op === 'cone' && o.range) o.range = Math.round(o.range * Math.sqrt(k)); };
const hasGeo = (o) => ['r', 'angle', 'w', 'splash'].some((f) => o[f]);

// 각인 이름에서 스킬 이름에 붙일 말 (「고블린의 잔꾀」 → 「잔꾀」)
const nameWord = (nm) => { const w = String(nm || '').trim().split(/\s+/); return w[w.length - 1].replace(/[의]$/, ''); };

function pickElem(eng, base) {
  if (base.elem) return base.elem; // 이미 성질이 있는 뼈대는 그대로 (설명 글이 그 성질을 말한다)
  for (const [re, el] of NAME_ELEM) if (re.test(eng.name || '')) return el;
  for (const t of eng.tags || []) if (TAG_ELEM[t]) return TAG_ELEM[t];
  return null;
}
const statusOf = (elem, eng) => (elem && ELEM_ST[elem]) || ((eng.tags || []).includes('bleed') || !elem ? 'bleed' : null);

export function makeVariant(baseId, base, eid, eng, used) {
  const direct = !!firstHit(base);
  const elem = pickElem(eng, base);
  const h = hash(eid);
  // 덧붙는 효과 후보: 태그가 좋아하는 것 먼저, 나머지는 각인마다 다른 순서
  let adds = ['status', 'pull', 'knock', 'pool', 'echo', 'wide', 'narrow', 'drain', 'stun'];
  if (!direct) adds = adds.filter((a) => !['echo', 'wide', 'narrow'].includes(a)); // 때리지 않는 뼈대: 둘레 성질 폭발에 붙는다
  const fh = firstHit(base);
  if (!fh || !ECHO_OK.has(fh.op)) adds = adds.filter((a) => a !== 'echo');
  if (!base.do.flatMap(hitsOf).some(hasGeo)) adds = adds.filter((a) => a !== 'wide' && a !== 'narrow');
  if (elem === 'wind' || elem === 'light') adds = adds.filter((a) => a !== 'status' || elem === 'light');
  if (!statusOf(elem, eng) && elem !== 'light') adds = adds.filter((a) => a !== 'status');
  const pref = (eng.tags || []).flatMap((t) => TAG_ADD[t] || []).filter((a) => adds.includes(a));
  adds = [...new Set([...pref, ...rot(adds, h % 7)])];
  const st = Object.entries(eng.stats || {}).filter(([k]) => STAT_KO[k]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  if (!st.length) st.push(base.scale === 'mag' ? 'mag' : 'str');
  const marks = rot(['crit', 'scale:' + st[0], ...(st[1] ? ['scale:' + st[1]] : [])], (h >> 3) % 3);
  const costs = rot(['none', 'hp', 'self', ...(base.cost ? ['res'] : [])], (h >> 6) % 4);
  for (const add of adds) for (const mark of marks) for (const cost of costs) {
    const key = `${elem || '-'}|${add}|${mark}|${cost}`;
    if (used.has(key)) continue;
    used.add(key);
    return build(baseId, base, eid, eng, { elem, add, mark, cost, key, direct });
  }
  return null;
}

function build(baseId, base, eid, eng, c) {
  const V = VX_VAL, grade = eng.grade || 1, def = JSON.parse(JSON.stringify(base));
  const vx = { key: c.key }, txt = [];
  if (c.elem && !base.elem) { def.elem = c.elem; vx.elem = c.elem; txt.push(`${ELEM_KO[c.elem]} 피해(마법)`); }
  const status = statusOf(c.elem, eng), stacks = 1 + Math.floor(grade / 2);
  const who = c.direct ? '맞힌 적' : `쓰는 순간 둘레 ${grade >= 4 ? V.burstR + 24 : V.burstR}에 ${ELEM_KO[c.elem] || '충격'} 폭발(공격력 ${Math.round(V.burstMul * 100)}%) · 맞은 적`;
  switch (c.add) {
    case 'status': if (c.elem === 'light') { vx.weak = V.weak; txt.push(`${who}은 ${V.weak}초 약화(받는 피해 +35%)`); } else { vx.status = status; vx.stacks = stacks; txt.push(`${who}에게 ${ST_KO[status]} ${stacks}중첩`); } break;
    case 'pull': vx.pull = true; txt.push(`${who}을 내 앞으로 끌어온다`); break;
    case 'knock': vx.knock = V.knock + grade * 10; txt.push(`${who}을 ${vx.knock} 밀쳐낸다`); break;
    case 'stun': vx.stun = V.stun; txt.push(`${who}은 ${V.stun}초 기절 (정예는 35%)`); break;
    case 'drain': vx.drain = V.drain; txt.push(`${who} 하나마다 최대 체력 ${V.drain * 100}% 회복 (한 번에 ${V.drainN}명까지)`); break;
    case 'pool': { const kind = POOL_KIND[c.elem] || 'slow'; vx.pool = { kind, r: V.pool.r + grade * 4, dur: V.pool.dur }; txt.push(`처음 맞힌 자리에 ${POOL_KO[kind]} 웅덩이 (둘레 ${vx.pool.r} · ${V.pool.dur}초)`); break; }
    case 'echo': { const sub = JSON.parse(JSON.stringify(firstHit(base))); delete sub.delay; def.do.push({ op: 'vxEcho', t: V.echoT, k: V.echoK, sub }); txt.push(`${V.echoT}초 뒤 한 번 더 (${Math.round(V.echoK * 100)}%)`); break; }
    case 'wide': for (const o of def.do.flatMap(hitsOf)) GEO(o, V.wide); txt.push(`범위 ×${V.wide} · 피해 조금 낮게`); break;
    case 'narrow': for (const o of def.do.flatMap(hitsOf)) GEO(o, V.narrow); txt.push(`범위 ×${V.narrow} · 그만큼 세게`); break;
  }
  const marks = [c.mark];
  if (c.mark === 'crit') txt.push('치명타 확정');
  else txt.push(`${STAT_KO[c.mark.split(':')[1]]} 1점마다 피해 +1%`);
  if (c.cost === 'hp') { vx.hp = V.hp; txt.push(`대가: 쓸 때 최대 체력 ${V.hp * 100}% (그만큼 피해 +${COST_BONUS.hp}%)`); }
  if (c.cost === 'res') { vx.costK = V.costK; txt.push(`대가: 자원 ×${V.costK} (그만큼 피해 +${COST_BONUS.res}%)`); }
  if (c.cost === 'self') { const s = { fire: 'burn', poison: 'poison', ice: 'chill', dark: 'bleed' }[c.elem] || ((eng.tags || []).includes('bleed') ? 'bleed' : 'slow'); marks.push('selfStatus:' + s); txt.push(`대가: 쓰면 나도 ${{ burn: '화상', poison: '독', chill: '냉기', bleed: '출혈', slow: '2초 둔화' }[s]} (그만큼 피해 +${COST_BONUS.self}%)`); }
  let k = VX_K.add[c.add] * VX_K.mark[c.mark === 'crit' ? 'crit' : 'scale'] * VX_K.cost[c.cost];
  if (!c.direct) { // 때리지 않는 뼈대: 둘레 성질 폭발에 변형이 붙는다 (버프 세기는 그대로)
    def.do.push({ op: 'aoe', at: 'self', r: grade >= 4 ? V.burstR + 24 : V.burstR, mul: Math.round(V.burstMul * k * 100) / 100, fx: 'burst', vxBurst: true });
    k = 1;
  } else if (grade >= 4) { // 높은 등급: 앞쪽에 성질 폭발이 하나 더
    def.do.push({ op: 'aoe', at: 'front', dist: 40, r: V.flairR, mul: V.flairMul, fx: 'burst', vxFlair: true });
    k *= VX_K.flair; txt.push(`앞쪽 둘레 ${V.flairR}에 ${ELEM_KO[c.elem] || '충격'} 폭발 (${Math.round(V.flairMul * 100)}%)`);
  }
  def.marks = [...new Set([...(base.marks || []), ...marks, ...autoMarks(base)])];
  def.vx = vx; def.base = baseId; def.vk = k; def.fromEng = eid;
  let word = nameWord(eng.name);
  if (base.name.includes(word)) word = String(eng.name).trim().split(/\s+/)[0].replace(/의$/, ''); // 「껍질 껍질 굳히기」가 되지 않게
  def.name = base.name.includes(word) ? `${eng.name}: ${base.name}` : `${word} ${base.name}`;
  def.desc = `【${eng.name}】 ${txt.join(' · ')}. ` + (base.desc || '');
  return def;
}
// 원거리 · 여러 대 표식 (뼈대에도 붙인다: 이어지는 패시브를 보여 준다)
export function autoMarks(def) {
  const out = [], ops = def.do.flatMap(hitsOf);
  if (ops.some((o) => o.op === 'proj' || o.op === 'chain' || o.op === 'line' || (o.op === 'aoe' && o.at === 'aim') || o.op === 'spiritArrow')) out.push('ranged');
  if (def.do.some((o) => o.op === 'channel' || o.op === 'comboSpin') || ops.some((o) => o.n > 1 || o.jumps > 1) || def.do.filter((o) => o.mul > 0).length > 1) out.push('multi');
  return out;
}

// 같은 스킬을 쓰는 각인 → 첫 각인은 뼈대 그대로, 나머지는 각자 변형
export function registerSkillVariants(SKILLS, ENGRAVING_SKILLS, ENGRAVINGS, SKILL_BAL, SKILL_BAL_GEN = {}) {
  const by = {};
  for (const [eid, sid] of Object.entries(ENGRAVING_SKILLS)) if (SKILLS[sid] && ENGRAVINGS[eid]) (by[sid] ||= []).push(eid);
  const made = [];
  for (const [sid, list] of Object.entries(by)) {
    if (list.length < 2) continue;
    const base = SKILLS[sid], used = new Set();
    base.marks = [...new Set([...(base.marks || []), ...autoMarks(base)])];
    const names = new Set([base.name]);
    for (const eid of list.slice(1)) {
      const v = makeVariant(sid, base, eid, ENGRAVINGS[eid], used); if (!v) continue;
      let vid = sid + '_' + eid; if (SKILLS[vid]) vid += '_v';
      if (names.has(v.name)) v.name = `${v.name}(${ENGRAVINGS[eid].name.split(/\s+/)[0].replace(/의$/, '')})`;
      if (names.has(v.name)) v.name += '·' + (v.vx.elem ? ELEM_KO[v.vx.elem] : made.length);
      names.add(v.name);
      SKILLS[vid] = v; ENGRAVING_SKILLS[eid] = vid; made.push(vid);
      SKILL_BAL[vid] = SKILL_BAL_GEN[vid] ?? (SKILL_BAL[sid] ?? 1) * v.vk;
    }
  }
  return made;
}
export const skillBaseOf = (SKILLS, id) => SKILLS[id]?.base || id;
