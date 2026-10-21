// 생활 시뮬레이션: 캐기(바위 · 광맥 · 덤불) · 나무 베기 · 땅 파기 · 낚시 · 농사.
// world.life = 저장 데이터의 같은 객체들 { bag, tools, nodes, chopped, farm, fishLog, artifacts, farmOpts } — 바꾸면 곧 저장된다.
import { TILE, T_FLOOR, T_WALL, T_BUILD, T_DEEP, T_LIQUID } from './mapgen.js';
import { GOODS, NODES, THEME_NODES, DIG_BASE, DIG_BIOME, ARTIFACTS, CROPS, FISH, FISH_JUNK, TOOLS, bagAdd } from '../data/goods.js';
import { G, BIOME_LIST, OW } from '../data/maps/overworld.js';
import { LORES } from '../data/monsters.js';

const now = () => Date.now();
export const toolTier = (w, kind) => w.life?.tools?.[kind] || 0;
const toolName = (kind, tier) => TOOLS[kind].tiers[Math.max(0, tier - 1)];
const HARD_TREES = new Set(['oak', 'jungle', 'willow', 'pine', 'snowpine', 'birch']);
function weighted(rng, list) { const tot = list.reduce((a, [, x]) => a + x, 0); let r = rng.next() * tot; for (const [id, x] of list) { r -= x; if (r <= 0) return id; } return list[0][0]; }

// ───── 시작: 캐는 것 · 반짝이는 흙 · 나무 목록 · 밭 ─────
export function initLife(w, life) {
  w.life = life || null;
  const m = w.map;
  if (!w.life || w.mode !== 'field') return;
  if (!m.outdoor && !m.nodes) placeInterior(w);
  const persist = !!m.outdoor, t = now();
  for (const nd of m.nodes || []) {
    const def = NODES[nd.type], key = persist ? `n${nd.id}` : null, k = nd.y * w.tw + nd.x;
    const o = { kind: 'node', type: nd.type, key, tx: nd.x, ty: nd.y, x: nd.x * TILE + 8, y: nd.y * TILE + 10, hp: def.hp, maxHp: def.hp, label: `${def.name} ${def.tool ? '캐기' : '따기'}`, reusable: true, block: !!(def.tool && m.outdoor) };
    if (key && life.nodes[key] > t) { o.depleted = true; o.respawnAt = life.nodes[key]; }
    else if (key && life.nodes[key]) delete life.nodes[key];
    if (o.block && !o.depleted) w.tiles[k] = T_BUILD;
    w.objects.push(o);
  }
  for (const dg of m.digs || []) {
    const key = persist ? `d${dg.id}` : null;
    const o = { kind: 'dig', key, tx: dg.x, ty: dg.y, x: dg.x * TILE + 8, y: dg.y * TILE + 9, label: '반짝이는 흙 파기', reusable: true };
    if (key && life.nodes[key] > t) { o.depleted = true; o.respawnAt = life.nodes[key]; }
    w.objects.push(o);
  }
  // 나무: 칸 → 나무 (벤 나무는 그루터기, 시간이 지나면 다시 자란다)
  if (m.outdoor) {
    w.treeAt = new Map();
    for (const pr of m.props) if (pr.kind === 'tree') {
      w.treeAt.set(`${pr.x},${pr.y}`, pr);
      const until = life.chopped[`${pr.x},${pr.y}`];
      if (until > t) { pr.chopped = until; w.tiles[pr.y * w.tw + pr.x] = T_FLOOR; }
      else if (until) { delete life.chopped[`${pr.x},${pr.y}`]; delete pr.chopped; w.tiles[pr.y * w.tw + pr.x] = T_BUILD; }
    }
    // 밭
    if (m.farm) {
      w.farmRect = m.farm;
      for (const [key, pl] of Object.entries(life.farm)) { const [x, y] = key.split(',').map(Number); if (!inFarm(w, x, y)) delete life.farm[key]; else growPlot(pl); }
    }
  }
  w.lifeT = 0;
}

// 동굴 · 던전 안: 벽에 붙은 광맥 몇 개와 반짝이는 흙
function placeInterior(w) {
  const m = w.map, rng = w.rng, table = THEME_NODES[w.zone?.id] || THEME_NODES.cave;
  const nodes = [], digs = [], area = w.tw * w.th, want = Math.round(area / 700), wantD = Math.max(2, Math.round(area / 3500));
  const sx = m.start.x, sy = m.start.y;
  const T = (x, y) => (x < 0 || y < 0 || x >= w.tw || y >= w.th ? T_WALL : w.tiles[y * w.tw + x]);
  for (let a = 0; a < 8000 && nodes.length < want; a++) {
    const x = rng.int(2, w.tw - 3), y = rng.int(2, w.th - 3);
    if (T(x, y) !== T_FLOOR || T(x, y - 1) !== T_WALL || T(x, y + 1) !== T_FLOOR || Math.hypot(x - sx, y - sy) < 8) continue; // 북쪽 벽에 붙은 칸
    if (nodes.some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) < 7)) continue;
    nodes.push({ id: nodes.length, type: weighted(rng, table), x, y });
  }
  for (let a = 0; a < 6000 && digs.length < wantD; a++) {
    const x = rng.int(2, w.tw - 3), y = rng.int(2, w.th - 3);
    if (T(x, y) !== T_FLOOR || Math.hypot(x - sx, y - sy) < 8 || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => T(x + dx, y + dy) !== T_FLOOR)) continue;
    if ([...digs, ...nodes].some((n) => Math.abs(n.x - x) + Math.abs(n.y - y) < 10)) continue;
    digs.push({ id: digs.length, x, y });
  }
  m.nodes = nodes; m.digs = digs;
}

