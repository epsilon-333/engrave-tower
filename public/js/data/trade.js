// 항구 · 배 · 교역: 섬마다 특산품과 시세가 다르다. 많이 팔면 떨어지고, 사 가면 오르고, 시간이 지나면 제자리로 돌아온다.
// 지금은 본섬의 두 항구(바람결 항구 · 안개 부두)만 열려 있고, 다른 섬 뱃길은 섬을 만들면서 하나씩 연다.
import { GOODS } from './goods.js';
import { TOWNS, priceMul, econOf } from './econ.js';

// ── 교역품 (가방에 쌓이지만 몸에 지는 짐은 CARGO_CAP 개까지) ──
export const CARGO = {
  windWheat: { name: '바람결 밀 포대', price: 30, desc: '바람결 들판에서 거둔 밀. 동쪽 해안 마을에서 귀하다.', icon: { t: 'sac', c: ['#e8c880', '#c89a50', '#8a6a3a'] } },
  woolBale: { name: '양털 뭉치', price: 40, desc: '시작 평원 목장의 양털. 바닷바람이 찬 안개 부두에서 잘 팔린다.', icon: { t: 'cloth', c: ['#f4f0e8', '#d8d0c0', '#a89c88'] } },
  mistSalt: { name: '안개 소금', price: 26, desc: '물안개 해안의 염전에서 말린 소금. 남쪽 마을에선 늘 모자란다.', icon: { t: 'dust', c: ['#f4f8ff', '#c8d8e8', '#8aa0b8'] } },
  driedFish: { name: '말린 생선', price: 22, desc: '안개 부두 어부들이 말린 생선. 남쪽 항구 선원들이 좋아한다.', icon: { t: 'plateFish', c: ['#c8a070', '#8a6a4a', '#5a4030'] } },
  royalWine: { name: '왕실 포도주', price: 50, desc: '왕도 아우렐리온 포도원의 붉은 술. 바다 건너 섬들에서 귀하게 친다.', icon: { t: 'bottle', c: ['#8a1a2a', '#c83a4a', '#4a0a14'] } },
  // 다른 섬 특산품 (뱃길이 열리면 그 섬에서 판다)
  iceCrystal: { name: '얼음 수정', price: 60, desc: '서리왕관 섬의 빙하에서 캔 수정. 붉은 모래 섬에서 아주 비싸다.', icon: { t: 'shard', c: ['#bfe8ff', '#ffffff', '#5aa0c8'] }, island: 'frost' },
  redSpice: { name: '붉은 향신료', price: 55, desc: '붉은 모래 섬 오아시스의 향신료. 추운 섬에서 귀하다.', icon: { t: 'dust', c: ['#e0582a', '#ffb060', '#8a2a10'] }, island: 'sand' },
  goldSilk: { name: '금빛 비단', price: 80, desc: '황금 돛 섬 상단이 들여오는 비단.', icon: { t: 'cloth', c: ['#ffe08a', '#e8b040', '#a8782a'] }, island: 'gold' },
  pirateRum: { name: '해적 럼주', price: 45, desc: '해골 군도에서 빚은 독한 술.', icon: { t: 'bottle', c: ['#8a4a2a', '#c87a3a', '#4a2a18'] }, island: 'skull' },
  // 밀수품: 녹트 하벤 암시장에서만 판다. 왕국 경비병에게 걸리면 빼앗긴다(나중에)
  blackPowder: { name: '화약 통', price: 70, desc: '녹타리스가 몰래 빚는 화약. 안개 부두 뒷골목에서 값을 쳐준다.', icon: { t: 'pot', c: ['#3a3a42', '#6a6a72', '#1a1a20'] }, contraband: true },
  forbiddenTome: { name: '금서', price: 90, desc: '왕국이 불태우라 명한 책. 바람결 항구의 몇몇 학자가 몰래 산다.', icon: { t: 'cloth', c: ['#4a2a5a', '#7a4a8a', '#2a1a3a'] }, contraband: true },
};
for (const [id, c] of Object.entries(CARGO)) GOODS[id] = { name: c.name, cat: 'cargo', price: c.price, desc: c.desc, icon: c.icon };
// 정치에 쓰는 물건 (증거)
GOODS.taxLedger = { name: '세금 장부', cat: 'junk', price: 60, desc: '세금 마차에서 훔친 장부. 녹트 하벤의 중개인이 산다 — 녹타리스 가입 증거.', icon: { t: 'cloth', c: ['#6a4a8a', '#c8a0ff', '#3a2a5a'] } };
GOODS.officialSeal = { name: '관리의 인장', cat: 'junk', price: 90, desc: '쓰러진 고위 관계자에게서 빼앗은 인장. 증거로도, 장물로도 쓴다.', icon: { t: 'crest', c: ['#ffd76a', '#c89a3a', '#6a4a1a'] } };
export const CARGO_CAP = 20; // 몸에 지는 교역품
// 내 배 (황금 돛 섬 조선소): 짐칸만큼 더 실을 수 있고, 배삯 없이 아는 항구 어디로든 빨리 간다
export const SHIPS = [
  { name: '작은 범선', price: 1500, hold: 20, speed: 0.75, desc: '돛 하나짜리 날렵한 배. 짐칸 20.' },
  { name: '중형 상선', price: 5000, hold: 60, speed: 0.7, desc: '돛 둘 · 넓은 짐칸 60. 상단 일에 알맞다.' },
  { name: '큰 갤리온', price: 15000, hold: 120, speed: 0.65, desc: '대포 구멍이 난 커다란 배. 짐칸 120. 해적질에도 쓸 만하다.' },
];
export const cargoCap = (save) => CARGO_CAP + (save.ship ? SHIPS[save.ship.tier].hold : 0);
// 상인 길드(황금 돛 연맹) 계급: 교역으로 번 돈(판 값 합계)으로 오른다 · 오를수록 교역소에서 더 받는다
export const GUILD_RANKS = [
  { name: '행상', need: 0, bonus: 0 }, { name: '상인', need: 3000, bonus: 0.03 }, { name: '대상인', need: 15000, bonus: 0.06 }, { name: '무역왕', need: 50000, bonus: 0.1 },
];
export const guildRank = (save) => { const r = save.trade?.revenue || 0; let k = 0; GUILD_RANKS.forEach((g, i) => { if (r >= g.need && save.trade?.joined) k = i; }); return save.trade?.joined ? k : -1; };

