// 항해: 배 갑판 세계에서 시간이 흘러 도착하고, 해적 · 바다뱀이 오르면 싸우는 동안 배가 멈추는지
import { computeBuild } from '../../public/js/sim/build.js';
import { World, DT } from '../../public/js/sim/world.js';
import { SHIP_ZONE, buildShipDeck } from '../../public/js/data/maps/ship.js';
import { SEA_EVENTS, PORTS, buyPrice, sellPrice, noteTrade } from '../../public/js/data/trade.js';

const b = computeBuild({ race: 'knight', level: 15, alloc: { str: 20, vit: 10 }, engravings: {}, gear: {} });
let ok = true;
for (const kind of [null, 'pirates', 'serpent']) {
  const w = new World({ build: b, mode: 'field', zone: SHIP_ZONE, zoneId: 'ship', seed: 5, map: buildShipDeck() });
  w.voyage = { from: 'portS', to: 'portE', t: 0, dur: 60, eventAt: 20, events: kind ? { [kind]: { ...SEA_EVENTS[kind], chance: 1 } } : {}, rolled: false, extra: 0 };
  const p = w.player;
  let ended = false, steps = 0, fought = false, won = false;
  while (!ended && steps < 60 * 400) {
    const foe = w.enemies.find((e) => !e.dead);
    w.step({ moveX: foe ? foe.x - p.x : 0, moveY: foe ? foe.y - p.y : 0, aimX: foe ? foe.x : p.x + 1, aimY: foe ? foe.y : p.y, attack: !!foe, s1: steps % 30 === 0 });
    for (const s of w.signals) {
      if (s.t === 'seaEvent') { w.spawnBoarders(kind, 15); fought = true; }
      if (s.t === 'voyageWon' || s.t === 'voyageLost') won = s.t;
      if (s.t === 'voyageEnd') ended = true;
    }
    w.signals.length = 0; w.events.length = 0; steps++;
    if (w.state !== 'play') { console.log('state', w.state); break; }
  }
  const secs = steps * DT;
  console.log(kind || 'calm', 'ended', ended, 'secs', secs.toFixed(1), 'fought', fought, won || '', 'extra', w.voyage.extra.toFixed(1));
  if (!ended || (kind && !won) || (!kind && Math.abs(secs - 60) > 1)) ok = false;
}
// 시세: 사면 오르고 팔면 내린다
const save = {};
const b0 = buyPrice(save, 'portS', 'windWheat'); noteTrade(save, 'portS', 'windWheat', 'buy', 10); const b1 = buyPrice(save, 'portS', 'windWheat');
const s0 = sellPrice(save, 'portE', 'windWheat'); noteTrade(save, 'portE', 'windWheat', 'sell', 10); const s1 = sellPrice(save, 'portE', 'windWheat');
console.log('wheat buy S', b0, '->', b1, ' sell E', s0, '->', s1, ' profit/unit', s0 - b0);
if (!(b1 > b0 && s1 < s0 && s0 > b0)) ok = false;
console.log(ok ? 'VOYAGE OK' : 'VOYAGE FAIL');
