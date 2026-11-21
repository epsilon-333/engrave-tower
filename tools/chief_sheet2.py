# 가면 족장 (해골 가면 · 뿔 · 불꽃 · 창): 사용자가 준 4×4 동작 시트(art/source/sheet_chief_motion2.webp)를
# 원본 도트 한 칸씩 그대로 옮겨 b_climbChief 시트로 넣는다 (색은 12가지로 고정 · 칸마다 가장 많이 나온 색)
#   줄: 서기 4 / 걷기 4 / 공격 4 (선 자세 · 준비 · 휘두르기 · 되돌림) / 맞음 · 쓰러짐 · 포효 2
#   python tools/chief_sheet2.py [--gif 미리보기.gif]
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'art', 'source', 'sheet_chief_motion2.webp')
OUT = os.path.join(ROOT, 'public', 'assets', 'custom', 'boss_climbChief_motion.png')
CELL = 1254 / 4
BG = np.array((36, 37, 45), float)

# 색 12가지 (원본의 고르게 칠한 자리에서 잰 색) — 글자로 손질할 때 쓴다
PAL = {
    'K': (24, 21, 26),     # 눈구멍 · 가장 짙은 그늘
    'd': (69, 54, 52),     # 짙은 갈색 (망토 안 · 바지)
    'B': (98, 78, 75),     # 갈색 (두건 · 옷)
    'b': (124, 93, 85),    # 밝은 갈색 (창대 · 옷 밝은 쪽)
    'p': (166, 128, 122),  # 가면 그늘 (분홍빛 회색)
    'W': (234, 220, 199),  # 뼈 크림 (가면 · 뿔 · 창날)
    'r': (128, 56, 64),    # 짙은 빨강 (망토 그늘)
    'R': (172, 64, 66),    # 빨강 (망토 · 가면 무늬 · 술)
    'O': (226, 112, 70),   # 불꽃 주황
    's': (196, 136, 104),  # 손 · 발 살색
    'w': (200, 182, 162),  # 크림 그늘
    'm': (150, 110, 102),  # 중간 갈색
}
LET = list(PAL); P = np.array([PAL[k] for k in LET], float)

src = np.array(Image.open(SRC).convert('RGB')).astype(float)


