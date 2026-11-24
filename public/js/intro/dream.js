// 새 게임의 꿈: 탑 꼭대기의 빛이 고동친다 → 어둠 속의 나, 팔에 내 종족의 문양이 타오른다 → 누군가 부르는 소리에 눈을 뜬다 (바람결 마을 내 방)
// 인트로와 같은 320×180 도트 판 · 같은 장면 형식 (createIntro(display, { scenes: dreamScenes(race) }))
import { IW, IH, H, clamp, lerp, seg, eOut, eIO, hexA, rect, px, poly, circ, ell, vgrad, glow, stars, cover, glyph, RACE_COL, rimmed, bz2, big, bp } from './pix.js';
import { tower } from './act1.js';
import { limb, ik } from './body.js';
import { PARTS } from './act3.js';

const { T7, heartbeat } = PARTS;

// 꿈속의 나: 옆모습(오른쪽 탑을 본다) · 발밑(x, y) 기준 키 28칸. 고개를 들고, 오른팔을 탑 쪽으로 뻗는다
// look: 0 고개 숙임 → 1 올려다봄 · reach: 0 내린 팔 → 1 뻗은 팔 · br: 숨 (−1~1) · wind: 망토 · 머리가 날리는 정도
function dreamer(g, x, y, look, reach, br, wind, c) {
  const P = (a, b) => [x + a, y + b];
  const hip = P(0, -13 + br * 0.2), sh = P(0.6 - reach * 0.6, -22.6 + br * 0.5), hd = P(1.6 - look * 0.4 + reach * 0.2, -27 + br * 0.5 - look * 0.4);
  // 먼 다리 · 먼 팔 (반 걸음 뒤)
  limb(g, hip, P(-1.4, -6.6), 3.2, 3, 2.4, c); limb(g, P(-1.4, -6.6), P(-2.4, 0), 2.4, 2.2, 2, c); poly(g, [P(-3.6, 0.6), P(-0.6, 0.6), P(-0.4, -1.2), P(-3.4, -1.4)], c);
  const farHand = P(-1.2 - reach * 1.5, -12.6 + reach * 1.2 + br * 0.3);
  { const [e, h] = ik(sh, farHand, 5, 5, 1); limb(g, sh, e, 2.4, 2.4, 2, c); limb(g, e, h, 2, 2, 1.8, c); }
  // 망토: 어깨에서 등 뒤로 흘러내리고 바람에 날린다
  const fl = Math.sin(wind * 2.1) * 1.4, fl2 = Math.sin(wind * 2.1 + 1.3) * 1.8;
  poly(g, [[sh[0] + 1.6, sh[1] - 0.6], [sh[0] - 2.6, sh[1] - 0.4], P(-6.5 + fl, -12), P(-9 + fl2, -3.4), P(-4.5 + fl, -4.6), P(-1, -6.4), P(1.6, -12)], c);
  // 가까운 다리 · 몸통
  limb(g, hip, P(1.4, -6.6), 3.4, 3.2, 2.6, c); limb(g, P(1.4, -6.6), P(1.8, 0), 2.6, 2.4, 2.1, c); poly(g, [P(0.4, 0.6), P(4.4, 0.6), P(4.2, -0.8), P(1, -1.6)], c);
  poly(g, [[sh[0] - 3, sh[1] - 0.4], [sh[0] + 3, sh[1] - 0.6], [hip[0] + 2.6, hip[1]], [hip[0] - 2.8, hip[1] + 0.4]], c);
  // 머리 · 목 · 날리는 머리칼
  limb(g, [sh[0] + 0.4, sh[1]], [hd[0] - 0.4, hd[1] + 2.4], 2, 2, 2, c);
  circ(g, hd[0], hd[1], 3.3, c);
  poly(g, [[hd[0] - 3.2, hd[1] - 1.6], [hd[0] + 1, hd[1] - 3.6], [hd[0] - 6 + fl, hd[1] - 1 + fl2 * 0.4], [hd[0] - 3, hd[1] + 1.4]], c);
  // 가까운 팔: 내린 팔 → 탑 쪽으로 뻗는다 (손끝을 조금 편다)
  const tgt = [lerp(x + 2.4, x + 11.5, reach), lerp(y - 12.4 + br * 0.3, y - 30, eOut(reach))];
  const [e, h] = ik(sh, tgt, 5.2, 5.2, reach > 0.4 ? -1 : 1);
  limb(g, sh, e, 2.6, 2.6, 2.2, c); limb(g, e, h, 2.2, 2.2, 1.8, c);
  const da = Math.atan2(h[1] - e[1], h[0] - e[0]);
  poly(g, [[h[0] + Math.cos(da + 1.4) * 1.1, h[1] + Math.sin(da + 1.4) * 1.1], [h[0] + Math.cos(da) * 2.4, h[1] + Math.sin(da) * 2.4], [h[0] + Math.cos(da - 1.4) * 1.1, h[1] + Math.sin(da - 1.4) * 1.1]], c);
  return { arm: [lerp(e[0], h[0], 0.35), lerp(e[1], h[1], 0.35)], hand: h };
}

