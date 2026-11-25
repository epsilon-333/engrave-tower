// 아르케 인트로: 320×180 도트 판에 장면마다 직접 그리고, 화면 배율로 키워 보여 준다. 글자는 화면 해상도로 아래에 한 줄씩
// 짧게 (약 30초 · 아무 키나 누르면 건너뜀): 별이 떨어져 탑이 솟고 → 빛이 여덟 종족에게 각인으로 → 꼭대기에 닿은 이는 없다
// → 몇 해 전 세린이 탑에 들어가 돌아오지 않았다 → 오늘 밤 바람결 마을, 탑이 다시 울린다 → 제목
import { PixelCtx } from '../render/pixelctx.js';
import { IW, IH, seg, cover } from './pix.js';
import { S1, S2, S3 } from './act1.js';
import { ACT2 } from './act2.js';
import { PARTS } from './act3.js';

// 장면 S의 [from, from + dur × speed] 구간만 speed배로 (o의 나머지는 장면 값을 덮는다: 자막 · 들고 나는 시간)
const clip = (S, { from = 0, speed = 1, dur, ...o } = {}) => ({ ...S, ...o, dur: dur ?? (S.dur - from) / speed, draw: (g, t, raw) => S.draw(g, from + t * speed, raw) });
const { T1, SERIN, T6, T7, T8 } = PARTS;
const RACE8 = ACT2.slice(0, 8), RING = ACT2[8];
const LIGHT = '탑의 빛은 여덟 종족에게 내려앉았다.';
const TITLE_SCENE = clip(T6, { dur: 3.4, text: '그리고 오늘 밤, 바람결 마을.', textAt: 0.4 });

export const SCENES = [
  clip(S1, { from: 2.3, text: '아주 먼 옛날, 하늘이 갈라졌다.', textAt: 0.3, fo: 0.25 }),
  clip(S2, { from: 1.6, dur: 2.6, text: '떨어진 별의 이름은 아르케.', textAt: 1.1, fi: 0.25 }),
  clip(S3, { speed: 2.2, text: '별이 떨어진 자리에 탑이 솟았다.', textAt: 1.0 }),
  ...RACE8.map((S, i) => clip(S, { from: [0.7, 0.7, 0.7, 0.7, 1.0, 0.9, 0.9, 0.7][i], dur: 0.5, text: LIGHT, textAt: 0.1, fi: 0.1, fo: 0.1 })), // 종족마다 한 컷 (몸이 움직이는 가장 센 순간만)
  clip(RING, { speed: 1.8, text: '빛은 몸에 문양으로 새겨졌다. 사람들은 그것을 각인이라 불렀다.', textAt: 0.3 }),
  clip(T1, { speed: 4.6 / 2.4, text: '각인을 지닌 자들은 탑을 올랐다. 꼭대기에 닿은 이는 아직 없다.', textAt: 0.3 }),
  clip(SERIN, { dur: 2.0, text: '몇 해 전에도, 바람결 마을의 누군가가 각인을 안고 탑에 들어갔다.', textAt: 0.4, fo: 0 }),
  clip(SERIN, { from: 3.6, dur: 1.6, text: '그는 돌아오지 않았다.', textAt: 0.1, fi: 0 }),
  TITLE_SCENE,
  clip(T7, { speed: 3.6 / 2.2, text: '탑이 다시 울린다. 이번에는 — 너를 부른다.', textAt: 0.15 }),
  clip(T8, { speed: 6.0 / 3.4 }),
];
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const startsOf = (scenes) => { const st = []; let acc = 0; for (const s of scenes) { st.push(acc); acc += s.dur; } return { st, total: acc }; };
const MAIN = startsOf(SCENES);
export const TOTAL = MAIN.total;
// 타이틀 화면 뒤에 되풀이할 구간: 「오늘 밤, 바람결 마을」 장면의 가운데 (모닥불 · 탑 · 어두워지기 전)
export const TITLE_BG = { t0: MAIN.st[SCENES.indexOf(TITLE_SCENE)] + 0.6, len: 2.6 };

// 도트 판 하나 (한 장면의 한 순간을 그린다)
export function makeStage(scenes = SCENES) {
  const { st: STARTS } = startsOf(scenes), sceneAt = (t) => { let i = 0; while (i < scenes.length - 1 && t >= STARTS[i + 1]) i++; return i; };
  const lo = document.createElement('canvas'); lo.width = IW; lo.height = IH;
  const raw = lo.getContext('2d'), g = new PixelCtx(raw);
  const draw = (t) => {
    const i = sceneAt(t), s = scenes[i], lt = t - STARTS[i];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    raw.fillStyle = '#000'; raw.fillRect(0, 0, IW, IH);
    s.draw(g, lt, raw);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const fi = s.fi ?? 0.45, fo = s.fo ?? 0.45; // 장면 사이는 점묘로 어두워졌다 밝아진다
    if (fi > 0 && lt < fi) cover(raw, 1 - lt / fi);
    if (fo > 0 && lt > s.dur - fo) cover(raw, (lt - (s.dur - fo)) / fo);
    return { i, s, lt };
  };
  return { lo, draw };
}

