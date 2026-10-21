// 인트로 인물: 관절 자세(옆모습, 오른쪽을 본다)로 사람 몸을 그리고, 종족마다 머리 · 옷 · 무기를 얹는다.
// 자세 q의 좌표는 발밑(0, 0) 기준 칸 단위 (위가 -). P(x, y)가 화면 좌표로 옮긴다 (좌우 뒤집기 포함).
// 색: o.pal이 없으면 한 색 실루엣, 있으면 부위마다 [밝은 면, 바탕] 색으로 칠한다 (layered가 테두리빛 · 밝은 면 · 바탕 순으로 덧그린다).
import { clamp, lerp, poly, circ, ell, path } from './pix.js';

// 굵기가 변하는 팔다리 (w0 → wm(중간 근육) → w1), 관절은 둥글게
export function limb(g, a, b, w0, wm, w1, c, at = 0.4) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, m = [a[0] + dx * at, a[1] + dy * at];
  poly(g, [[a[0] + nx * w0 / 2, a[1] + ny * w0 / 2], [m[0] + nx * wm / 2, m[1] + ny * wm / 2], [b[0] + nx * w1 / 2, b[1] + ny * w1 / 2], [b[0] - nx * w1 / 2, b[1] - ny * w1 / 2], [m[0] - nx * wm / 2, m[1] - ny * wm / 2], [a[0] - nx * w0 / 2, a[1] - ny * w0 / 2]], c);
  circ(g, a[0], a[1], w0 / 2, c); circ(g, b[0], b[1], w1 / 2, c);
}
// 두 마디 팔: 어깨 a에서 손 b로. 닿지 않으면 쭉 편다. [팔꿈치, 실제 손]
export function ik(a, b, L1, L2, bend) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = clamp(Math.hypot(dx, dy), 0.01, L1 + L2 - 0.01), base = Math.atan2(dy, dx);
  const ang = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), e = [a[0] + Math.cos(base + bend * ang) * L1, a[1] + Math.sin(base + bend * ang) * L1];
  const ex = Math.atan2(b[1] - e[1], b[0] - e[0]);
  return [e, [e[0] + Math.cos(ex) * L2, e[1] + Math.sin(ex) * L2]];
}
// 인물을 세 겹으로: 먼 팔다리 → 몸 → 가까운 팔. 겹마다 [테두리빛, 밝은 면, 바탕]을 (dx, dy)씩 밀며 덧그려
// 빛 쪽 가장자리에 밝은 띠가 남고, 가까운 팔이 몸통 위에서도 갈라져 보인다
// shade면 먼저 그림자 색을 한 칸 더 밀어 그려, 빛 반대쪽 가장자리에 어두운 띠가 생긴다
export function layered(g, sets, dx, dy, fn, shade = false) {
  let r;
  for (const layer of ['far', 'body', 'near']) {
    const cs = sets[layer] || sets.body;
    if (shade) { g.save(); g.translate(dx * cs.length, dy * cs.length); r = fn(cs[0], layer, 3); g.restore(); }
    cs.forEach((c, i) => { g.save(); g.translate(dx * i, dy * i); r = fn(c, layer, i); g.restore(); });
  }
  return r;
}
export const lerpPose = (A, B, k) => { const o = {}; for (const key in A) o[key] = Array.isArray(A[key]) ? [lerp(A[key][0], B[key][0], k), lerp(A[key][1], B[key][1], k)] : lerp(A[key], B[key] ?? A[key], k); return o; };
const rotv = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
const darker = (hex, k) => { const n = parseInt(hex.slice(1, 7), 16), f = (v) => Math.round(v * (1 - k)).toString(16).padStart(2, '0'); return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`; };

// 부위별 붓: C('skin')이 지금 겹 · 지금 단계의 색을 준다 (먼 팔다리는 한 단계 어둡게)
function painter(g, P, c, o) {
  const pass = o.pass ?? 2, pal = o.pal, far = o.layer === 'far';
  const C = (k) => {
    if (!pal || pass === 0) return c;
    const [lit, base] = pal[k] || pal.skin;
    if (pass === 3) return darker(base, far ? 0.7 : 0.55);
    return far ? (pass === 1 ? base : darker(base, 0.35)) : pass === 1 ? lit : base;
  };
  const Q = (p) => P(p[0], p[1]);
  return { C, Q, pl: (pts, k) => poly(g, pts.map(Q), C(k)), lb: (a, b, w0, wm, w1, k) => limb(g, Q(a), Q(b), w0, wm, w1, C(k)), el: (p, rx, ry, k) => ell(g, ...Q(p), rx, ry, C(k)), ci: (p, r, k) => circ(g, ...Q(p), r, C(k)), pa: (pts, w, k) => path(g, pts.map(Q), C(k), w) };
}
// 몸통: 엉덩이 h에서 어깨 s까지. 앞쪽(+x 방향)은 가슴이 나오고 뒤쪽은 등이 곧다
function torso(pl, h, s, ww, cw, bulge, k) {
  const u = unit(h, s), n = [-u[1], u[0]], f = (t, w) => add([lerp(h[0], s[0], t), lerp(h[1], s[1], t)], n, w);
  pl([f(0, -ww / 2), f(0, ww / 2), f(0.45, ww / 2 + bulge * 0.4), f(0.72, cw / 2 + bulge), f(1, cw * 0.32), f(1.06, 0), f(1, -cw * 0.34), f(0.7, -cw / 2), f(0.3, -ww / 2 - 0.5)], k);
}
const boot = (pl, a, k = 1, key = 'leather') => pl([add(a, [-2.4 * k, -2]), add(a, [2 * k, -2.4]), add(a, [6.5 * k, 0.4]), add(a, [6.5 * k, 1]), add(a, [-2.6 * k, 1])], key);

// 양날 도끼: 손잡이를 쥔 점 w에서 ang 방향으로. C는 색 또는 부위별 색 함수. 아래쪽 날 끝을 돌려준다
export function axe(g, Q, w, ang, C) {
  const col = typeof C === 'function' ? C : () => C;
  const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]], A = add(w, d, 27), X = (a, b) => add(add(A, d, a), n, b), pl = (pts, k) => poly(g, pts.map(Q), col(k));
  path(g, [Q(add(w, d, -9)), Q(add(w, d, 32))], col('wood'), 2.6);
  for (const m of [1, -1]) pl([X(5, 0), X(11, 11 * m), X(6, 15 * m), X(-6, 15 * m), X(-11, 11 * m), X(-5, 0)], 'metal');
  pl([X(6, -1.5), X(9, 0), X(6, 1.5)], 'metal');
  return Q(X(0, 15 * (n[1] > 0 ? 1 : -1)));
}
export const mouthOf = (q) => add(q.hd, rotv([6.4, 2.6], q.ha));

// ───────── 오크: 키가 크고 어깨가 넓은 초록 피부 전사. 튀어나온 턱 · 엄니 · 뒤로 뻗은 귀 · 상투, 큰 양날 도끼 ─────────
export const ORC_PAL = { skin: ['#5a6a28', '#2a3614'], cloth: ['#7a3a1e', '#3e1c0e'], leather: ['#5a3418', '#2a180c'], metal: ['#8e8278', '#3c3632'], bone: ['#f0e4c8', '#b0a080'], hair: ['#3a2418', '#180e08'], wood: ['#7a5430', '#3a2614'] };
export function orc(g, P, q, c, t, o = {}) {
  const { C, Q, pl, lb, el, ci, pa } = painter(g, P, c, o), on = (k) => !o.layer || o.layer === k;
  const R = (x, y) => add(q.hd, rotv([x, y], q.ha)), sw = Math.sin(t * 2.6), f = Math.sin(t * 5);
  const hB = add(q.hip, [-1.5, 0]), hF = add(q.hip, [1.5, 0]), u = unit(q.hip, q.sh), sB = add(q.sh, [-1.5, 2]), sF = add(q.sh, [1.5, 2]);
  const [eB, wB] = ik(sB, q.hB, 13, 12, o.bendB ?? 1), [eF, wF] = ik(sF, q.hF, 13, 12, o.bendF ?? 1);
  const j = (o.jaw || 0) * 0.5, hg = R(0.5, 1.5), J = (x, y) => add(hg, rotv(rotv([x - 0.5, y - 1.5], q.ha), j));
  const arm = (s, e, w) => { lb(s, e, 7.5, 8.5, 5.5, 'skin'); lb(e, w, 5.5, 6.5, 4.2, 'skin'); lb(add(e, unit(e, w), 7), w, 5.8, 5.8, 5.6, 'leather'); ci(w, 3, 'skin'); };
  if (on('far')) { lb(hB, q.kB, 7.5, 8, 5.5, 'skin'); lb(q.kB, q.aB, 5.5, 6, 3.6, 'skin'); boot(pl, q.aB); arm(sB, eB, wB); }
  if (on('body')) {
    lb(hF, q.kF, 7.5, 8, 5.5, 'skin'); lb(q.kF, q.aF, 5.5, 6, 3.6, 'skin'); boot(pl, q.aF);
    pl([add(q.hip, [-6.5, -3]), add(q.hip, [6.5, -3]), add(q.hip, [7.5 + f * 0.5, 9]), add(q.hip, [4, 7.5]), add(q.hip, [1.5, 10 + f * 0.6]), add(q.hip, [-2, 7.5]), add(q.hip, [-5, 10]), add(q.hip, [-7.5, 8])], 'cloth'); // 너덜너덜한 허리 천
    torso(pl, add(q.hip, u, -2), q.sh, 10, 18, 1.2, 'skin');
    pl([add(q.hip, [-7, -4.5]), add(q.hip, [7, -4.5]), add(q.hip, [7, -1.5]), add(q.hip, [-7, -1.5])], 'leather'); // 허리띠
    pl([add(q.sh, [-5, 3]), add(q.sh, [-2, 1]), add(add(q.hip, u, -2), [5, -6]), add(add(q.hip, u, -2), [2, -5])], 'leather'); // 가슴을 가로지르는 끈
    lb(q.sh, R(-1, 3.5), 8, 7.5, 6.5, 'skin'); // 굵은 목
    pl([R(-4.6, -1), R(-4, -4.6), R(-1, -6), R(3, -5.6), R(5, -3.8), R(6.6, -3), R(6.6, -1.6), R(5.6, -1.2), R(6.8, 0.4), R(5.6, 1.2), R(4, 3), R(-1, 4.4), R(-4.2, 2.4)], 'skin'); // 크고 각진 머리
    pl([J(-0.5, 1), J(6.6, 1.2), J(7, 4.2), J(5.5, 5.6), J(0.5, 5.6)], 'skin'); // 넓게 튀어나온 아래턱
    pl([J(5.4, 1.6), J(6.6, -2.2), J(7.2, 1.6)], 'bone'); pl([J(3, 1.6), J(3.6, -0.6), J(4.2, 1.6)], 'bone'); // 엄니 둘
    pl([R(-2, -1.2), R(-9.5, -6.5), R(-8, -3.5), R(-2.4, 1.4)], 'skin'); // 뒤로 길게 뻗은 귀
    pl([R(-2.5, -5.4), R(1.2, -6), R(0.4, -9.5), R(-1.5, -10)], 'hair'); pa([R(-0.6, -9.6), R(-5, -11 + sw), R(-10, -8 + sw * 1.5), R(-12, -4 + sw * 2)], 2.4, 'hair'); // 상투와 늘어진 머리채
  }
  let edge = null;
  if (on('near')) {
    arm(sF, eF, wF);
    el(add(sF, [-0.5, -0.5]), 5.5, 4.2, 'metal'); pl([add(sF, [-4.5, -2.5]), add(sF, [-9, -6]), add(sF, [-3, -4])], 'metal'); pl([add(sF, [-2, -3.8]), add(sF, [-5, -8.5]), add(sF, [0, -4.2])], 'metal'); // 뒤로 뻗은 가시 견갑
    if (o.axe != null) edge = axe(g, Q, wF, o.axe, C);
  }
  return { eye: Q(R(4, -2.2)), mouth: Q(J(6.4, 2.6)), chest: Q(add(add(q.sh, u, -8), [2.5, 0])), hand: Q(wF), edge };
}
// 오크 자세들 (오른쪽을 본다)
export const ORC = {
  idle: { hip: [0, -29], kF: [6, -15], aF: [8, -1], kB: [-5, -15], aB: [-8, -1], sh: [2, -50], hd: [4.5, -55.5], ha: 0.35, hF: [12, -37], hB: [6, -33] },
  look: { hip: [0, -29], kF: [6, -15], aF: [8, -1], kB: [-5, -15], aB: [-8, -1], sh: [1.5, -50.5], hd: [3.5, -57], ha: -0.08, hF: [12, -37], hB: [6, -33] },
  raise: { hip: [-1, -29], kF: [7, -15], aF: [9, -1], kB: [-6, -15], aB: [-9, -1], sh: [-2.5, -50], hd: [-0.5, -56.5], ha: -0.2, hF: [-1, -75], hB: [-3, -73] },
  slam: { hip: [3, -24], kF: [13, -12], aF: [14, -1], kB: [-6, -12], aB: [-13, -1], sh: [13, -42], hd: [17.5, -46.5], ha: 0.3, hF: [25, -25], hB: [21, -27] },
};

// ───────── 용족: 사람의 몸에 붉은 머리칼 · 뒤로 휜 뿔 · 끝에 불이 붙은 비늘 꼬리 ─────────
export const DRK_PAL = { skin: ['#e0a07a', '#8a4a34'], hair: ['#ff5a32', '#a01c12'], horn: ['#f0e0b8', '#9a8460'], cloth: ['#5a2c2a', '#26100e'], cloth2: ['#c83a1e', '#6a1a0e'], leather: ['#6a4426', '#2e1c0e'], scale: ['#c8461e', '#5a160a'], metal: ['#b0a090', '#4a403a'] };
export function dragonkin(g, P, q, c, t, o = {}) {
  const { C, Q, pl, lb, el, ci, pa } = painter(g, P, c, o), on = (k) => !o.layer || o.layer === k;
  const R = (x, y) => add(q.hd, rotv([x, y], q.ha)), fl = o.float || 0, sw = Math.sin(t * 3), f = Math.sin(t * 6);
  const u = unit(q.hip, q.sh), hB = add(q.hip, [-1, 0]), hF = add(q.hip, [1, 0]), sB = add(q.sh, [-1, 1.6]), sF = add(q.sh, [1, 1.6]);
  const tail = [add(q.hip, [-2.5, -1]), add(q.hip, [-10, 4]), add(q.hip, [-18, 7 + sw]), add(q.hip, [-25, 4 + sw * 1.5]), add(q.hip, [-28, -2 + sw * 2])];
  const [eB, wB] = ik(sB, q.hB, 10.5, 10, o.bendB ?? 1), [eF, wF] = ik(sF, q.hF, 10.5, 10, o.bendF ?? 1);
  const j = (o.jaw || 0) * 0.55, hg = R(0.6, 1.4), J = (x, y) => add(hg, rotv(rotv([x - 0.6, y - 1.4], q.ha), j));
  const arm = (s, e, w) => { lb(s, e, 5.2, 5.6, 4, 'skin'); lb(e, w, 4, 4.4, 3.2, 'skin'); lb(add(e, unit(e, w), 5), w, 4.4, 4.4, 4, 'leather'); ci(w, 2.2, 'skin'); };
  if (on('far')) {
    for (let i = 0; i < 4; i++) lb(tail[i], tail[i + 1], 5 - i * 1.1, 5 - i * 1.1, 4 - i * 1.1, 'scale');
    lb(hB, q.kB, 6.5, 7, 4.6, 'cloth'); lb(q.kB, q.aB, 4.6, 5, 3.2, 'cloth'); boot(pl, q.aB, 0.9); arm(sB, eB, wB);
  }
  if (on('body')) {
    lb(hF, q.kF, 6.5, 7, 4.6, 'cloth'); lb(q.kF, q.aF, 4.6, 5, 3.2, 'cloth'); boot(pl, q.aF, 0.9);
    torso(pl, add(q.hip, u, -1), q.sh, 10, 14.5, 1.4, 'cloth');
    pl([add(q.hip, [-5.5, -3.5]), add(q.hip, [5.5, -3.5]), add(q.hip, [5.5, -1]), add(q.hip, [-5.5, -1])], 'cloth2'); // 붉은 허리띠
    pa([add(q.hip, [-4, -2]), add(q.hip, [-9, 2 + f]), add(q.hip, [-14, 1 + f * 1.4])], 1.8, 'cloth2'); // 뒤로 날리는 끈
    pl([add(q.sh, [-2, 1]), add(q.sh, [3, 1]), add(add(q.sh, u, -7), [3.5, 0]), add(add(q.sh, u, -7), [-1, 0])], 'cloth2'); // 옷깃
    lb(q.sh, R(-0.5, 3.2), 4.4, 4.4, 4, 'skin');
    ci(R(-0.3, -0.6), 4.4, 'skin');
    pl([R(0, -3.6), R(3.5, -3.4), R(4.4, -1.4), R(5.2, 0.2), R(4.3, 0.7), R(4.4, 1.3), R(0, 1.8)], 'skin'); // 이마 · 코 · 윗입술
    pl([J(0, 1.4), J(4.2, 1.6), J(3.8, 3.6), J(1, 4.2)], 'skin'); // 아래턱 (열리면 입이 보인다)
    pl([R(0.8, -4.9), R(-2.5, -5), R(-4.8, -2.6), R(-5.4, 1), R(-5.6, 4.5), R(-9 - fl * 3, 6.5 - fl * 2 + sw), R(-14 - fl * 4, 5 - fl * 3 + sw * 1.6), R(-11 - fl * 3, 2.8 - fl * 2 + sw), R(-13 - fl * 3, 0 - fl * 3 + sw * 0.8), R(-8.5, -1.2), R(-7, -4), R(-3, -5.6)], 'hair'); // 붉은 머리칼
    pl([R(1, -4.6), R(4, -4.2), R(3, -2.6), R(0.5, -3)], 'hair'); // 앞머리
    for (const [ox, k] of [[0.8, 1], [-0.8, 0.8]]) pl([R(ox, -3.6), R(ox + 1.6, -3.4), R(ox - 3 * k, -6.2 * k), R(ox - 7 * k, -6.6 * k), R(ox - 9.5 * k, -9 * k), R(ox - 7 * k, -5 * k), R(ox - 3 * k, -4.2)], 'horn'); // 뒤로 휜 뿔
  }
  if (on('near')) { arm(sF, eF, wF); el(add(sF, [0.4, -0.6]), 4, 3, 'scale'); pl([add(sF, [-2, -2.5]), add(sF, [-0.5, -6]), add(sF, [1.2, -2.5])], 'scale'); }
  return { mouth: Q(J(5.6, 2.4)), throat: Q(R(0.5, 4.5)), chest: Q(add(add(q.sh, u, -7), [2, 0])), tail: Q(tail[4]), eye: Q(R(2.6, -1.4)) };
}
export const DRK = {
  kneel: { hip: [0, -15], kF: [8, -11], aF: [9, -1], kB: [-3, -1.5], aB: [-13, -1], sh: [5, -33], hd: [9.5, -37.5], ha: 0.7, hF: [10, -12], hB: [5, -2] },
  stand: { hip: [0, -29], kF: [4, -15], aF: [6, -1], kB: [-4, -15], aB: [-6, -1], sh: [0.5, -48], hd: [1.5, -53.5], ha: 0, hF: [5, -30], hB: [-5, -30] },
  inhale: { hip: [-1, -29], kF: [5, -15], aF: [8, -1], kB: [-5, -15], aB: [-9, -1], sh: [-2.5, -48], hd: [-2.8, -54], ha: -0.6, hF: [9, -34], hB: [-11, -33] },
  breath: { hip: [1.5, -28], kF: [10, -15], aF: [13, -1], kB: [-6, -14], aB: [-13, -1], sh: [6, -46.5], hd: [9, -52], ha: 0.12, hF: [-3, -34], hB: [-9, -32] },
};

// ───────── 기사: 판금 갑옷 · 깃털 장식 투구 · 망토 · 연 모양 방패와 긴 검 ─────────
export function knight(g, P, q, c, t, o = {}) {
  const { C, Q, pl, lb, el, ci, pa } = painter(g, P, c, o), on = (k) => !o.layer || o.layer === k;
  const R = (x, y) => add(q.hd, rotv([x, y], q.ha)), f = Math.sin(t * (o.capeSpeed || 4)), f2 = Math.sin(t * (o.capeSpeed || 4) + 1.2), wind = o.wind || 0;
  const u = unit(q.hip, q.sh), s0 = add(q.sh, [-1.5, 0.5]), sB = add(q.sh, [-1.4, 1.8]), sF = add(q.sh, [1.4, 1.8]);
  const [eB, wB] = ik(sB, q.hB, 11, 10.5, o.bendB ?? 1), [eF, wF] = ik(sF, q.hF, 11, 10.5, o.bendF ?? 1), sc = add(wB, [1, 1]);
  const d = [Math.cos(o.sword ?? 0), Math.sin(o.sword ?? 0)], n = [-d[1], d[0]], tip = add(wF, d, o.blade ?? 32);
  const hB = add(q.hip, [-1.2, 0]), hF = add(q.hip, [1.2, 0]);
  if (on('far')) { // 망토 (wind가 크면 수평으로 날린다) · 먼 다리 · 방패 든 팔
    pl([s0, add(s0, [-6 - wind * 8 + f, 10 - wind * 6]), add(s0, [-10 - wind * 16 + f2 * 1.5, 20 - wind * 12]), add(s0, [-8 - wind * 20 + f, 28 - wind * 18]), add(s0, [-2 - wind * 12, 24 - wind * 12]), add(q.hip, [-2, -4])], 'cloth');
    lb(hB, q.kB, 6.5, 6.5, 5, 'metal'); lb(q.kB, q.aB, 5, 5, 3.8, 'metal'); boot(pl, q.aB, 1, 'metal'); ci(q.kB, 3.2, 'metal');
    lb(sB, eB, 5.5, 5.5, 4.5, 'metal'); lb(eB, wB, 4.5, 4.8, 4, 'metal'); el(add(sB, [0, -0.5]), 4.5, 3.5, 'metal');
    pl([add(sc, [-5.5, -7]), add(sc, [5.5, -7]), add(sc, [6.5, -2]), add(sc, [0, 10]), add(sc, [-6.5, -2])], 'metal');
  }
  if (on('body')) {
    lb(hF, q.kF, 6.5, 6.5, 5, 'metal'); lb(q.kF, q.aF, 5, 5, 3.8, 'metal'); boot(pl, q.aF, 1, 'metal'); ci(q.kF, 3.2, 'metal');
    torso(pl, add(q.hip, u, -1), q.sh, 11, 15, 1.8, 'metal');
    pl([add(q.hip, [-6.5, -3]), add(q.hip, [6.5, -3]), add(q.hip, [8, 6]), add(q.hip, [-7.5, 6])], 'metal'); // 허리 갑옷 자락
    lb(q.sh, R(0, 3), 5, 5, 5, 'metal');
    pl([R(-4, -4.6), R(3, -5.2), R(4.8, -3), R(5, 1), R(3.8, 4), R(-3.6, 4), R(-4.8, 0)], 'metal'); // 투구
    pl([R(0, -5), R(-5, -8 + f), R(-11, -7 + f2), R(-15, -3 + f), R(-8, -4.4), R(-2, -4.6)], 'cloth'); // 깃털 장식
  }
  if (on('near')) { // 칼 든 팔 · 검
    lb(sF, eF, 5.5, 5.5, 4.5, 'metal'); lb(eF, wF, 4.5, 4.8, 4, 'metal'); el(add(sF, [0, -0.5]), 4.8, 3.6, 'metal');
    pa([add(wF, d, -3.5), add(wF, d, 2)], 2.2, 'leather');
    pa([add(add(wF, d, 2.2), n, 4), add(add(wF, d, 2.2), n, -4)], 1.6, 'metal');
    pl([add(add(wF, d, 2.5), n, 1.1), add(tip, n, 0.3), add(tip, d, 1.5), add(tip, n, -0.3), add(add(wF, d, 2.5), n, -1.1)], 'metal');
  }
  return { tip: Q(tip), shield: Q(sc), chest: Q(add(add(q.sh, u, -7), [2, 0])), hand: Q(wF) };
}
export const KNT = {
  ready: { hip: [0, -26], kF: [7, -13], aF: [10, -1], kB: [-6, -13], aB: [-10, -1], sh: [2.5, -46], hd: [4, -51.5], ha: 0.12, hF: [9, -34], hB: [9, -40] },
  lunge: { hip: [3, -21], kF: [14, -12], aF: [17, -1], kB: [-8, -11], aB: [-19, -1], sh: [11, -39], hd: [14.5, -44], ha: 0.05, hF: [29, -37], hB: [-5, -32] },
};
