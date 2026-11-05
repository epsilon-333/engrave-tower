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
    const { scale = 1, sy = 1, speed = 1, max, floor = 46, rot = 0, sortY, ...opts } = o; // rot: 화면에 얹을 때 돌린다 (이펙트 틀 안에서 돌리면 틀 밖으로 나간 부분이 잘린다)
    delete opts.angle; delete opts.flip;
    for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k]; // 빈 값이 이펙트의 기본값(팔레트 등)을 덮지 않게
    const fx = createFx(mod, { ...opts, x: ox, y: oy, seed: opts.seed ?? (seedN = (seedN * 1103515245 + 12345) >>> 0) % 100000 });
    const frame = createFrame(w, h), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    const e = { fx, frame, cv, ctx, img, x, y, ox, oy, w, h, scale, sy, speed, floor, rot, sortY, t: 0, max: max ?? mod.meta.duration ?? 2 };
    this.list.push(e);
    if (this.list.length > 60) this.list.shift();
    return e;
  }
  // 매 프레임 한 번: 시간을 흘리고 그림을 만든다. 실제로 얹는 것은 drawOne (렌더러가 건물 · 사람과 함께 y 순서로 부른다)
  update(dt) {
    for (const e of this.list) {
      e.t += dt * e.speed;
      try { e.fx.update(dt * e.speed); clearFrame(e.frame); e.fx.draw(e.frame); } catch (err) { e.keep = -1; e.max = 0; console.warn('pixelfx', err?.message); continue; } // 이펙트 하나가 잘못돼도 게임은 멈추지 않는다
      composite(e.frame, e.img.data, null);
      if (e.floor) { // pixelfx는 옆에서 본 그림이라 땅(기준선)을 따라 먼지 · 그을음이 길게 깔린다 → 위에서 보는 이 게임에서는 막대처럼 보여서 기준선 근처의 멀리 뻗은 부분을 지운다
        const D = e.img.data, y0 = Math.max(0, e.oy - 10), y1 = Math.min(e.h, e.oy + 8), xl = e.ox - e.floor, xr = e.ox + e.floor;
        for (let y = y0; y < y1; y++) for (let x = 0; x < e.w; x++) if (x < xl || x > xr) D[(y * e.w + x) * 4 + 3] = 0;
      }
      e.ctx.putImageData(e.img, 0, 0);
    }
    this.list = this.list.filter((e) => (e.keep != null ? e.t < e.keep : e.t < e.max && !e.fx.done()));
  }
  // 따라다니는 이펙트(날아가는 탄 · 떨어지는 운석): 매 프레임 hold(e, x, y, angle)로 자리를 옮긴다. 붙잡지 않으면 곧 사라진다
  hold(e, x, y, angle) { e.x = x; e.y = y; if (angle != null) e.rot = angle; e.keep = e.t + 0.06; }
  drawOne(g, e) { // sy: 세로 배율 (바닥에 깔리는 이펙트는 눌러서 눕힌다)
    const s = e.scale, sy = s * e.sy;
    if (!e.rot) { g.drawImage(e.cv, Math.round(e.x - e.ox * s), Math.round(e.y - e.oy * sy), Math.round(e.w * s), Math.round(e.h * sy)); return; }
    // 돌린 그림은 따로 만든 일반 캔버스에서 돌려(도트 그대로 · 투명 유지) 똑바로 얹는다 — 게임 화면 층에서 바로 돌리면 투명한 곳이 검게 나온다
    const W = Math.round(e.w * s), H = Math.round(e.h * sy), R = Math.ceil(Math.hypot(Math.max(e.ox * s, W - e.ox * s), Math.max(e.oy * sy, H - e.oy * sy))), D = R * 2 + 2;
    const rc = (e.rc ||= document.createElement('canvas')); if (rc.width !== D) { rc.width = D; rc.height = D; }
    const c2 = rc.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, D, D); c2.imageSmoothingEnabled = false;
    c2.translate(R + 1, R + 1); c2.rotate(e.rot); c2.drawImage(e.cv, Math.round(-e.ox * s), Math.round(-e.oy * sy), W, H);
    g.drawImage(rc, Math.round(e.x - R - 1), Math.round(e.y - R - 1));
  }
}
