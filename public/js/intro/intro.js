// 아르케 인트로: 320×180 도트 판에 장면마다 직접 그리고, 화면 배율로 키워 보여 준다. 글자는 화면 해상도로 아래에 한 줄씩
import { PixelCtx } from '../render/pixelctx.js';
import { IW, IH, seg, cover } from './pix.js';
import { S1, S2, S3 } from './act1.js';
import { ACT2 } from './act2.js';
import { ACT3 } from './act3.js';

export const SCENES = [S1, S2, S3, ...ACT2, ...ACT3];
const STARTS = []; let acc = 0; for (const s of SCENES) { STARTS.push(acc); acc += s.dur; }
export const TOTAL = acc;
const sceneAt = (t) => { let i = 0; while (i < SCENES.length - 1 && t >= STARTS[i + 1]) i++; return i; };

// 도트 판 하나 (한 장면의 한 순간을 그린다)
export function makeStage() {
  const lo = document.createElement('canvas'); lo.width = IW; lo.height = IH;
  const raw = lo.getContext('2d'), g = new PixelCtx(raw);
  const draw = (t) => {
    const i = sceneAt(t), s = SCENES[i], lt = t - STARTS[i];
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
function subtitleAlpha(i, lt) {
  const s = SCENES[i], prev = SCENES[i - 1], next = SCENES[i + 1];
  if (!s.text) return 0;
  const at = s.textAt ?? 0.5;
  const fin = prev?.text === s.text ? 1 : seg(lt, at, at + 0.4), fout = next?.text === s.text ? 1 : 1 - seg(lt, s.dur - 0.45, s.dur - 0.1);
  return Math.min(fin, fout);
}

export function createIntro(display, { onDone, loop = false, startAt = 0 } = {}) {
  const stage = makeStage(), dg = display.getContext('2d');
  let t0 = null, raf = 0, ended = false;
  const finish = () => { if (ended) return; ended = true; cancelAnimationFrame(raf); off(); onDone?.(); };
  const skip = (e) => { if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; finish(); };
  const on = () => { addEventListener('keydown', skip); display.addEventListener('pointerdown', skip); };
  const off = () => { removeEventListener('keydown', skip); display.removeEventListener('pointerdown', skip); };
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
    const a = subtitleAlpha(i, lt);
    if (a > 0) {
      const fs = Math.max(18, Math.round(sc * 4.2)), y = oy + IH * sc - Math.round(fs * 1.6);
      dg.font = `${fs}px Galmuri11, "Noto Sans KR", sans-serif`; dg.textAlign = 'center'; dg.textBaseline = 'middle';
      dg.globalAlpha = a; dg.fillStyle = '#05040a';
      const o = Math.max(2, Math.round(fs / 10));
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) dg.fillText(SCENES[i].text, W / 2 + dx, y + dy);
      dg.fillStyle = '#f4ecd8'; dg.fillText(SCENES[i].text, W / 2, y);
      dg.globalAlpha = 1;
    }
    if (t > 1 && t < TOTAL - 1) { dg.font = `${Math.max(12, Math.round(sc * 2.4))}px Galmuri11, sans-serif`; dg.textAlign = 'right'; dg.fillStyle = 'rgba(232,224,240,0.35)'; dg.fillText('아무 키나 누르면 건너뜁니다', W - 16, 22); }
    raf = requestAnimationFrame(frame);
  }
  return { start() { on(); raf = requestAnimationFrame(frame); }, stop: finish };
}
