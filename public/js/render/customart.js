// 직접 그린 종족 도트: 0x72 시트에 없는 모습(돌 골렘, 후드 암살자)
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

const ASSASSIN = [
  '......KKKK......',
  '.....KhHHHK.....',
  '....KhHHHHHK....',
  '...KhHHHHHHHK...',
  '...KhHKKKKHHK...',
  '...KHKSSSSKHK...',
  '...KHKESSEKHK...',
  '...KHKSSSSKHK...',
  '..KHHRRRRRRHHK..',
  '..KCcRRRRRRcCK..',
  '..KCcCRRRRCcCK..',
  '.KCCcCCCCCCcCCK.',
  'KDKCcCBBBBCcCKDK',
  '.DKCcCCCCCCcCKD.',
  '.D.KCcCCCCcCK.D.',
  '...KCCCCCCCCK...',
  '...KCcCKKCcCK...',
  '....KLLKKLLK....',
  '....KLLKKLLK....',
  '....KLLKKLLK....',
  '....KFFKKFFK....',
  '...KFFFKKFFFK...',
];
const ASSASSIN_PAL = {
  K: '#110e18', H: '#2e2a44', h: '#4a4468', S: '#08060c', E: '#ff4a5e', C: '#25213a', c: '#38334f',
  R: '#8a2232', B: '#6a4a30', D: '#d0d8e8', L: '#1d1a2a', F: '#0e0c14',
};

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
  add('stone_golem', mirror(GOLEM_HALF), GOLEM_PAL, 28, 17);
  add('hood_assassin', ASSASSIN, ASSASSIN_PAL, 28, 17);
}