// ───── 지금 할 수 있는 생활 동작 (가까운 물건이 없을 때) ─────
export function lifeAction(w) {
  if (!w.life || w.mode !== 'field' || w.player.fish) return null;
  const p = w.player, ax = p.aimX, ay = p.aimY;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  // 나무: 둘레 칸 중 바라보는 쪽에 가까운 것
  if (w.treeAt) {
    let best = null, bd = 1e9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const pr = w.treeAt.get(`${tx + dx},${ty + dy}`);
      if (!pr || pr.chopped) continue;
      const cx = pr.x * TILE + 8, cy = pr.y * TILE + 10, d = Math.hypot(cx - p.x, cy - p.y) - ((cx - p.x) * ax + (cy - p.y) * ay) * 0.4;
      if (Math.hypot(cx - p.x, cy - p.y) < 24 && d < bd) { bd = d; best = pr; }
    }
    if (best) return { kind: 'chop', prop: best, x: best.x * TILE + 8, y: best.y * TILE + 6, label: toolTier(w, 'axe') ? '나무 베기' : '도끼가 필요하다' };
  }
  // 밭
  const farm = farmAction(w);
  if (farm) return farm;
  // 물가: 바라보는 쪽의 물
  const spot = fishSpot(w);
  if (spot) return { kind: 'fish', ...spot, label: !toolTier(w, 'rod') ? '낚싯대가 필요하다' : spot.water === 'lava' && toolTier(w, 'rod') < 4 ? '용암 낚시는 화염 낚싯대로' : `낚시하기${(w.life.bag.worm || 0) > 0 ? ' (지렁이 미끼)' : ''}` };
  return null;
}

// ───── 동작 시작 (G) ─────
export function startAction(w, act) {
  const p = w.player;
  if (p.gather || p.fish) return;
  if (act.kind === 'node') {
    const def = NODES[act.type];
    if (act.depleted) return;
    if (def.tool) {
      const tier = toolTier(w, def.tool);
      if (tier < def.tier) { w.emit({ t: 'text', x: act.x, y: act.y - 22, text: `${toolName(def.tool, def.tier)} 이상이 필요하다`, color: '#ffb08a' }); w.emit({ t: 'locked', x: act.x, y: act.y }); return; }
      p.gather = { kind: 'pickaxe', target: act, t: 0, dur: (0.5 - 0.04 * (tier - 1)) * (w.hasKnack('miner') ? 0.75 : 1), power: tier };
    } else p.gather = { kind: 'hand', target: act, t: 0, dur: 0.32, power: 1 };
  } else if (act.kind === 'dig') {
    if (act.depleted) return;
    const tier = toolTier(w, 'shovel');
    if (!tier) { w.emit({ t: 'text', x: act.x, y: act.y - 18, text: '삽이 필요하다', color: '#ffb08a' }); return; }
    p.gather = { kind: 'shovel', target: act, t: 0, dur: 0.6, power: tier };
  } else if (act.kind === 'chop') {
    const tier = toolTier(w, 'axe');
    if (!tier) { w.emit({ t: 'text', x: act.x, y: act.y - 30, text: '도끼가 필요하다', color: '#ffb08a' }); return; }
    p.gather = { kind: 'axe', target: act, t: 0, dur: 0.5 - 0.04 * (tier - 1), power: [1, 1, 1.5, 3][tier - 1] + (w.hasKnack('lumber') ? 1 : 0) };
  } else if (act.kind === 'fish') { startFishing(w, act); return; }
  else if (act.kind === 'till' || act.kind === 'plant' || act.kind === 'water' || act.kind === 'harvest') { farmDo(w, act); return; }
  if (p.gather) { p.dir = (p.gather.target.x ?? act.x) >= p.x ? 1 : -1; w.emit({ t: 'toolSwing', kind: p.gather.kind }); }
}