// ① 꿈: 탑 꼭대기로 다가가며 고동이 빨라진다 (인트로의 「탑이 다시 깨어난다」 그대로, 끝은 하얗게)
const D1 = { ...T7, dur: 3.6, text: '…꿈속에서, 탑 꼭대기의 빛이 심장처럼 고동친다.', textAt: 0.3, fi: 0.6, fo: 0 };

// ② 어둠 속의 나: 빛이 울릴 때마다 팔의 문양이 타오르고, 탑에서 흘러온 빛 알갱이가 팔로 스며든다
function D2(race) {
  const col = RACE_COL[race] || '#9af0e0';
  return { dur: 5.2, text: '빛이 울릴 때마다, 팔에 새겨진 문양이 타오른다.', textAt: 0.6, fi: 0, fo: 0, draw(g, t, raw) {
    const hb = heartbeat(t, 1.25), look = eIO(seg(t, 0.6, 1.8)), reach = eIO(seg(t, 1.6, 3.0)), lit = seg(t, 1.4, 3.4), flare = seg(t, 4.2, 5.2);
    vgrad(g, 0, IH, [[0, '#020208'], [0.7, '#070a1a'], [1, '#0c1024']]);
    stars(g, 70, 611, 150, t, 0.5);
    // 멀리 탑: 오른쪽 위, 고동마다 꼭대기가 빛난다
    glow(g, 256, 62, 50 + hb * 26, '#9af0e0', 0.12 + 0.3 * hb);
    tower(g, 256, 150, 80, { dark: '#060812', rim: '#2a4a5a', rdx: -1, win: '#4a9a94', crystal: '#e8fff8', cglow: 0.3 + 0.8 * hb });
    // 물 같은 바닥: 내 발밑에 비친 빛
    rect(g, 0, 150, IW, IH - 150, '#04050c');
    for (let i = 0; i < 30; i++) { const d = H(i, 621), yy = 152 + Math.floor(d * d * 26), xx = (H(i, 622) * IW + t * (3 + 6 * d)) % IW; rect(g, xx, yy, 2 + Math.floor(4 * H(i, 623)), 1, hexA('#1a2a44', 0.8)); }
    // 빛 알갱이: 탑 꼭대기에서 휘어져 팔로 (손에 닿을수록 밝다)
    const X = 104, Y = 160, S = 3.2;
    let arm = [X, Y - 40];
    const fig = (c) => big(g, X, Y, S, () => { arm = dreamer(g, X, Y, look, reach, Math.sin(t * 2.2), t, c).arm; });
    ell(g, X + 2, Y + 1, 16, 2.5, hexA(col, 0.12 + 0.25 * lit)); // 발밑에 비친 문양 빛
    rimmed(g, hexA(col, 0.4 + 0.6 * lit), '#05050c', -1, 0, fig);
    const A = bp(X, Y, S, arm);
    if (lit > 0) for (let i = 0; i < 36; i++) {
      const u = (t * (0.35 + H(i, 631) * 0.25) + H(i, 632)) % 1; if (u > lit * 1.4) continue;
      const c1 = [lerp(256, A[0], 0.5) + (H(i, 633) - 0.5) * 80, 10 + H(i, 634) * 40], [qx, qy] = bz2([256, 52], c1, A, eIO(u));
      px(g, qx, qy, u > 0.8 ? '#ffffff' : u > 0.4 ? hexA(col, 0.9) : hexA('#9af0e0', 0.6));
    }
    // 문양: 처음엔 희미하게, 고동마다 번쩍 · 끝에는 온몸이 빛에 잠긴다
    const ga = clamp(0.15 + lit * 0.6 + hb * 0.4 * lit);
    if (lit > 0) { glow(g, A[0], A[1], 8 + 14 * hb * lit + 30 * flare, col, 0.4 * ga + 0.4 * flare); glyph(g, race, A[0], A[1], 1, ga, col); }
    rect(g, 0, 0, IW, IH, hexA('#ffffff', 1 - seg(t, 0, 0.5))); // 앞 장면의 하얀 빛에서 깨어난다
    if (flare > 0) cover(raw, eIO(flare), '#ffffff');
  } };
}

