// 이야기: 몬스터가 떨어뜨린 물건을 사람에게 가져가면 길이 열리고 이야기가 나아간다.
// 1층 이끼 동굴 — 먼저 탑을 오른 등반가 세린의 흔적과, 길 잃은 지도 제작자 피노.
// 진행 상태는 저장 데이터 save.story = { items: {id: 개수}, flags: {이름: true} } 에 남는다.

// 이야기 물건. from: 떨어뜨리는 몬스터와 확률, max: 이만큼 모이면 더 안 나온다, done: 다 쓴 뒤엔 안 나온다
export const STORY_ITEMS = {
  mapScrap: { name: '찢어진 지도 조각', color: '#e8d8a8', max: 3, from: { goblin: 0.35, goblinShaman: 0.5 }, done: 'pinoMap',
    desc: '누군가 정성껏 그린 동굴 지도의 조각. 고블린 냄새가 난다.' },
  glowMoss: { name: '빛나는 이끼', color: '#7affc8', max: 5, from: { slime: 0.35, mossSlug: 0.45 }, done: 'pinoLantern',
    desc: '어둠 속에서 은은하게 빛나는 이끼. 늪괴들이 몸에 붙이고 다닌다.' },
  rustyKey: { name: '녹슨 열쇠', color: '#d0a868', max: 1, from: { goblinChief: 1 }, done: 'open:ironGate',
    desc: '가면 족장이 목에 걸고 있던 열쇠. 손잡이에 작은 글씨로 "세린"이라고 새겨져 있다.' },
  lantern: { name: '이끼 등불', color: '#9affd8', max: 1, from: {},
    desc: '피노가 빛나는 이끼로 만든 등불. 가시덩굴이 이 빛을 싫어한다.' },
};

// 길을 막는 것들. need: 필요한 물건(keep: 쓰고도 남는지), oneway: 이쪽에서만 열린다
export const BARRIERS = {
  thornGate: { name: '엉킨 가시덩굴', look: 'thorn', need: 'lantern', keep: true,
    locked: '가시덩굴이 길을 막고 있다. 밝은 것을 싫어하는 듯 움찔거린다.', open: '등불을 들이밀자 가시덩굴이 스르르 물러났다.' },
  ironGate: { name: '녹슨 철창', look: 'bars', need: 'rustyKey',
    locked: '녹슨 철창이 잠겨 있다. 너머에 작은 방과 상자가 보인다. 열쇠 구멍이 있다.', open: '녹슨 열쇠가 끼익 돌아갔다.' },
  rubble: { name: '무너진 바위', look: 'rubble', oneway: true,
    locked: '바위가 무너져 길이 막혀 있다. 반대편에서라면 밀어낼 수 있을 것 같다.', open: '바위를 밀어내자 아래로 이어지는 지름길이 열렸다!' },
};

// 등반가 세린의 일지 (기록 도감)
export const JOURNALS = {
  serin1: { title: '세린의 일지 · 첫째 장', where: '등반가의 첫 야영지', look: 'campfire',
    text: '탑에 들어온 지 사흘째.\n아래 마을 사람들은 꼭대기에 아무것도 없다고 했지만, 나는 봤다. 밤마다 탑 꼭대기에서 깜빡이는 빛을.\n\n오늘 밤 고블린들이 내 지도를 찢어 가져갔다. 괜찮다. 길은 내 발이 기억한다.\n\n— 세린' },
  serin2: { title: '세린의 일지 · 둘째 장', where: '등반가의 숨은 방', look: 'book',
    text: '이 방은 내가 이 탑에서 찾은 첫 번째 비밀이다.\n철창 열쇠는 가면 쓴 고블린 족장에게 맡겨 두었다. …사실은 빼앗겼다.\n\n언젠가 누가 이 글을 읽는다면, 너도 그 족장을 이겼다는 뜻이겠지. 반갑다, 모르는 친구.\n\n북쪽 가시덩굴은 빛을 싫어한다. 빛나는 이끼를 모아 봐.' },
  serin3: { title: '세린의 일지 · 셋째 장', where: '무너진 전망대', look: 'book',
    text: '드디어 하늘을 봤다.\n탑 밖은 생각보다 훨씬 넓었다. 저 멀리, 내가 떠나온 마을의 불빛이 반딧불이처럼 작다.\n\n위로 갈수록 더 넓어지겠지.\n나는 계속 오른다. 꼭대기의 빛이 나를 부르는 것 같다.' },
};

