# 가면 족장: 사용자가 준 4×4 시트(art/source/sheet_chief_motion3.webp)를 도트 한 칸씩 "그대로" 딴다 (고쳐 그리지 않는다)
#   배경은 반투명이라 투명도로 가른다 · 색은 시트에서 뽑은 12가지로 고정(칸마다 가장 많이 나온 색) · 짙은 외곽선 1칸
#   줄: 서기 4 / 걷기 4 / 공격 4 / 맞음 · 쓰러짐 · 포효 2
#   python tools/chief_sheet3.py [--gif 미리보기.gif]
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'art', 'source', 'sheet_chief_motion3.webp')
OUT = os.path.join(ROOT, 'public', 'assets', 'custom', 'boss_climbChief_motion.png')
RGBA = np.array(Image.open(SRC).convert('RGBA')).astype(float)
src, alpha = RGBA[..., :3], RGBA[..., 3]
CELL = src.shape[0] / 4
SOLID = 200  # 이보다 진하면 그림, 옅으면 배경
# 처음 색 (이전 시트에서 잰 12가지) → 이 시트의 색으로 맞춘다
PAL0 = [(24, 21, 26), (69, 54, 52), (98, 78, 75), (124, 93, 85), (166, 128, 122), (234, 220, 199),
        (128, 56, 64), (172, 64, 66), (226, 112, 70), (196, 136, 104), (200, 182, 162), (150, 110, 102)]


