// 경제: 마을마다 창고(재고)가 있고, 생산과 소비로 늘고 준다. 값은 재고로 정해진다 — 모자라면 비싸고, 넘치면 싸다.
// 상단(진짜 상인 마차)이 남는 곳에서 사서 모자란 곳으로 나른다. 상단이 털리면 그 물건은 도착하지 않는다.
// 세금 마차가 왕도에 닿으면 왕실 금고가 차고, 털리면 비고, 금고가 비면 세금이 오른다 (사람들의 불만).
import { CARGO } from './trade.js';

// 마을(시장): 인구 · 만드는 것(시간당) · 쓰는 것(시간당 · 인구 1명당)
export const TOWNS = {
  portS: { name: '바람결 마을', pop: 30, make: { windWheat: 11, woolBale: 5 }, use: { mistSalt: 0.06, driedFish: 0.1, royalWine: 0.02 } },
  portE: { name: '안개 부두', pop: 22, make: { mistSalt: 6, driedFish: 9 }, use: { windWheat: 0.12, woolBale: 0.06, royalWine: 0.03 } },
  capital: { name: '왕도', pop: 60, make: { royalWine: 2 }, use: { windWheat: 0.12, driedFish: 0.08, mistSalt: 0.06, woolBale: 0.05 } },
};
export const ECON_GOODS = ['windWheat', 'woolBale', 'mistSalt', 'driedFish', 'royalWine'];
const TARGET = 60; // 이만큼 있으면 제값

export function econOf(save) {
  const E = (save.econ ||= { stock: {}, at: null, treasury: 2000, tax: 0.1, news: [] });
  for (const [t, T] of Object.entries(TOWNS)) { const S = (E.stock[t] ||= {}); for (const g of ECON_GOODS) if (S[g] == null) S[g] = T.make[g] ? TARGET * 1.6 : TARGET * 0.8; }
  return E;
}
// 값 배율: 재고가 적을수록 비싸다 (0.45 ~ 2.8배)
export function priceMul(save, town, good) {
  const E = econOf(save), S = E.stock[town]; if (!S || S[good] == null) return 1;
  return Math.max(0.45, Math.min(2.8, Math.pow(TARGET / Math.max(4, S[good]), 0.6)));
}
// 게임 시간이 흐른 만큼 생산 · 소비 (absMin: 게임 분)
export function econTick(save, absMin) {
  const E = econOf(save);
  if (E.at == null) { E.at = absMin; return; }
  let h = (absMin - E.at) / 60; if (h < 0.25) return;
  h = Math.min(h, 72); E.at = absMin;
  for (const [t, T] of Object.entries(TOWNS)) {
    const S = E.stock[t];
    for (const g of ECON_GOODS) {
      const made = (T.make[g] || 0) * h * (1 - E.tax * 0.5); // 세금이 높으면 덜 만든다 (일할 맛이 안 난다)
      const used = (T.use[g] || 0) * T.pop * h;
      S[g] = Math.max(0, Math.min(400, S[g] + made - used));
    }
  }
  // 눈에 안 보이는 곳에서도 상인들이 오간다: 마을 사이의 차이를 조금씩 메운다 (도적이 들끓으면 덜 메운다)
  const flow = Math.min(0.6, 0.1 * h) * (1 - Math.min(0.7, (E.banditry || 0) / 10));
  const ts = Object.keys(TOWNS);
  for (const g of ECON_GOODS) {
    const avg = ts.reduce((a, t) => a + E.stock[t][g], 0) / ts.length;
    for (const t of ts) E.stock[t][g] += (avg - E.stock[t][g]) * flow;
  }
  E.banditry = Math.max(0, (E.banditry || 0) - h * 0.2); // 습격 소문은 시간이 지나면 잦아든다
  // 왕실 금고: 세금이 조금씩 들어오고, 경비 월급으로 나간다
  E.treasury = Math.max(0, E.treasury + h * (E.tax * 120 - 9));
  if (E.treasury < 400 && E.tax < 0.35) { E.tax = Math.round((E.tax + 0.05) * 100) / 100; news(E, `왕실 금고가 비어 세금이 ${Math.round(E.tax * 100)}%로 올랐다`); }
  else if (E.treasury > 4000 && E.tax > 0.08) { E.tax = Math.round((E.tax - 0.03) * 100) / 100; news(E, `금고가 넉넉해져 세금이 ${Math.round(E.tax * 100)}%로 내렸다`); }
}
export function news(E, text) { E.news.unshift({ t: Date.now(), text }); E.news.length = Math.min(E.news.length, 20); }
// 상단: 가장 남는 곳에서 가장 모자란 곳으로 가장 이익 나는 물건을 고른다
export function planCaravan(save) {
  const E = econOf(save); let best = null;
  for (const a of Object.keys(TOWNS)) for (const b of Object.keys(TOWNS)) {
    if (a === b) continue;
    for (const g of ECON_GOODS) { const gain = priceMul(save, b, g) - priceMul(save, a, g); if (E.stock[a][g] > 30 && (!best || gain > best.gain)) best = { from: a, to: b, good: g, gain }; }
  }
  if (!best || best.gain < 0.15) return null;
  const n = Math.min(40, Math.floor(E.stock[best.from][best.good] * 0.4));
  E.stock[best.from][best.good] -= n;
  return { ...best, n };
}
export function deliver(save, cv) { const E = econOf(save); E.stock[cv.to][cv.good] = Math.min(400, E.stock[cv.to][cv.good] + cv.n); }
export function caravanLost(save, cv) { const E = econOf(save); E.banditry = (E.banditry || 0) + 2; news(E, `${TOWNS[cv.to].name}로 가던 ${CARGO[cv.good]?.name || cv.good} ${cv.n}개가 털렸다 — 값이 오를 것이다`); }
export function taxArrived(save, n) { const E = econOf(save); E.treasury += n; }
export function taxLost(save, n) { const E = econOf(save); E.treasury = Math.max(0, E.treasury - n * 0.5); news(E, '세금 마차가 털려 왕실 금고가 줄었다'); }
// 사람들 이야기에 쓰는 시장 소식 (가장 비싼 · 싼 것)
export function marketGossip(save) {
  const out = [];
  for (const [t, T] of Object.entries(TOWNS)) for (const g of ECON_GOODS) { const m = priceMul(save, t, g); if (m > 1.6) out.push(`${T.name}에 ${CARGO[g].name}이(가) 모자라 값이 ${m.toFixed(1)}배래.`); else if (m < 0.6) out.push(`${T.name}엔 ${CARGO[g].name}이(가) 남아돌아 헐값이래.`); }
  return out;
}
