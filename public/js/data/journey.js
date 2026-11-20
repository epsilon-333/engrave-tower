// 여정: 지금 무엇을 하면 좋을지 하나씩 알려 주는 목표 줄 (화면 오른쪽 위 · J 창).
// 정해진 이야기가 아니라 "다음 한 걸음"이다. 하나를 마치면 보상을 받고 다음 목표가 보인다.
// check(s): 저장(s)만 보고 판단한다 (어디서 무엇을 했든 조건이 맞으면 끝난 것으로)
// reward.mats: 종족 스킬 각인 하나를 새길 재료 (예전 클래스 스킬을 열리는 레벨 차례로 · 'ult'면 궁극기) — 각인이 아니라 재료를 주고 공명 제단에서 새긴다 · 첫 각인 포함 다섯 번뿐
// (예전) reward.skill: 종족 스킬 각인을 그 수만큼 (예전 클래스 스킬을 열리는 레벨 차례로 · 'ult'면 궁극기 둘) — 레벨업으로는 받지 않는다
// giver: 맡기는 사람 (새 저장 save.npcJourney 에서만) — 말을 걸어야 여정이 걸리고(talk), autoReport가 아니면 끝낸 뒤 다시 말을 걸어야 보상(report). set: 그때 켜는 이야기 플래그
// to: 따라가기(퀘스트 창 J)를 켜면 화살표가 가리킬 것 — { kind, house, mine } 오브젝트 · { region: 이름 또는 [이름…] } 지역 한가운데 (가장 가까운 곳) (오브젝트 종류 · 조건)

const kn = (s, act) => s.knack?.n?.[act] || 0; // 낚시 · 요리 · 수확 같은 행동을 한 횟수
const C = (s) => s.climb || {};
const lords = (s, n) => !!(C(s).lords || {})[n];
const visited = (s, name) => !!s.codex?.places?.[`world:${name}`]; // 바깥 세계의 그 지역에 가 봤나