// ───── 매 틱 ─────
export function updateLife(w, inp) {
  if (!w.life) return;
  const p = w.player;
  if (p.gather) {
    const gth = p.gather;
    gth.t += 1 / 60;
    if (!gth.hit && gth.t >= gth.dur * 0.62) { gth.hit = true; landHit(w, gth); }
    if (gth.t >= gth.dur) {
      p.gather = null;
      // G를 누르고 있으면 같은 것을 계속
      const tg = gth.target;
      if (inp.gHeld && !gth.done && (gth.kind === 'pickaxe' || gth.kind === 'axe') && !(tg.depleted || tg.prop?.chopped)) startAction(w, tg);
    }
  }
  if (p.fish) updateFishing(w, inp);
  // 1초마다: 다시 생기는 것 · 다시 자라는 나무 · 밭
  w.lifeT += 1 / 60;
  if (w.lifeT >= 1) {
    w.lifeT = 0;
    const t = now();
    for (const o of w.objects) if ((o.kind === 'node' || o.kind === 'dig') && o.depleted && o.respawnAt && t >= o.respawnAt) {
      const k = o.ty * w.tw + o.tx;
      if (o.block && Math.hypot(p.x - o.x, p.y - o.y) < 14) continue; // 그 자리에 서 있으면 조금 뒤에
      o.depleted = false; o.respawnAt = 0; o.hp = NODES[o.type]?.hp || 1;
      if (o.block) w.tiles[k] = T_BUILD;
      if (o.key) delete w.life.nodes[o.key];
    }
    if (w.treeAt) for (const [key, until] of Object.entries(w.life.chopped)) {
      if (t < until) continue;
      const pr = w.treeAt.get(key);
      if (!pr) { delete w.life.chopped[key]; continue; }
      if (Math.hypot(p.x - (pr.x * TILE + 8), p.y - (pr.y * TILE + 8)) < 16) continue;
      delete pr.chopped; delete w.life.chopped[key]; w.tiles[pr.y * w.tw + pr.x] = T_BUILD;
      w.emit({ t: 'treeGrow', x: pr.x * TILE + 8, y: pr.y * TILE + 8 });
    }
    if (w.farmRect) for (const pl of Object.values(w.life.farm)) growPlot(pl);
  }
}

function addGood(w, id, n, x, y) { for (let i = 0; i < n; i++) w.spawnDrop(x, y, 'good', id, 1); }

function landHit(w, gth) {
  const tg = gth.target, rng = w.rng;
  if (gth.kind === 'pickaxe' || gth.kind === 'hand') {
    const def = NODES[tg.type];
    tg.hp -= gth.power; tg.hitT = 0.25;
    w.emit({ t: 'gatherHit', x: tg.x, y: tg.y - 6, type: tg.type, tool: gth.kind });
    if (tg.hp > 0) return;
    gth.done = true;
    tg.depleted = true;
    tg.respawnAt = now() + def.respawn * 1000;
    if (tg.key) w.life.nodes[tg.key] = tg.respawnAt;
    if (tg.block) w.tiles[tg.ty * w.tw + tg.tx] = T_FLOOR;
    for (const [id, a, b] of def.drops) addGood(w, id, rng.int(a, b) + (gth.kind === 'pickaxe' && gth.power >= 4 ? 1 : 0), tg.x, tg.y - 4);
    for (const [id, ch] of def.extra || []) if (rng.chance(ch)) addGood(w, id, 1, tg.x, tg.y - 4);
    const first = def.drops[0]?.[0], hand = gth.kind === 'hand'; // 숙련 「광부의 눈」 · 「채집가」: 덤
    if (first && w.hasKnack(hand ? 'forager' : 'miner') && rng.chance(hand ? 0.3 : 0.2)) addGood(w, first, 1, tg.x, tg.y - 4);
    w.knack(hand ? 'forage' : 'mine');
    w.emit({ t: 'nodeBreak', x: tg.x, y: tg.y - 4, type: tg.type });
    w.signals.push({ t: 'save' });
  } else if (gth.kind === 'axe') {
    const pr = tg.prop; if (pr.chopped) return;
    pr.hp = (pr.hp ?? 3) - gth.power; pr.shakeT = 0.3;
    w.emit({ t: 'chopHit', x: pr.x * TILE + 8, y: pr.y * TILE + 4, kind: pr.tree });
    if (pr.hp > 0) return;
    gth.done = true;
    delete pr.hp;
    const burnt = w.burntTrees?.has(`${pr.x},${pr.y}`) || pr.tree === 'charred';
    pr.chopped = now() + 300000;
    w.life.chopped[`${pr.x},${pr.y}`] = pr.chopped;
    w.tiles[pr.y * w.tw + pr.x] = T_FLOOR;
    const x = pr.x * TILE + 8, y = pr.y * TILE + 6, tier = toolTier(w, 'axe');
    if (burnt) { addGood(w, 'coal', rng.int(1, 2), x, y); addGood(w, 'wood', 1, x, y); }
    else if (pr.tree === 'cactus' || pr.tree === 'dead') addGood(w, 'wood', rng.int(1, 2), x, y);
    else {
      addGood(w, 'wood', rng.int(2, 3) + (tier >= 3 ? 1 : 0) + (w.hasKnack('lumber') && rng.chance(0.3) ? 1 : 0), x, y);
      if (tier >= 2 && HARD_TREES.has(pr.tree)) addGood(w, 'hardwood', rng.int(1, 2), x, y);
      if (pr.tree === 'oak' && pr.v === 3) addGood(w, 'berry', 2, x, y); // 열매가 달린 나무
    }
    w.emit({ t: 'treeFall', x, y: y - 20, kind: pr.tree, burnt });
    w.knack('chop');
    w.signals.push({ t: 'save' });
  } else if (gth.kind === 'shovel') {
    gth.done = true;
    tg.depleted = true; tg.respawnAt = now() + 480000;
    if (tg.key) w.life.nodes[tg.key] = tg.respawnAt;
    const found = digLoot(w, tg, gth.power);
    if (w.hasKnack('digger') && rng.chance(0.25)) found.push(...digLoot(w, tg, gth.power)); // 숙련 「발굴가」
    for (const [id, n] of found) addGood(w, id, n, tg.x, tg.y - 2);
    w.knack('dig');
    w.emit({ t: 'digDone', x: tg.x, y: tg.y });
    w.signals.push({ t: 'save' });
  }
}

