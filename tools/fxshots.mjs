// 스킬 장면 찍기: 체험실(lab.html)에서 각인 스킬을 하나씩 써 보고 0.15 · 0.4 · 0.7 · 1.0 · 1.4초 장면을 찍는다
// 쓰기: node tools/fxshots.mjs <나올 폴더> [걸러내기: all | race | orig | hidden | 각인id,각인id...] [포트 5195]
// 결과: <폴더>/<각인>_<t>.png (장면) · <폴더>/report.json (그림 오류 · 안 나간 스킬). 시트로 붙이기는 tools/fxsheet.py
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const OUT = process.argv[2] || 'fxshots', FILTER = process.argv[3] || 'all', PORT = +(process.argv[4] || 5195);
const TIMES = (process.env.TIMES || "0.15,0.4,0.7,1.0,1.4").split(",").map(Number);
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
    errs = [];
    const r = { ...s, fired: false, errs: [], toast: null };
    try {
      await page.evaluate((s) => { window.__lab.build({ race: s.race, level: 60, weapon: s.weapon, off: s.off, slots: { head: s.eid }, hidden: s.cat === 'hidden' }); window.__lab.practice(); const t0 = document.getElementById('errToast'); if (t0) t0.hidden = true; document.querySelectorAll('#lab,.lab').forEach((e) => { e.style.display = 'none'; }); }, s);
      await sleep(700);
      const pos = await page.evaluate(() => {
        const W = window.__game.world, p = W.player, R = window.__game.renderer;
        W.enemies.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); W.enemies.splice(3); W.enemies.forEach((e, i) => { e.x = p.x + 80 + i * 26; e.y = p.y + (i - 1) * 18; e.vx = e.vy = 0; e.spd = 0; if (W.canWalk && !W.canWalk(e.x, e.y)) { e.x = p.x - 80 - i * 26; } });
        let best = null, bd = 1e9; for (const e of W.enemies) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
        p.res = p.resMax || 100; p.cds = {}; window.__fxev = []; if (!W.__fxw) { const o = W.emit.bind(W); W.emit = (ev) => { window.__fxev.push(ev.t === 'noRes' ? 'noRes:' + ev.text : ev.t); return o(ev); }; W.__fxw = 1; } p.hp = p.maxHp || p.hp;
        const c = R.c.getBoundingClientRect(), tx = best ? best.x : p.x + 100, ty = best ? best.y : p.y;
        const sx = c.left + (tx - R.cam.x) / R.VW * c.width, sy = c.top + (ty - R.cam.y) / R.VH * c.height;
        const px = c.left + (p.x - R.cam.x) / R.VW * c.width, py = c.top + (p.y - R.cam.y) / R.VH * c.height;
        return { sx, sy, px, py, sk: W.b?.skills?.[0]?.id || W.b?.skills?.[0] };
      });
      await page.mouse.move(pos.sx, pos.sy);
      await sleep(60);
      await page.keyboard.down('KeyQ'); const t0 = Date.now();
      setTimeout(() => page.keyboard.up('KeyQ').catch(() => {}), 120);
      for (const t of TIMES) {
        const wait = t * 1000 - (Date.now() - t0); if (wait > 0) await sleep(wait);
        const W = 320, H = 200;
        await page.screenshot({ path: `${OUT}/${s.eid}_${t}.png`, clip: { x: Math.max(0, Math.min(960 - W, pos.px - W / 2)), y: Math.max(0, Math.min(600 - H, pos.py - H / 2)), width: W, height: H } });
      }
      const st = await page.evaluate((sk) => { const p = window.__game.world.player; const t = document.getElementById('errToast'); const ev = window.__fxev || []; const no = ev.find((x) => String(x).startsWith('noRes')); return { cd: Object.keys(p.cds || {}).length > 0 && !no, no, ev: [...new Set(ev)].slice(0, 12), toast: t && !t.hidden ? t.textContent : null }; });
      r.fired = st.cd; r.no = st.no; r.ev = st.ev; r.toast = st.toast; r.equipped = pos.sk;
    } catch (e) { // 페이지가 멈췄으면 새로 연다 (다음 스킬까지 망치지 않게)
      r.errs.push('tool: ' + String(e.message).split('\n')[0].slice(0, 160));
      try { await page.close(); } catch {}
      page = await browser.newPage({ viewport: { width: 960, height: 600 } }); hook(page);
      await page.goto(`http://localhost:${PORT}/lab.html`); await page.waitForFunction(() => window.__lab && window.__game, null, { timeout: 30000 });
    }
    r.errs.push(...errs);
    report.push(r);
    if (!r.fired || r.errs.length || r.toast) console.log('!', s.eid, s.sk, r.fired ? '' : 'NOT FIRED ' + (r.no || ''), r.toast || '', r.errs.join(' | '));
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  console.log('done', report.length, 'notFired', report.filter((r) => !r.fired).length, 'err', report.filter((r) => r.errs.length || r.toast).length);
} finally { await browser.close(); srv.kill(); }
