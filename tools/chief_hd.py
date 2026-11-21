# 가면 족장 1.5배 (손으로 찍는 도트): 원본 시트(art/source/sheet_chief_motion2.webp)의 모습을 따라 크게 다시 찍는다
# 부위마다 손으로 찍은 그림(불꽃 · 뿔 · 두건 · 가면 · 창 · 몸 · 망토 · 다리)을 장면마다 정한 자리에 놓는다
#   python tools/chief_hd.py [미리보기.png]
import sys
from PIL import Image

PAL = {
    'K': (24, 21, 26), 'd': (69, 54, 52), 'B': (98, 78, 75), 'b': (124, 93, 85), 'm': (150, 110, 102),
    'p': (166, 128, 122), 'W': (234, 220, 199), 'w': (200, 182, 162), 'r': (128, 56, 64), 'R': (172, 64, 66),
    'O': (226, 112, 70), 's': (196, 136, 104),
}

# ── 부위 (손으로 찍은 칸 · '.'은 비움) ──
FLAME = [
    '.....R..',
    '....RR..',
    '...RRR.R',
    '..RRORRR',
    '.RROORR.',
    'RROOOORR',
    'ROOWWOOR',
    'ROWWWORR',
    '.RWWORR.',
]
HORN_L = [
    'WW.......',
    'WW.......',
    'WWW......',
    'WWW......',
    'WWWWW....',
    '.WWWWWWW.',
    '..wWWWWWW',
    '....wwWWW',
]
HORN_R = [
    '..W',
    '.WW',
    '.WW',
    'WWW',
    'WW.',
]
BODY = [  # 두건 · 옷 (22칸, x10부터) · 가면이 위에 덮인다
    '........mmmm..........',
    '......mmmmmmmB........',
    '....BmmmmmmmmBB.......',
    '...dBBmmmmmmBBBB......',
    '...dBBBBBBBBBBBBBd....',
    '..dBBddddddddddddddB...',
] + ['..dBdBBBBBBBBBBBBBBd..'] * 15 + [
    '.dddBBBBBBBBBBBBBBBBd.',
    '.ddBBBBdBBBBBBBdBBBBd.',
    'dddBBBBdBBBBBBBdBBBBdd',
    'ddBBBBBdBBBBBBBBdBBBBd',
    'ddKKKKKKKKKKKKKKKKKKdd',
    'ddBBBBdBBBBBBBBdBBBBdd',
    '.dBBBBdBBBBBBBBdBBBBd.',
    '.ddBBdBBBBBBBBBBdBBdd.',
    '..dddd.........ddddd..',
]
MASK = [  # 14칸 × 15줄
    '..WWWWWWWWWW..',
    '.WWRRRRRRRRWW.',
    'WWWWWWWWWWWWWW',
    'WWRWWWWWWWWRWW',
    'WWKKKKWWWKKKWW',
    'WRKKKKWWWKKKRW',
    'WRKKKKWWWKKKRW',
    'WWWKKWWWWWKWWW',
    'WWWWWWKKWWWWWW',
    'wWWWWWKKWWWWWw',
    'wWWWWWWWWWWWWw',
    '.WWWWWWWWWWWW.',
    '.WKWWKWWKWWKW.',
    '.WKWWKWWKWWKW.',
    '..wWwwWwwWww..',
]
SPEARHEAD = [
    '....WW...',
    '...WWWW..',
    'WW.WWWWWW',
    'WWWWWKWWW',
    '.WWWWWWWW',
    '..WWwWWW.',
    '...WWW...',
    '...wbw...',
]
SKULL = ['WWWWW', 'WKWKW', '.WWW.']


def blank(w, h): return [['.'] * w for _ in range(h)]
def stamp(g, part, x, y):
    for j, row in enumerate(part):
        for i, ch in enumerate(row):
            if ch != '.' and 0 <= y + j < len(g) and 0 <= x + i < len(g[0]): g[y + j][x + i] = ch
def fill(g, x0, x1, y, ch):
    for x in range(x0, x1 + 1): g[y][x] = ch


W_, H_ = 42, 44


def stand(bob=0, step=None):
    """서기 (bob: 다리 위 몸이 내려앉는 칸) · step: 걷기 다리 (앞발 x 이동, 뒷발 x 이동, 앞발 듦, 뒷발 듦)"""
    g = blank(W_, H_); G = H_ - 1; y0 = 2 + bob
    # 창 (몸 뒤 · 오른손): 창대 x33
    for y in range(y0 + 10, G + 1): g[y][34] = 'b'
    stamp(g, SPEARHEAD, 30, y0 + 2)
    for y in range(y0 + 11, y0 + 18): g[y][35] = 'R'
    for y in range(y0 + 13, y0 + 21): g[y][36] = 'r'
    # 망토 (왼쪽 어깨에서 뒤로 흘러내림 · 위 가장자리 밝은 빨강)
    cape = [(11, 12), (9, 12), (8, 12), (7, 12), (6, 11), (5, 11), (4, 11), (3, 10), (2, 10), (3, 9), (5, 8)]
    for k, (a, b) in enumerate(cape):
        for x in range(a, b + 1): g[y0 + 21 + k][x] = 'R' if x == a or (k < 2) else 'r'
    stamp(g, BODY, 10, y0 + 7)
    stamp(g, SKULL, 19, y0 + 31)
    fill(g, 29, 31, y0 + 28, 'B'); fill(g, 29, 31, y0 + 29, 'd')  # 팔
    for (x, y) in [(32, y0 + 28), (33, y0 + 28), (32, y0 + 29), (33, y0 + 29), (35, y0 + 28), (35, y0 + 29)]: g[y][x] = 's'  # 창을 쥔 손
    for y in (y0 + 28, y0 + 29): g[y][34] = 'b'
    # 다리
    fx, bx, fl, bl = step or (0, 0, 0, 0)
    for (lx, lift, shade) in [(15 + bx, bl, 'd'), (22 + fx, fl, 'B')]:
        top = y0 + 36; foot = G - lift
        for y in range(top, foot - 1): fill(g, lx, lx + 3, y, shade); g[y][lx] = 'd'
        fill(g, lx, lx + 4, foot - 1, 'd'); g[foot - 1][lx + 4] = 's'; fill(g, lx, lx + 4, foot, 'K')  # 신 · 발끝
    # 머리
    stamp(g, HORN_L, 4, y0 + 6); stamp(g, HORN_R, 29, y0 + 9)
    stamp(g, FLAME, 17, y0 - 2)
    stamp(g, MASK, 15, y0 + 13)
    return g


def image(g):
    im = Image.new('RGBA', (len(g[0]), len(g)), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.': px[x, y] = PAL[ch] + (255,)
    return im


if __name__ == '__main__':
    out = sys.argv[1]; s = 10
    fr = [image(stand())]
    sheet = Image.new('RGBA', (sum(f.width + 4 for f in fr) * s, H_ * s), (60, 60, 72, 255)); x = 0
    for f in fr: sheet.alpha_composite(f.resize((f.width * s, f.height * s), Image.NEAREST), (x * s, 0)); x += f.width + 4
    sheet.save(out)
