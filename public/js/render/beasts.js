// 새 몬스터 그림: 0x72 그림체에 맞춘 작은 픽셀 그림을 직접 찍는다 (짙은 테두리 · 위는 밝게 · 아래는 어둡게)
// 프레임마다 다리 · 날개 · 꼬리 · 몸이 따로 움직인다. pose: 'walk' | 'idle' | 'wind'(공격 예고) · f: 0~3
const OUT = '#141018';
const cache = new Map();

function makeP(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const P = {
    c, g, W, H,
    p(x, y, col) { if (x < 0 || y < 0 || x >= W || y >= H) return; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
    r(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    e(cx, cy, rx, ry, col) { // 꽉 찬 타원 (정수 픽셀)
      g.fillStyle = col;
      for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
        const k = 1 - ((y - cy) / ry) ** 2; if (k < 0) continue;
        const hw = rx * Math.sqrt(k); g.fillRect(Math.round(cx - hw), y, Math.max(1, Math.round(hw * 2)), 1);
      }
    },
    l(x0, y0, x1, y1, col) { // 1픽셀 선
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (;;) { P.p(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    },
  };
  return P;
}
// 그린 것 둘레에 1픽셀 짙은 테두리
function outline(P) {
  const { g, W, H } = P, d = g.getImageData(0, 0, W, H), a = d.data, out = g.createImageData(W, H), o = out.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > 40;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y) || !(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
    const i = (y * W + x) * 4; o[i] = 0x14; o[i + 1] = 0x10; o[i + 2] = 0x18; o[i + 3] = 255;
  }
  const t = document.createElement('canvas'); t.width = W; t.height = H; t.getContext('2d').putImageData(out, 0, 0);
  g.drawImage(t, 0, 0);
}
const sw = (f) => (f % 2 ? 1 : -1); // 다리 앞뒤
const legs = (P, list, f, col, y1, lift = 1) => list.forEach((x, i) => { const up = (i + f) % 2 ? lift : 0; P.r(x, y1 - 3, 1, 3 - up, col); P.p(x + (i % 2 ? 1 : -1) * 0, y1 - up - 1, col); });

const B = {
  // 독거미: 다리가 긴 보라 거미 · 배에 초록 무늬
  spider: { W: 27, H: 17, faceLeft: true, draw(P, f, pose) {
    const low = pose === 'wind' ? 2 : 0, by = 9 + low;
    for (let s = 0; s < 4; s++) { // 다리 8개 (양쪽 4개씩) · 마디가 위로 꺾인다
      const hip = 10 + s * 2.2, ph = (s + f) % 2 ? 1 : -1;
      for (const side of [-1, 1]) {
        const kx = hip + side * (3 + s), ky = 2 + low + (s % 2), fx = hip + side * (6 + s * 1.6) + ph * side, fy = 16;
        P.l(hip, by, kx, ky, '#5a2a78'); P.l(kx, ky, fx, fy, '#5a2a78'); P.p(kx, ky, '#b070e0'); P.p(fx, fy, '#2a0e3a');
      }
    }
    P.e(17, by - 1, 6.5, 5, '#5a2078'); P.e(17, by - 2, 5.5, 3.8, '#8a40b8'); P.e(16, by - 4, 3, 1.5, '#c88af0');
    P.p(16, by - 1, '#9be15d'); P.p(18, by, '#9be15d'); P.p(19, by - 2, '#9be15d'); P.p(15, by + 1, '#5ab040');
    P.e(9, by, 3.2, 3, '#4a1a68'); P.e(9, by - 1, 2.5, 2, '#7a3aa0');
    P.p(7, by - 1, '#ff3a3a'); P.p(8, by - 2, '#ff3a3a'); P.p(7, by + 1, '#ffd0d0');
    P.p(6, by + 2, '#e8dcc0'); P.p(8, by + 3, '#e8dcc0'); // 독니
  } },
  // 돌진 멧돼지: 큰 엄니 · 등 갈기 · 예고 때 몸을 낮춘다
  boar: { W: 27, H: 17, draw(P, f, pose) {
    const low = pose === 'wind' ? 2 : 0, bob = pose === 'walk' ? f % 2 : 0, by = 8 + low + bob;
    [[5, 0], [8, 1], [14, 1], [17, 0]].forEach(([x, o]) => { const k = pose === 'walk' ? ((f + o) % 2 ? 1 : -1) : 0; P.r(x, by + 3, 2, 13 - by - 3 + 3, '#3a2414'); P.r(x + k, 15, 2, 1, '#1e120a'); });
    P.e(11, by, 8, 5, '#5a3a20'); P.e(11, by - 1, 7, 4, '#8a5a34'); P.e(10, by - 3, 5, 1.5, '#a8743e');
    for (let x = 5; x <= 15; x += 2) P.r(x, by - 6 + (x % 4 ? 0 : 1), 1, 2, '#2a1a0e'); // 갈기
    P.e(19, by + 1 + low, 4, 3.5, '#7a4a2a'); P.e(19, by + low, 3, 2.5, '#9a6a3e');
    P.r(21, by + 1 + low, 3, 3, '#c89070'); P.p(23, by + 2 + low, '#5a3a2a'); // 코
    P.p(19, by - 1 + low, '#141018'); P.p(18, by - 3 + low, '#3a2414'); P.p(17, by - 3 + low, '#3a2414'); // 눈 · 귀
    P.l(21, by + 4 + low, 22, by + 1 + low, '#f0e8d0'); P.p(23, by + low, '#f0e8d0'); P.p(20, by + 4 + low, '#d0c8b0'); // 엄니
    P.l(3, by - 1, 1, by - 3 + bob, '#5a3a20'); // 꼬리
  } },
  // 얼음 늑대: 푸른 털 · 얼음 송곳니 · 등에 얼음 결정
  wolf: { W: 24, H: 16, draw(P, f, pose) {
    const low = pose === 'wind' ? 1 : 0, bob = pose === 'walk' ? f % 2 : 0, by = 8 + low + bob;
    const st = pose === 'walk' ? f : 0;
    [[6, 0], [9, 1], [15, 1], [18, 0]].forEach(([x, o]) => { const k = (st + o) % 2 ? 1 : -1; P.l(x, by + 3, x + k, 15, '#3a6a98'); P.p(x + k, 15, '#d0ecff'); });
    P.e(12, by, 7.5, 4, '#3a6a98'); P.e(12, by - 1, 6.5, 3, '#6a9ac8'); P.e(11, by - 2, 4.5, 1.3, '#a8d0f0'); P.e(12, by + 2, 4, 1.2, '#e8f4ff');
    P.p(9, by - 4, '#e8f8ff'); P.p(10, by - 5, '#bfe8ff'); P.p(13, by - 4, '#e8f8ff'); P.p(14, by - 5, '#bfe8ff'); // 얼음 결정
    P.l(4, by - 1, 1, by - 4 - bob, '#6a9ac8'); P.p(1, by - 5 - bob, '#e8f4ff'); // 꼬리
    P.e(20, by - 1, 3.5, 3, '#4a7aa8'); P.e(20, by - 2, 2.5, 2, '#8ab8e0');
    P.r(21, by - 1, 3, 2, '#8ab8e0'); P.p(23, by - 1, '#141018'); // 주둥이 · 코
    P.p(19, by - 5, '#4a7aa8'); P.p(20, by - 6, '#6a9ac8'); P.p(21, by - 5, '#4a7aa8'); // 귀
    P.p(20, by - 2, '#ffffff'); P.p(21, by - 2, '#3affff'); // 눈
    P.p(22, by + 1, '#e8f8ff'); P.p(23, by + 1, '#e8f8ff'); P.p(22, by + 2, '#bfe8ff'); // 얼음 송곳니
  } },
  // 화염 박쥐: 불꽃 날개가 위 · 가운데 · 아래로 퍼덕인다
  bat: { W: 22, H: 16, draw(P, f) {
    const flap = [-4, 0, 3, 0][f], cy = 8 + (f === 2 ? 1 : 0);
    for (const side of [-1, 1]) {
      const tipX = 11 + side * 10, tipY = cy + flap, midX = 11 + side * 6, midY = cy + flap * 0.6 - 1;
      for (let i = 0; i <= 6; i++) { const q = i / 6, x = 11 + side * (2 + q * 8), y = cy - 1 + (tipY - cy) * q; P.l(x, y, x - side * 1, y + 3 + (1 - q) * 2, i % 2 ? '#ff7a2a' : '#ffb040'); }
      P.l(11 + side * 2, cy - 1, midX, midY, '#5a1a10'); P.l(midX, midY, tipX, tipY, '#5a1a10');
      P.p(tipX, tipY + 1, '#ffe080'); P.p(midX, midY + 3, '#ffe080');
    }
    P.e(11, cy, 3, 3.2, '#3a1008'); P.e(11, cy - 1, 2.2, 2.2, '#6a2014');
    P.p(9, cy - 4, '#3a1008'); P.p(13, cy - 4, '#3a1008'); P.p(10, cy - 1, '#ffe040'); P.p(12, cy - 1, '#ffe040'); P.p(11, cy + 1, '#f0e8d0');
  } },
  // 독버섯: 큰 갓에 점박이 · 작은 눈과 다리
  shroom: { W: 18, H: 19, draw(P, f, pose) {
    const sq = pose === 'wind' ? 1 : pose === 'idle' && f % 2 ? 1 : 0, step = pose === 'walk' ? f % 2 : 0;
    P.r(6 - step, 16, 2, 2, '#c8b898'); P.r(10 + step, 16, 2, 2, '#c8b898'); // 다리
    P.e(9, 13, 4, 4, '#c8b898'); P.e(9, 12, 3.3, 3.5, '#e8dcc0');
    P.p(7, 12, '#141018'); P.p(11, 12, '#141018'); P.p(7, 11, '#ffffff'); P.p(11, 11, '#ffffff'); P.r(8, 14, 3, 1, '#7a6a5a');
    P.e(9, 6 + sq, 8.5, 5.5 - sq, '#5a1a6a'); P.e(9, 5 + sq, 7.5, 4.3 - sq, '#9a3ab0'); P.e(8, 3 + sq, 4.5, 1.6, '#c86ae0');
    for (const [x, y] of [[4, 5], [9, 3], [13, 6], [7, 7], [12, 3]]) { P.p(x, y + sq, '#d8f070'); P.p(x + 1, y + sq, '#b0d040'); }
    P.r(2, 9 + sq, 15, 1, '#3a0e48');
  } },
  // 바위 골렘: 각진 돌덩이 거인 · 이끼 · 빛나는 눈 · 예고 때 두 팔을 머리 위로
  rockGolem: { W: 24, H: 24, draw(P, f, pose) {
    const up = pose === 'wind', bob = pose === 'walk' ? f % 2 : 0, st = pose === 'walk' ? sw(f) : 0;
    P.r(7 - st, 19, 4, 5, '#4a4650'); P.r(13 + st, 19, 4, 5, '#4a4650'); P.r(7 - st, 19, 4, 1, '#7a7680'); P.r(13 + st, 19, 4, 1, '#7a7680'); // 다리
    P.r(5, 8 + bob, 14, 12, '#5a5660'); P.r(6, 8 + bob, 12, 10, '#7a7680'); P.r(6, 8 + bob, 12, 2, '#a09ca8');
    P.r(8, 12 + bob, 3, 1, '#4a4650'); P.r(13, 15 + bob, 4, 1, '#4a4650'); P.r(9, 16 + bob, 2, 1, '#4a4650'); // 갈라진 금
    P.p(6, 9 + bob, '#5a8a3a'); P.p(7, 9 + bob, '#7aaa4a'); P.p(16, 10 + bob, '#5a8a3a'); // 이끼
    P.r(8, 2 + bob, 8, 7, '#5a5660'); P.r(9, 2 + bob, 6, 5, '#8a8690'); P.r(9, 2 + bob, 6, 1, '#b0acb8');
    P.r(9, 5 + bob, 2, 1, '#ffb040'); P.r(13, 5 + bob, 2, 1, '#ffb040'); // 눈
    for (const side of [-1, 1]) { // 팔: 커다란 돌 주먹
      const ax = side < 0 ? 1 : 19, ay = up ? 0 + bob : 10 + bob + (pose === 'walk' ? side * st : 0);
      P.r(ax, ay, 4, 8, '#5a5660'); P.r(ax, ay, 4, 1, '#a09ca8'); P.r(ax - (side < 0 ? 1 : 0), ay + (up ? -2 : 7), 5, 4, '#6a6670'); P.r(ax - (side < 0 ? 1 : 0), ay + (up ? -2 : 7), 5, 1, '#9a96a0');
    }
  } },
  // 사막 전갈: 큰 집게 · 몸 위로 휘어 올라간 꼬리와 붉은 독침
  scorpion: { W: 28, H: 18, draw(P, f, pose) {
    const up = pose === 'wind' ? 2 : 0, by = 13, st = pose === 'walk' ? f % 2 : 0;
    for (let i = 0; i < 3; i++) for (const s of [0, 1]) { const x = 9 + i * 3, k = (i + st + s) % 2 ? 1 : -1; P.l(x, by + 1, x + k * 2, 17, '#6a4a22'); }
    P.e(12, by, 6, 3, '#7a5428'); P.e(12, by - 1, 5, 2, '#c8944e'); P.r(9, by - 2, 7, 1, '#e8c078');
    const tail = [[6, by - 1], [4, by - 4], [4, by - 7 - up], [6, by - 10 - up], [9, by - 11 - up]]; // 꼬리 마디
    tail.forEach(([x, y], i) => { P.e(x, y, 1.6, 1.6, '#7a5428'); P.p(x, y - 1, '#e8c078'); });
    P.l(10, by - 11 - up, 12, by - 9 - up, '#c02020'); P.p(12, by - 8 - up, '#ff5a3a'); // 독침
    const cl = pose === 'wind' ? 1 : f % 2; // 집게
    P.e(19, by - 1, 2, 1.5, '#7a5428'); P.e(22, by - 2, 2.5, 2, '#a8743e'); P.l(23, by - 4, 25, by - 3 - cl, '#7a5428'); P.l(23, by, 25, by - 1 + cl, '#7a5428');
    P.p(17, by - 2, '#141018'); P.p(18, by - 2, '#141018');
  } },
  // 망령: 보라 반투명 유령 · 두건 · 흔들리는 꼬리
  ghost: { W: 18, H: 22, draw(P, f) {
    const wv = [0, 1, 0, -1][f];
    for (let y = 9; y < 21; y++) { const w0 = 6 - (y - 9) * 0.4, x = 9 + Math.sin(y * 0.6 + f * 1.5) * (y - 9) * 0.15; P.r(x - w0, y, w0 * 2, 1, y % 3 ? '#7a4ac0' : '#6a3aa8'); }
    P.e(9, 8, 6, 6, '#6a3aa8'); P.e(9, 7, 5, 5, '#9a6ae0'); P.e(8, 5, 3, 2, '#c8a8ff');
    P.e(9, 8, 3.5, 3, '#1a0e2a'); P.p(8, 8, '#ffffff'); P.p(11, 8, '#ffffff'); P.p(8, 9, '#e0c8ff'); // 두건 속 얼굴
    P.l(3, 11, 1, 14 + wv, '#9a6ae0'); P.l(15, 11, 17, 14 - wv, '#9a6ae0'); P.p(1, 15 + wv, '#e0c8ff'); P.p(17, 15 - wv, '#e0c8ff'); // 팔
  } },
  // 가시 슬라임: 보라 몸 · 가시 여러 개 · 통통 튄다
  spikeSlime: { W: 20, H: 17, draw(P, f, pose) {
    const hop = pose === 'walk' ? [0, 2, 3, 1][f] : 0, sq = pose === 'wind' ? 2 : hop === 0 && pose === 'walk' ? 1 : 0, by = 12 - hop;
    for (const [a, l] of [[-2.6, 3], [-2.0, 4], [-1.4, 4], [-0.9, 4], [-0.4, 3], [-3.0, 2], [-0.1, 2]]) { const x0 = 10 + Math.cos(a) * 6, y0 = by + Math.sin(a) * (4 - sq * 0.5), x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; P.l(x0, y0, x1, y1, '#d8b8ff'); P.p(x1, y1, '#ffffff'); }
    P.e(10, by, 7 + sq, 4.5 - sq * 0.5, '#4a1a78'); P.e(10, by - 1, 6 + sq, 3.5 - sq * 0.5, '#8a3ad0'); P.e(8, by - 3, 3, 1, '#c88aff');
    P.p(8, by, '#141018'); P.p(12, by, '#141018'); P.p(8, by - 1, '#ffffff'); P.p(12, by - 1, '#ffffff'); P.r(9, by + 2, 2, 1, '#2a0a48');
  } },
  // 철갑 딱정벌레: 금속처럼 빛나는 등껍질 · 뿔 · 다리 6개
  beetle: { W: 22, H: 15, draw(P, f, pose) {
    const st = pose === 'walk' ? f % 2 : 0, by = 8 + (pose === 'wind' ? 1 : 0);
    for (let i = 0; i < 3; i++) { const x = 7 + i * 4, k = (i + st) % 2 ? 1 : -1; P.l(x, by + 3, x + k, 14, '#1a222a'); }
    P.e(10, by, 8, 5, '#2a3a4a'); P.e(10, by - 1, 7, 4, '#5a7088'); P.e(9, by - 2, 5, 2, '#8aa4c0');
    P.l(4, by - 3, 14, by - 3, '#d8ecff'); P.p(6, by - 4, '#ffffff'); P.l(10, by - 4, 10, by + 3, '#2a3a4a'); // 광택 · 날개 틈
    P.e(18, by + 1, 2.5, 2.5, '#2a3a4a'); P.e(18, by, 1.8, 1.6, '#5a7088');
    P.l(19, by - 1, 21, by - 4, '#8aa4c0'); P.p(21, by - 5, '#d8ecff'); P.p(19, by + 1, '#ff5a3a'); // 뿔 · 눈
  } },
  // 불꽃 정령: 불꽃이 뭉친 작은 몸 · 프레임마다 일렁인다
  fireSpirit: { W: 16, H: 19, draw(P, f) {
    const fl = [0, 1, -1, 0][f];
    for (let y = 2; y < 18; y++) { const t = (y - 2) / 16, w0 = Math.sin(t * Math.PI * 0.95) * 6 * (t < 0.3 ? t / 0.3 * 0.6 + 0.4 : 1), x = 8 + Math.sin(y * 0.8 + f * 1.7) * (1 - t) * 1.5 + (y < 6 ? fl : 0); P.r(x - w0, y, w0 * 2, 1, '#c8301a'); if (w0 > 1.5) P.r(x - w0 + 1, y, w0 * 2 - 2, 1, '#ff7a2a'); if (w0 > 3 && y > 7) P.r(x - w0 + 2.5, y, w0 * 2 - 5, 1, '#ffd040'); }
    P.p(8 + fl, 1, '#ff7a2a'); P.p(5, 4 - fl, '#ff7a2a'); P.p(11, 5 + fl, '#ffb040');
    P.p(6, 11, '#3a0a04'); P.p(10, 11, '#3a0a04'); P.r(7, 14, 3, 1, '#c8301a');
  } },
  // 물의 정령: 물방울 몸 · 둘레를 도는 소용돌이
  waterSpirit: { W: 18, H: 20, draw(P, f) {
    const bob = [0, -1, 0, 1][f];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + f * 0.5, x = 9 + Math.cos(a) * 8, y = 15 + Math.sin(a) * 2.5; P.p(x, y, i % 3 ? '#4aa8e8' : '#d8f4ff'); }
    for (let y = 2; y < 17; y++) { const t = (y - 2) / 15, w0 = t < 0.4 ? t / 0.4 * 5.5 : 5.5 - (t - 0.4) * 3, x = 9; P.r(x - w0, y + bob, w0 * 2, 1, '#1a6ab8'); if (w0 > 1.5) P.r(x - w0 + 1, y + bob, w0 * 2 - 2, 1, '#3a9ae0'); }
    P.p(7, 6 + bob, '#d8f4ff'); P.p(6, 7 + bob, '#d8f4ff'); P.p(6, 8 + bob, '#a8dcff'); P.p(9, 1 + bob, '#3a9ae0');
    P.p(7, 10 + bob, '#0a2a5a'); P.p(11, 10 + bob, '#0a2a5a'); P.p(7, 9 + bob, '#ffffff'); P.p(11, 9 + bob, '#ffffff');
  } },
  // 감시안: 날개 달린 커다란 눈 · 눈동자가 보는 쪽을 향한다
  eye: { W: 24, H: 17, draw(P, f, pose) {
    const flap = [-3, 0, 2, 0][f], cy = 8;
    for (const side of [-1, 1]) { for (let i = 0; i < 5; i++) { const q = i / 4, x = 12 + side * (5 + q * 6), y = cy - 2 + flap * q; P.l(x, y, x - side, y + 4 - q * 2, i % 2 ? '#5a3a6a' : '#7a5a8a'); } P.l(12 + side * 5, cy - 2, 12 + side * 11, cy - 2 + flap, '#3a2448'); }
    P.e(12, cy, 5.5, 5.5, '#c8b8c0'); P.e(12, cy - 0.5, 5, 5, '#f0e8ec'); P.e(11, cy - 3, 2.5, 1.2, '#ffffff');
    P.l(8, cy + 2, 10, cy + 1, '#e04050'); P.l(15, cy + 3, 14, cy + 1, '#e04050'); // 핏줄
    const ix = 13 + (pose === 'wind' ? 1 : 0); P.e(ix, cy, 2.6, 2.6, pose === 'wind' ? '#ff3a3a' : '#c8302a'); P.e(ix, cy, 1.2, 1.4, '#141018'); P.p(ix - 1, cy - 1, '#ffffff');
  } },
  // 붙잡는 망령(사령술사의 부하): 창백한 푸른 수의 · 깊은 두건 속 두 눈 · 길게 늘어진 뼈 팔 · 흩날리는 끝자락
  grasper: { W: 22, H: 26, draw(P, f, pose) {
    const wv = [0, 1, 0, -1][f], reach = pose === 'wind' ? 2 : 0;
    for (let y = 11; y < 25; y++) { const t = (y - 11) / 14, w0 = 5.5 - t * 3.5, x = 11 + Math.sin(y * 0.7 + f * 1.6) * t * 2; P.r(x - w0, y, w0 * 2, 1, '#5a7a98'); if (w0 > 2) P.r(x - w0 + 1, y, w0 * 2 - 2, 1, y % 3 ? '#8aaccc' : '#7a9cbc'); }
    for (let i = 0; i < 3; i++) P.p(8 + i * 3 + Math.round(Math.sin(f * 1.6 + i) * 1), 24 + (i % 2), '#a8c8e8'); // 찢어진 끝자락
    P.e(11, 8, 6, 6.5, '#4a6a88'); P.e(11, 7, 5, 5.5, '#9abcdc'); P.e(10, 4, 3, 2, '#d0e8ff');
    P.e(11, 9, 3.4, 3.4, '#0e141e'); P.p(9, 9, '#e8fbff'); P.p(13, 9, '#e8fbff'); P.p(9, 10, '#7ae8ff'); P.p(13, 10, '#7ae8ff'); // 두건 속 눈
    for (const s of [-1, 1]) { // 뼈 팔: 늘어뜨렸다가 기를 모으면 앞으로 든다
      const sx = 11 + s * 5, sy = 13, ex = 11 + s * (8 + reach), ey = 20 + wv * s - reach * 3;
      P.l(sx, sy, ex, ey, '#e8e0c8'); P.p(ex, ey + 1, '#e8e0c8'); P.p(ex + s, ey + 1, '#e8e0c8'); P.p(ex - s, ey + 2, '#e8e0c8'); // 손가락
      P.l(sx, sy, sx + s * 2, sy + 3, '#7a9cbc'); // 소매
    }
  } },
  // 그림자 표범: 검은 몸 · 보라 발톱과 눈 · 날렵한 꼬리
  panther: { W: 26, H: 15, draw(P, f, pose) {
    const st = pose === 'walk' ? f : 0, by = 7 + (pose === 'wind' ? 2 : 0), stretch = pose === 'walk' && f % 2 ? 1 : 0;
    [[6, 0], [9, 1], [16, 1], [19, 0]].forEach(([x, o]) => { const k = (st + o) % 2 ? 2 : -1; P.l(x, by + 3, x + k, 14, '#1a1620'); P.p(x + k + 1, 14, '#c070ff'); });
    P.e(13, by, 9 + stretch, 3.5, '#18141e'); P.e(13, by - 1, 8, 2.5, '#2a2434'); P.e(12, by - 2, 5, 1, '#3e3650');
    P.l(4, by - 1, 1, by - 4 + (f % 2), '#2a2434'); P.l(1, by - 4 + (f % 2), 0, by - 2, '#2a2434'); // 꼬리
    P.e(22, by - 1, 3, 2.5, '#18141e'); P.e(22, by - 2, 2.2, 1.5, '#2a2434'); P.p(21, by - 4, '#2a2434'); P.p(23, by - 4, '#2a2434');
    P.p(23, by - 2, '#c070ff'); P.p(24, by - 1, '#e0b0ff'); P.p(25, by, '#141018');
  } },
};

// 몬스터 그림 한 장 (뒤집기 · 맞을 때 번쩍임까지 캐시)
export function beastImg(kind, pose, f, flip, flash) {
  const def = B[kind]; if (!def) return null;
  const key = `${kind}|${pose}|${f}|${flip ? 1 : 0}|${flash || ''}`;
  let c = cache.get(key); if (c) return c;
  const base = `${kind}|${pose}|${f}`;
  let src = cache.get(base);
  if (!src) { const P = makeP(def.W, def.H); def.draw(P, f, pose); outline(P); src = P.c; cache.set(base, src); }
  if (def.faceLeft) flip = !flip; // 왼쪽을 보고 그린 그림
  c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
  if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0);
  if (flash) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = flash === true ? 'rgba(255,255,255,0.85)' : flash; g.globalAlpha = flash === true ? 1 : 0.6; g.fillRect(0, 0, c.width, c.height); }
  cache.set(key, c);
  return c;
}
export const BEASTS = B;
