import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await p.goto('http://localhost:5187/lab.html?lab&debug'); await p.waitForFunction(() => window.__lab); await p.waitForTimeout(1500);
await p.evaluate(() => window.__lab.build({ race: 'orc', level: 50, weapon: '', off: null, hidden: false, slots: {} })); await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(() => window.__game.renderer.guideRects)));
const got = [];
for (const t of ['char', 'skills', 'gear', 'altar']) { await p.evaluate((t) => { window.__lab.close(); window.__lab.panel(t); }, t); got.push(...await p.evaluate(() => [...document.querySelectorAll('[data-guide]')].map((e) => e.dataset.guide))); }
await p.evaluate(() => { window.__lab.close(); window.__lab.quest(); }); got.push(...await p.evaluate(() => [...document.querySelectorAll('[data-guide]')].map((e) => e.dataset.guide)));
console.log([...new Set(got)].join(' '));
await b.close();
