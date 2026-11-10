// 여정: 지금 무엇을 하면 좋을지 하나씩 알려 주는 목표 줄 (화면 오른쪽 위 · J 창).
// 정해진 이야기가 아니라 "다음 한 걸음"이다. 하나를 마치면 보상을 받고 다음 목표가 보인다.
// check(s): 저장(s)만 보고 판단한다 (어디서 무엇을 했든 조건이 맞으면 끝난 것으로)
// to: 바깥 세계에서 화살표가 가리킬 것 (오브젝트 종류 · 조건)

const C = (s) => s.climb || {};
const lords = (s, n) => !!(C(s).lords || {})[n];
const visited = (s, name) => !!s.codex?.places?.[`world:${name}`]; // 바깥 세계의 그 지역에 가 봤나

export const JOURNEY = [
  { id: 'hunt', title: '시작 평원에서 몬스터 5마리 사냥', hint: '마을 북쪽 시작 평원. 몬스터마다 다른 부산물이 떨어진다. 각인의 재료', check: (s) => Object.values(s.codex?.kills || {}).reduce((a, n) => a + n, 0) >= 5, reward: { gold: 30 } },
  { id: 'altarEng', title: '공명 제단에서 각인 새기기', hint: '사냥으로 얻은 몬스터 부산물로 각인을 새긴다. 강해지는 길은 탑 밖에 있다', check: (s) => Object.values(s.slots || {}).some(Boolean), reward: { gold: 100 } },
  { id: 'door', title: '각인의 탑 문 앞에 서기', hint: '섬 한가운데 높은 탑. 화면의 노란 화살표를 따라가자', to: { kind: 'towerDoor' }, check: (s) => !!s.flags?.towerSeen || (C(s).runs || 0) > 0, reward: { gold: 30 } },
  { id: 'f1', title: '탑 1층 돌파', hint: '탑 문 앞에서 G → 「1층부터」. 적을 모두 쓰러뜨리면 층이 열린다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 1, reward: { gold: 80 } },
  { id: 'f5', title: '5층 수호자 쓰러뜨리기', hint: '빨간 예고 원 · 선을 보고 Space로 구르자. 구르는 동안은 맞지 않는다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 5, reward: { gold: 80, potion: 'potion1' } },
  { id: 'lv5', title: '레벨 5 되기', hint: '레벨은 도감으로 오른다. 처음 보는 몬스터 · 처음 가는 장소 · 기록 · 사람. 섬을 돌아다니자', check: (s) => (s.level || 1) >= 5, reward: { gold: 150 } },
  { id: 'forge', title: '대장간에서 무기 강화하기', hint: '바람결 마을 대장간의 브론. 강화 한 단계마다 모든 피해 +6%', to: { kind: 'door', house: 'forge' }, check: (s) => Object.values(s.reinforce || {}).some((v) => v > 0), reward: { gold: 120 } },
  { id: 'lord1', title: '10층 · 이끼 굴의 주인 쓰러뜨리기', hint: '주인은 체력이 셋으로 나뉘어 단계마다 기술이 바뀐다. 쓰러뜨리면 섬의 새 지역이 열린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 1), reward: { gold: 450 } },
  { id: 'open10', title: '새로 열린 이끼 숲에 가 보기', hint: '탑 10층을 넘으면 이끼 숲 · 물안개 해안 · 독늪이 열린다. 지도(M)에서 밝아진 곳', check: (s) => visited(s, '이끼 숲'), reward: { gold: 120 } },
  { id: 'sanct', title: '내 종족의 성지 찾아가기', hint: '탑 10층을 넘으면 열린다. 성지가 아직 잠긴 지역에 있으면 마을 포탈에서 바로 간다', to: { kind: 'sanctum', mine: true }, check: (s) => !!s.flags?.['sanct:' + s.race], reward: { gold: 60 } },
  { id: 'lv10', title: '레벨 10 되기', hint: '이끼 숲 · 물안개 해안 · 독늪: 권장 레벨이 지역 이름 아래에 보인다', check: (s) => (s.level || 1) >= 10, reward: { gold: 300 } },
  { id: 'f15', title: '15층 수호자 쓰러뜨리기', hint: '독늪의 수호자는 독을 뿌린다. 같은 태그의 각인을 모으면 시너지가 켜진다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 15, reward: { gold: 120 } },
  { id: 'lord2', title: '20층 · 독늪의 주인 쓰러뜨리기', hint: '구역의 주인을 쓰러뜨리면 다음부터 그 다음 층에서 시작한다. 부산물로 각인을 새겨 다시 오르자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 2), reward: { gold: 850 } },
  { id: 'open20', title: '폐허 도시 · 원시림 · 화산 지대 중 한 곳 가 보기', hint: '탑 20층을 넘으면 열린다. 농사 · 동료(파티 · 결투)도 이때 열린다', check: (s) => ['폐허 도시', '원시림', '화산 지대'].some((n) => visited(s, n)), reward: { gold: 400 } },
  { id: 'lv16', title: '레벨 16 되기', hint: '폐허 도시 · 원시림 · 화산 지대. 의뢰 게시판의 의뢰도 도감을 채운다', check: (s) => (s.level || 1) >= 16, reward: { gold: 600 } },
  { id: 'lord3', title: '30층 · 화산 균열의 주인 쓰러뜨리기', hint: '용암 웅덩이에 들어가면 화상. 광선은 예고선 옆으로 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 3), reward: { gold: 1400 } },
  { id: 'open30', title: '메마른 황야나 북쪽 바위산에 가 보기', hint: '탑 30층을 넘으면 열린다. 항해 · 탈것 · 레이드도 이때 열린다', check: (s) => ['메마른 황야', '북쪽 바위산'].some((n) => visited(s, n)), reward: { gold: 800 } },
  { id: 'raid', title: '레이드 보스 하나 쓰러뜨리기', hint: '탑 옆의 레이드 제단. 친구와 파티로 가면 쉽다', to: { kind: 'raidAltar' }, check: (s) => Object.values(s.raid?.clears || {}).some((v) => v > 0), reward: { gold: 1000 } },
  { id: 'lv24', title: '레벨 28 되기', hint: '메마른 황야 · 북쪽 바위산. 종족 성지의 수련으로도 강해진다', check: (s) => (s.level || 1) >= 28, reward: { gold: 1000 } },
  { id: 'lord4', title: '40층 · 서리 회랑의 주인 쓰러뜨리기', hint: '서리 마녀의 표식은 끝날 때 구르면 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 4), reward: { gold: 2100 } },
  { id: 'open40', title: '서리 설원이나 그림자 묘지에 가 보기', hint: '탑 40층을 넘으면 열린다. 왕도 정치도 이때 열린다', check: (s) => ['서리 설원', '그림자 묘지'].some((n) => visited(s, n)), reward: { gold: 1200 } },
  { id: 'lv32', title: '레벨 37 되기', hint: '서리 설원 · 그림자 묘지. 레이드 · 탑 · 성지 의뢰 모두 도감을 채운다', check: (s) => (s.level || 1) >= 37, reward: { gold: 1500 } },
  { id: 'lord5', title: '50층 · 각인의 왕 쓰러뜨리기', hint: '탑의 한가운데. 쓰러뜨리면 51층부터 새 구역 다섯이 열리고, 서약 · 랭킹도 열린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 5) || (C(s).wins || 0) > 0, reward: { gold: 4000 } },
  { id: 'oath', title: '서약을 걸고 오르기', hint: '50층을 넘으면 열린다. 탑 문 앞 → 「서약」. 더 어렵게 오르고 기록에 서약 점수를 남긴다', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathRuns || 0) > 0, reward: { gold: 100 } },
  { id: 'top', title: '100층 · 빛의 정상의 마지막 왕 쓰러뜨리기', hint: '탑의 꼭대기. 꺼져 가는 빛을 되살리자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 10), reward: { gold: 10000 } },
  { id: 'oath5', title: '서약 5 이상으로 꼭대기에 닿기', hint: '이제부터는 기록의 싸움. 친구와 서약 점수를 겨뤄 보자', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 5, reward: { gold: 800 } },
  { id: 'oath10', title: '서약 10 이상으로 꼭대기에 닿기', hint: '탑을 완전히 정복한 자만이 닿는 곳', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 10, reward: { gold: 6500 } },
];

// 지금의 여정 (다 끝났으면 null) · 끝났지만 보상을 아직 안 받은 것은 done 목록에
export function journeyNow(s) {
  const got = s.journey || {};
  for (let i = 0; i < JOURNEY.length; i++) if (!got[JOURNEY[i].id]) return { i, step: JOURNEY[i], done: JOURNEY[i].check(s) };
  return null;
}
export const rewardText = (r = {}) => [r.gold ? `◆ ${r.gold}` : '', r.potion ? '물약' : ''].filter(Boolean).join(' · ');
