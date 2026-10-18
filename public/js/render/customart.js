// 직접 그린 도트: 0x72 시트에 없는 모습(돌 골렘, 후드 암살자, 대검). 불 용인족 · 불 용은 assets/custom 의 PNG
// 글자 한 칸 = 픽셀 하나. 아틀라스에 base_idle_anim_f0~3 / base_run_anim_f0~3 으로 등록한다.

// 골렘족: 왼쪽 절반만 그리고 좌우 대칭으로 펼친다 (12칸 → 24칸)
const GOLEM_HALF = [
  '.........KKK',
  '........KgGG',
  '........KGEG',
  '........KGGd',
  '..KKKKKKKddd',
  '.KggGGKKGGGG',
  '.KgGGGdKgGGG',
  '.KGGGdKKGGGc',
  '.KKdddKgGGcc',
  'KgGGKKgGGGGc',
  'KGGdKKGGMGGG',
  'KGGdKKGGGGGd',
  'KGMdK.KdGGdd',
  'KgGdK.KKdddK',
  'KggGdK.KGGGd',
  'KGGGGdK.KGGd',
  '.KdddK..KddK',
  '......KgGdK.',
  '......KGGdK.',
  '......KGGdK.',
  '.....KgGGdK.',
  '.....KKKKKK.',
];
const GOLEM_PAL = {
  K: '#1a1614', G: '#8a8478', g: '#b4ac9a', d: '#5e584e', M: '#5f7f3c', E: '#7ae8ff', c: '#ffb04a',
};

// 암살자: 후드를 푹 눌러쓴 작은 도적. 0x72 캐릭터처럼 큰 머리 · 짙은 외곽선 · 단순한 면
const ASSASSIN = [
  '.....KKKKK......',
  '...KKhHHHHKK....',
  '..KhHHHHHHHHK...',
  '.KhHHHHHHHHHHK..',
  '.KhHHHHHHHHHHK..',
  'KhHHHHHHHHHHHHK.',
  'KhHHHKKKKKKKHHK.',
  'KhHHKSSSSSSSKHK.',
  'KhHHKSESSSESKHK.',
  'KhHHKSESSSESKHK.',
  '.KhHHKKKKKKKHK..',
  '..KKMMMMMMMMKK..',
  '..KCcCCCCMmCcK..',
  '..KgKCCCCCCKgK..',
  '...KCBBbbBBCK...',
  '...KCcCCCCcCK...',
  '...KLLKKKLLK....',
  '...KFFK.KFFK....',
  '..KFFFK.KFFFK...',
];
const ASSASSIN_PAL = {
  K: '#1b1626', h: '#5e588a', H: '#3e3a5e', S: '#100d18', E: '#f0f6ff', C: '#302c48', c: '#4a4468',
  M: '#7a2838', m: '#a8364a', g: '#3a3248', B: '#5a3e2a', b: '#e0b860', L: '#262234', F: '#4a3628',
};

// 용창: 손잡이가 아래인 세로 그림. 불꽃 모양 창날 · 금색 가드 · 붉은 자루와 금띠
const DRAGON_SPEAR = [
  '...K...',
  '..KwK..',
  '..KwK..',
  '.KwWsK.',
  '.KwWsK.',
  'KrwWsrK',
  'KrwWsrK',
  '.KwWsK.',
  '..KWK..',
  'KKKGKKK',
  'KgGGGgK',
  '.KKGKK.',
  ...Array(5).fill('..KRK..'),
  '..KgK..',
  ...Array(5).fill('..KRK..'),
  '..KgK..',
  ...Array(4).fill('..KRK..'),
  '..KdK..',
  '..KgK..',
  '...K...',
];
const DRAGON_SPEAR_PAL = { K: '#1a0c0a', w: '#f4f6ff', W: '#b8c0d0', s: '#6a7284', r: '#e8482a', g: '#ffe08a', G: '#c89a3a', R: '#a8281a', d: '#6a1410' };