// 땅 파기: 지역에 따라 나오는 것이 다르다 (삽이 좋을수록 귀한 것이 자주, 두 가지씩)
function biomeAt(w, x, y) {
  const m = w.map;
  if (!m.outdoor) return w.zone?.id || 'cave';
  const k = Math.floor(y / TILE) * w.tw + Math.floor(x / TILE), r = m.regions?.[k];
  if (r === BIOME_LIST.length + 1) return 'coast';
  return BIOME_LIST[m.biome?.[k]]?.id || 'plains';
}
function digLoot(w, tg, tier) {
  const rng = w.rng, bk = biomeAt(w, tg.x, tg.y), rare = tier >= 4 ? 2 : tier >= 2 ? 1.3 : 1;
  const table = [...DIG_BASE.map(([id, x]) => [id, ['oldCoin', 'gem', 'artifact', 'seed'].includes(id) ? x * rare : x]), ...(DIG_BIOME[bk] || [])];
  const out = [];
  for (let roll = 0; roll < (tier >= 3 ? 2 : 1); roll++) {
    let id = weighted(rng, table);
    if (id === 'artifact') {
      const art = Object.keys(ARTIFACTS).find((a) => ARTIFACTS[a].biome === bk && !w.life.artifacts[a]);
      if (art) { w.life.artifacts[art] = true; w.emit({ t: 'artifact', id: art, x: tg.x, y: tg.y }); w.signals.push({ t: 'codex' }); continue; }
      id = 'oldCoin';
    }
    if (id === 'seed') id = rng.chance(0.12) ? 'starflowerSeed' : rng.pick(['turnipSeed', 'wheatSeed', 'carrotSeed', 'potatoSeed', 'strawberrySeed', 'pumpkinSeed']);
    if (id === 'gem') id = rng.pick(['ruby', 'sapphire', 'emerald']);
    out.push([id, id === 'worm' ? rng.int(1, 3) : id === 'clay' || id === 'stone' || id === 'bone' ? rng.int(1, 2) : 1]);
  }
  return out;
}

