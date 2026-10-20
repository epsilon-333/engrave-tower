// 종족 성지 마을: 커다란 상징물 · 주민의 집 · 하는 일이 보이는 주민 · 우두머리 · 수련장
// 바깥 세계를 다 만든 뒤 맨 끝에 놓는다 (앞에서 정한 상자 · 몬스터 자리와 '열어 본 것' 기억이 바뀌지 않게)
import { T_FLOOR, T_BUILD, TILE } from '../../sim/mapgen.js';
import { SANCT_LIFE } from '../sanctums.js';

// 상징물의 새 바닥 칸 [가로, 세로] (가운데 아래를 맞춘다). 그림은 이보다 훨씬 크게 그린다
const BIG = { worldTree: [7, 3], mageTower: [5, 4], castle: [15, 6], arena: [13, 7], mausoleum: [8, 5], guildHouse: [8, 5], nest: [10, 5], dragonNest: [11, 6] };
// 집 자리: 문 앞 기준 왼쪽 위 칸 (집 5×3)
const HOUSE_SPOTS = [[-17, 0], [13, 0], [-18, 8], [14, 8]];
// 마을 꾸밈: 길 바닥 · 둘레에 흩어 놓는 것
const LOOK = {
  wizard: { path: 'STONE', deco: [['crystalShard', 4], ['lamp', 2]] },
  elf: { path: 'DIRT', deco: [['flowerBed', 3], ['lamp', 3]] },
  knight: { path: 'COBBLE', deco: [['bannerPole', 3], ['hayBale', 2]] },
  orc: { path: 'CRACKED', deco: [['bonePile', 3], ['brazier', 2]] },
  undead: { path: 'STONE', deco: [['grave', 7], ['candles', 2]] },
  assassin: { path: 'COBBLE', deco: [['crates', 3], ['lamp', 2]] },
  dino: { path: 'DIRT', deco: [['fernBig', 4], ['bonePile', 2]] },
  dragon: { path: 'BLACKROCK', deco: [['brazier', 3], ['bonePile', 2]] },
};

