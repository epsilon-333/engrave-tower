// 각인 전체 목록 문서 만들기: node tools/engdoc.mjs → docs/각인-전체-목록.md
import { writeFileSync } from 'fs';
const root = new URL('../public/js', import.meta.url).href;
const { ENGRAVINGS, TAGS } = await import(root + '/data/engravings.js');
const { MONSTERS, ECHOES, ZONES } = await import(root + '/data/monsters.js');
const { SKILLS, ENGRAVING_SKILLS } = await import(root + '/data/skills.js');
const { STAT_INFO, SPECIAL_INFO } = await import(root + '/data/stats.js');
const GR = ['', '1 회색', '2 초록', '3 파랑', '4 보라', '5 금색(전설)'], SLOT = { head: '머리', arm: '팔', heart: '심장', leg: '다리', back: '등' };
const statTxt = (st) => Object.entries(st || {}).map(([k, v]) => `${(STAT_INFO[k] || SPECIAL_INFO[k] || { name: k }).name} ${v > 0 ? '+' : ''}${v}`).join(', ');
const rec = (r) => Object.entries(r).map(([e, n]) => `${ECHOES[e]?.name || e} ${n}`).join(' + ');
const monZone = (mid) => ZONES.find((z) => [...z.pool, z.elite].includes(mid))?.id || (MONSTERS[mid]?.boss ? 'tower' : 'raid');
const zoneOfEcho = (eid) => { for (const z of ZONES) for (const m of [...z.pool, z.elite]) { const d = MONSTERS[m]; if (d.echo.id === eid || d.part === eid) return z.id; } return null; };
const zName = (z) => z === 'tower' ? '각인의 탑 수호자' : z === 'raid' ? '레이드 · 우두머리' : z === 'mix' ? '혼합' : ZONES.find((x) => x.id === z)?.name || z;
const row = (id) => {
  const e = ENGRAVINGS[id], sk = SKILLS[ENGRAVING_SKILLS[id]];
  return `| ${e.name} | ${GR[e.grade] || e.grade} | ${SLOT[e.slot]} | ${e.tags.map((t) => TAGS[t]?.name || t).join('·') || '—'} | ${e.from ? MONSTERS[e.from].name : '—'} | ${rec(e.recipe)} | ${statTxt(e.stats)} | ${e.effects.map((x) => x.text).join('<br>')} | **${sk?.name || '—'}**${sk?.ult ? ' (궁극)' : ''}<br>${(sk?.desc || '').replace(/\|/g, '/').replace(/\n/g, ' ')} |`;
};
const head = '| 각인 | 등급 | 부위 | 태그 | 몬스터 | 재료 | 능력치 | 패시브 | 액티브 스킬 |\n|---|---|---|---|---|---|---|---|---|';
const byG = (ids) => ids.sort((a, b) => ENGRAVINGS[a].grade - ENGRAVINGS[b].grade || ENGRAVINGS[a].name.localeCompare(ENGRAVINGS[b].name, 'ko'));
const all = Object.keys(ENGRAVINGS), mon = all.filter((id) => ENGRAVINGS[id].from), glyph = all.filter((id) => !ENGRAVINGS[id].from);
let out = `# 각인 전체 목록 (${all.length}개)\n\n자동 생성: \`node tools/engdoc.mjs\`. 모든 각인은 **패시브 + 액티브 스킬**을 가진다. 전설 각인의 스킬은 궁극기.\n\n- 몬스터 각인 ${mon.length}개: 그 몬스터의 부산물 + 계열 잔향으로 새긴다\n- 문양 각인 ${glyph.length}개: 계열 잔향으로 새긴다\n\n## 태그 시너지\n\n| 태그 | 단계 | 각인 수 |\n|---|---|---|\n${Object.entries(TAGS).map(([t, T]) => `| ${T.name} | ${T.tiers.map((x) => `${x.n}개: ${x.text}`).join('<br>')} | ${all.filter((id) => ENGRAVINGS[id].tags.includes(t)).length} |`).join('\n')}\n`;
out += `\n## 몬스터 각인 (${mon.length}개)\n`;
for (const z of [...ZONES.map((x) => x.id), 'tower', 'raid']) { const ids = byG(mon.filter((id) => monZone(ENGRAVINGS[id].from) === z)); if (ids.length) out += `\n### ${zName(z)} (${ids.length})\n\n${head}\n${ids.map(row).join('\n')}\n`; }
out += `\n## 문양 각인 (${glyph.length}개)\n`;
const gz = (id) => { const zs = [...new Set(Object.keys(ENGRAVINGS[id].recipe).map(zoneOfEcho))]; return zs.length === 1 ? zs[0] : 'mix'; };
for (const z of [...ZONES.map((x) => x.id), 'mix']) { const ids = byG(glyph.filter((id) => gz(id) === z)); if (ids.length) out += `\n### ${zName(z)} 계열 (${ids.length})\n\n${head}\n${ids.map(row).join('\n')}\n`; }
writeFileSync(new URL('../docs/각인-전체-목록.md', import.meta.url), out);
console.log('docs/각인-전체-목록.md', all.length, mon.length, glyph.length);