// ── 항구: mult < 1 이면 그 항구 특산품(싸게 판다), > 1 이면 그 항구에서 귀한 물건(비싸게 사 준다) ──
export const PORTS = {
  portS: {
    name: '바람결 항구', where: '바람결 마을 남쪽 해안', master: '항구지기 오렌', trader: '교역상 미라',
    market: { windWheat: 0.6, woolBale: 0.65, mistSalt: 1.4, driedFish: 1.35, iceCrystal: 1.2, redSpice: 1.3, goldSilk: 1.25, pirateRum: 1.2, forbiddenTome: 1.45 },
    routes: [
      { to: 'portE', fare: 30, time: 12, desc: '섬 남쪽 바다를 돌아 동쪽 해안으로' },
      { to: 'gold', fare: 60, time: 12, desc: '남쪽 바다 건너 상인 공화국으로' }, { to: 'sand', fare: 90, time: 12, desc: '남서쪽 뜨거운 바다를 건너 사막의 섬으로' },
    ],
  },
  portE: {
    name: '안개 부두', where: '물안개 해안 동쪽 끝', master: '선장 하겔', trader: '교역상 브린',
    market: { royalWine: 1.3, mistSalt: 0.6, driedFish: 0.6, windWheat: 1.35, woolBale: 1.3, iceCrystal: 1.25, redSpice: 1.4, goldSilk: 1.2, pirateRum: 1.3, blackPowder: 1.5 },
    routes: [
      { to: 'portS', fare: 30, time: 12, desc: '섬 남쪽 바다를 돌아 남쪽 항구로' },
      { to: 'frost', fare: 80, time: 12, desc: '북동쪽 얼음 바다를 건너 공국으로' }, { to: 'skull', fare: 70, time: 12, desc: '동쪽 암초 사이 해적 소굴로' },
    ],
  },
};
// 왕도 시장: 바다는 없지만 교역소는 있다 (밀수품은 받지 않는다). 왕실 포도주가 특산품, 사치품은 비싸게 사 준다
PORTS.capital = { name: '왕도 시장', where: '왕도 아우렐리온 남동쪽 시장', master: null, trader: '교역상 마틸드', inland: true,
  market: { royalWine: 0.6, windWheat: 0.95, woolBale: 1.0, mistSalt: 1.25, driedFish: 1.2, goldSilk: 1.5, redSpice: 1.4, iceCrystal: 1.3, pirateRum: 1.1 },
  routes: [] };