def grid_fit(A):
    """칸 크기 · 시작 자리: 같은 칸 안에서 붙은 두 픽셀의 색 차이가 가장 작은 격자"""
    best = None
    dX = np.abs(np.diff(A, axis=1)).sum(2); dY = np.abs(np.diff(A, axis=0)).sum(2)
    for d in np.arange(7.85, 8.11, 0.05):  # 원본 한 도트 ≈ 8px (시트 전체에서 잰 값 · AI 그림이라 조금씩 밀려 장면마다 맞춘다)
        for ox in np.arange(0, d, 0.5):
            for oy in np.arange(0, d, 0.5):
                cx = ((np.arange(A.shape[1]) - ox) // d); cy = ((np.arange(A.shape[0]) - oy) // d)
                sx = cx[1:] == cx[:-1]; sy = cy[1:] == cy[:-1]
                cost = (dX[:, sx].sum() + dY[sy, :].sum()) / (sx.sum() * A.shape[0] + sy.sum() * A.shape[1])
                if best is None or cost < best[0]: best = (cost, d, ox, oy)
    return best[1:]


def cell_img(r, c):
    x0, y0 = round(c * CELL), round(r * CELL); A = src[y0:round(y0 + CELL), x0:round(x0 + CELL)]
    d, ox, oy = grid_fit(A)
    nw, nh = int((A.shape[1] - ox) // d), int((A.shape[0] - oy) // d)
    g = [['.'] * nw for _ in range(nh)]
    for j in range(nh):
        for i in range(nw):
            cx, cy = ox + (i + 0.5) * d, oy + (j + 0.5) * d
            blk = A[int(cy - d * 0.3):int(cy + d * 0.3) + 1, int(cx - d * 0.3):int(cx + d * 0.3) + 1].reshape(-1, 3)
            allc = np.vstack([P, BG[None]])
            lab = ((blk[:, None, :] - allc[None]) ** 2).sum(2).argmin(1)
            k = np.bincount(lab, minlength=len(allc)).argmax()
            g[j][i] = LET[k] if k < len(LET) else '_'  # '_' = 배경처럼 짙은 칸 (아래에서 가른다)
    # 테두리에서 이어진 '_'만 진짜 배경. 몸 안에 갇힌 '_'(가면 눈구멍 · 이 사이)은 눈구멍 색 K
    seen = set(); stack = [(i, j) for j in range(nh) for i in (0, nw - 1)] + [(i, j) for i in range(nw) for j in (0, nh - 1)]
    while stack:
        i, j = stack.pop()
        if (i, j) in seen or not (0 <= i < nw and 0 <= j < nh) or g[j][i] != '_': continue
        seen.add((i, j)); stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    for j in range(nh):
        for i in range(nw):
            if g[j][i] == '_': g[j][i] = '.' if (i, j) in seen else 'K'
    # 격자 원점이 칸 왼쪽 위에서 얼마나 떨어졌나 (장면끼리 자리 맞춤용, 원본 픽셀 → 도트)
    return g, (ox / d, oy / d), d


def to_image(g):
    im = Image.new('RGBA', (len(g[0]), len(g)), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.': px[x, y] = PAL[ch] + (255,)
    return im


ROWS = {'idle': [(0, i) for i in range(4)], 'run': [(1, i) for i in range(4)], 'attack': [(2, i) for i in range(4)],
        'hit': [(3, 0)], 'death': [(3, 0), (3, 1)], 'skill': [(3, 2), (3, 3)]}
cells = {rc: cell_img(*rc) for rc in {rc for v in ROWS.values() for rc in v}}
FW, FH = 44, 40
GROUND = FH - 1


def place(rc, ground_of):
    g, _, _ = cells[rc]; im = to_image(g); bb = im.getbbox()
    o = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    # 가로: 칸 안 자리 그대로 (장면끼리 몸이 같은 자리) · 세로: 그 줄의 땅(가장 낮은 발밑)을 한 장의 바닥에
    dx = FW // 2 - len(g[0]) // 2; dy = GROUND - ground_of
    o.paste(im, (dx, dy), im); return o


frames = {}
def feet(rc):
    """발밑: 창대(b · m)를 뺀 가장 낮은 칸 (창대 끝이 발보다 내려가 있어도 발을 땅에)"""
    g = cells[rc][0]
    return max(j for j, row in enumerate(g) if any(ch not in '.bm' for ch in row))


for name, rcs in ROWS.items():
    ground = max(to_image(cells[rc][0]).getbbox()[3] - 1 for rc in rcs if rc != (3, 1))
    # 걷기: 원본 두 장은 몸이 위로 떠 있어(뛰는 그림) 출렁인다 → 장면마다 발을 땅에 붙인다
    frames[name] = [place(rc, feet(rc) if name == 'run' else ground if rc != (3, 1) else to_image(cells[rc][0]).getbbox()[3] - 1) for rc in rcs]

# 기준 머리 (손으로 정리): 불꽃 · 왼뿔 · 두건 · 해골 가면(왼눈 3칸 · 오른눈 1칸 · 이 셋) · 오른뿔. '.'은 건드리지 않는 칸
# 각 줄은 첫 글자부터 끝 글자 사이를 옛 머리째 지우고 새로 찍는다 (창대 b · m은 남긴다)
HEAD = [
    '........RR..........',
    '........RR..........',
    '........ROR.........',
    '......RROORR........',
    '......RROOORR.......',
    '.WW...RRRWWRRBBB....',
    '.WW.....RRWWBBBB..W.',
    '.WW.....BBBBBBBBB.W.',
    '.WWWW..BBBBBBBBBBWW.',
    '.WWWWWBBBWWRRRWWBWW.',
    '...WWWBBWWRWWWRWWW..',
    '.....BBBWKKKWWKWWB..',
    '.....BBBWKKKWWKWWB..',
    '.....BBBWWWWWWWWWB..',
    '....BBBBRWWWWWWWRB..',
    '....BBBBBWKWKWKWB...',
    '.....BBBBWKWKWKWB...',
]
FLAME_AT = (8, 0)  # 기준 머리 안 불꽃 맨 위 칸
HEAD_POS = {}      # 장면마다 기준 머리를 찍은 자리 (키운 뒤 같은 머리를 다시 찍는다)
HEAD_AT = {}       # 불꽃으로 자리를 못 잡는 장면: (장면 이름, 번호) → 기준 머리 왼쪽 위


def flame_top(im):
    px = im.load(); w, h = im.size; fire = {PAL['R'], PAL['O']}
    for y in range(h):
        xs = [x for x in range(8, 32) if px[x, y][3] and px[x, y][:3] in fire]
        if xs: return xs[0], y


def put_head(im, at, head=None):
    px = im.load(); ox, oy = at; keep = {PAL['b'], PAL['m']}
    for j, row in enumerate(head or HEAD):
        idx = [i for i, ch in enumerate(row) if ch != '.']
        for i in range(idx[0], idx[-1] + 1):
            x, y = ox + i, oy + j
            if not (0 <= x < im.width and 0 <= y < im.height): continue
            ch = row[i]
            if ch != '.': px[x, y] = PAL[ch] + (255,)
            elif px[x, y][3] and px[x, y][:3] not in keep: px[x, y] = (0, 0, 0, 0)


def denoise(im):
    """혼자 떨어진 점(같은 색 이웃이 하나도 없는 칸)을 둘레에 가장 많은 색으로 (머리를 넣기 전에)"""
    px = im.load(); w, h = im.size; todo = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            p = px[x, y]
            if not p[3] or p[:3] in (PAL['W'], PAL['b']): continue  # 뼈 · 창대는 가늘어도 둔다
            nb = [px[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
            if any(q[3] and q[:3] == p[:3] for q in nb): continue
            four = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            op = [q for q in four if q[3]]
            if len(op) >= 2: todo.append((x, y, max(set(op), key=op.count)))
    for x, y, q in todo: px[x, y] = q


for fl in frames.values():
    for f in fl: denoise(f)
# 서기 4번째: 원본에서 가면 오른쪽에 번진 검은 덩어리 (다른 서기 장면엔 없다)
_px = frames['idle'][3].load()
for _y in range(18, 32):
    for _x in range(30, 34):
        if _px[_x, _y][3] and _px[_x, _y][:3] == PAL['K']: _px[_x, _y] = (0, 0, 0, 0)

for name, fl in frames.items():
    for k, f in enumerate(fl):
        if name == 'death' and k == 1: continue  # 누운 장면은 따로
        at = HEAD_AT.get((name, k))
        if at is None: fx, fy = flame_top(f); at = (fx - FLAME_AT[0], fy - FLAME_AT[1])
        HEAD_POS[(name, k)] = at  # 기준 머리를 붙이지 않는다 (머리가 굳어 보여서) · 장면마다 손으로 고친다 (HAND)

# 가면 얼굴만 장면마다 손으로 (두건 · 뿔 · 불꽃은 원본 그대로 · 머리가 굳지 않게)
# 장면마다 왼눈 왼쪽 위 칸을 원본에서 읽어 적었다. 그 자리를 기준으로 눈 · 무늬 · 이를 같은 크기로 다시 찍는다
FACE_E = {
    ('idle', 0): (21, 24), ('idle', 1): (21, 25), ('idle', 2): (21, 25), ('idle', 3): (21, 25),
    ('run', 0): (21, 26), ('run', 1): (23, 27), ('run', 2): (23, 26), ('run', 3): (22, 26),
    ('attack', 0): (21, 25), ('attack', 1): (18, 26), ('attack', 2): (19, 26), ('attack', 3): (22, 26),
    ('hit', 0): (17, 27), ('death', 0): (17, 27), ('skill', 0): (20, 25), ('skill', 1): (21, 24),
}
FACE = [  # 왼눈 왼쪽 위가 (1, 2) · '.'은 건드리지 않음 · 'W'로 원본 얼룩을 덮는다
    '...RRR..',   # 이마 줄
    '.WWWWWWW',
    '.KKWWWKW',   # 왼눈 · 오른눈
    '.KKKWWKW',
    '.OOWWWWW',   # 눈 밑 무늬
    '.OWKWKWW',   # 이
    '.WWKWKWW',
    '.KKKKKKK',   # 턱
]
FACE_AT = (1, 2)
for (name, k), (ex, ey) in FACE_E.items():
    _p = frames[name][k].load(); ox, oy = ex - FACE_AT[0], ey - FACE_AT[1]
    for j, row in enumerate(FACE):
        for i, ch in enumerate(row):
            if ch != '.': _p[ox + i, oy + j] = PAL[ch] + (255,)
# 서기 4번째: 원본에서 가면 오른쪽에 번진 검은 줄 → 두건
_p = frames['idle'][3].load()
for _y in range(24, 32):
    for _x in (28, 29):
        if _p[_x, _y][3] and _p[_x, _y][:3] == PAL['K']: _p[_x, _y] = PAL['B'] + (255,)

# 몸통 · 허리띠 · 다리 · 손 (장면마다 원본에서 읽은 자리): 옷 위 끝 줄 t · 옷 왼끝 x0 · 오른끝 x1 · 허리띠 줄 belt · 해골 왼끝 sk
# · 두 다리 왼끝 (lx, rx) · 창 쥔 손 (x, y) 또는 None. 옷 아래 끝 35 · 다리 36~38 · 발 39 (모든 장면 같은 땅)
BODY_AT = {
    ('idle', 0): (30, 16, 28, 33, 21, (19, 25), (29, 32)), ('idle', 1): (31, 17, 29, 33, 22, (18, 25), (30, 31)),
    ('idle', 2): (31, 18, 28, 34, 23, (19, 24), (29, 32)), ('idle', 3): (31, 17, 29, 34, 23, (18, 25), (30, 31)),
    ('run', 0): (32, 16, 27, 34, 22, (13, 20), (29, 33)), ('run', 3): (32, 17, 29, 34, 22, (18, 23), (30, 34)),
    ('attack', 0): (31, 16, 27, 34, 21, (17, 24), (28, 31)), ('attack', 1): (32, 15, 25, 34, 20, (15, 22), None),
    ('attack', 2): (32, 15, 24, 34, 19, (15, 23), None), ('attack', 3): (32, 18, 29, 34, 22, (17, 25), (29, 32)),
    ('hit', 0): (33, 14, 25, 34, 19, (13, 22), None), ('death', 0): (33, 14, 25, 34, 19, (13, 22), None),
    ('skill', 0): (31, 15, 29, 34, 23, (18, 25), (30, 32)), ('skill', 1): (30, 18, 28, 33, 23, (19, 25), (30, 31)),
}
for (name, k), (t, x0, x1, belt, sk, (lx, rx), hand) in BODY_AT.items():
    _p = frames[name][k].load(); keep = {PAL['b'], PAL['r'], PAL['R']}
    put = lambda x, y, ch: _p.__setitem__((x, y), PAL[ch] + (255,))
    for y in range(t, 40):  # 옛 몸통 · 다리 지우기 (창대 · 망토는 남긴다)
        for x in range(max(0, x0 - 1) if y < 36 else 8, min(FW, x1 + 2) if y < 36 else 36):
            if _p[x, y][3] and _p[x, y][:3] not in keep: _p[x, y] = (0, 0, 0, 0)
    for y in range(t, 36):
        for x in range(x0, x1 + 1):
            if y == belt: put(x, y, 'K')
            elif y < belt: put(x, y, 'd')
            else: put(x, y, 'd' if x in (x0, x1) else 'B')
    for i, ch in enumerate('WWW'): put(sk + i, belt - 1, ch)  # 허리띠 해골
    for i, ch in enumerate('KWK'): put(sk + i, belt, ch)
    put(sk + 1, belt + 1, 'W')
    for L in (lx, rx):  # 다리 둘 (2칸) · 발 (앞쪽으로 한 칸 더)
        for y in range(36, 39): put(L, y, 'd'); put(L + 1, y, 'd')
        for i in range(3): put(L + i, 39, 's')
    if hand: put(hand[0], hand[1], 's')  # 창 쥔 손은 한 칸

# 누운 장면: 기준 머리에서 뿔을 뺀 부분(불꽃 · 두건 · 가면)을 왼쪽으로 90° 눕힌다 (불꽃이 왼쪽 · 이가 오른쪽 = 원본 누운 모습)
_core = [row[6:18] for row in HEAD]
HEAD_LIE = [''.join(_core[r][len(_core[0]) - 1 - c] for r in range(len(_core))) for c in range(len(_core[0]))]
_px = frames['death'][1].load()
for _y in range(24, 38):  # 옛 가면 · 불꽃 색만 지운다 (망토 · 두건 · 창은 둔다)
    for _x in range(4, 27):
        if _px[_x, _y][3] and _px[_x, _y][:3] in {PAL[k] for k in 'WKROwp'}: _px[_x, _y] = (0, 0, 0, 0)
put_head(frames['death'][1], (5, 26), HEAD_LIE)  # 불꽃이 원본 불꽃 자리(왼쪽)에 오게 손으로 맞춘 자리
for _y in range(27, 37):  # 눕힌 머리가 원본 가면보다 짧아 몸과 사이에 난 틈: 몸 그늘 색으로
    for _x in range(20, 28):
        if not _px[_x, _y][3] and any(_px[_x - k, _y][3] for k in (1, 2)) and any(_px[_x + k, _y][3] for k in (1, 2, 3)): _px[_x, _y] = PAL['d'] + (255,)

# 창대 곧게 (장면마다 손으로 읽은 [창날 밑, 창대 끝]). 외곽선 없는 그림이라 나무색(b) 한 줄 · 몸 앞은 덮지 않는다
SHAFT = {
    ('idle', 0): [(32, 23), (29, 37)], ('idle', 1): [(33, 22), (29, 38)], ('idle', 2): [(32, 24), (29, 39)], ('idle', 3): [(33, 22), (29, 38)],
    ('run', 0): [(33, 24), (27, 39)], ('run', 1): [(33, 21), (29, 31)], ('run', 2): [(34, 16), (29, 29)], ('run', 3): [(33, 26), (28, 39)],
    ('attack', 0): [(31, 24), (26, 36)], ('attack', 1): [(33, 27), (25, 31)], ('attack', 2): [(32, 28), (27, 30)], ('attack', 3): [(33, 24), (27, 37)],
    ('skill', 0): [(32, 22), (29, 37)], ('skill', 1): [(33, 21), (30, 36)],
}


def straight_shaft(im, a, b):
    px = im.load(); w, h = im.size; wood = {PAL['b'], PAL['m']}
    (ax, ay), (bx, by) = a, b; vx, vy = bx - ax, by - ay; L = max(abs(vx), abs(vy))
    def dist(x, y):
        t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
        return ((x - ax - t * vx) ** 2 + (y - ay - t * vy) ** 2) ** 0.5
    erased = set()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and px[x, y][:3] in wood and dist(x, y) <= 2.5: px[x, y] = (0, 0, 0, 0); erased.add((x, y))
    line = {(round(ax + vx * k / L), round(ay + vy * k / L)) for k in range(L + 1)}
    for (x, y) in line:
        if 0 <= x < w and 0 <= y < h and (not px[x, y][3] or (x, y) in erased): px[x, y] = PAL['b'] + (255,)
    for _ in range(3):  # 옛 창대 자리: 둘레 색으로 (둘레가 비었으면 빈칸)
        for (x, y) in list(erased):
            if (x, y) in line or px[x, y][3]: erased.discard((x, y)); continue
            op = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] and (x + dx, y + dy) not in line]
            if len(op) >= 3: px[x, y] = max(set(op), key=op.count); erased.discard((x, y))


for (name, k), ab in SHAFT.items(): straight_shaft(frames[name][k], *ab)


# 창날 하나로 (서기 첫 장면의 창날을 정리): 창이 위로 선 장면마다 창대 위 끝에 같은 창날을 찍는다
SPEARHEAD = [
    '.WWW....',
    '.WWW....',
    '.WWW....',
    '..WWWWW.',
    '.WWWKKW.',
    '..WWWWW.',
    '.....WW.',
    '.....WWW',
]
SPEAR_OFF = (-1, -8)  # 창대 위 끝(창날 밑)에서 창날 왼쪽 위까지
UPRIGHT = [('idle', 0), ('idle', 1), ('idle', 2), ('idle', 3), ('run', 0), ('run', 1), ('run', 2), ('run', 3), ('attack', 0), ('attack', 3), ('skill', 0), ('skill', 1)]
SPEAR_POS = {}


def put_spear(im, a):
    px = im.load(); w, h = im.size; bone = {PAL[k] for k in 'WwKp'}
    seed = [(x, y) for y in range(max(0, a[1] - 10), a[1]) for x in range(a[0] - 1, min(w, a[0] + 8)) if px[x, y][3] and px[x, y][:3] == PAL['W']]
    seen = set(seed)
    while seed:  # 옛 창날: 창대 위쪽에 붙은 뼈색 덩어리 (뿔 쪽 왼편으로는 넘어가지 않는다)
        x, y = seed.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in seen and a[0] - 1 <= q[0] < w and 0 <= q[1] < a[1] and px[q][3] and px[q][:3] in bone: seen.add(q); seed.append(q)
    for q in seen: px[q] = (0, 0, 0, 0)
    ox, oy = a[0] + SPEAR_OFF[0], a[1] + SPEAR_OFF[1]
    for j, row in enumerate(SPEARHEAD):
        for i, ch in enumerate(row):
            if ch != '.' and 0 <= ox + i < w and 0 <= oy + j < h: px[ox + i, oy + j] = PAL[ch] + (255,)
    return ox, oy


for nk in UPRIGHT: SPEAR_POS[nk] = put_spear(frames[nk[0]][nk[1]], SHAFT[nk][0])


# 1.5배로 키우기 (새로 그리지 않는다): Scale3x로 사선을 매끄럽게 3배 → 한 칸 건너 뽑아 1.5배. 키운 뒤 생긴 외톨이 점은 둘레 색으로
def scale3x(src):
    w, h = src.size; p = src.load(); o = Image.new('RGBA', (w * 3, h * 3)); q = o.load()
    g = lambda x, y: p[min(max(x, 0), w - 1), min(max(y, 0), h - 1)]
    for y in range(h):
        for x in range(w):
            A, B, C, D, E, F, G, H, I = (g(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
            e = [E] * 9
            if B != H and D != F:
                e[0] = D if D == B else E
                e[1] = B if (D == B and E != C) or (B == F and E != A) else E
                e[2] = F if B == F else E
                e[3] = D if (D == B and E != G) or (D == H and E != A) else E
                e[5] = F if (B == F and E != I) or (H == F and E != C) else E
                e[6] = D if D == H else E
                e[7] = H if (D == H and E != I) or (H == F and E != G) else E
                e[8] = F if H == F else E
            for k in range(9): q[x * 3 + k % 3, y * 3 + k // 3] = e[k]
    return o


FW, FH = FW * 3 // 2, FH * 3 // 2
frames = {n: [scale3x(f).resize((FW, FH), Image.NEAREST) for f in fl] for n, fl in frames.items()}
for fl in frames.values():
    for f in fl: denoise(f)


def grid_of(lines):
    """글자 그림을 1.5배로 (몸과 같은 방법) → 글자 그림"""
    im = to_image([list(r) for r in lines]); big = scale3x(im).resize((im.width * 3 // 2, im.height * 3 // 2), Image.NEAREST)
    inv = {v: k for k, v in PAL.items()}; px = big.load()
    return [''.join(inv[px[x, y][:3]] if px[x, y][3] else '.' for x in range(big.width)) for y in range(big.height)]


S = lambda v: round(v * 1.5)
HEAD_S, LIE_S, SPEAR_S = grid_of(HEAD), grid_of(HEAD_LIE), grid_of(SPEARHEAD)
put_head(frames['death'][1], (S(5), S(26)), LIE_S)
for (name, k), (x, y) in SPEAR_POS.items(): put_head(frames[name][k], (S(x), S(y)), SPEAR_S)

# 달리기: 원본 넷 중 둘(2 · 3번째)은 뛰어오른 그림이라 어색하다 → 땅을 딛는 두 장(1 · 4번째)으로
# 딛기 → 내려앉기(다리 위 몸이 한 칸 내려감) → 반대 발 딛기 → 내려앉기
def sink(im, legs=10):
    o = Image.new('RGBA', im.size, (0, 0, 0, 0))
    top = im.crop((0, 0, im.width, im.height - legs)); bot = im.crop((0, im.height - legs, im.width, im.height))
    o.paste(bot, (0, im.height - legs), bot); o.paste(top, (0, 1), top); return o


r0, r3 = frames['run'][0], frames['run'][3]
frames['run'] = [r0, sink(r0), r3, sink(r3)]

# 외곽선: 다른 캐릭터처럼 짙은 1칸
OUTLINE = (20, 14, 18, 255)
def outline(im):
    px = im.load(); w, h = im.size; todo = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): todo.append((x, y))
    for q in todo: px[q] = OUTLINE


for fl in frames.values():
    for f in fl: outline(f)

if __name__ == '__main__':
    ORDER = ['idle', 'run', 'attack', 'skill', 'hit', 'death']
    cols = max(len(frames[n]) for n in ORDER)
    sheet = Image.new('RGBA', (FW * cols, FH * len(ORDER)), (0, 0, 0, 0))
    for r, n in enumerate(ORDER):
        for c, f in enumerate(frames[n]): sheet.alpha_composite(f, (c * FW, r * FH))
    sheet.save(OUT)
    sys.path.insert(0, HERE)
    from sprites import meta_path, build_manifest
    json.dump({'b_climbChief': {'img': os.path.basename(OUT), 'w': FW, 'h': FH, 'y0': 0, 'anims': {n: {'row': r, 'n': len(frames[n])} for r, n in enumerate(ORDER)}}}, open(meta_path('boss_pixel'), 'w'))
    build_manifest(os.path.dirname(OUT))
    print('frame', FW, 'x', FH, {n: len(frames[n]) for n in ORDER}, 'dot', [round(cells[rc][2], 2) for rc in sorted(cells)])
    if '--gif' in sys.argv:
        gif = sys.argv[sys.argv.index('--gif') + 1]; s = 6; seq = []
        for n, dur, rep in [('idle', 220, 2), ('run', 140, 3), ('attack', 130, 2), ('skill', 200, 2), ('hit', 200, 2), ('death', 400, 1)]:
            for _ in range(rep):
                for f in frames[n]:
                    bg = Image.new('RGBA', (FW * s, FH * s), (60, 60, 72, 255)); bg.alpha_composite(f.resize((FW * s, FH * s), Image.NEAREST)); seq.append((bg.convert('RGB'), dur))
        seq[0][0].save(gif, save_all=True, append_images=[f for f, _ in seq[1:]], duration=[d for _, d in seq], loop=0)
