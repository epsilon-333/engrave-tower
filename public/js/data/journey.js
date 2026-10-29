// 여정: 지금 무엇을 하면 좋을지 하나씩 알려 주는 목표 줄 (화면 오른쪽 위 · J 창).
// 정해진 이야기가 아니라 "다음 한 걸음"이다. 하나를 마치면 보상을 받고 다음 목표가 보인다.
// check(s): 저장(s)만 보고 판단한다 (어디서 무엇을 했든 조건이 맞으면 끝난 것으로)
// to: 바깥 세계에서 화살표가 가리킬 것 (오브젝트 종류 · 조건)

const C = (s) => s.climb || {};
const metaSum = (s) => Object.values(C(s).meta || {}).reduce((a, b) => a + b, 0);
const lords = (s, n) => !!(C(s).lords || {})[n];

export const JOURNEY = [
  { id: 'door', title: '각인의 탑 문 앞에 서기', hint: '섬 한가운데 높은 탑. 화면의 노란 화살표를 따라가자', to: { kind: 'towerDoor' }, check: (s) => !!s.flags?.towerSeen || (C(s).runs || 0) > 0, reward: { shards: 3 } },
  { id: 'f1', title: '탑 1층 돌파', hint: '탑 문 앞에서 G → 「1층부터」. 적을 모두 쓰러뜨리면 층이 열린다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 1, reward: { gold: 80 } },
  { id: 'eng3', title: '한 번의 등반에서 각인 3개 새기기', hint: '층을 깨면 가운데 빛에서 보상을 받는다. 문 위의 그림 = 다음 층의 보상', to: { kind: 'towerDoor' }, check: (s) => (C(s).maxEng || 0) >= 3, reward: { shards: 5 } },
  { id: 'meta1', title: '탑의 축복 하나 배우기', hint: '탑 문 앞 → 「탑의 축복」. 쓰러져도 남는 별빛으로 영구히 강해진다', to: { kind: 'towerDoor' }, check: (s) => metaSum(s) >= 1, reward: { gold: 100 } },
  { id: 'f5', title: '5층 수호자 쓰러뜨리기', hint: '빨간 예고 원 · 선을 보고 Space로 구르자. 구르는 동안은 맞지 않는다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 5, reward: { shards: 8, potion: 'potion1' } },
  { id: 'lv5', title: '레벨 5 되기', hint: '레벨은 도감으로 오른다 — 처음 보는 몬스터 · 처음 가는 장소 · 기록 · 사람. 섬을 돌아다니자', check: (s) => (s.level || 1) >= 5, reward: { gold: 150 } },
  { id: 'forge', title: '대장간에서 무기 강화하기', hint: '바람결 마을 대장간의 브론. 강화 한 단계마다 모든 피해 +6%', to: { kind: 'door', house: 'forge' }, check: (s) => Object.values(s.reinforce || {}).some((v) => v > 0), reward: { gold: 120 } },
  { id: 'sanct', title: '내 종족의 성지 찾아가기', hint: '성지에서 축복 · 의뢰 · 종족 기술을 얻는다. 지도(M)에 색 점으로 보인다', to: { kind: 'sanctum', mine: true }, check: (s) => !!s.flags?.['sanct:' + s.race], reward: { shards: 6 } },
  { id: 'lord1', title: '10층 · 이끼 굴의 주인 쓰러뜨리기', hint: '주인은 체력이 셋으로 나뉘어 단계마다 기술이 바뀐다. 9층의 쉼터에서 체력을 채우자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 1), reward: { shards: 15, gold: 300 } },
  { id: 'oath', title: '서약을 걸고 오르기', hint: '탑 문 앞 → 「서약」. 더 어렵게 → 별빛이 더 많이', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathRuns || 0) > 0, reward: { shards: 10 } },
  { id: 'lv10', title: '레벨 10 되기', hint: '꽃바람 들판 · 이끼 숲 · 독늪 — 권장 레벨이 지역 이름 아래에 보인다', check: (s) => (s.level || 1) >= 10, reward: { gold: 300 } },
  { id: 'f15', title: '15층 수호자 쓰러뜨리기', hint: '독늪의 수호자는 독을 뿌린다. 같은 태그의 각인을 모으면 시너지가 켜진다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 15, reward: { shards: 12 } },
  { id: 'hone5', title: '한 각인을 5단계까지 연마하기', hint: '연마 문 · 쉼터 · 상인의 숫돌. 같은 각인이 다시 나와도 연마된다', to: { kind: 'towerDoor' }, check: (s) => (C(s).maxLv || 0) >= 5, reward: { shards: 12 } },
  { id: 'lord2', title: '20층 · 독늪의 주인 쓰러뜨리기', hint: '쓰러지면 언제나 1층부터. 레벨을 올리고 좋은 무기를 얻어 다시 오른다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 2), reward: { shards: 25, gold: 600 } },
  { id: 'meta10', title: '탑의 축복 모두 합쳐 10단계', hint: '「두 번째 숨」은 쓰러질 때 한 번 일으켜 준다', to: { kind: 'towerDoor' }, check: (s) => metaSum(s) >= 10, reward: { gold: 500 } },
  { id: 'lv16', title: '레벨 16 되기', hint: '폐허 도시 · 원시림 · 바위산 · 황야. 의뢰 게시판의 의뢰도 도감을 채운다', check: (s) => (s.level || 1) >= 16, reward: { gold: 600 } },
  { id: 'lord3', title: '30층 · 화산 균열의 주인 쓰러뜨리기', hint: '용암 웅덩이에 들어가면 화상. 광선은 예고선 옆으로 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 3), reward: { shards: 40, gold: 1000 } },
  { id: 'raid', title: '레이드 보스 하나 쓰러뜨리기', hint: '탑 옆의 레이드 제단. 친구와 파티로 가면 쉽다', to: { kind: 'raidAltar' }, check: (s) => Object.values(s.raid?.clears || {}).some((v) => v > 0), reward: { shards: 20, gold: 800 } },
  { id: 'lv24', title: '레벨 24 되기', hint: '그림자 묘지 · 서리 설원. 종족 성지의 수련으로도 강해진다', check: (s) => (s.level || 1) >= 24, reward: { gold: 1000 } },
  { id: 'lord4', title: '40층 · 서리 회랑의 주인 쓰러뜨리기', hint: '서리 마녀의 표식은 끝날 때 구르면 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 4), reward: { shards: 60, gold: 1500 } },
  { id: 'lv32', title: '레벨 32 되기', hint: '화산 지대 · 고요한 협곡. 레이드 · 탑 · 성지 의뢰 모두 도감을 채운다', check: (s) => (s.level || 1) >= 32, reward: { gold: 1500 } },
  { id: 'lord5', title: '50층 · 각인의 왕 쓰러뜨리기', hint: '탑의 한가운데. 이제부터는 각성한 수호자들이 기다린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 5) || (C(s).wins || 0) > 0, reward: { shards: 100, gold: 3000 } },
  { id: 'top', title: '100층 · 각성한 각인의 왕 쓰러뜨리기', hint: '탑의 꼭대기. 꺼져 가는 빛을 되살리자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 10), reward: { shards: 200, gold: 8000 } },
  { id: 'oath5', title: '서약 5 이상으로 꼭대기에 닿기', hint: '이제부터는 기록의 싸움. 친구와 서약 점수를 겨뤄 보자', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 5, reward: { shards: 80 } },
  { id: 'oath10', title: '서약 10 이상으로 꼭대기에 닿기', hint: '탑을 완전히 정복한 자만이 닿는 곳', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 10, reward: { shards: 150, gold: 5000 } },
];

// 지금의 여정 (다 끝났으면 null) · 끝났지만 보상을 아직 안 받은 것은 done 목록에
export function journeyNow(s) {
  const got = s.journey || {};
  for (let i = 0; i < JOURNEY.length; i++) if (!got[JOURNEY[i].id]) return { i, step: JOURNEY[i], done: JOURNEY[i].check(s) };
  return null;
}
export const rewardText = (r = {}) => [r.gold ? `◆ ${r.gold}` : '', r.shards ? `✦ 별빛 ${r.shards}` : '', r.potion ? '물약' : ''].filter(Boolean).join(' · ');