// ③ 누군가 부르는 소리 → 눈을 뜬다: 눈꺼풀이 두 번 깜빡이며 아침 햇살 든 내 방이 보인다
function room(g, t) {
  vgrad(g, 0, IH, [[0, '#4a3226'], [0.6, '#6a4630'], [1, '#3a261c']]);
  for (let i = 0; i < 8; i++) rect(g, 0, 18 + i * 20, IW, 1, '#3a261a'); // 나무 벽 결
  rect(g, 0, 0, IW, 14, '#2a1a12'); for (let i = 0; i < 6; i++) rect(g, 20 + i * 56, 0, 6, 16, '#22140e'); // 서까래
  // 창: 아침 하늘 · 멀리 탑 (작게)
  rect(g, 196, 34, 70, 56, '#2a1a12'); vgrad(g, 38, 86, [[0, '#9ad0f0'], [1, '#f0e0b8']], 200, 262);
  tower(g, 236, 86, 40, { dark: '#5a6a8a', crystal: '#ffffff', cglow: 0.4 });
  rect(g, 229, 38, 3, 48, '#2a1a12'); rect(g, 200, 60, 62, 3, '#2a1a12');
  // 햇살이 닿은 바닥 자리 (창 모양 그대로)
  poly(g, [[172, 180], [206, 120], [270, 120], [258, 180]], hexA('#ffe8b0', 0.18));
  for (let i = 0; i < 14; i++) { const u = (t * 0.08 + H(i, 641)) % 1; px(g, 206 + H(i, 642) * 60 - u * 20, 50 + u * 110, hexA('#fff0c8', 0.6 * Math.sin(u * Math.PI))); } // 떠다니는 먼지
  // 이불 끝 · 침대 기둥 (화면 아래 가까이)
  poly(g, [[0, 150], [120, 142], [170, 160], [170, IH], [0, IH]], '#7a3a2a'); poly(g, [[0, 156], [110, 150], [150, 164], [150, IH], [0, IH]], '#5a2a20');
  rect(g, 10, 120, 8, 60, '#3a2418');
}
const D3 = { dur: 3.4, text: '…누군가 부르는 소리. 눈을 떴다. 바람결 마을, 내 방이다.', textAt: 0.5, fi: 0, fo: 0.5, draw(g, t, raw) {
  room(g, t);
  // 눈꺼풀: 감김 → 조금 → 감김(깜빡) → 활짝 · 처음엔 흐리게(하얀 잔상)
  const o = t < 0.5 ? 0 : t < 1.0 ? eOut(seg(t, 0.5, 1.0)) * 0.35 : t < 1.25 ? 0.35 * (1 - seg(t, 1.0, 1.2)) : eOut(seg(t, 1.25, 2.1));
  const lid = Math.round((IH / 2) * (1 - o));
  if (t < 2.6) cover(raw, (1 - seg(t, 0.5, 2.6)) * 0.6, '#fff4e0');
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(g, 0, 0, IW, lid, '#050304'); rect(g, 0, IH - lid, IW, lid, '#050304');
  if (lid > 2 && lid < IH / 2) { rect(g, 0, lid, IW, 1, '#1a0e0a'); rect(g, 0, IH - lid - 1, IW, 1, '#1a0e0a'); }
} };

export const dreamScenes = (race) => [D1, D2(race), D3];