// 녹트 하벤 암시장: 밀수품을 싸게 팔고, 어떤 교역품이든 조금 싸게 사 준다 (장물도 묻지 않는다)
export const BLACK_MARKET = {
  noktBlack: {
    name: '녹트 하벤 암시장', trader: '장물아비 스크라', black: true,
    market: { blackPowder: 0.55, forbiddenTome: 0.55, windWheat: 0.95, woolBale: 0.95, mistSalt: 0.95, driedFish: 0.95, iceCrystal: 1.1, redSpice: 1.1, goldSilk: 1.1, pirateRum: 1.1 },
    routes: [],
  },
};
Object.assign(PORTS, BLACK_MARKET);
// 바다 건너 섬의 항구 (hidden: 기록을 모아야 열리는 뱃길)
const R = (to, fare, desc, extra = {}) => ({ to, fare, time: 12, desc, ...extra });
Object.assign(PORTS, {
  gold: { name: '황금 돛 섬', where: '황금 돛 연맹의 거대 항구', master: '항구장 마리넬', trader: '교역상 도로', island: true,
    market: { royalWine: 1.45, goldSilk: 0.6, iceCrystal: 1.3, redSpice: 1.35, pirateRum: 1.2, windWheat: 1.2, woolBale: 1.25, mistSalt: 1.2, driedFish: 1.1, blackPowder: 1.2 },
    routes: [R('portS', 60, '북쪽 바람결의 섬 남쪽 항구로'), R('sand', 70, '서쪽 사막의 섬으로'), R('skull', 60, '동쪽 해적 소굴로'), R('frost', 90, '북동쪽 얼음 섬으로')] },
  frost: { name: '서리왕관 섬', where: '하얀 왕관 공국의 얼음 항구', master: '항구 관리관 이스벤', trader: '교역상 니엘', island: true,
    market: { royalWine: 1.5, iceCrystal: 0.6, redSpice: 1.6, goldSilk: 1.3, pirateRum: 1.4, windWheat: 1.4, driedFish: 1.3, woolBale: 1.5, mistSalt: 1.2 },
    routes: [R('portE', 80, '남서쪽 바람결의 섬 안개 부두로'), R('gold', 90, '남쪽 상인 공화국으로'), R('mist', 120, '안개 속으로… 기록이 가리키는 뱃길', { hidden: true })] },
  sand: { name: '붉은 모래 섬', where: '모래바람 술탄국의 오아시스 항구', master: '항구 감독관 자이드', trader: '향신료 상인 라나', island: true,
    market: { royalWine: 1.35, redSpice: 0.6, iceCrystal: 1.9, goldSilk: 1.3, windWheat: 1.3, mistSalt: 1.4, pirateRum: 1.2, woolBale: 1.1, driedFish: 1.3 },
    routes: [R('portS', 90, '북동쪽 바람결의 섬 남쪽 항구로'), R('gold', 70, '동쪽 상인 공화국으로')] },
  skull: { name: '해골 군도', where: '해적 연합의 소굴 블랙코브', master: '부두 두목 갈고리 잭', trader: '장물아비 루시', island: true, lawless: true,
    market: { royalWine: 1.6, pirateRum: 0.6, blackPowder: 1.8, forbiddenTome: 1.6, goldSilk: 1.4, redSpice: 1.3, iceCrystal: 1.3, windWheat: 1.3, driedFish: 1.2, woolBale: 1.2 },
    routes: [R('portE', 70, '서쪽 바람결의 섬 안개 부두로'), R('gold', 60, '서남쪽 상인 공화국으로'), R('mist', 110, '안개 속으로… 기록이 가리키는 뱃길', { hidden: true })] },
  mist: { name: '안개 너머의 섬', where: '버려진 선착장', master: '겁먹은 뱃사공', trader: '', island: true, market: {},
    routes: [R('skull', 110, '안개를 빠져나가 해적 소굴로'), R('frost', 120, '안개를 빠져나가 얼음 섬으로')] },
});
export const ISLANDS = {};
export const destName = (id) => PORTS[id]?.name || ISLANDS[id] || id;

