// 숙련: 같은 행동을 몇 번쯤 하면 깨닫는지 (사람마다 다르게, 문턱 아래로는 절대 안 나오게)
const root = process.argv[2] || new URL('../../public/js', import.meta.url).href;
const { KNACKS, knackTick, newKnack } = await import(root + '/data/knacks.js');
let seed = 7; const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (const id of ['lumber', 'angler', 'haggler', 'windStep', 'leap', 'harpoon', 'slowField']) {
  const def = KNACKS[id], got = [];
  for (let run = 0; run < 400; run++) {
    const k = newKnack();
    let n = 0;
    while (!k.got[id] && n < 5000) { knackTick(k, def.act, rand); n++; }
    got.push(n);
  }
  got.sort((a, b) => a - b);
  const pick = (q) => got[Math.floor(q * (got.length - 1))];
  console.log(`${(def.name || def.skill).padEnd(10)} 문턱 ${def.min} · 빨리 깨닫는 사람 ${pick(0.1)} · 보통 ${pick(0.5)} · 늦은 사람 ${pick(0.9)} · 가장 이른 ${got[0]}`);
}
