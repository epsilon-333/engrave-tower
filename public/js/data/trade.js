// 항구 · 배 · 교역: 섬마다 특산품과 시세가 다르다. 많이 팔면 떨어지고, 사 가면 오르고, 시간이 지나면 제자리로 돌아온다.
// 지금은 본섬의 두 항구(바람결 항구 · 안개 부두)만 열려 있고, 다른 섬 뱃길은 섬을 만들면서 하나씩 연다.
import { GOODS } from './goods.js';

// ── 교역품 (가방에 쌓이지만 몸에 지는 짐은 CARGO_CAP 개까지) ──
export const CARGO = {
  windWheat: { name: '바람결 밀 포대', price: 30, desc: '바람결 들판에서 거둔 밀. 동쪽 해안 마을에서 귀하다.', icon: { t: 'sac', c: ['#e8c880', '#c89a50', '#8a6a3a'] } },
  woolBale: { name: '양털 뭉치', price: 40, desc: '시작 평원 목장의 양털. 바닷바람이 찬 안개 부두에서 잘 팔린다.', icon: { t: 'cloth', c: ['#f4f0e8', '#d8d0c0', '#a89c88'] } },
  mistSalt: { name: '안개 소금', price: 26, desc: '물안개 해안의 염전에서 말린 소금. 남쪽 마을에선 늘 모자란다.', icon: { t: 'dust', c: ['#f4f8ff', '#c8d8e8', '#8aa0b8'] } },
  driedFish: { name: '말린 생선', price: 22, desc: '안개 부두 어부들이 말린 생선. 남쪽 항구 선원들이 좋아한다.', icon: { t: 'plateFish', c: ['#c8a070', '#8a6a4a', '#5a4030'] } },
  // 다른 섬 특산품 (뱃길이 열리면 그 섬에서 판다)
  iceCrystal: { name: '얼음 수정', price: 60, desc: '서리왕관 섬의 빙하에서 캔 수정. 붉은 모래 섬에서 아주 비싸다.', icon: { t: 'shard', c: ['#bfe8ff', '#ffffff', '#5aa0c8'] }, island: 'frost' },
  redSpice: { name: '붉은 향신료', price: 55, desc: '붉은 모래 섬 오아시스의 향신료. 추운 섬에서 귀하다.', icon: { t: 'dust', c: ['#e0582a', '#ffb060', '#8a2a10'] }, island: 'sand' },
  goldSilk: { name: '금빛 비단', price: 80, desc: '황금 돛 섬 상단이 들여오는 비단.', icon: { t: 'cloth', c: ['#ffe08a', '#e8b040', '#a8782a'] }, island: 'gold' },
  pirateRum: { name: '해적 럼주', price: 45, desc: '해골 군도에서 빚은 독한 술.', icon: { t: 'bottle', c: ['#8a4a2a', '#c87a3a', '#4a2a18'] }, island: 'skull' },
};
for (const [id, c] of Object.entries(CARGO)) GOODS[id] = { name: c.name, cat: 'cargo', price: c.price, desc: c.desc, icon: c.icon };
export const CARGO_CAP = 20; // 몸에 지는 교역품 (짐수레 · 배는 나중에)

// ── 항구: mult < 1 이면 그 항구 특산품(싸게 판다), > 1 이면 그 항구에서 귀한 물건(비싸게 사 준다) ──
export const PORTS = {
  portS: {
    name: '바람결 항구', where: '바람결 마을 남쪽 해안', master: '항구지기 오렌', trader: '교역상 미라',
    market: { windWheat: 0.6, woolBale: 0.65, mistSalt: 1.4, driedFish: 1.35, iceCrystal: 1.2, redSpice: 1.3, goldSilk: 1.25, pirateRum: 1.2 },
    routes: [
      { to: 'portE', fare: 30, time: 12, desc: '섬 남쪽 바다를 돌아 동쪽 해안으로' },
      { to: 'gold', fare: 60, closed: true }, { to: 'sand', fare: 90, closed: true },
    ],
  },
  portE: {
    name: '안개 부두', where: '물안개 해안 동쪽 끝', master: '선장 하겔', trader: '교역상 브린',
    market: { mistSalt: 0.6, driedFish: 0.6, windWheat: 1.35, woolBale: 1.3, iceCrystal: 1.25, redSpice: 1.4, goldSilk: 1.2, pirateRum: 1.3 },
    routes: [
      { to: 'portS', fare: 30, time: 12, desc: '섬 남쪽 바다를 돌아 남쪽 항구로' },
      { to: 'frost', fare: 80, closed: true }, { to: 'skull', fare: 70, closed: true },
    ],
  },
};
// 아직 만들지 않은 섬 (뱃길 목록에 「준비 중」으로 보인다)
export const ISLANDS = {
  gold: '황금 돛 섬 (황금 돛 연맹)', sand: '붉은 모래 섬 (모래바람 술탄국)', frost: '서리왕관 섬 (하얀 왕관 공국)', skull: '해골 군도 (해적 연합)',
};
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
  return Math.round(CARGO[id].price * m * (1 + STEP * (st.buy[id] || 0)));
}
// 항구가 사 주는 값(내가 파는 값)
export function sellPrice(save, portId, id) {
  const m = PORTS[portId].market[id];
  if (!m) return null;
  const st = marketState(save, portId);
  return Math.max(1, Math.round(CARGO[id].price * m * 0.85 * (1 - STEP * (st.sell[id] || 0))));
}
export function noteTrade(save, portId, id, side, n) {
  const st = marketState(save, portId);
  st[side][id] = Math.min(30, (st[side][id] || 0) + n);
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
