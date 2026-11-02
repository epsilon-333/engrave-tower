// pixelfx(MIT · vendor/pixelfx/LICENSE · NOTICE.md)의 이펙트를 게임 화면에 그린다.
// 이펙트마다 제 크기의 픽셀 틀(color + light)에 그리고, 합친 그림을 세계 좌표에 1:1로 얹는다 (도트가 게임과 같은 크기).
import { createFrame, clearFrame, createFx, composite } from '../vendor/pixelfx/core/index.js';

const mods = {}; // 'explosions/small-explosion' → 모듈 (처음 쓸 때 불러 둔다)
const loading = {};
export function preload(ids) { for (const id of ids) load(id); }
function load(id) {
  if (mods[id] || loading[id]) return mods[id];
  loading[id] = import(`../vendor/pixelfx/fx/${id}.js`).then((m) => { mods[id] = m; }).catch(() => { mods[id] = null; });
  return null;
}

let seedN = 1;
export class PxFx {
  constructor() { this.list = []; }
  // id: pixelfx 이펙트 · x, y: 세계 좌표(이펙트의 기준점) · o: { palette, flip, angle, scale, speed, max(초), ...이펙트 옵션 }
  add(id, x, y, o = {}) {
    const mod = mods[id] ?? load(id);
    if (!mod) return false; // 아직 못 불렀으면 이번에는 건너뛴다 (preload로 미리 불러 둔다)
    const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
    const { scale = 1, sy = 1, speed = 1, max, floor = 46, ...opts } = o;
    const fx = createFx(mod, { ...opts, x: ox, y: oy, seed: opts.seed ?? (seedN = (seedN * 1103515245 + 12345) >>> 0) % 100000 });
    const frame = createFrame(w, h), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    this.list.push({ fx, frame, cv, ctx, img, x, y, ox, oy, w, h, scale, sy, speed, floor, t: 0, max: max ?? mod.meta.duration ?? 2 });
    if (this.list.length > 40) this.list.shift();
    return true;
  }
  // 매 프레임 한 번: 시간을 흘리고 그림을 만든다. 실제로 얹는 것은 drawOne (렌더러가 건물 · 사람과 함께 y 순서로 부른다)
  update(dt) {
    for (const e of this.list) {
      e.t += dt * e.speed; e.fx.update(dt * e.speed);
      clearFrame(e.frame); e.fx.draw(e.frame);
      composite(e.frame, e.img.data, null);
      if (e.floor) { // pixelfx는 옆에서 본 그림이라 땅(기준선)을 따라 먼지 · 그을음이 길게 깔린다 → 위에서 보는 이 게임에서는 막대처럼 보여서 기준선 근처의 멀리 뻗은 부분을 지운다
        const D = e.img.data, y0 = Math.max(0, e.oy - 10), y1 = Math.min(e.h, e.oy + 8), xl = e.ox - e.floor, xr = e.ox + e.floor;
        for (let y = y0; y < y1; y++) for (let x = 0; x < e.w; x++) if (x < xl || x > xr) D[(y * e.w + x) * 4 + 3] = 0;
      }
      e.ctx.putImageData(e.img, 0, 0);
    }
    this.list = this.list.filter((e) => e.t < e.max && !e.fx.done());
  }
  drawOne(g, e) { // sy: 세로 배율 (바닥에 깔리는 이펙트는 눌러서 눕힌다)
    const s = e.scale, sy = s * e.sy;
    g.drawImage(e.cv, Math.round(e.x - e.ox * s), Math.round(e.y - e.oy * sy), Math.round(e.w * s), Math.round(e.h * sy));
  }
}