export function buildSanctumVillages(c) {
  const { t, gr, G, occupied, props, chests, camps, nodes, digs, objects, waypoints, inb, I, removeTree, trees, prop, at, onPath } = c;
  const villages = {};
  const objTiles = [...objects.map((o) => ({ x: Math.floor(o.x / TILE), y: Math.floor(o.y / TILE) })), ...chests, ...(waypoints || []).map((w) => ({ x: w.tx, y: w.ty }))];
  const taken = (x, y) => objTiles.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1);
  const free = (x, y) => inb(x, y) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)];
  const area = (x0, y0, w, h, pad = 1) => { for (let y = y0 - pad; y < y0 + h + pad; y++) for (let x = x0 - pad; x < x0 + w + pad; x++) if (!free(x, y) || taken(x, y)) return false; return true; };
  for (const [race, door] of Object.entries(c.sanctums)) {
    const L = SANCT_LIFE[race], pr = props.find((p) => p.race === race && BIG[p.kind]);
    if (!L || !pr) continue;
    const O = { x: door.x, y: door.y }, look = LOOK[race];
    // 1) 마을 터: 나무를 베고, 둘레의 몬스터 무리 · 캐는 것 · 반짝이는 흙은 치운다
    const inVillage = (x, y) => x >= O.x - 22 && x <= O.x + 22 && y >= O.y - 3 && y <= O.y + 15;
    const nearTrunk = (x, y) => Math.abs(x - O.x) <= 9 && y >= pr.y - 3 && y < O.y;
    for (let y = O.y - 16; y <= O.y + 16; y++) for (let x = O.x - 24; x <= O.x + 24; x++) if (inb(x, y) && trees.has(I(x, y)) && (inVillage(x, y) || nearTrunk(x, y))) removeTree(x, y);
    for (let i = camps.length - 1; i >= 0; i--) if (Math.hypot(camps[i].x - O.x, camps[i].y - O.y) < 26) camps.splice(i, 1);
    for (const list of [nodes, digs]) for (let i = list.length - 1; i >= 0; i--) if (inVillage(list[i].x, list[i].y)) list.splice(i, 1);
    // 2) 상징물을 키운다 (가운데 아래를 맞추고, 비어 있는 만큼만 넓힌다)
    const [bw, bh] = BIG[pr.kind], bx = pr.x + (pr.w >> 1), by = pr.y + pr.h;
    for (let w = bw; w >= pr.w; w -= 2) {
      const x0 = bx - (w >> 1), y0 = by - Math.max(pr.h, bh);
      let ok = true;
      for (let y = y0; y < by && ok; y++) for (let x = x0; x < x0 + w && ok; x++) { const k = I(x, y); if (!inb(x, y) || (t[k] !== T_FLOOR && !(t[k] === T_BUILD && x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < by)) || taken(x, y) || (occupied[k] && !(x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < by))) ok = false; }
      if (!ok) continue;
      for (let y = y0; y < by; y++) for (let x = x0; x < x0 + w; x++) { t[I(x, y)] = T_BUILD; occupied[I(x, y)] = 1; }
      pr.x = x0; pr.y = y0; pr.w = w; pr.h = by - y0;
      break;
    }
    pr.big = true;
    // 3) 문 앞에서 남쪽으로 넓은 길 + 마을 마당
    const path = G[look.path] ?? G.DIRT;
    for (let y = O.y; y <= O.y + 14; y++) for (let x = O.x - 1; x <= O.x + 1; x++) if (inb(x, y) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)]) gr[I(x, y)] = path;
    for (let y = O.y - 1; y <= O.y + 2; y++) for (let x = O.x - 6; x <= O.x + 6; x++) if (inb(x, y) && t[I(x, y)] === T_FLOOR && !occupied[I(x, y)]) gr[I(x, y)] = path;
    // 4) 주민의 집 (비어 있는 자리만, 조금씩 비켜 가며)
    const houses = [];
    for (const [ox, oy] of HOUSE_SPOTS) {
      let spot = null;
      for (let r = 0; r <= 3 && !spot; r++) for (const [sx, sy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r]]) { const hx = O.x + ox + sx, hy = O.y + oy + sy; if (area(hx, hy, 5, 3)) { spot = { x: hx, y: hy }; break; } }
      if (!spot) continue;
      prop('house_res', spot.x, spot.y, 5, 3, { house: `res_${L.house}`, race, doorX: (spot.x + 2) * TILE + 8 });
      houses.push(spot);
      for (let y = spot.y + 3; y <= spot.y + 4; y++) if (inb(spot.x + 2, y) && t[I(spot.x + 2, y)] === T_FLOOR && !occupied[I(spot.x + 2, y)]) gr[I(spot.x + 2, y)] = path; // 집 앞 디딤돌
    }
    // 5) 주민 · 그들이 쓰는 것(과녁 · 룬석 · 모루 …)
    const near = (x, y) => { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (free(xx, yy) && !taken(xx, yy)) return { x: xx, y: yy }; } return null; };
    const residents = [];
    for (const [i, rd] of L.residents.entries()) {
      const s = near(O.x + rd.at[0], O.y + rd.at[1]);
      if (!s) continue;
      occupied[I(s.x, s.y)] = 1; objTiles.push(s);
      let pat = null;
      if (rd.pat) {
        const ps = near(O.x + rd.pat[0], O.y + rd.pat[1]);
        if (ps) { pat = ps; if (rd.prop) prop(rd.prop, ps.x, ps.y, 1, 1, { race }); else occupied[I(ps.x, ps.y)] = 1; objTiles.push(ps); }
      }
      residents.push({ i, ...at(s.x, s.y), pat: pat ? at(pat.x, pat.y) : null });
    }
    // 6) 우두머리 (수호자 맞은편) · 수련장 (마을 가운데 아래) · 수련 안내판
    const ls = near(O.x + 3, O.y) || near(O.x + 4, O.y + 1);
    if (ls) { occupied[I(ls.x, ls.y)] = 1; objTiles.push(ls); }
    const tc = { x: O.x, y: O.y + 10 };
    const board = near(O.x + 3, O.y + 6);
    if (board) { occupied[I(board.x, board.y)] = 1; objTiles.push(board); }
    for (const [dx, dy] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) { const s = near(tc.x + dx, tc.y + dy); if (s) { prop('stake', s.x, s.y, 1, 1, { race }); objTiles.push(s); } } // 수련장 네 귀퉁이 말뚝
    // 7) 둘레 꾸밈
    let seed = race.length * 97 + O.x * 13 + O.y * 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const [kind, n] of look.deco) for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const x = O.x + Math.round((rnd() - 0.5) * 40), y = O.y + Math.round(rnd() * 15) - 1;
      if (Math.abs(x - O.x) <= 2 || (Math.abs(x - tc.x) <= 7 && Math.abs(y - tc.y) <= 5) || !area(x, y, 1, 1, 1) || (onPath && onPath[I(x, y)])) continue;
      prop(kind, x, y, 1, 1, { race, v: k }); objTiles.push({ x, y }); k++;
    }
    villages[race] = {
      door: at(O.x, O.y), center: at(O.x, O.y - Math.max(4, pr.h)), houses: houses.map((h) => at(h.x + 2, h.y + 3)),
      leader: ls ? at(ls.x, ls.y) : null, board: board ? at(board.x, board.y) : null,
      train: { ...at(tc.x, tc.y), r: 5.5 * TILE }, residents,
    };
  }
  return villages;
}
