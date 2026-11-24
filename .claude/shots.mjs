// UI 검토용 스크린샷 (커밋하지 않음): node .claude/shots.mjs <outdir> [desk|phone] [only,tabs]
import { chromium, devices } from '/opt/node-tools/node_modules/playwright/index.mjs';
const out = process.argv[2] || 'shots';
const mode = process.argv[3] || 'desk';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const PORT = process.env.PORT || 5187;
const b = await chromium.launch();
const ctxOpt = mode === 'phone' ? { ...devices['iPhone 13 landscape'] } : mode === 'phonep' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } };
const ctx = await b.newContext(ctxOpt);
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(`http://localhost:${PORT}/lab.html?lab&debug`);
await p.waitForFunction(() => window.__lab, null, { timeout: 20000 });
await p.waitForTimeout(1500);
const withSkills = process.env.SK === '1';
await p.evaluate(async (withSkills) => {
  const slots = { head: '', arm: '', heart: '', leg: '', back: '' };
  if (withSkills) {
    const { ENGRAVINGS } = await import('/js/data/engravings.js');
    const { engravingSkillFor } = await import('/js/data/skills.js');
    const ids = Object.keys(ENGRAVINGS).filter((id) => !ENGRAVINGS[id].hidden && engravingSkillFor(id, 'orc'));
    const order = ['head', 'arm', 'heart', 'leg', 'back'];
    const used = new Set();
    for (const sl of order) { const id = ids.find((x) => !used.has(engravingSkillFor(x, 'orc')) && (ENGRAVINGS[x].slot === sl || !ENGRAVINGS[x].slot)) || ids.find((x) => !used.has(engravingSkillFor(x, 'orc'))); if (id) { slots[sl] = id; used.add(engravingSkillFor(id, 'orc')); } }
  }
  window.__lab.build({ race: 'orc', level: 50, weapon: '', off: null, hidden: false, slots });
}, withSkills);
await p.evaluate(() => { const el = document.getElementById('lab'); el.classList.add('min'); });
await p.waitForTimeout(2500);
const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${mode}_${name}.png` }); };
const want = (n) => !only || only.includes(n);
if (want('hud')) await shot('hud');
const tabs = ['char', 'skills', 'gear', 'where', 'altar', 'shop', 'forge', 'craft', 'trade', 'learn', 'cook', 'storage', 'quest', 'hunt', 'bag', 'codex'];
for (const t of tabs) {
  if (!want(t)) continue;
  await p.evaluate((t) => { window.__lab.close(); window.__lab.panel(t, true); }, t);
  await shot('tab_' + t);
}
await p.evaluate(() => window.__lab.close());
for (const m of ['quest', 'settings', 'pause']) {
  if (!want('m_' + m)) continue;
  await p.evaluate((m) => { window.__lab.close(); window.__lab[m](); }, m);
  await shot('m_' + m);
  await p.evaluate(() => window.__lab.close());
}
if (want('boss')) {
  await p.evaluate(() => window.__lab.tower(10));
  await p.waitForTimeout(10000);
  await shot('boss');
}
if (want('trial')) {
  await p.evaluate(() => window.__lab.trial('sword'));
  await p.waitForTimeout(3000);
  await shot('trial');
}
await b.close();
