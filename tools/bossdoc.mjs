// 탑 보스 기술 정리 문서: docs/보스-기술-정리.md 를 데이터에서 다시 만든다
// 사용: node tools/bossdoc.mjs
// 보스 · 기술 이름 · 단계 · 패시브는 데이터(monsters.js · data/tower.js · data/climb.js)에서 그대로,
// 기술이 하는 일 · 피하는 법은 아래 MOVE 표 (sim/enemyai.js · sim/towerzone.js 의 동작에 맞춰 적었다 — 기술을 바꾸면 여기도)
import { writeFileSync } from 'node:fs';
const r = new URL('../public/js', import.meta.url).href;
const { ACTS } = await import(r + '/data/climb.js');
const { MONSTERS } = await import(r + '/data/monsters.js');
const { CLIMB_SIGS, BOSS_PASSIVES } = await import(r + '/data/tower.js');

// 기술 열쇠 → [기본 이름, 하는 일, 피하는 법, 회복이면 true]
const MOVE = {
  adds: ['부하 호출', '부하 둘을 깨운다', '부하가 붙기 전에 보스를 몰아치거나, 부하부터 정리'],
  beam: ['광선', '빨간 조준선(0.9초)을 보여 준 뒤 곧은 광선. 벽에서 멈춘다', '조준선 옆으로 비킨다 · 벽 뒤로 숨는다'],
  beltFlip: ['컨베이어 역회전', '바닥 톱니 띠가 6초 동안 거꾸로 · 두 배 빠르게 돈다', '띠가 미는 반대 방향으로 걷는다'],
  blink: ['순간이동', '잠깐 사라졌다가 다른 자리에 나타난다', '나타난 자리를 보고 다시 붙는다'],
  channel: ['회복 의식', '3초 동안 버티면 체력 18% 회복 (초록빛 · 체력바에 회복될 몫이 깜빡인다)', '3초 안에 보스 최대 체력의 7%만큼 때리면 끊기고 3초 기절 (빈틈)', true],
  charge: ['돌진', '굵은 빨간 예고선(0.8초)이 끝나면 예고선 끝(벽이면 벽 앞)까지 달린다', '예고선 옆으로 비키거나 구른다'],
  cleave: ['정면 대베기', '앞쪽 거의 반원을 크게 벤다', '보스 등 뒤로 돌아간다'],
  clones: ['분신', '분신 둘을 만들고 셋이 자리를 섞는다', '분신은 금방 부서진다 — 버티는 쪽이 진짜'],
  collapse: ['구름 붕괴', '바닥 절반이 2초 뒤 하늘로 꺼진다 (10초 동안)', '남는 쪽 바닥으로 건너간다'],
  combo: ['연속 베기', '짧은 예고 뒤 세 번 벤다 (0.22초 간격)', '물러나거나 구른다'],
  constellation: ['별자리 긋기', '내 둘레의 별 다섯을 선으로 잇고, 1.4초 뒤 선을 따라 별빛이 떨어진다', '선 위에서 벗어난다'],
  copy: ['거울 복사', '내 스킬을 똑같이 따라 쓴다', '머리 위에 뜨는 기술 이름을 보고 피한다'],
  crossBeam: ['십자 광선', '+ 모양 광선 → 비스듬한 × 모양 광선 (예고선이 먼저 보인다)', '광선 사이의 틈으로 옮겨 다닌다'],
  donut: ['바깥 고리', '보스 둘레 바깥 고리가 터진다', '보스 곁(안쪽)으로 들어간다'],
  douse: ['빛 끄기', '켜진 빛기둥 하나를 끈다. 다 꺼져 있으면 어둠이 차오른다 (반경 8칸 · 1.2초 예고)', '꺼진 빛기둥을 G로 다시 깨운다 — 빛 안의 대사제는 25% 더 아프게 맞는다'],
  fan: ['부채꼴 사격', '부채꼴로 다섯 발', '탄 사이로 빠지거나 옆으로 크게 돈다'],
  grab: ['끌어당기기', '사슬 예고선 — 맞으면 보스 앞으로 끌려가 곧 내려찍힌다', '예고선에서 벗어난다'],
  gust: ['돌풍', '보스에게서 멀어지는 쪽으로 세게 밀린다', '가장자리를 등지지 않는다'],
  jumps3: ['세 번 뛰기', '내 자리로 세 번 연달아 뛰어내린다', '멈추지 말고 계속 움직인다'],
  leap: ['뛰어들기', '예고 원으로 날아가 내려찍는다', '원 밖으로'],
  lightCore: ['빛의 핵', '3.5초 동안 핵이 드러난다 (피해 2배). 끝나기 0.9초 전부터 핵이 부풀어 둘레 7칸이 터진다', '몰아치다가 부풀기 시작하면 빠진다'],
  mark: ['표식', '한 사람을 따라다니는 원이 2.2초 뒤 터진다', '동료에게서 떨어진다'],
  meteorRain: ['운석 비', '내 자리에 세 번 떨어진다', '계속 움직인다'],
  mirror: ['반사 방패', '2.6초(각성 3.2초) 동안 방패가 빛나며 맞은 피해를 되돌린다 (「때리지 마라!」)', '빛나는 동안 때리지 않는다'],
  nova: ['둘레 폭발', '1.2초 뒤 보스 둘레 반경 110이 크게 터진다', '멀리 떨어진다'],
  pool: ['장판', '예고 원(1초)이 터진다', '원 밖으로'],
  quake: ['땅 찍기', '0.8초 뒤 퍼지는 충격파', '원 밖으로 · 구르기'],
  raceArt: ['각인 빌리기', '8종족의 기술을 빌려 쓴다', '머리 위 기술 이름을 보고 그 기술에 맞게 피한다'],
  rain: ['장판 비', '모든 사람 발밑과 둘레에 장판이 떨어진다 (바닥에만)', '발밑 원에서 벗어난다'],
  rewind: ['되감기', '2초 전의 내 자리에 잔상 → 1.2초 뒤 거기로 끌려가고 그 자리가 터진다', '끌려갈 때 구르면 피한다'],
  ripple: ['파문', '안 → 밖으로 고리 셋이 차례로 터진다', '이미 터진 고리 안으로 들어간다'],
  ritual: ['제물 의식', '제물 셋을 부른다. 7초 안에 다 쓰러뜨리면 보스가 무너진다(기절), 못 하면 큰 폭발', '제물부터 쓰러뜨린다'],
  shardHide: ['거울 숨바꼭질', '거울 여섯 중 하나에 숨는다', '진짜를 때리면 드러나 기절 · 가짜를 깨면 파편이 나에게 튄다'],
  shelfFall: ['책장 쓰러뜨리기', '가로 · 세로 줄 셋이 1.2초 뒤 무너진다', '줄 사이로 피한다'],
  shove: ['밀쳐내기', '세게 쳐서 멀리 날린다', '보스 정면을 피한다'],
  soar: ['승천', '날아올라 무적 · 불비 두 번 · 내 자리로 떨어진다', '계속 움직이고, 떨어지는 원 밖으로'],
  spikeTrail: ['가시 길', '보스에서 나를 향해 가시가 차례로 솟는다 (벽에서 멈춘다)', '옆으로 비킨다'],
  spiral: ['빙글 도는 탄', '탄이 소용돌이로 퍼진다', '탄 사이 틈으로'],
  split: ['갈라지는 탄', '날아가다 여러 갈래로 갈라지는 탄', '갈라지기 전에 멀리 떨어진다'],
  sweep: ['회전 광선', '예고 뒤 광선이 한쪽으로 돌며 쓸고 지나간다 (벽에서 멈춘다)', '도는 방향 반대로 돌아 광선 뒤에 선다'],
  timeStop: ['멈춘 시간', '3초 동안 나는 55% 느려지고 다른 적은 멈춘다. 0.4초마다 내 자리에 칼날 원이 쌓였다가 끝나면 한꺼번에 떨어진다', '끝날 때 칼날 원 밖에 선다'],
  tornado: ['회오리', '보스 양옆에 회오리 둘 (6초)', '회오리에 닿지 않게 돈다'],
  whalePass: ['하늘 가르기', '넓은 그림자 길(1.4초 예고)을 따라 고래가 하늘을 가로지른다', '그림자 길 밖으로'],
  whirl: ['회전베기', '둘레를 한 바퀴 벤다', '원 밖으로'],
};