// 자막: 앞뒤 장면과 같은 글이면 끊기지 않고 이어진다
function subtitleAlpha(SCENES, i, lt) {
  const s = SCENES[i], prev = SCENES[i - 1], next = SCENES[i + 1];
  if (!s.text) return 0;
  const at = s.textAt ?? 0.5;
  const fin = prev?.text === s.text ? 1 : seg(lt, at, at + 0.4), fout = next?.text === s.text ? 1 : 1 - seg(lt, s.dur - 0.45, s.dur - 0.1);
  return Math.min(fin, fout);
}

export function createIntro(display, { onDone, loop = false, startAt = 0, scenes = SCENES, skipText = TOUCH ? '화면을 누르면 건너뜁니다 ▶' : '아무 키나 누르면 건너뜁니다 ▶' } = {}) {
  const SCENES = scenes, TOTAL = startsOf(scenes).total;
  const stage = makeStage(scenes), dg = display.getContext('2d');
  let t0 = null, raf = 0, ended = false;
  const finish = () => { if (ended) return; ended = true; cancelAnimationFrame(raf); off(); onDone?.(); };
  const skip = (e) => { if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; e.stopPropagation(); e.preventDefault(); finish(); }; // 건너뛰는 키가 게임에 닿지 않게 (G · Esc 등)
  const on = () => { addEventListener('keydown', skip, true); display.addEventListener('pointerdown', skip); };
  const off = () => { removeEventListener('keydown', skip, true); display.removeEventListener('pointerdown', skip); };
  function frame(now) {
    if (t0 == null) t0 = now - startAt * 1000;
    let t = (now - t0) / 1000;
    if (t >= TOTAL) { if (loop) { t0 = now; t = 0; } else { finish(); return; } }
    const W = display.width = display.clientWidth, Hh = display.height = display.clientHeight;
    let sc = Math.min(W / IW, Hh / IH); if (sc >= 1) sc = Math.floor(sc);
    const ox = Math.round((W - IW * sc) / 2), oy = Math.round((Hh - IH * sc) / 2);
    const { i, lt } = stage.draw(t);
    dg.fillStyle = '#000'; dg.fillRect(0, 0, W, Hh);
    dg.imageSmoothingEnabled = false;
    dg.drawImage(stage.lo, ox, oy, IW * sc, IH * sc);
    const a = subtitleAlpha(SCENES, i, lt);
    if (a > 0) {
      let fs = Math.max(22, Math.round(sc * 5.2));
      dg.font = `${fs}px Galmuri11, sans-serif`;
      { const w = dg.measureText(SCENES[i].text).width; if (w > W * 0.9) fs = Math.max(13, Math.floor(fs * (W * 0.9) / w)); } // 좁은 화면(휴대폰 세로)에서도 한 줄에
      const y = oy + IH * sc - Math.round(fs * 1.6);
      dg.font = `${fs}px Galmuri11, sans-serif`; dg.textAlign = 'center'; dg.textBaseline = 'middle';
      dg.globalAlpha = a * 0.55; dg.fillStyle = '#05040a'; // 밝은 장면에서도 읽히게 글 뒤에 어둠 띠
      { const bw = dg.measureText(SCENES[i].text).width + fs * 2; dg.fillRect(Math.round(W / 2 - bw / 2), Math.round(y - fs * 0.9), Math.round(bw), Math.round(fs * 1.8)); }
      dg.globalAlpha = a;
      const o = Math.max(2, Math.round(fs / 10));
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) dg.fillText(SCENES[i].text, W / 2 + dx, y + dy);
      dg.fillStyle = '#f4ecd8'; dg.fillText(SCENES[i].text, W / 2, y);
      dg.globalAlpha = 1;
    }
    if (t > 1 && t < TOTAL - 1) { dg.font = `${Math.max(15, Math.round(sc * 3))}px Galmuri11, sans-serif`; dg.textAlign = 'right'; dg.textBaseline = 'middle'; dg.fillStyle = 'rgba(232,224,240,0.75)'; dg.fillText(skipText, W - 20, 28); }
    raf = requestAnimationFrame(frame);
  }
  return { start() { on(); raf = requestAnimationFrame(frame); }, stop: finish };
}
