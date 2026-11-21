# 가면 족장: 사용자가 준 동작 시트(art/source/sheet_chief_motion.webp · 걷기 4 · 멀리 점프 4 · 창 휘두르기 4 · 창 찌르기 2 · 포효 2)를
# 게임 도트 크기(한 칸 약 5.75px → 1px)로 줄여 b_climbChief 시트로 넣는다. 서기 · 맞음 · 쓰러짐은 시트에 없어 찌르기 첫 장면(선 자세)으로 만든다.
#   python tools/chief_sheet.py [--gif 미리보기.gif]
import json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'art', 'source', 'sheet_chief_motion.webp')
OUT = os.path.join(ROOT, 'public', 'assets', 'custom', 'boss_climbChief_motion.png')
DOT = 5.75  # 원본 한 도트의 크기 (가장자리 간격을 재서 정함)
# 줄마다 (y0, y1) · 장면마다 (x0, x1) — 원본에서 잰 칸 (효과선 조각까지 들어가게 조금 넓게)
ROWS = {
    'run':    ((14, 212), [(255, 445), (520, 705), (790, 985), (1060, 1250)]),
    'leap':   ((222, 440), [(225, 450), (495, 725), (800, 1000), (1050, 1275)]),
    'attack': ((455, 635), [(225, 435), (528, 760), (815, 1075), (1105, 1345)]),
    'thrust': ((646, 828), [(225, 450), (520, 825)]),
    'skill':  ((830, 1010), [(250, 440), (525, 765)]),
}
FW, FH = 62, 38  # 한 장 크기 (게임은 아래 가운데를 발밑에 놓는다)
OUTLINE = (34, 22, 26, 255)

src = Image.open(SRC).convert('RGBA')
from PIL import ImageDraw
for box in [(0, 8, 216, 58), (0, 232, 262, 281), (0, 456, 290, 503), (0, 648, 266, 696), (0, 842, 212, 891)]:  # 줄 이름표를 지운다
    ImageDraw.Draw(src).rectangle(box, fill=(0, 0, 0, 0))
import numpy as np
SA = np.array(src).astype(float)