// 사람 (사람 도감). steps: 사연이 나아가는 순서 (플래그 이름)
export const PEOPLE = {
  pino: { name: '지도 제작자 피노', title: '길 잃은 지도 제작자', steps: ['pinoMet', 'pinoMap', 'pinoLantern', 'pinoDone'],
    summary: ['이끼 동굴에서 길을 잃은 지도 제작자. 고블린에게 지도를 빼앗겼다.', '지도 조각을 찾아 주자 동굴 지도를 그려 주었다.', '빛나는 이끼로 등불을 만들어 주었다.', '탑 밖의 하늘 이야기를 듣고, 위층으로 오르기로 했다. 광장에 있다.'] },
};

const has = (st, id, n = 1) => (st.items[id] || 0) >= n;

// 피노와의 대화: 지금 상태에 맞는 대사와, 건넬 수 있는 물건이 있으면 그 행동
export function pinoTalk(st) {
  const f = st.flags;
  if (!f.pinoMet) return { lines: ['어, 사람이다! 나는 지도 제작자 피노야.', '이 동굴을 그리던 중이었는데… 고블린들이 내 지도를 찢어서 나눠 가져가 버렸어. 조각이 세 개야.', '고블린을 혼내 주고 조각을 찾아 주면, 이 동굴 지도를 너한테도 그려 줄게.'], set: 'pinoMet' };
  if (!f.pinoMap) {
    if (has(st, 'mapScrap', 3)) return { lines: ['이거야, 이거! …하나, 둘, 셋. 다 맞췄다!', '자, 이 동굴 지도야. 가 보지 않은 길도 흐릿하게 보일 거야. (지도에 동굴 전체가 표시됩니다)'], take: { mapScrap: 3 }, set: 'pinoMap' };
    return { lines: [`지도 조각은 고블린들이 나눠 가지고 있어. 주술사 녀석들이 특히 좋아하더라. (지도 조각 ${st.items.mapScrap || 0}/3)`] };
  }
  if (!f.pinoLantern) {
    if (has(st, 'glowMoss', 5)) return { lines: ['봐, 빛이 살아 있지? 이끼 다섯 개면 충분해.', '이 등불을 들고 북쪽 가시덩굴 앞에 서 봐. 그 너머가 궁금해서 잠이 안 와.'], take: { glowMoss: 5 }, give: { lantern: 1 }, set: 'pinoLantern' };
    return { lines: ['그런데 이상한 게 있어. 북쪽 가시덩굴 너머로 누가 지나간 발자국이 있더라.', '가시덩굴은 빛을 싫어해. 빛나는 이끼 다섯 개를 가져오면 등불을 만들어 줄게.', `이끼는 늪괴랑 민달팽이들이 몸에 붙이고 다녀. (빛나는 이끼 ${st.items.glowMoss || 0}/5)`] };
  }
  if (!f.vistaSeen) return { lines: ['가시덩굴 너머엔 뭐가 있었어? 궁금해 죽겠네.'] };
  if (!f.pinoDone) return { lines: ['하늘을 봤다고? 탑 밖의 하늘을…!', '…나도 동굴 지도만 그리고 있을 때가 아니네. 위층으로 올라가 볼래.', '광장에서 다시 만나자. 그때까지 위층 지도를 준비해 둘게!'], set: 'pinoDone' };
  return { lines: ['…'] };
}

export function pinoPlazaTalk() {
  return { lines: ['왔구나! 여기서 위층 지도를 준비하고 있어.', '2층 독늪에서도 이상한 발자국을 봤다는 사람이 있더라. 세린이라는 사람일까?'] };
}

// 화면 오른쪽에 띄울 지금의 목표 (없으면 null)
export function storyObjective(st) {
  if (!st) return null;
  const f = st.flags, n = (id) => st.items[id] || 0;
  const list = [];
  if (n('rustyKey') && !f['open:ironGate']) list.push('녹슨 열쇠 — 물웅덩이 동굴의 철창');
  if (f.pinoMet && !f.pinoMap) list.push(`지도 조각 ${n('mapScrap')}/3 — 고블린에게서`);
  else if (f.pinoMap && !f.pinoLantern) list.push(`빛나는 이끼 ${n('glowMoss')}/5 — 늪괴·민달팽이에게서`);
  else if (f.pinoLantern && !f['open:thornGate']) list.push('이끼 등불 — 북쪽 가시덩굴로');
  else if (f.pinoLantern && !f.vistaSeen) list.push('가시덩굴 너머로');
  else if (f.vistaSeen && f.pinoLantern && !f.pinoDone) list.push('피노에게 하늘 이야기를');
  return list.length ? list : null;
}

export function newStory() { return { items: {}, flags: {} }; }
