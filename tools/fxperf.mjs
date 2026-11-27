// 스킬 렉 재기: 체험실(lab.html)에서 각인 스킬을 하나씩 써 보고 2초 동안 renderer.draw 시간(최악 · 평균 ms)을 잰다
// 쓰기: node tools/fxperf.mjs <나올 폴더> [걸러내기: all | race | orig | hidden | 각인id,...] [포트 5195]
// 결과: <폴더>/perf.json · 화면에 느린 순 상위 25개
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const OUT = process.argv[2] || 'fxshots', FILTER = process.argv[3] || 'all', PORT = +(process.argv[4] || 5195);
mkdirSync(OUT, { recursive: true });
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1200);
const browser = await chromium.launch();
let page = await browser.newPage({ viewport: { width: 960, height: 600 } });
let errs = [];
const hook = (pg) => { pg.setDefaultTimeout(8000); pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200))); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); }); };
hook(page);
try {
  await page.goto(`http://localhost:${PORT}/lab.html`);
  await page.waitForFunction(() => window.__lab && window.__game, null, { timeout: 30000 });
  const list = await page.evaluate(async () => {
    const S = await import('/js/data/skills.js'), O = await import('/js/data/origskills.js'), H = await import('/js/data/hidden.js');
    const C = S.CLASSES || (await import('/js/data/skills.js')).CLASSES;
    const R = await import('/js/data/races.js'), R0 = Object.keys(R.RACES)[0];
    const hid = new Set(H.HIDDEN.map((h) => h.id)), out = [];
    for (const [eid, sk] of Object.entries(S.ENGRAVING_SKILLS)) {
      const d = S.SKILLS[sk]; if (!d) continue;
      const cat = hid.has(eid) || d.hidden ? 'hidden' : O.ORIG_SKILLS[eid] ? 'orig' : 'race';
      let race = d.race || C?.[d.cls]?.race || R0; if (!R.RACES[race]) race = R0;
      const weapon = d.kind === 'shoot' ? 'huntBow' : d.kind === 'shield' ? 'rustySword' : undefined, off = d.kind === 'shield' ? 'buckler' : undefined; // 무기가 있어야 하는 스킬은 맞는 무기를 쥐어 준다
      out.push({ eid, sk, cat, race, name: d.name, weapon, off });
    }
    return out;
  });
  const want = FILTER === 'all' ? list : ['race', 'orig', 'hidden'].includes(FILTER) ? list.filter((x) => x.cat === FILTER) : list.filter((x) => FILTER.split(',').includes(x.eid) || FILTER.split(',').includes(x.sk));
  console.log('skills', want.length, Object.fromEntries(['race', 'orig', 'hidden'].map((c) => [c, list.filter((x) => x.cat === c).length])));
  await page.evaluate((s) => { window.__lab.build({ race: s.race, level: 60, slots: {} }); window.__lab.practice(); }, list[0]); await sleep(1500); // 처음 한 번은 몸풀기 (첫 스킬이 안 나가지 않게)
  const report = [];
  for (const s of want) {
    const r = { eid: s.eid, sk: s.sk, name: s.name, cat: s.cat };
    try {
      await page.evaluate((s) => { window.__lab.build({ race: s.race, level: 60, weapon: s.weapon, off: s.off, slots: { head: s.eid }, hidden: s.cat === 'hidden' }); window.__lab.practice(); document.querySelectorAll('#lab,.lab').forEach((e) => { e.style.display = 'none'; }); }, s);
      await sleep(600);
      const pos = await page.evaluate(() => {
        const W = window.__game.world, p = W.player, R = window.__game.renderer;
        W.enemies.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); W.enemies.splice(3); W.enemies.forEach((e, i) => { e.x = p.x + 80 + i * 26; e.y = p.y + (i - 1) * 18; e.vx = e.vy = 0; e.spd = 0; });
        p.res = p.resMax || 100; p.cds = {}; p.hp = p.maxHp || p.hp;
        if (!R.__perf) { const o = R.draw.bind(R); R.draw = (...a) => { const t = performance.now(); try { return o(...a); } finally { (window.__ft ||= []).push(performance.now() - t); const C = (window.__cnt ||= { parts: 0, fx: 0, anims: 0, ground: 0 }); C.parts = Math.max(C.parts, R.parts.length); C.fx = Math.max(C.fx, R.fx.length); C.anims = Math.max(C.anims, R.anims.list.length); C.ground = Math.max(C.ground, R.anims.ground.length); } }; R.__perf = 1; }
        const c = R.c.getBoundingClientRect(), e = W.enemies[0], tx = e ? e.x : p.x + 100, ty = e ? e.y : p.y;
        return { sx: c.left + (tx - R.cam.x) / R.VW * c.width, sy: c.top + (ty - R.cam.y) / R.VH * c.height };
      });
      await page.mouse.move(pos.sx, pos.sy); await sleep(300);
      await page.evaluate(() => { window.__ft = []; window.__cnt = null; });
      const base = await page.evaluate(() => new Promise((res) => setTimeout(() => { const a = window.__ft; window.__ft = []; res(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)); }, 300)));
      await page.keyboard.down('KeyQ'); setTimeout(() => page.keyboard.up('KeyQ').catch(() => {}), 120);
      if (process.env.PROF) { const cdp = await page.context().newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); await sleep(2000); const { profile } = await cdp.send('Profiler.stop');
        const self = new Map(), dt = new Map(); profile.timeDeltas.forEach((d, i) => { const id = profile.samples[i]; dt.set(id, (dt.get(id) || 0) + d); });
        const par = new Map(), byId = new Map(); for (const n of profile.nodes) { byId.set(n.id, n); for (const c of n.children || []) par.set(c, n.id); }
        const key = (n) => { const f = n.callFrame; return `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; };
        // 그리기 함수(브라우저 · pixelctx 안쪽)의 시간은 그것을 부른 이펙트 함수로 올린다 (어느 그림이 무거운지 보이게)
        const low = (n) => !n.callFrame.url || /pixelctx\.js|color\.js/.test(n.callFrame.url);
        for (const n of profile.nodes) { let m = n; while (low(m) && par.has(m.id) && !/^\((idle|program|garbage|root)/.test(m.callFrame.functionName)) m = byId.get(par.get(m.id)); const k = key(m); self.set(k, (self.get(k) || 0) + (dt.get(n.id) || 0) / 1000); }
        r.prof = [...self].filter(([k]) => !/^\((idle|program|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + v.toFixed(1)); console.log(s.sk, '\n  ' + r.prof.join('\n  '));
        if (process.env.PROF === 'lines') { const L = new Map(); for (const n of profile.nodes) if (n.positionTicks && /renderer\.js/.test(n.callFrame.url) && n.callFrame.functionName === 'drawFrame') for (const t of n.positionTicks) L.set(t.line, (L.get(t.line) || 0) + t.ticks); console.log('  lines', [...L].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l, t]) => l + ':' + t).join(' ')); } await cdp.detach(); }
      else await sleep(2000);
      const ft = await page.evaluate(() => window.__ft.slice()); r.cnt = await page.evaluate(() => window.__cnt);
      ft.sort((a, b) => b - a);
      r.n = ft.length; r.max = +ft[0]?.toFixed(2); r.p95 = +(ft[Math.floor(ft.length * 0.05)] || 0).toFixed(2); r.avg = +(ft.reduce((x, y) => x + y, 0) / Math.max(1, ft.length)).toFixed(2); r.base = +base.toFixed(2);
    } catch (e) {
      r.err = String(e.message).split('\n')[0].slice(0, 160);
      try { await page.close(); } catch {}
      page = await browser.newPage({ viewport: { width: 960, height: 600 } }); hook(page);
      await page.goto(`http://localhost:${PORT}/lab.html`); await page.waitForFunction(() => window.__lab && window.__game, null, { timeout: 30000 });
    }
    report.push(r);
  }
  writeFileSync(`${OUT}/perf.json`, JSON.stringify(report, null, 1));
  const top = report.filter((r) => r.max != null).sort((a, b) => b.max - a.max).slice(0, +(process.env.TOP || 25));
  for (const r of top) console.log([r.eid, r.sk, r.name, 'max', r.max, 'p95', r.p95, 'avg', r.avg, 'base', r.base, JSON.stringify(r.cnt)].join('\t'));
  console.log('done', report.length, 'err', report.filter((r) => r.err).length);
} finally { await browser.close(); srv.kill(); }