// 대검: 손잡이가 아래인 세로 그림 (0x72 무기와 같은 방향). 날 5칸 · 가운데 홈 · 넓은 가드
const GREATSWORD = [
  '....K....',
  '...KwK...',
  '..KwWsK..',
  ...Array(26).fill('.KwWfWsK.'),
  '.KwWWWsK.',
  'KKKKKKKKK',
  'KgGGGGGgK',
  '.KKKKKKK.',
  '...KhK...',
  '...KHK...',
  '...KhK...',
  '...KHK...',
  '..KpPpK..',
  '...KKK...',
];
const GREATSWORD_PAL = { K: '#16141c', w: '#f4f6ff', W: '#b8c0d0', s: '#6a7284', f: '#8a92a6', g: '#ffe08a', G: '#c89a3a', h: '#6a4a30', H: '#4a3020', p: '#ffe08a', P: '#c89a3a' };

function paint(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}

const mirror = (half) => half.map((r) => r + [...r].reverse().join(''));

// rows: 그림, legFrom: 다리가 시작하는 줄. 프레임마다 몸 흔들림(bob)과 양다리 들기(lift)를 준다
function makeFrames(rows, pal, H, legFrom, poses) {
  const w = rows[0].length, h = rows.length, top = H - h;
  return poses.map(({ bob, liftL, liftR }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = H;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x], col = pal[ch];
        if (!col) continue;
        let dy = top + y;
        if (y < legFrom) dy += bob;
        else {
          const lift = x < w / 2 ? liftL : liftR;
          // 들린 다리: 맨 아랫줄부터 접혀 짧아 보이게
          if (y >= h - lift) continue;
          dy += 0;
        }
        g.fillStyle = col; g.fillRect(x, dy, 1, 1);
      }
    }
    return c;
  });
}

const IDLE = [{ bob: 0, liftL: 0, liftR: 0 }, { bob: 0, liftL: 0, liftR: 0 }, { bob: 1, liftL: 0, liftR: 0 }, { bob: 1, liftL: 0, liftR: 0 }];
const RUN = [{ bob: 0, liftL: 2, liftR: 0 }, { bob: 1, liftL: 0, liftR: 0 }, { bob: 0, liftL: 0, liftR: 2 }, { bob: 1, liftL: 0, liftR: 0 }];

export function registerCustomArt(atlas) {
  const add = (base, rows, pal, H, legFrom) => {
    for (const [kind, poses] of [['idle', IDLE], ['run', RUN]]) {
      makeFrames(rows, pal, H, legFrom, poses).forEach((c, i) => {
        atlas[`${base}_${kind}_anim_f${i}`] = { x: 0, y: 0, w: c.width, h: c.height, src: c };
      });
    }
  };
  // 바람총 (세로로 긴 무기 그림, 0x72 무기처럼 손잡이가 아래)
  const bg = document.createElement('canvas'); bg.width = 4; bg.height = 18;
  const g = bg.getContext('2d');
  g.fillStyle = '#1a140c'; g.fillRect(0, 0, 4, 18);
  g.fillStyle = '#8a7a3a'; g.fillRect(1, 1, 2, 16);
  g.fillStyle = '#c8b860'; g.fillRect(1, 1, 1, 16);
  g.fillStyle = '#5a3a20'; g.fillRect(1, 5, 2, 1); g.fillRect(1, 11, 2, 1);
  g.fillStyle = '#9be15d'; g.fillRect(1, 0, 2, 1);
  atlas.weapon_blowgun = { x: 0, y: 0, w: 4, h: 18, src: bg };
  add('stone_golem', mirror(GOLEM_HALF), GOLEM_PAL, 28, 17);
  add('hood_assassin', ASSASSIN, ASSASSIN_PAL, 28, 16);
  const sp = paint(DRAGON_SPEAR, DRAGON_SPEAR_PAL);
  atlas.weapon_dragon_spear = { x: 0, y: 0, w: sp.width, h: sp.height, src: sp };
  const gs = paint(GREATSWORD, GREATSWORD_PAL);
  atlas.weapon_greatsword = { x: 0, y: 0, w: gs.width, h: gs.height, src: gs };
}