// ───── 낚시 ─────
// 물 종류: 바다(섬 밖) · 늪 · 용암 · 호수(거울 호수 · 연못) · 강 · 동굴 물 · 용궁
function waterType(w, k) {
  const m = w.map;
  if (!m.outdoor) return w.zone?.id === 'palace' ? 'palace' : w.zone?.liquid === 'lava' ? 'lava' : w.zone?.liquid === 'water' || w.zone?.liquid === 'mist' ? 'cave' : null;
  const g = m.ground[k];
  if (g === G.LAVA) return 'lava';
  if (g === G.BOG) return 'bog';
  if (m.biome?.[k] < 0) return 'sea';
  const x = k % w.tw, y = Math.floor(k / w.tw);
  if (Math.hypot((x - OW.LAKE.x) / (OW.LAKE.rx + 4), (y - OW.LAKE.y) / (OW.LAKE.ry + 4)) < 1 || BIOME_LIST[m.biome[k]]?.id === 'jungle') return 'fresh';
  return 'river';
}
export function fishSpot(w) {
  const p = w.player, isWater = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= w.tw || ty >= w.th) return null; const k = ty * w.tw + tx, t = w.tiles[k]; return (t === T_DEEP || t === T_LIQUID) ? k : null; };
  let k = null;
  for (const d of [14, 24, 34]) { k = isWater(p.x + p.aimX * d, p.y + p.aimY * d); if (k != null) break; }
  if (k == null) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { k = isWater(p.x + dx * 14, p.y + dy * 14); if (k != null) break; }
  if (k == null) return null;
  const water = waterType(w, k);
  if (!water) return null;
  // 찌를 던질 곳: 바라보는 쪽으로 물 위 가장 먼 칸 (최대 3칸)
  let bx = (k % w.tw) * TILE + 8, by = Math.floor(k / w.tw) * TILE + 8;
  const dx = Math.sign(Math.round(p.aimX * 2)), dy = Math.sign(Math.round(p.aimY * 2));
  for (let i = 1; i <= 2; i++) { const kk = isWater(bx + dx * TILE, by + dy * TILE); if (kk == null || waterType(w, kk) !== water) break; bx += dx * TILE; by += dy * TILE; }
  return { x: bx, y: by, water, k };
}
// 먼바다: 찌 둘레로 몇 칸이나 물뿐인가 (뭍에서 멀수록 큰 물고기 · 귀한 물고기가 잘 문다)
export function seaDepth(w, k) {
  const x0 = k % w.tw, y0 = Math.floor(k / w.tw);
  for (let r = 1; r <= 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= w.tw || y >= w.th) continue;
    const t = w.tiles[y * w.tw + x];
    if (t !== T_DEEP && t !== T_LIQUID) return r - 1;
  }
  return 9;
}
function startFishing(w, act) {
  const p = w.player, tier = toolTier(w, 'rod');
  if (!tier) { w.emit({ t: 'text', x: p.x, y: p.y - 24, text: '낚싯대가 필요하다', color: '#ffb08a' }); return; }
  if (act.water === 'lava' && tier < 4) { w.emit({ t: 'text', x: p.x, y: p.y - 24, text: '용암에는 화염 낚싯대가 필요하다', color: '#ffb08a' }); return; }
  const bait = (w.life.bag.worm || 0) > 0;
  if (bait) w.life.bag.worm--;
  p.dir = act.x >= p.x ? 1 : -1;
  const deep = act.water === 'sea' ? Math.max(0, Math.min(1, (seaDepth(w, Math.floor(act.y / TILE) * w.tw + Math.floor(act.x / TILE)) - 3) / 4)) : 0; // 0 바닷가 ~ 1 먼바다
  p.fish = { phase: 'cast', t: 0, sx: p.x, sy: p.y, bx: act.x, by: act.y, water: act.water, bait, tier, deep, wait: w.rng.range(1.6, 5.5) * (bait ? 0.55 : 1) * (1 - 0.45 * deep) * (w.hasKnack('angler') ? 0.75 : 1), nibble: 0 };
  w.emit({ t: 'fishCast', x: act.x, y: act.y });
  if (deep >= 0.5 && !w.deepTold) { w.deepTold = true; w.emit({ t: 'text', x: p.x, y: p.y - 26, text: '먼바다: 큰 물고기가 잘 문다', color: '#9fd8ff' }); }
}
function pickFish(w, f) {
  const rng = w.rng, bk = biomeAt(w, f.bx, f.by);
  const nearPalace = w.map.outdoor && w.map.entrances?.palace && Math.hypot(f.bx / TILE - w.map.entrances.palace.x, f.by / TILE - w.map.entrances.palace.y) < 16;
  const rareMul = (f.bait ? 1.4 : 1) * (f.tier >= 3 ? 1.5 : 1) * (1 + w.modAdd('luck')) * (1 + 1.2 * (f.deep || 0)); // 음식 '행운' · 먼바다도 귀한 물고기를 부른다
  const night = w.night; // 밤에만 무는 물고기
  const list = Object.entries(FISH).filter(([, d]) => d.water.includes(f.water) && (!d.biome || d.biome.includes(bk)) && (!d.near || nearPalace || f.water === 'palace') && (!d.time || (d.time === 'night') === night))
    .map(([id, d]) => [id, d.w * (d.w <= 6 || d.beat >= 4 ? rareMul : 1)]);
  const junk = f.water === 'lava' || f.water === 'cave' ? [] : FISH_JUNK.map(([id, x]) => [id, x * (f.bait ? 0.5 : 1) * (1 - 0.7 * (f.deep || 0))]); // 먼바다엔 잡동사니가 적다
  return weighted(rng, [...list, ...junk]);
}
// ───── 리듬 낚시: 물고기마다 박자가 다르다. 둥근 박이 원에 닿을 때 G · Space · 클릭 ─────
// 난이도(beat 1~5)에 따라 빠르기와 박 수가 늘고, 모양(style)에 따라 박자가 달라진다. 목숨(낚싯줄)이 남은 채로 끝까지 가면 잡힌다.
export const BEAT_LEVEL = { 1: { bpm: 78, n: 6 }, 2: { bpm: 88, n: 8 }, 3: { bpm: 98, n: 10 }, 4: { bpm: 108, n: 12 }, 5: { bpm: 120, n: 15 } };
export const JUDGE = { perfect: 0.085, good: 0.18 }; // 판정 폭 (초)
export function makeChart(rng, fish) {
  const lv = BEAT_LEVEL[fish.beat] || BEAT_LEVEL[1], spb = 60 / lv.bpm, gaps = [];
  while (gaps.length < lv.n - 1) {
    const r = rng.next(), hard = fish.beat >= 2;
    if (fish.style === 'dart' && hard && r < 0.34) gaps.push(0.5, 1);                 // 톡톡 빠른 두 번
    else if (fish.style === 'erratic' && hard && r < 0.34) gaps.push(1.5, 0.5);       // 엇박
    else if (fish.style === 'sink' && r < 0.3) gaps.push(2);                           // 한 박 쉬고
    else if (fish.style === 'wave' && hard && r < 0.4) gaps.push(0.5, 1.5);           // 길고 짧게
    else if (fish.beat >= 5 && r < 0.18) gaps.push(0.5, 0.5, 1);                       // 전설: 세 번 연타
    else gaps.push(1);
  }
  gaps.length = lv.n - 1;
  let b = 2; const beats = [b]; // 두 박 세고 시작
  for (const g of gaps) { b += g; beats.push(b); }
  return { bpm: lv.bpm, spb, notes: beats.map((x) => ({ t: x * spb, b: x, hit: null })), end: (b + 1) * spb };
}
function updateFishing(w, inp) {
  const p = w.player, f = p.fish, dt = 1 / 60;
  f.t += dt;
  const cancel = () => { p.fish = null; w.emit({ t: 'fishEnd', ok: false }); };
  const tap = !!(inp.interact || inp.dash || inp.wskill || (inp.attack && !f.prevAtk));
  f.prevAtk = !!inp.attack;
  // 기다리는 동안 움직이면 낚싯줄을 거둔다
  if ((f.phase === 'wait' || f.phase === 'bite') && (inp.moveX || inp.moveY)) { cancel(); return; }
  if (f.phase === 'cast') { if (f.t >= 0.45) { f.phase = 'wait'; f.t = 0; w.emit({ t: 'fishSplash', x: f.bx, y: f.by, small: true }); } return; }
  if (f.phase === 'wait') { // 일찍 눌러도 괜찮다 (아무 일도 없다)
    if (f.t > 0.8 && w.rng.chance(dt * 0.6)) { f.nibble = 0.25; w.emit({ t: 'fishNibble', x: f.bx, y: f.by }); }
    if (f.nibble > 0) f.nibble -= dt;
    if (f.t >= f.wait) { f.phase = 'bite'; f.t = 0; f.catch = pickFish(w, f); w.emit({ t: 'fishBite', x: f.bx, y: f.by }); }
    return;
  }
  if (f.phase === 'bite') {
    if (tap) {
      const d = FISH[f.catch];
      if (!d) { finishCatch(w, f); return; } // 잡동사니는 바로 걸려 나온다
      f.phase = 'rhythm'; f.t = 0;
      f.chart = makeChart(w.rng, d);
      f.lives = f.maxLives = 3 + (f.tier >= 2 ? 1 : 0) + (f.tier >= 4 ? 1 : 0);
      f.good = JUDGE.good + 0.015 * (f.tier - 1);
      f.beatI = 0; f.perfect = 0; f.hits = 0; f.combo = 0;
      w.emit({ t: 'fishHook', x: f.bx, y: f.by, beat: d.beat });
      return;
    }
    if (f.t > 1.5 + 0.1 * (f.tier - 1)) { cancel(); w.emit({ t: 'text', x: p.x, y: p.y - 26, text: '놓쳤다… 찌가 가라앉으면 G', color: '#a8b8d0' }); }
    return;
  }
  if (f.phase === 'rhythm') {
    const ch = f.chart;
    // 박마다 똑딱 (처음 두 박은 세기)
    while (f.t >= f.beatI * ch.spb && f.beatI * ch.spb < ch.end) { w.emit({ t: 'beatTick', i: f.beatI, count: f.beatI < 2 }); f.beatI++; }
    // 누르면: 가장 가까운 아직 안 친 박을 판정 (너무 이르면 아무 일 없음)
    if (tap) {
      let best = null, bd = 1e9;
      for (const n of ch.notes) { if (n.hit) continue; const d = Math.abs(f.t - n.t); if (d < bd) { bd = d; best = n; } if (n.t > f.t + 1) break; }
      if (best && bd <= f.good) {
        best.hit = bd <= JUDGE.perfect ? 'perfect' : 'good';
        f.hits++; f.combo++; if (best.hit === 'perfect') f.perfect++;
        w.emit({ t: 'beatHit', grade: best.hit, idx: ch.notes.indexOf(best), combo: f.combo, x: f.bx, y: f.by });
      }
    }
    // 지나간 박은 놓침 → 낚싯줄 하나
    for (const n of ch.notes) {
      if (n.hit || f.t <= n.t + f.good) continue;
      n.hit = 'miss'; f.lives--; f.combo = 0;
      w.emit({ t: 'beatMiss', idx: ch.notes.indexOf(n), x: f.bx, y: f.by });
      if (f.lives <= 0) { p.fish = null; w.emit({ t: 'fishEnd', ok: false, snapped: true }); w.emit({ t: 'text', x: p.x, y: p.y - 26, text: '낚싯줄이 끊어졌다…', color: '#a8b8d0' }); return; }
    }
    if (f.t >= ch.end && ch.notes.every((n) => n.hit)) finishCatch(w, f);
  }
}
function finishCatch(w, f) {
  const p = w.player, id = f.catch, d = FISH[id];
  p.fish = null;
  w.knack('fish');
  if (id === 'bottleLetter') { // 유리병 편지: 오래된 기록 한 장
    const text = LORES[w.rng.int(0, LORES.length - 1)];
    w.signals.push({ t: 'lore', text, bottle: true });
    if (w.codex && !(w.codex.lore || []).includes(text)) { (w.codex.lore ||= []).push(text); w.signals.push({ t: 'codex' }); }
    w.emit({ t: 'fishEnd', ok: true, id, x: p.x, y: p.y });
    return;
  }
  let size = 0;
  if (d) {
    // 박자를 잘 맞출수록 큰 물고기 (모두 '완벽'이면 크게)
    const total = f.chart?.notes.length || 1, pr = (f.perfect || 0) / total, allPerfect = f.chart && f.perfect === total;
    const k = Math.min(1, Math.pow(w.rng.next(), 1.6) * 0.7 + pr * 0.45 + 0.18 * (f.deep || 0)); // 먼바다 물고기는 더 크다
    size = Math.round(d.size[0] + (d.size[1] - d.size[0]) * k);
    const log = w.life.fishLog[id] ||= { n: 0, best: 0 };
    const first = !log.n;
    log.n++;
    const record = size > log.best;
    if (record) log.best = size;
    if (first) w.signals.push({ t: 'codex' });
    w.emit({ t: 'fishEnd', ok: true, id, size, first, record: record && !first, allPerfect, x: p.x, y: p.y });
  } else w.emit({ t: 'fishEnd', ok: true, id, x: p.x, y: p.y });
  if (!bagAdd(w.life, id, 1)) w.emit({ t: 'text', x: p.x, y: p.y - 30, text: '가방이 가득 차서 놓아주었다', color: '#ffb0a0' });
  w.signals.push({ t: 'save' });
}