// ── 시세: 사면 오르고 팔면 내린다(한 개마다 3%), 2분마다 한 칸씩 제자리로 ──
const STEP = 0.03, RECOVER_MS = 120000;
export function marketState(save, portId) {
  const M = (save.market ||= { ports: {}, seen: {} });
  const st = (M.ports[portId] ||= { buy: {}, sell: {}, t: Date.now() });
  const steps = Math.floor((Date.now() - st.t) / RECOVER_MS);
  if (steps > 0) {
    for (const side of ['buy', 'sell']) for (const k of Object.keys(st[side])) { st[side][k] = Math.max(0, st[side][k] - steps); if (!st[side][k]) delete st[side][k]; }
    st.t += steps * RECOVER_MS;
  }
  return st;
}
// 항구가 파는 값(내가 사는 값) — 특산품만 판다
export function buyPrice(save, portId, id) {
  const m = PORTS[portId].market[id];
  if (!m || m >= 1) return null;
  const st = marketState(save, portId);
  return Math.round(CARGO[id].price * m * (1 + STEP * (st.buy[id] || 0)) * (TOWNS[portId] ? priceMul(save, portId, id) : 1)); // 마을 재고가 모자라면 비싸다
}
// 항구가 사 주는 값(내가 파는 값)
export function sellPrice(save, portId, id) {
  const m = PORTS[portId].market[id];
  if (!m) return null;
  const st = marketState(save, portId);
  const gb = guildRank(save) > 0 ? GUILD_RANKS[guildRank(save)].bonus : 0;
  return Math.max(1, Math.round(CARGO[id].price * m * (0.85 + gb) * (1 - STEP * (st.sell[id] || 0)) * (TOWNS[portId] ? priceMul(save, portId, id) : 1)));
}
export function noteTrade(save, portId, id, side, n) {
  const st = marketState(save, portId);
  st[side][id] = Math.min(30, (st[side][id] || 0) + n);
  if (TOWNS[portId]) { const S = econOf(save).stock[portId]; if (S[id] != null) S[id] = Math.max(0, Math.min(400, S[id] + (side === 'sell' ? n : -n))); } // 내가 사고팔면 그 마을 창고가 바뀐다
}
// 이 항구 시세를 기록해 둔다 (다른 항구 시세판에서 「지난번에 본 값」으로 보인다)
export function rememberPrices(save, portId) {
  const prices = {};
  for (const id of Object.keys(PORTS[portId].market)) prices[id] = { buy: buyPrice(save, portId, id), sell: sellPrice(save, portId, id) };
  (save.market.seen ||= {})[portId] = { t: Date.now(), prices };
}
export const cargoCount = (bag) => Object.keys(CARGO).reduce((a, id) => a + (bag[id] || 0), 0);

// ── 바다 사건: 항해 중 가끔 일어난다. 선택지만 보여 주고, 무엇을 고를지는 플레이어 몫 ──
export const SEA_EVENTS = {
  pirates: {
    title: '해적선이 다가온다', chance: 0.22,
    text: '검은 돛을 단 배가 옆으로 붙는다. 갈고리가 날아와 난간에 걸린다. 선원들이 칼을 뽑고, 해적 두목이 소리친다. "짐 절반만 내놓으면 아무도 안 다친다!"',
    choices: [
      { id: 'fight', label: '맞서 싸운다', hint: '이기면 해적의 돈 · 명성. 지면 다치고 돈을 잃는다' },
      { id: 'join', label: '해적 편에 선다', hint: '다른 승객의 짐을 함께 턴다 · 악명' },
      { id: 'pay', label: '짐을 내준다', hint: '교역품 절반을 잃는다' },
    ],
  },
  serpent: {
    title: '바다뱀', chance: 0.12,
    text: '배 밑에서 거대한 그림자가 지나간다. 비늘 덮인 목이 물 위로 솟더니 돛대를 휘감으려 한다.',
    choices: [
      { id: 'fight', label: '작살을 들고 싸운다', hint: '이기면 바다뱀 비늘 · 명성. 지면 다친다' },
      { id: 'flee', label: '돛을 펴고 달아난다', hint: '안전하지만 아무것도 없다' },
    ],
  },
  merchantShip: {
    title: '짐을 가득 실은 상선', chance: 0, own: 0.2,
    text: '수평선에 황금 돛 연맹 깃발을 단 상선이 보인다. 짐칸이 무거워 느리다. 호위는 몇 명뿐이다.',
    choices: [
      { id: 'raid', label: '덮친다 (해적질)', hint: '호위를 쓰러뜨리면 교역품 · 돈. 악명 +10' },
      { id: 'pass', label: '지나친다', hint: '아무 일도 없다' },
    ],
  },
  castaway: {
    title: '표류자', chance: 0.12,
    text: '부서진 나무판에 매달린 사람이 손을 흔든다. 선장은 "시간이 빠듯한데…" 하며 당신을 본다.',
    choices: [
      { id: 'save', label: '건져 올린다', hint: '명성 · 고맙다며 무언가를 줄지도' },
      { id: 'pass', label: '지나친다', hint: '아무 일도 없다' },
    ],
  },
};
// 이길 확률: 레벨이 높을수록 (해적 Lv 10 기준)
export const seaWinChance = (level) => Math.max(0.2, Math.min(0.92, 0.35 + (level - 10) * 0.025));