const nameOf = (id, k) => ({ ...(MONSTERS[id].skillNames || {}), ...(CLIMB_SIGS[id]?.names || {}) })[k] || MOVE[k]?.[0] || k;
const lines = ['# 탑 보스 기술 정리', '', `> \`node tools/bossdoc.mjs\` 로 만든 문서 (데이터에서 자동). 보스마다 체력 100~66% · 66~33% · 33% 아래 세 단계로 기술이 바뀐다.`, '> ★ = 보스가 회복하는 기술 · 능력', ''];
const missing = new Set();
for (const a of ACTS) {
  lines.push(`## ${a.from}~${a.to}층 · ${a.name}${a.gimmick ? ` — ${a.gimmick}` : ''}`, '');
  for (const [role, id, f] of [['수호자', a.guardian, a.from + 4], ['주인', a.lord, a.to]]) {
    const d = MONSTERS[id], s = CLIMB_SIGS[id] || {};
    const awake = f > 50 && !s.fresh;
    lines.push(`### ${f}층 ${role} · ${awake ? '각성한 ' : ''}${d.name}`);
    if (s.hint) lines.push(`- **공략**: ${s.hint}`);
    const pas = (ph) => (ph || []).map((k) => `${k === 'regrow' ? '★' : ''}${BOSS_PASSIVES[k]?.name} (${BOSS_PASSIVES[k]?.text})`).join(' · ');
    if (s.passives?.length) lines.push(`- **패시브**: ${pas(s.passives)}`);
    const base = d.phaseMoves || [[], [], []];
    const ph = base.map((l, i) => [...l, ...(s.add?.[i] || []), ...(awake ? (s.add?.[Math.min(2, i + 1)] || []).slice(0, 1) : [])]);
    if (s.phase2?.add) ph[1].push(...s.phase2.add); if (s.phase2?.add) ph[2].push(...s.phase2.add); if (s.phase3?.add) ph[2].push(...s.phase3.add);
    const form = (v) => (v ? `「${v.text}」${v.atk ? ` · 공격 ×${v.atk}` : ''}${v.speed ? ` · 빠르기 ×${v.speed}` : ''}${v.passives ? ` · 패시브 ${pas(v.passives)}` : ''}` : '');
    ph.forEach((l, i) => {
      const uniq = [...new Set(l)];
      lines.push(`- **${i + 1}단계${i ? ` (${i === 1 ? '66%' : '33%'})` : ''}**${i && form([null, s.phase2, s.phase3][i]) ? ` — ${form([null, s.phase2, s.phase3][i])}` : ''}: ${uniq.map((k) => `${MOVE[k]?.[3] ? '★' : ''}${nameOf(id, k)}`).join(' · ') || '(평타만)'}`);
    });
    const all = [...new Set(ph.flat())];
    lines.push('', '| 기술 | 하는 일 | 피하는 법 |', '|---|---|---|');
    for (const k of all) { const m = MOVE[k]; if (!m) missing.add(k); lines.push(`| ${m?.[3] ? '★ ' : ''}${nameOf(id, k)} | ${m?.[1] || '(설명 없음)'} | ${m?.[2] || ''} |`); }
    lines.push('');
  }
}
lines.push('## 패시브', '', '| 패시브 | 효과 |', '|---|---|', ...Object.values(BOSS_PASSIVES).map((p) => `| ${p.name === '재생' ? '★ ' : ''}${p.name} | ${p.text} |`), '');
writeFileSync(new URL('../docs/보스-기술-정리.md', import.meta.url), lines.join('\n'));
console.log(`docs/보스-기술-정리.md · 보스 ${ACTS.length * 2}명${missing.size ? ' · 설명 없는 기술: ' + [...missing].join(', ') : ''}`);