// ───── 농사: 마을 텃밭 (갈기 → 심기 → 물 주기 → 자라기 → 수확) ─────
function inFarm(w, x, y) { const f = w.farmRect; return !!f && x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1; }
// 물을 준 뒤 stageSec초가 지나면 한 단계 자란다 (다 자라면 그대로)
export function growPlot(pl) {
  const c = CROPS[pl.crop];
  if (!c || !pl.wateredAt) return;
  if (pl.stage < c.stages && now() >= pl.wateredAt + c.stageSec * 1000) { pl.stage++; pl.wateredAt = null; } // 다음 단계는 다시 물을 줘야 한다
}
function farmTile(w) {
  const p = w.player, tx = Math.floor((p.x + p.aimX * 10) / TILE), ty = Math.floor((p.y + 2 + p.aimY * 10) / TILE);
  if (inFarm(w, tx, ty)) return [tx, ty];
  const ux = Math.floor(p.x / TILE), uy = Math.floor((p.y + 2) / TILE);
  return inFarm(w, ux, uy) ? [ux, uy] : null;
}
function farmAction(w) {
  if (!w.farmRect) return null;
  const ft = farmTile(w);
  if (!ft) return null;
  const [x, y] = ft, key = `${x},${y}`, pl = w.life.farm[key], cx = x * TILE + 8, cy = y * TILE + 8;
  const base = { x: cx, y: cy, tx: x, ty: y, key };
  if (!pl) return { kind: 'till', ...base, label: toolTier(w, 'hoe') ? '밭 갈기' : '괭이가 필요하다' };
  const c = CROPS[pl.crop];
  if (!pl.crop) {
    const seed = pickSeed(w);
    return { kind: 'plant', ...base, seed, label: seed ? `${GOODS[seed].name} 심기 (${w.life.bag[seed]}개 · X로 바꾸기)` : '씨앗이 없다 (잡화점에서 산다)' };
  }
  if (pl.stage >= c.stages) return { kind: 'harvest', ...base, label: `${c.name} 수확하기` };
  if (!pl.wateredAt) return { kind: 'water', ...base, label: toolTier(w, 'can') ? `물 주기 (${c.name} ${pl.stage + 1}/${c.stages}단계)` : '물뿌리개가 필요하다' };
  const left = Math.max(0, Math.ceil((pl.wateredAt + c.stageSec * 1000 - now()) / 1000));
  return { kind: 'wait', ...base, label: `${c.name} 자라는 중 · ${left}초` };
}
// 심을 씨앗: 고른 것이 있으면 그것, 없으면 가진 씨앗 중 첫 번째
export function pickSeed(w) {
  const bag = w.life.bag, cur = w.life.farmOpts.seed;
  if (cur && bag[cur] > 0) return cur;
  return Object.keys(CROPS).map((c) => c + 'Seed').find((s) => bag[s] > 0) || null;
}
export function cycleSeed(w) {
  const bag = w.life.bag, own = Object.keys(CROPS).map((c) => c + 'Seed').filter((s) => bag[s] > 0);
  if (!own.length) return null;
  const i = own.indexOf(pickSeed(w));
  w.life.farmOpts.seed = own[(i + 1) % own.length];
  return w.life.farmOpts.seed;
}
// 괭이 · 물뿌리개는 단계가 오르면 여러 칸을 한 번에
function areaTiles(w, x, y, tier) {
  const p = w.player, out = [[x, y]];
  if (tier >= 2) { const horiz = Math.abs(p.aimX) < Math.abs(p.aimY); for (const d of [-1, 1]) out.push(horiz ? [x + d, y] : [x, y + d]); }
  if (tier >= 3) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!out.some(([a, b]) => a === x + dx && b === y + dy)) out.push([x + dx, y + dy]);
  return out.filter(([a, b]) => inFarm(w, a, b));
}
function farmDo(w, act) {
  const p = w.player, farm = w.life.farm;
  p.dir = act.x >= p.x ? 1 : -1;
  if (act.kind === 'till') {
    const tier = toolTier(w, 'hoe');
    if (!tier) { w.emit({ t: 'text', x: act.x, y: act.y - 16, text: '괭이가 필요하다', color: '#ffb08a' }); return; }
    let n = 0;
    for (const [x, y] of areaTiles(w, act.tx, act.ty, tier)) { const k = `${x},${y}`; if (!farm[k] && Math.hypot(p.x - (x * TILE + 8), p.y - (y * TILE + 8)) > 6) { farm[k] = { crop: null, stage: 0, wateredAt: null }; n++; w.emit({ t: 'farmTill', x: x * TILE + 8, y: y * TILE + 8 }); } }
    if (n) { p.gather = { kind: 'hoe', target: act, t: 0, dur: 0.4, done: true, hit: true }; w.signals.push({ t: 'save' }); }
  } else if (act.kind === 'plant') {
    const seed = act.seed;
    if (!seed) { w.emit({ t: 'text', x: act.x, y: act.y - 16, text: '씨앗이 없다 · 잡화점에서 산다', color: '#ffb08a' }); return; }
    w.life.bag[seed]--;
    farm[act.key] = { crop: GOODS[seed].crop, stage: 0, wateredAt: null };
    w.emit({ t: 'farmPlant', x: act.x, y: act.y, crop: GOODS[seed].crop });
    p.gather = { kind: 'hand', target: act, t: 0, dur: 0.3, done: true, hit: true };
    w.signals.push({ t: 'save' });
  } else if (act.kind === 'water') {
    const tier = toolTier(w, 'can');
    if (!tier) { w.emit({ t: 'text', x: act.x, y: act.y - 16, text: '물뿌리개가 필요하다', color: '#ffb08a' }); return; }
    const t = now();
    for (const [x, y] of areaTiles(w, act.tx, act.ty, tier)) { const pl = farm[`${x},${y}`]; if (pl?.crop && !pl.wateredAt && pl.stage < CROPS[pl.crop].stages) { pl.wateredAt = t; w.emit({ t: 'farmWater', x: x * TILE + 8, y: y * TILE + 8 }); } }
    p.gather = { kind: 'can', target: act, t: 0, dur: 0.55, done: true, hit: true };
    w.signals.push({ t: 'save' });
  } else if (act.kind === 'harvest') {
    const pl = farm[act.key], c = CROPS[pl.crop], n = w.rng.int(c.yield[0], c.yield[1]) + (w.hasKnack('farmer') && w.rng.chance(0.3) ? 1 : 0);
    w.knack('harvest');
    addGood(w, pl.crop, n, act.x, act.y - 4);
    if (w.rng.chance(0.08)) addGood(w, pl.crop + 'Seed', 1, act.x, act.y - 4); // 가끔 씨앗도 남는다
    w.emit({ t: 'farmHarvest', x: act.x, y: act.y, crop: pl.crop });
    if (c.regrow) { pl.stage = c.stages - c.regrow; pl.wateredAt = null; }
    else farm[act.key] = { crop: null, stage: 0, wateredAt: null }; // 갈아 둔 밭은 남는다
    p.gather = { kind: 'hand', target: act, t: 0, dur: 0.3, done: true, hit: true };
    w.signals.push({ t: 'save' });
  }
}