def grid_fit(box):
    """장면마다 도트 격자(한 칸 크기 · 시작 자리)를 따로 찾는다: 칸 안의 색이 가장 고르게 나뉘는 격자"""
    x0, y0, x1, y1 = box; A = SA[y0:y1, x0:x1]
    best = None
    for d in np.arange(5.3, 6.31, 0.05):
        for ox in np.arange(0, d, 0.5):
            for oy in np.arange(0, d, 0.5):
                xs = ((np.arange(A.shape[1]) - ox) // d).astype(int); ys = ((np.arange(A.shape[0]) - oy) // d).astype(int)
                # 가로 · 세로로 붙은 두 픽셀이 같은 칸인데 색이 다르면 벌점
                cx = (xs[1:] == xs[:-1]); cy = (ys[1:] == ys[:-1])
                dx = np.abs(np.diff(A, axis=1)).sum(2)[:, cx].sum(); dy = np.abs(np.diff(A, axis=0)).sum(2)[cy, :].sum()
                cost = (dx + dy) / (cx.sum() * A.shape[0] + cy.sum() * A.shape[1])
                if best is None or cost < best[0]: best = (cost, d, ox, oy)
    return best[1:]

# 색 12가지 (원본의 고르게 칠한 자리에서 잰 색) — 칸마다 이 중 하나만
PAL12 = np.array([
    (20, 19, 21),     # 외곽선 · 눈
    (64, 40, 45),     # 짙은 그늘
    (88, 38, 52),     # 망토 짙은 빨강
    (178, 57, 67),    # 깃털 빨강
    (250, 232, 209),  # 크림
    (212, 192, 178),  # 크림 그늘
    (215, 194, 191),  # 창날
    (158, 140, 142),  # 창날 그늘
    (110, 70, 62),    # 갈색 (머리띠 · 허리띠)
    (98, 64, 46),     # 창대 나무
    (112, 182, 88),   # 초록
    (80, 130, 70),    # 초록 그늘
], float)

def shrink(box):
    """원본 도트를 한 칸씩 그대로 옮긴다: 칸 가운데 픽셀마다 가장 가까운 12색을 고르고, 가장 많이 나온 색을 그 칸의 색으로"""
    d, ox, oy = grid_fit(box); x0, y0, x1, y1 = box; A = SA[y0:y1, x0:x1]
    nw, nh = int((A.shape[1] - ox) // d), int((A.shape[0] - oy) // d)
    out = Image.new('RGBA', (nw, nh), (0, 0, 0, 0)); po = out.load()
    for j in range(nh):
        for i in range(nw):
            cx, cy = ox + (i + 0.5) * d, oy + (j + 0.5) * d
            blk = A[int(cy - d * 0.3):int(cy + d * 0.3) + 1, int(cx - d * 0.3):int(cx + d * 0.3) + 1].reshape(-1, 4)
            bg = (blk[:, 3] < 128) | ((blk[:, :3].min(1) > 236))  # 투명 · 흰 바탕
            if bg.sum() * 2 >= len(blk): continue
            lab = ((blk[~bg, None, :3] - PAL12[None]) ** 2).sum(2).argmin(1)
            po[i, j] = tuple(int(v) for v in PAL12[np.bincount(lab).argmax()]) + (255,)
    return out

def bottom_and_head(im):
    w, h = im.size; px = im.load()
    ys = [y for y in range(h) for x in range(w) if px[x, y][3]]
    top, bot = min(ys), max(ys)
    head = [x for y in range(top, top + 12) for x in range(w) if px[x, y][3]]  # 머리장식 가운데 = 몸 가운데
    return bot, (min(head) + max(head)) // 2

def place(im, lift=0, ref=None):
    bot, cx = bottom_and_head(im)
    if ref is not None: bot = ref  # 점프: 땅에서 뜬 높이를 그대로 (같은 줄의 첫 장면 발밑 기준)
    o = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    o.paste(im, (FW // 2 - cx, FH - 1 - bot - lift), im)
    return o

frames = {}
for name, ((y0, y1), xs) in ROWS.items():
    small = [shrink((x0, y0, x1, y1)) for x0, x1 in xs]
    if name == 'leap':  # 같은 줄 안에서 땅 높이는 첫 장면 발밑 · 가로 가운데는 장면마다
        ground = max(bottom_and_head(s)[0] for s in small)
        frames[name] = [place(s, ref=ground) for s in small]
    else:
        frames[name] = [place(s) for s in small]

# 손으로 고친 칸 (창대를 곧게): 장면마다 {줄: 글자}, 글자는 x = 12부터. 색 글자는 PAL12 순서
LETTERS = 'KhrRWwSsBbGg'
FIX = {
    ('thrust', 0): {
        22: '....KhKbBKKhKKGGGGGGGGGGGGGGGKWKKK',
        23: '..KKRRKbBKKKswKgGGGGGKKGGGGGGKBKh.',
        25: '.KRRRRKKbBKRRKKGGGGGGKKGGGKKGKKRK.',
        26: '.KKRRKhhKbBKKKhKKgGGGGGGGGGKGKKRK.',
        27: '..KKK..hKbBKhhKKKKGGGGGGGwSGGK....',
        28: '........hKbBKKKRRRKKKKKKwSSKKK....',
        29: '........KKbBGGKRRRRWWKKKKKKK......',
        30: '........KKbGGGghKKBWWgWWBWKhK.....',
        32: '.......KhKKbBKKrbbBBhhhBghbK......',
        33: '......KrrKKbBKhKKbBrhhrKKKK.......',
        34: '.....KrrrrKKbBKKhKKKKKKgGKK.......',
        35: '.....KKKrrhKbBKggGGKhKKGGKK.......',
        36: '.......KKKKKbBKgGGGKhKKgGKK.......',
        37: '..........KKbBhKKKKKhKKKKKK.......',
    },
}
for (name, i), rows in FIX.items():
    px = frames[name][i].load()
    for y, row in rows.items():
        for k, c in enumerate(row):
            px[12 + k, y] = (0, 0, 0, 0) if c == '.' else tuple(int(v) for v in PAL12[LETTERS.index(c)]) + (255,)

# 기준 머리 (손으로 정리 · 눈 2×3 · 얼굴 단색 · 깃털 구분선 한 색). '.'은 건드리지 않는 칸
HEAD = [
    '............KK...........',
    '..........KKRRK..........',
    '....KKKKKKKRRRRK.........',
    '...KRRRRRRKRRRRRK.KK.....',
    '...KRRRRWWWWRRRRKKRRK....',
    '..KRRRRWWWWWwWWWWRRRK....',
    '.KRRRRWWwWWWwWWWwWRRKK...',
    '.KRRRWWWwWWWwWWWwWWRRRK..',
    '.KRRRRWWhhhhhhhhhhWWRRRK.',
    'KRRRRWWhBBBBWWWWWBhWWRRK.',
    'KRRWWWhBBBBBWKWKWBBhWRRK.',
    'KKRRWWhhhhhhhWWWhhhhWWRRK',
    '.KKRKKKGGGGGGGGGGGGKKWKK.',
    '....KGGGGGGGGGGGGGGKWKK..',
    '....KGGGGGGKKGGGKKGKBK...',
    '....KGGGGGGKKGGGKKGKBWK..',
    '....KGGGGGGKKGGGKKGKKRK..',
    '.....KGGGGGGGGGGGGGKKRK..',
    '......KKGGGGGGGWWGGK.....',
    '........KKKKKKKWWKKK.....',
]
EYE = (11, 14)  # 기준 머리 안 왼눈 왼쪽 위
EYE_GAP = 5     # 왼눈과 오른눈 사이 (칸)

def find_eye(im):
    """왼눈 찾기: 초록 사이의 검은 2칸이 두 줄 이상, 오른쪽 EYE_GAP 칸 자리에도 검은 칸"""
    px = im.load(); w, h = im.size; K = tuple(int(v) for v in PAL12[0]); G = tuple(int(v) for v in PAL12[10])
    c = lambda x, y: px[x, y][:3] if 0 <= x < w and 0 <= y < h and px[x, y][3] else None
    eye = lambda x, y: all(c(x - 1, y + k) == G and c(x, y + k) == K and c(x + 1, y + k) == K for k in range(2)) and c(x, y - 1) == G
    best = None
    for y in range(h):
        for x in range(w):
            if eye(x, y):
                for d in (EYE_GAP - 1, EYE_GAP, EYE_GAP + 1):
                    for e in (-1, 0, 1):
                        if eye(x + d, y + e) and best is None: best = (x, y)
    if best: return best
    return None

# 눈 모양이 원본마다 달라 못 찾는 장면: 원본 눈을 보고 손으로 적은 머리 자리 (기준 머리 왼쪽 위)
HEAD_AT = {('run', 2): (21, 5), ('leap', 0): (21, 8), ('leap', 2): (21, 2), ('leap', 3): (21, 8), ('attack', 2): (14, 10), ('skill', 1): (16, 5)}

def put_head(im, at=None):
    if at is None:
        e = find_eye(im)
        if e is None: return False
        at = (e[0] - EYE[0], e[1] - EYE[1])
    ox, oy = at; px = im.load()
    # 옛 머리 지우기: 머리장식 줄(얼굴 위)에서 창(날 · 대)과 그 외곽선만 남기고 비운다
    keep = {tuple(int(v) for v in PAL12[LETTERS.index(k)]) for k in 'Ssb'}
    K = tuple(int(v) for v in PAL12[0])
    near = lambda x, y: any(0 <= x + dx < im.width and 0 <= y + dy < im.height and px[x + dx, y + dy][3] and px[x + dx, y + dy][:3] in keep for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    for y in range(max(0, oy - 3), min(im.height, oy + 13)):
        for x in range(max(0, ox - 4), min(im.width, ox + 28)):
            q = px[x, y]
            if q[3] and q[:3] not in keep and not (q[:3] == K and near(x, y)): px[x, y] = (0, 0, 0, 0)
    for j, row in enumerate(HEAD):
        for i, ch in enumerate(row):
            if ch != '.' and 0 <= ox + i < im.width and 0 <= oy + j < im.height:
                px[ox + i, oy + j] = tuple(int(v) for v in PAL12[LETTERS.index(ch)]) + (255,)
    return True

def denoise(im):
    """혼자 떨어진 명암 점(같은 색 이웃이 없는 그늘색 한 칸)을 둘레에 가장 많은 색으로"""
    px = im.load(); w, h = im.size; shade = {tuple(int(v) for v in PAL12[LETTERS.index(k)]) for k in 'hrwsgB'}
    K = tuple(int(v) for v in PAL12[0]); todo = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            p = px[x, y]
            if not p[3] or p[:3] not in shade: continue
            nb = [px[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
            if any(q[3] and q[:3] == p[:3] for q in nb): continue
            four = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            cand = [q for q in four if q[3] and q[:3] != K]
            if cand: todo.append((x, y, max(set(cand), key=cand.count)))
    for x, y, q in todo: px[x, y] = q

# 창대 곧게 (손으로 읽은 자리): 장면마다 [(창날 밑 x, y), (창대 끝 x, y)]. 몸 뒤로 지나가는 곳은 그리지 않는다(빈칸 · 외곽선 · 옛 창대 자리에만)
SHAFT = {
    ('run', 0): [(21, 19), (23, 36)], ('run', 1): [(20, 19), (25, 35)], ('run', 2): [(19, 21), (25, 35)], ('run', 3): [(20, 18), (25, 35)],
    ('leap', 0): [(21, 21), (24, 32)], ('leap', 1): [(19, 19), (24, 34)], ('leap', 2): [(19, 15), (24, 27)], ('leap', 3): [(21, 20), (24, 35)],
    ('attack', 0): [(21, 22), (28, 28)], ('attack', 1): [(15, 24), (22, 28)], ('attack', 2): [(16, 25), (37, 30)],
    ('skill', 0): [(20, 25), (25, 36)], ('skill', 1): [(16, 24), (20, 35)], ('thrust', 1): [(20, 22), (27, 36)],
}
def col(k): return tuple(int(v) for v in PAL12[LETTERS.index(k)]) + (255,)
def straight_shaft(im, a, b):
    px = im.load(); w, h = im.size
    wood = {col('b'), col('B')}; ok_under = {col('K'), col('h')}
    ax, ay = a; bx, by = b; L = max(abs(bx - ax), abs(by - ay)); steep = abs(by - ay) >= abs(bx - ax)
    def dist(x, y):  # 선분까지 거리
        vx, vy = bx - ax, by - ay; t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
        return ((x - ax - t * vx) ** 2 + (y - ay - t * vy) ** 2) ** 0.5
    erased = set()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and px[x, y] in wood and dist(x, y) <= 2.6: px[x, y] = (0, 0, 0, 0); erased.add((x, y))
    core = []
    for k in range(L + 1):
        x = round(ax + (bx - ax) * k / L); y = round(ay + (by - ay) * k / L)
        core += [((x, y), col('b')), (((x + 1, y) if steep else (x, y + 1)), col('B'))]
    drawn = set()
    for (x, y), c in core:
        if 0 <= x < w and 0 <= y < h and (not px[x, y][3] or px[x, y] in ok_under or (x, y) in erased):
            px[x, y] = c; drawn.add((x, y))
    for (x, y) in list(drawn):  # 외곽선
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < w and 0 <= q[1] < h and q not in drawn and not px[q][3]: px[q] = col("K")
    for _ in range(3):  # 옛 창대 자리: 둘레 색으로 채운다 (둘레가 거의 비었으면 비워 둔다)
        for (x, y) in list(erased):
            if px[x, y][3]: erased.discard((x, y)); continue
            nb = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h]
            op = [q for q in nb if q[3]]
            if len(op) >= 3: px[x, y] = max(set(op), key=op.count); erased.discard((x, y))

def fill_holes(im):
    """머리를 바꾸며 생긴 몸 안 구멍(네 이웃 중 셋 이상이 칠해진 빈칸)을 둘레 색으로"""
    px = im.load(); w, h = im.size
    for _ in range(3):
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if px[x, y][3]: continue
                op = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if px[x + dx, y + dy][3]]
                if len(op) >= 3: px[x, y] = max(set(op), key=op.count)

MISS = []
for name, fl in frames.items():
    for i, f in enumerate(fl):
        if (name, i) in SHAFT: straight_shaft(f, *SHAFT[(name, i)])
        if not put_head(f, HEAD_AT.get((name, i))): MISS.append((name, i))
        fill_holes(f)
        denoise(f)
print('눈을 못 찾은 장면', MISS)

stand = frames['thrust'][0]
def shifted(im, dx=0, dy=0, top_only=None):
    o = Image.new('RGBA', im.size, (0, 0, 0, 0))
    if top_only is None: o.paste(im, (dx, dy), im); return o
    body = im.crop((0, 0, FW, top_only)); legs = im.crop((0, top_only, FW, FH))
    o.paste(legs, (0, top_only), legs); o.paste(body, (dx, dy), body); return o
frames['idle'] = [stand, stand, shifted(stand, dy=1, top_only=FH - 6), shifted(stand, dy=1, top_only=FH - 6)]  # 숨쉬기: 다리 위만 한 칸 내려앉는다
frames['hit'] = [shifted(stand, dx=-2, dy=1), shifted(stand, dx=-1)]
def lie(im):
    body = im.crop(im.getbbox()).rotate(-90, expand=True)
    o = Image.new('RGBA', (FW, FH), (0, 0, 0, 0)); o.alpha_composite(body, (max(0, (FW - body.width) // 2), FH - body.height)); return o
frames['death'] = [shifted(stand, dx=-1, dy=1), shifted(stand, dy=2, top_only=FH - 6), shifted(stand, dy=3, top_only=FH - 6), lie(stand)]

ORDER = ['idle', 'run', 'attack', 'skill', 'hit', 'death', 'leap', 'thrust']
cols = max(len(frames[n]) for n in ORDER)
sheet = Image.new('RGBA', (FW * cols, FH * len(ORDER)), (0, 0, 0, 0))
for r, n in enumerate(ORDER):
    for c, f in enumerate(frames[n]): sheet.alpha_composite(f, (c * FW, r * FH))
sheet.save(OUT)
sys.path.insert(0, HERE)
from sprites import meta_path, build_manifest
json.dump({'b_climbChief': {'img': os.path.basename(OUT), 'w': FW, 'h': FH, 'y0': 0, 'anims': {n: {'row': r, 'n': len(frames[n])} for r, n in enumerate(ORDER)}}}, open(meta_path('boss_pixel'), 'w'))
build_manifest(os.path.dirname(OUT))
print('frame', FW, 'x', FH, {n: len(frames[n]) for n in ORDER})

if '--gif' in sys.argv:
    gif = sys.argv[sys.argv.index('--gif') + 1]; s = 6; seq = []
    for n, dur, rep in [('idle', 220, 2), ('run', 140, 3), ('leap', 150, 2), ('attack', 110, 2), ('thrust', 160, 2), ('skill', 180, 2), ('hit', 110, 2), ('death', 260, 1)]:
        for _ in range(rep):
            for f in frames[n]:
                bg = Image.new('RGBA', (FW * s, FH * s), (60, 60, 72, 255)); bg.alpha_composite(f.resize((FW * s, FH * s), Image.NEAREST)); seq.append((bg.convert('RGB'), dur))
    seq[0][0].save(gif, save_all=True, append_images=[f for f, _ in seq[1:]], duration=[d for _, d in seq], loop=0)
