// 16x16 도트 스프라이트 (2프레임 애니메이션). 문자 → 팔레트 색
// k=외곽선, a=주색, b=어두운색, c=밝은색, e=눈, s=피부, h=머리, d=다리
const HUMAN_TOP = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khsssssshk...',
  '...kssesssesk...',
  '...kssssssssk...',
  '....kksssskk....',
  '...kaaakkaaak...',
  '..ksaaaaaaaask..',
  '..ksabaaaabask..',
  '..kkaaaaaaaakk..',
  '...kbbbkkbbbk...',
];
const SHAPES = {
  humanoid: [
    [...HUMAN_TOP, '...kdddkkdddk...', '...kddk..kddk...', '...kkkk..kkkk...'],
    [...HUMAN_TOP, '..kdddk..kddk...', '..kddk....kdk...', '..kkkk....kkk...'],
    [...HUMAN_TOP, '...kddk..kdddk..', '...kdk....kddk..', '...kkk....kkkk..'],
  ],
  blob: [[
    '................', '................', '................', '......kkkk......',
    '....kkaaaakk....', '...kaaccaaaak...', '..kaaccaaaaaak..', '..kaacaaaaaaak..',
    '.kaaaaeaaaeaaak.', '.kaaaaeaaaeaaak.', '.kaaaaaaaaaaaak.', '.kbaaaaaaaaaabk.',
    '.kbbaaaaaaaabbk.', '..kbbbbbbbbbbk..', '...kkkkkkkkkk...', '................',
  ]],
  flyer: [[
    '................', '.kk..........kk.', 'kaak........kaak', 'kaaak......kaaak',
    'kaaaak.kk.kaaaak', '.kaaaakaakaaaak.', '..kaaaaaaaaaak..', '...kaaeaaeaak...',
    '....kaccccak....', '....kaaaaaak....', '.....kbbbbk.....', '......kkkk......',
    '................', '................', '................', '................',
  ], [
    '................', '................', '................', '......kkkk......',
    '.....kaaaak.....', '..kkkaaaaaakkk..', '.kaaaaaaaaaaaak.', 'kaaaaaeaaeaaaaak',
    'kaakkaccccakkaak', 'kak..kaaaak..kak', 'kk....kbbk....kk', '.......kk.......',
    '................', '................', '................', '................',
  ]],
  quad: [[
    '................', '................', '................', '................',
    '............kk..', '...........kaak.', '..........kaaeak', '.kkkkkkkkkkaaaak',
    'kaaaaaaaaaaaaak.', 'kaccccaaaaaaabk.', 'kaaaaaaaaaaaabk.', '.kbbbbbbbbbbbk..',
    '..kbk..kbk.kbk..', '..kbk..kbk.kbk..', '..kk...kk..kk...', '................',
  ], [
    '................', '................', '................', '................',
    '............kk..', '...........kaak.', '..........kaaeak', '.kkkkkkkkkkaaaak',
    'kaaaaaaaaaaaaak.', 'kaccccaaaaaaabk.', 'kaaaaaaaaaaaabk.', '.kbbbbbbbbbbbk..',
    '.kbk..kbk..kbk..', '..kbk..kbk..kbk.', '...kk...kk...kk.', '................',
  ]],
  golem: [[
    '....kkkkkkkk....', '...kaaaaaaaak...', '...kaeaaaaeak...', '...kaaaccaaak...',
    '.kkkkaaaaaakkkk.', 'kaacakaaaakacaak', 'kaaaakbbbbkaaaak', 'kaaaakaccakaaaak',
    'kbbbkkaaaakkbbbk', '.kkk.kaaaak.kkk.', '.....kaaaak.....', '....kaakkaak....',
    '...kaaak.kaaak..', '...kbbbk.kbbbk..', '...kkkkk.kkkkk..', '................',
  ]],
  dummy: [[
    '......kkkk......', '.....kccaak.....', '.....kceaek.....', '.....kaaaak.....',
    '..kkkkkaakkkkk..', '.kbbbbaaaabbbbk.', '..kkkkaaaakkkk..', '.....kaaaak.....',
    '.....kabbak.....', '.....kaaaak.....', '......kbbk......', '......kbbk......',
    '......kbbk......', '....kkbbbbkk....', '...kbbbbbbbbk...', '...kkkkkkkkkk...',
  ]],
};

const cache = new Map();

export function frameCount(shape) { return SHAPES[shape].length; }

export function getSprite(shape, pal, frame = 0, flash = false, flip = false) {
  const frames = SHAPES[shape];
  const f = frames[frame % frames.length];
  const key = shape + '|' + JSON.stringify(pal) + frame + flash + flip;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  const colors = { k: '#0d0b10', ...pal };
  colors.c ||= colors.a; colors.b ||= colors.a; colors.s ||= colors.a; colors.h ||= colors.b; colors.e ||= '#ffffff';
  colors.d ||= shade(colors.b, -0.25);
  for (let y = 0; y < 16; y++) {
    const row = (f[y] || '').padEnd(16, '.');
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = flash ? '#ffffff' : colors[ch] || '#ff00ff';
      g.fillRect(flip ? 15 - x : x, y, 1, 1);
    }
  }
  cache.set(key, c);
  return c;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// 잔향 보석
export function drawEchoGem(g, x, y, color, size = 3) {
  g.fillStyle = '#0d0b10';
  for (let i = -size - 1; i <= size + 1; i++) { const w = size + 1 - Math.abs(i); g.fillRect(x - w, y + i, w * 2 + 1, 1); }
  for (let i = -size; i <= size; i++) {
    const w = size - Math.abs(i);
    g.fillStyle = i < 0 ? shade(color, 0.35) : i > 0 ? shade(color, -0.25) : color;
    g.fillRect(x - w, y + i, w * 2 + 1, 1);
  }
  g.fillStyle = '#ffffff';
  g.fillRect(x - 1, y - size + 1, 1, 1);
}

export function drawCoin(g, x, y, t) {
  const w = Math.max(1, Math.round(Math.abs(Math.cos(t * 6)) * 3));
  g.fillStyle = '#0d0b10'; g.fillRect(x - w - 1, y - 3, w * 2 + 2, 6);
  g.fillStyle = '#ffcf3a'; g.fillRect(x - w, y - 2, w * 2, 4);
  g.fillStyle = '#fff2a0'; g.fillRect(x - w, y - 2, 1, 2);
}