export const JOURNEY = [
  { id: 'hunt', giver: 'chief', talk: ['…일어났구나. 간밤에 탑이 울렸다. 삼백 년 동안 한 번도 없던 일이지.', '네 팔의 문양이 빛나는 걸 봤다. 각인이 깨어난 게다. 탑이 너를 부르는 게야.', '각인을 새기려면 몬스터의 부산물이 필요하다. 마을 북쪽 시작 평원에서 다섯 마리만 잡아 오너라. 처음엔 스킬이 없으니, 손에 쥔 것으로 싸워라.'], report: ['돌아왔구나. 다치진 않았고?', '이걸 받아라. 네 종족의 첫 각인을 새길 재료다. 마을의 공명 제단에 가면 각인사 루네가 새겨 줄 게다.', '…몇 해 전에도 문양이 깨어난 아이가 있었다. 세린이라고. 그 아이도 이 재료를 들고 제단으로 갔지.'], set: ['chiefMet', 'chiefHunt'], title: '시작 평원에서 몬스터 5마리 사냥', hint: '마을 북쪽 시작 평원. 처음에는 스킬이 없다 — 평타(좌클릭)와 무기 기술(우클릭)로 싸우자. 마치면 첫 각인의 재료를 받는다', to: { region: '시작 평원' }, check: (s) => Object.values(s.codex?.kills || {}).reduce((a, n) => a + n, 0) >= 5, reward: { firstMats: true, gold: 30 } },
  { id: 'altarEng', giver: 'rune', autoReport: true, talk: ['촌장님께 들었어요. 문양이 깨어났다고요.', '재료를 제단 위에 올리고 각인을 고르면 몸에 새겨져요. 새긴 각인은 Q 칸에 끼워야 그 스킬을 쓸 수 있어요.', '…세린도 여기 그 자리에 서 있었죠.'], title: '공명 제단에서 첫 각인 새기기', hint: '마을의 공명 제단(G)에서 받은 재료로 종족의 첫 각인을 새기고 Q 칸에 끼우자. 각인을 끼우면 그 각인의 스킬을 쓴다', to: { kind: 'door', house: 'altar' }, check: (s) => s.flags?.firstEng ? (s.owned?.[s.flags.firstEng] || 0) > 0 : Object.values(s.slots || {}).some(Boolean), reward: { gold: 100 } },
  { id: 'door', giver: 'chief', autoReport: true, talk: ['각인을 새겼구나. 이제 진짜 시작이다.', '섬 한가운데 탑 문 앞에 서 보아라. 문은 오르려는 자에게만 열린다.', '세린도 그 문으로 들어갔다. …돌아오지 않았지. 너는 꼭 돌아오너라.'], set: ['chiefAltar', 'chiefTower'], title: '각인의 탑 문 앞에 서기', hint: '섬 한가운데 높은 탑. 화면의 노란 화살표를 따라가자', to: { kind: 'towerDoor' }, check: (s) => !!s.flags?.towerSeen || (C(s).runs || 0) > 0, reward: { gold: 30 } },
  { id: 'f1', title: '탑 1층 돌파', hint: '탑 문 앞에서 G → 「1층부터」. 적을 모두 쓰러뜨리면 층이 열린다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 1, reward: { gold: 80 } },
  { id: 'f5', title: '5층 수호자 쓰러뜨리기', hint: '빨간 예고 원 · 선을 보고 Space로 구르자. 구르는 동안은 맞지 않는다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 5, reward: { gold: 80, potion: 'potion1' } },
  { id: 'lv5', title: '레벨 5 되기', hint: '레벨은 도감으로 오른다. 처음 보는 몬스터 · 처음 가는 장소 · 기록 · 사람. 섬을 돌아다니자', check: (s) => (s.level || 1) >= 5, reward: { gold: 150 } },
  { id: 'fish1', giver: 'toby', autoReport: true, talk: ['탑 안에는 쉴 곳이 없대요. 체력을 되찾는 건 요리뿐이에요.', '물가에서 낚싯대를 던져 보세요. 입질이 오면 박자에 맞춰 당기면 돼요.'], title: '물고기 한 마리 낚기', hint: '탑 5층을 넘으면 낚시가 열린다. 물가에서 G로 낚싯대를 던지고, 입질이 오면 박자에 맞춰 당긴다', to: { water: true }, check: (s) => kn(s, 'fish') >= 1 || Object.keys(s.fishLog || {}).length > 0, reward: { gold: 80 } },
  { id: 'cook1', giver: 'toby', autoReport: true, talk: ['잡은 물고기는 집 부엌에서 요리하세요. 요리는 탑 안에서 H로 먹어요.', '먹는 동안엔 굼떠지니까, 적을 떼어 놓고 드세요!'], title: '요리 하나 만들기', hint: '내 집 부엌에서 잡은 물고기 · 작물로 요리한다. 요리는 탑 안에서 체력을 되찾는 유일한 길이다 (H로 먹기)', to: { kind: 'door', house: 'home' }, check: (s) => kn(s, 'cook') >= 1 || Object.keys(s.dishLog || {}).length > 0, reward: { gold: 100, potion: 'potion1' } },
  { id: 'forge', giver: 'bron', autoReport: true, talk: ['탑에 오른다고? 그 무기로?', '강화 한 단계마다 모든 피해가 6%씩 오른다. 광석이랑 골드를 가져와. 두드려 줄 테니.'], title: '대장간에서 무기 강화하기', hint: '바람결 마을 대장간의 브론. 강화 한 단계마다 모든 피해 +6%', to: { kind: 'door', house: 'forge' }, check: (s) => Object.values(s.reinforce || {}).some((v) => v > 0), reward: { gold: 120 } },
  { id: 'lord1', title: '10층 · 이끼 굴의 주인 쓰러뜨리기', hint: '주인은 체력이 셋으로 나뉘어 단계마다 기술이 바뀐다. 쓰러뜨리면 섬의 새 지역이 열린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 1), reward: { mats: 1, gold: 450 } },
  { id: 'open10', title: '새로 열린 이끼 숲에 가 보기', hint: '탑 10층을 넘으면 이끼 숲 · 물안개 해안 · 독늪이 열린다. 지도(M)에서 밝아진 곳', to: { region: '이끼 숲' }, check: (s) => visited(s, '이끼 숲'), reward: { gold: 120 } },
  { id: 'sanct', giver: 'chief', autoReport: true, talk: ['네 종족에게는 성지가 있다. 거기서 수련하면 몸 자체가 단단해지지.', '바람결 마을에서 자랐어도 너는 그 종족의 피를 이었다. 한번 찾아가 보아라.'], title: '내 종족의 성지 찾아가기', hint: '탑 10층을 넘으면 열린다. 성지가 아직 잠긴 지역에 있으면 마을 포탈에서 바로 간다', to: { kind: 'sanctum', mine: true }, check: (s) => !!s.flags?.['sanct:' + s.race], reward: { gold: 60 } },
  { id: 'fish5', title: '물고기 5종 낚기', hint: '물마다 사는 물고기가 다르다. 강 · 호수 · 바다 · 늪을 돌아다니자 (도감 · 물고기)', to: { water: true }, check: (s) => Object.keys(s.fishLog || {}).length >= 5, reward: { gold: 250 } },
  { id: 'lv10', title: '레벨 10 되기', hint: '이끼 숲 · 물안개 해안 · 독늪: 권장 레벨이 지역 이름 아래에 보인다', check: (s) => (s.level || 1) >= 10, reward: { gold: 300 } },
  { id: 'f15', title: '15층 수호자 쓰러뜨리기', hint: '독늪의 수호자는 독을 뿌린다. 같은 태그의 각인을 모으면 시너지가 켜진다', to: { kind: 'towerDoor' }, check: (s) => (C(s).best || 0) >= 15, reward: { gold: 120 } },
  { id: 'lord2', title: '20층 · 독늪의 주인 쓰러뜨리기', hint: '구역의 주인을 쓰러뜨리면 다음부터 그 다음 층에서 시작한다. 부산물로 각인을 새겨 다시 오르자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 2), reward: { mats: 1, gold: 850 } },
  { id: 'open20', title: '폐허 도시 · 원시림 · 화산 지대 중 한 곳 가 보기', hint: '탑 20층을 넘으면 열린다. 농사 · 동료(파티 · 결투)도 이때 열린다', to: { region: ['폐허 도시', '원시림', '화산 지대'] }, check: (s) => ['폐허 도시', '원시림', '화산 지대'].some((n) => visited(s, n)), reward: { gold: 400 } },
  { id: 'farm1', title: '작물 하나 수확하기', hint: '탑 20층을 넘으면 농사가 열린다. 집 앞 밭을 갈고 씨앗을 심어 물을 주면 자란다 (X로 씨앗 고르기)', to: { kind: 'door', house: 'home' }, check: (s) => kn(s, 'harvest') >= 1, reward: { gold: 300 } },
  { id: 'cook5', title: '서로 다른 요리 5가지 만들기', hint: '재료마다 요리가 다르고, 요리마다 회복 · 강화가 다르다. 탑에 오르기 전에 챙겨 가자', to: { kind: 'door', house: 'home' }, check: (s) => Object.keys(s.dishLog || {}).length >= 5, reward: { gold: 400 } },
  { id: 'lv20', title: '레벨 20 되기 · 궁극기', hint: '종족 궁극기 각인의 재료를 받는다 (지금 끼운 스킬이 더 많은 갈래의 궁극기). 공명 제단에서 새기자 · 궁극기는 그 종족만 쓴다', check: (s) => (s.level || 1) >= 20, reward: { mats: 'ult', gold: 800 } },
  { id: 'lord3', title: '30층 · 화산 균열의 주인 쓰러뜨리기', hint: '용암 웅덩이에 들어가면 화상. 광선은 예고선 옆으로 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 3), reward: { mats: 1, gold: 1400 } },
  { id: 'open30', title: '메마른 황야나 북쪽 바위산에 가 보기', hint: '탑 30층을 넘으면 열린다. 항해 · 탈것 · 레이드도 이때 열린다', to: { region: ['메마른 황야', '북쪽 바위산'] }, check: (s) => ['메마른 황야', '북쪽 바위산'].some((n) => visited(s, n)), reward: { gold: 800 } },
  { id: 'raid', title: '레이드 보스 하나 쓰러뜨리기', hint: '탑 옆의 레이드 제단. 친구와 파티로 가면 쉽다', to: { kind: 'raidAltar' }, check: (s) => Object.values(s.raid?.clears || {}).some((v) => v > 0), reward: { gold: 1000 } },
  { id: 'lv30', title: '레벨 30 되기', hint: '종족 성지의 수련 · 레이드 · 사냥한 부산물로 새기는 각인이 강해지는 길이다', check: (s) => (s.level || 1) >= 30, reward: { gold: 1500 } },
  { id: 'lord4', title: '40층 · 서리 회랑의 주인 쓰러뜨리기', hint: '서리 마녀의 표식은 끝날 때 구르면 피한다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 4), reward: { gold: 2100 } },
  { id: 'open40', title: '서리 설원이나 그림자 묘지에 가 보기', hint: '탑 40층을 넘으면 열린다. 레이드 · 서리 여왕도 이때 열린다', to: { region: ['서리 설원', '그림자 묘지'] }, check: (s) => ['서리 설원', '그림자 묘지'].some((n) => visited(s, n)), reward: { gold: 1200 } },
  { id: 'lv32', title: '레벨 37 되기', hint: '서리 설원 · 그림자 묘지. 레이드 · 탑 · 성지 의뢰 모두 도감을 채운다', check: (s) => (s.level || 1) >= 37, reward: { gold: 1500 } },
  { id: 'lord5', title: '50층 · 각인의 왕 쓰러뜨리기', hint: '탑의 한가운데. 쓰러뜨리면 51층부터 새 구역 다섯이 열리고, 서약 · 랭킹도 열린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 5) || (C(s).wins || 0) > 0, reward: { gold: 4000 } },
  { id: 'oath', title: '서약을 걸고 오르기', hint: '50층을 넘으면 열린다. 탑 문 앞 → 「서약」. 더 어렵게 오르고 기록에 서약 점수를 남긴다', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathRuns || 0) > 0, reward: { gold: 100 } },
  { id: 'lord6', title: '60층 · 하늘 정원의 주인 쓰러뜨리기', hint: '51층부터는 층마다 장치가 있다. 주인은 체력이 셋으로 나뉘어 단계마다 기술이 바뀐다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 6), reward: { gold: 5000 } },
  { id: 'lord7', title: '70층 · 거울 미궁의 주인 쓰러뜨리기', hint: '거울 미궁: 가짜 분신 사이에서 진짜를 찾아 치자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 7), reward: { gold: 6000 } },
  { id: 'lord8', title: '80층 · 태엽 시계탑의 주인 쓰러뜨리기', hint: '태엽 시계탑: 바닥의 톱니 띠 위에서는 떠밀린다', to: { kind: 'towerDoor' }, check: (s) => lords(s, 8), reward: { gold: 7000 } },
  { id: 'lord9', title: '90층 · 별의 서고의 주인 쓰러뜨리기', hint: '별의 서고: 별자리 위에 선 적은 더 아프게 때린다. 끌어내서 싸우자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 9), reward: { gold: 8000 } },
  { id: 'top', title: '100층 · 빛의 정상의 마지막 왕 쓰러뜨리기', hint: '탑의 꼭대기. 꺼져 가는 빛을 되살리자', to: { kind: 'towerDoor' }, check: (s) => lords(s, 10), reward: { gold: 10000 } },
  { id: 'oath5', title: '서약 5 이상으로 꼭대기에 닿기', hint: '이제부터는 기록의 싸움. 친구와 서약 점수를 겨뤄 보자', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 5, reward: { gold: 800 } },
  { id: 'oath10', title: '서약 10 이상으로 꼭대기에 닿기', hint: '탑을 완전히 정복한 자만이 닿는 곳', to: { kind: 'towerDoor' }, check: (s) => (C(s).oathBest || 0) >= 10, reward: { gold: 6500 } },
];

// 지금의 여정 (다 끝났으면 null) · 끝났지만 보상을 아직 안 받은 것은 done 목록에
export function journeyNow(s) {
  const got = s.journey || {};
  for (let i = 0; i < JOURNEY.length; i++) if (!got[JOURNEY[i].id]) {
    const step = JOURNEY[i], done = step.check(s), npc = s.npcJourney && step.giver;
    const stage = !npc ? 'do' : !s.jAccept?.[step.id] ? 'talk' : done && !step.autoReport ? 'report' : 'do'; // talk: 맡는 사람에게 말 걸기 · report: 알리러 가기
    return { i, step, done: done && stage === 'do', stage };
  }
  return null;
}
// 맡기는 사람: 이름 · 어디 있나 (화살표) · 머리 위 표시 자리
export const GIVERS = {
  chief: { name: '촌장', to: { kind: 'npc', id: 'chief' }, mark: 'chief' },
  rune: { name: '각인사 루네', to: { kind: 'door', house: 'altar' }, mark: 'house:altar', station: 'altar' },
  bron: { name: '대장장이 브론', to: { kind: 'door', house: 'forge' }, mark: 'house:forge', station: 'shop' },
  toby: { name: '잡화점 주인 토비', to: { kind: 'door', house: 'shop' }, mark: 'house:shop', station: 'store' },
};
export const rewardText = (r = {}) => [r.firstMats ? '첫 각인 재료' : '', r.mats === 'ult' ? '궁극기 각인 재료' : r.mats ? '종족 스킬 각인 재료' : '', r.skill === 'ult' || r.ult ? '궁극기 각인' : r.skill ? `종족 스킬 각인${r.skill > 1 ? ' ×' + r.skill : ''}` : '', r.gold ? `◆ ${r.gold}` : '', r.potion ? '물약' : ''].filter(Boolean).join(' · ');