def grid_fit(A):
    """칸 크기 · 시작 자리: 같은 칸 안에서 붙은 두 픽셀의 색 차이가 가장 작은 격자"""
    best = None
    dX = np.abs(np.diff(A, axis=1)).sum(2); dY = np.abs(np.diff(A, axis=0)).sum(2)
    for d in np.arange(D0 - 0.15, D0 + 0.16, 0.05):
        for ox in np.arange(0, d, 0.5):
            for oy in np.arange(0, d, 0.5):
                cx = ((np.arange(A.shape[1]) - ox) // d); cy = ((np.arange(A.shape[0]) - oy) // d)
                sx = cx[1:] == cx[:-1]; sy = cy[1:] == cy[:-1]
                cost = (dX[:, sx].sum() + dY[sy, :].sum()) / (sx.sum() * A.shape[0] + sy.sum() * A.shape[1])
                if best is None or cost < best[0]: best = (cost, d, ox, oy)
    return best[1:]


def dot_size():
    """시트 전체에서 한 도트 크기 (색이 바뀌는 자리 사이 간격의 가장 흔한 값)"""
    A = src[:int(CELL), :int(CELL)]; best = None
    for d in np.arange(5.0, 10.01, 0.1):
        dX = np.abs(np.diff(A, axis=1)).sum(2)
        for ox in np.arange(0, d, 1.0):
            cx = ((np.arange(A.shape[1]) - ox) // d); sx = cx[1:] == cx[:-1]
            cost = dX[:, sx].mean()
            if best is None or cost < best[0]: best = (cost, d)
    return best[1]


D0 = dot_size()


def sample(r, c):
    x0, y0 = round(c * CELL), round(r * CELL)
    A = src[y0:round(y0 + CELL), x0:round(x0 + CELL)]; Al = alpha[y0:round(y0 + CELL), x0:round(x0 + CELL)]
    d, ox, oy = grid_fit(A)
    nw, nh = int((A.shape[1] - ox) // d), int((A.shape[0] - oy) // d)
    blocks = {}
    for j in range(nh):
        for i in range(nw):
            cx, cy = ox + (i + 0.5) * d, oy + (j + 0.5) * d
            sl = (slice(int(cy - d * 0.3), int(cy + d * 0.3) + 1), slice(int(cx - d * 0.3), int(cx + d * 0.3) + 1))
            if (Al[sl] > SOLID).mean() > 0.5: blocks[(i, j)] = A[sl].reshape(-1, 3)[Al[sl].reshape(-1) > SOLID]
    return blocks, (nw, nh), d


ROWS = {'idle': [(0, i) for i in range(4)], 'run': [(1, i) for i in range(4)], 'attack': [(2, i) for i in range(4)],
        'hit': [(3, 0)], 'death': [(3, 0), (3, 1)], 'skill': [(3, 2), (3, 3)]}
RCS = sorted({rc for v in ROWS.values() for rc in v})
raw = {rc: sample(*rc) for rc in RCS}

# 12색: 모든 칸의 가운데 색을 모아 처음 색에서 출발해 맞춘다(k-평균)
meds = np.array([np.median(b, 0) for rc in RCS for b in raw[rc][0].values()])
P = np.array(PAL0, float)
for _ in range(20):
    lab = ((meds[:, None] - P[None]) ** 2).sum(2).argmin(1)
    P = np.array([meds[lab == k].mean(0) if (lab == k).any() else P[k] for k in range(len(P))])
P = P.round().astype(int)


def label(rc):
    blocks, (nw, nh), d = raw[rc]
    g = [[-1] * nw for _ in range(nh)]
    for (i, j), b in blocks.items():
        k = ((b[:, None] - P[None]) ** 2).sum(2).argmin(1)
        g[j][i] = int(np.bincount(k, minlength=len(P)).argmax())
    return g


def to_image(g):
    im = Image.new('RGBA', (len(g[0]), len(g)), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(g):
        for x, k in enumerate(row):
            if k >= 0: px[x, y] = tuple(int(v) for v in P[k]) + (255,)
    return im


cells = {rc: to_image(label(rc)) for rc in RCS}
# 한 장 크기: 가장 큰 그림 + 외곽선 · 가로는 칸 안 자리 그대로(장면끼리 몸이 같은 자리) · 세로는 발밑을 바닥 줄에
FW = max(im.width for im in cells.values()) + 2
FH = max(im.getbbox()[3] - min(c.getbbox()[1] for c in cells.values()) for im in cells.values()) + 2
TOP = min(c.getbbox()[1] for c in cells.values())
frames = {}
for name, rcs in ROWS.items():
    ground = max(cells[rc].getbbox()[3] for rc in rcs)  # 줄마다 가장 낮은 발밑을 바닥에
    fl = []
    for rc in rcs:
        im = cells[rc]; o = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        o.paste(im, ((FW - im.width) // 2, FH - 1 - ground), im); fl.append(o)
    frames[name] = fl

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
# 빈 위아래 줄 잘라 한 장 크기를 줄인다 (모든 장면 같은 만큼)
bb = [f.getbbox() for fl in frames.values() for f in fl]
y0, x0, x1 = min(b[1] for b in bb), min(b[0] for b in bb), max(b[2] for b in bb)
frames = {n: [f.crop((x0, y0, x1, FH)) for f in fl] for n, fl in frames.items()}
FW, FH = x1 - x0, FH - y0

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
    print('dot', round(D0, 2), 'frame', FW, 'x', FH, 'pal', [tuple(p) for p in P])
    print({rc: (cells[rc].getbbox()[2] - cells[rc].getbbox()[0], cells[rc].getbbox()[3] - cells[rc].getbbox()[1], round(raw[rc][2], 2)) for rc in RCS})
    if '--gif' in sys.argv:
        gif = sys.argv[sys.argv.index('--gif') + 1]; s = 6; seq = []
        for n, dur, rep in [('idle', 220, 2), ('run', 140, 3), ('attack', 130, 2), ('skill', 200, 2), ('hit', 200, 2), ('death', 400, 1)]:
            for _ in range(rep):
                for f in frames[n]:
                    bg = Image.new('RGBA', (FW * s, FH * s), (60, 60, 72, 255)); bg.alpha_composite(f.resize((FW * s, FH * s), Image.NEAREST)); seq.append((bg.convert('RGB'), dur))
        seq[0][0].save(gif, save_all=True, append_images=[f for f, _ in seq[1:]], duration=[d for _, d in seq], loop=0)
        big = Image.new('RGBA', (FW * cols * s, FH * len(ORDER) * s), (60, 60, 72, 255))
        big.alpha_composite(sheet.resize((sheet.width * s, sheet.height * s), Image.NEAREST)); big.save(gif.rsplit('.', 1)[0] + '_sheet.png')
