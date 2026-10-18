# 사용자가 준 스프라이트 시트(용 · 정령왕)에서 동작 프레임을 잘라 게임용 시트로 만든다
#   패널마다 배경과 다른 픽셀을 찾아 프레임을 나누고(겹치면 개수대로 균등 분할), 배경을 지우고,
#   발끝을 바닥선에 맞춘 같은 크기의 칸에 넣는다. 사이가 끊기는 동작은 두 프레임을 섞은 중간 프레임을 넣는다.
from dragon_walk import walk_cycle
import sys, json
from collections import deque
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PREV = sys.argv[3] if len(sys.argv) > 3 else None
im = Image.open(SRC).convert('RGBA')
W, H = im.size
px = im.load()

# (모델, 동작, 패널 x0, x1, y0, y1, 프레임 수)
PANELS = [
    ('dragon', 'idle', 20, 412, 246, 342, 4), ('dragon', 'walk', 430, 782, 246, 342, 4), ('dragon', 'run', 795, 1142, 246, 342, 4),
    ('dragon', 'fly', 1155, 1515, 246, 342, 4), ('dragon', 'attack', 20, 382, 376, 468, 4), ('dragon', 'breath', 395, 572, 376, 468, 2),
    ('dragon', 'hit', 905, 1142, 376, 468, 3), ('dragon', 'death', 1155, 1515, 376, 468, 4),
    ('wind', 'idle', 128, 332, 580, 682, 3), ('wind', 'walk', 340, 628, 580, 682, 4), ('wind', 'attack', 668, 948, 578, 682, 3),
    ('wind', 'hit', 955, 1124, 580, 682, 2), ('wind', 'skill', 1140, 1522, 578, 682, 4),
    ('fire', 'idle', 25, 277, 742, 838, 4), ('fire', 'walk', 285, 512, 742, 838, 4), ('fire', 'attack', 520, 752, 742, 838, 3),
    ('fire', 'hit', 895, 1127, 742, 838, 3), ('fire', 'skill', 1140, 1522, 726, 838, 3),
    ('forest', 'idle', 25, 267, 900, 1002, 3), ('forest', 'walk', 275, 562, 900, 1002, 4), ('forest', 'attack', 575, 740, 884, 1002, 2),
    ('forest', 'hit', 900, 1132, 900, 1002, 3), ('forest', 'skill', 1145, 1522, 884, 1002, 3),
]

def bg_of(x0, x1, y0, y1):
    # 패널 배경: 가장 흔한 어두운 색
    from collections import Counter
    c = Counter()
    for y in range(y0, y1, 3):
        for x in range(x0, x1, 3):
            r, g, b, _ = px[x, y]
            if r + g + b < 120: c[(r // 4, g // 4, b // 4)] += 1
    (r, g, b), _ = c.most_common(1)[0]
    return (r * 4 + 2, g * 4 + 2, b * 4 + 2)

def fg(p, bg):
    return abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) > 48

def split(x0, x1, y0, y1, n, bg):
    cols = [sum(1 for y in range(y0, y1) if fg(px[x, y], bg)) for x in range(x0, x1)]
    runs, s = [], None
    for i, c in enumerate(cols + [0]):
        if c > 0 and s is None: s = i
        if c == 0 and s is not None:
            if i - s > 2: runs.append([s, i])
            s = None
    # 너무 가까운 덩어리는 합친다 (프레임 하나에 붙은 불꽃 조각 등)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 4: merged[-1][1] = r[1]
        else: merged.append(r)
    if len(merged) == n: return [(x0 + a, x0 + b) for a, b in merged]
    # 개수가 안 맞으면 전경이 있는 구간을 균등 분할
    a, b = merged[0][0], merged[-1][1]
    step = (b - a) / n
    return [(x0 + int(a + i * step), x0 + int(a + (i + 1) * step)) for i in range(n)]

def clean(box, bg):
    x0, y0, x1, y1 = box
    c = im.crop(box).copy(); w, h = c.size; p = c.load()
    for y in range(h):
        for x in range(w):
            if not fg(p[x, y], bg): p[x, y] = (0, 0, 0, 0)
    # 작은 잡티 제거 (4픽셀 이하 덩어리)
    seen = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not p[x, y][3]: continue
            q, comp = deque([(x, y)]), []
            seen[y][x] = True
            while q:
                a, b = q.popleft(); comp.append((a, b))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = a + dx, b + dy
                    if 0 <= xx < w and 0 <= yy < h and not seen[yy][xx] and p[xx, yy][3]:
                        seen[yy][xx] = True; q.append((xx, yy))
            if len(comp) <= 4:
                for a, b in comp: p[a, b] = (0, 0, 0, 0)
    return c

def scale_to(c, s):
    w, h = c.size
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    sm = c.resize((nw, nh), Image.BOX); p = sm.load()
    for y in range(nh):
        for x in range(nw):
            r, g, b, a = p[x, y]
            if a < 110: p[x, y] = (0, 0, 0, 0)
            else: k = 255 / a; p[x, y] = (min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), 255)
    return sm

def blend(a, b, t):
    return Image.blend(a, b, t)

import numpy as np, cv2

def to_np(img): return np.array(img, dtype=np.float32) / 255.0
def to_img(a): return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA')

def inbetween(A, B, t=0.5):
    # 광학 흐름으로 두 프레임 사이 그림을 만든다: A 는 B 쪽으로 t, B 는 A 쪽으로 1-t 만큼 밀어 겹친다
    a, b = to_np(A), to_np(B)
    ga = (cv2.cvtColor((a[..., :3] * a[..., 3:4] * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY))
    gb = (cv2.cvtColor((b[..., :3] * b[..., 3:4] * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY))
    fab = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 15, 5, 5, 1.2, 0)
    fba = cv2.calcOpticalFlowFarneback(gb, ga, None, 0.5, 4, 15, 5, 5, 1.2, 0)
    h, w = ga.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    wa = cv2.remap(a, gx - fab[..., 0] * t, gy - fab[..., 1] * t, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    wb = cv2.remap(b, gx - fba[..., 0] * (1 - t), gy - fba[..., 1] * (1 - t), cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    # 픽셀 그림이 흐려지지 않게: 섞지 않고, 더 가까운 쪽(t)의 픽셀을 우선 고르고 빈 곳은 다른 쪽으로 채운다
    first, second = (wa, wb) if t <= 0.5 else (wb, wa)
    out = np.where(first[..., 3:4] > 0.5, first, second)
    out[..., 3] = np.where(out[..., 3] > 0.5, 1.0, 0.0)
    return to_img(out)

def anchor(f):
    # 서 있는 자리: 맨 아래 12% (발) 픽셀의 가로 무게중심. 주먹을 뻗거나 몸을 기울여도 발은 그대로라 위치가 튀지 않는다
    a = np.array(f)[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.88):])
    if len(xs) < 4: ys, xs = np.nonzero(a[int(h * 0.6):])
    return xs.mean() if len(xs) else f.width / 2

LOOP = ('idle', 'walk', 'run', 'fly')
def components(x0, x1, y0, y1, bg):
    w, h = x1 - x0, y1 - y0
    mask = [[fg(px[x0 + x, y0 + y], bg) for x in range(w)] for y in range(h)]
    lab = [[-1] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if not mask[y][x] or lab[y][x] >= 0: continue
            q = deque([(x, y)]); lab[y][x] = len(comps); pts = []
            while q:
                a, b = q.popleft(); pts.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        xx, yy = a + dx, b + dy
                        if 0 <= xx < w and 0 <= yy < h and mask[yy][xx] and lab[yy][xx] < 0:
                            lab[yy][xx] = len(comps); q.append((xx, yy))
            comps.append(pts)
    return comps

models = {}
for name, anim, x0, x1, y0, y1, n in PANELS:
    bg = bg_of(x0, x1, y0, y1)
    xs = split(x0, x1, y0, y1, n, bg)
    centers = [(a + b) / 2 - x0 for a, b in xs]
    comps = [c for c in components(x0, x1, y0, y1, bg) if len(c) > 6]
    def thin(c):
        xs_ = [p[0] for p in c]; ys_ = [p[1] for p in c]
        return max(ys_) - min(ys_) <= 2 and max(xs_) - min(xs_) >= 6   # 패널 밑줄 같은 가는 선
    comps = [c for c in comps if not thin(c)]
    if name in ('fire', 'forest'):
        # 시트의 글자(밝은 회청색, 채도 낮음)는 버린다
        def texty(c):
            cols = [px[x0 + x, y0 + y] for x, y in c]
            r = sum(p[0] for p in cols) / len(cols); g = sum(p[1] for p in cols) / len(cols); b = sum(p[2] for p in cols) / len(cols)
            return b >= r - 10 and max(r, g, b) - min(r, g, b) < 70 and max(r, g, b) > 110
        comps = [c for c in comps if not texty(c)]
    groups = [[] for _ in range(n)]
    for c in comps:
        cx = sum(p[0] for p in c) / len(c)
        i = min(range(n), key=lambda k: abs(centers[k] - cx))
        groups[i].append(c)
    frames = []
    for gpts in groups:
        if not gpts: continue
        allp = [p for c in gpts for p in c]
        mx0 = min(p[0] for p in allp); mx1 = max(p[0] for p in allp); my0 = min(p[1] for p in allp); my1 = max(p[1] for p in allp)
        f = Image.new('RGBA', (mx1 - mx0 + 1, my1 - my0 + 1), (0, 0, 0, 0)); fp = f.load()
        for (x, y) in allp: fp[x - mx0, y - my0] = px[x0 + x, y0 + y]
        frames.append((f, my1))  # my1: 패널 안에서 발끝 높이
    models.setdefault(name, {})[anim] = frames
    print(name, anim, len(frames))

meta_all = {}
for name, anims in models.items():
    # 원본 시트는 칸마다 그려진 크기가 조금씩 다르다: 공격 · 브레스 · 피격 칸을 대기 칸 키에 맞춘다
    import statistics
    ref = statistics.median(f.height for f, _ in anims['idle'])
    # 용 브레스 칸은 원본에서 작고 웅크린 자세라 작아 보인다 → 대기 키의 1.1배로 키운다
    if name == 'dragon' and 'breath' in anims:
        kb = ref * 1.1 / statistics.median(f.height for f, _ in anims['breath'])
        print('브레스 배율', round(kb, 2))
        anims['breath'] = [(f.resize((round(f.width * kb), round(f.height * kb)), Image.NEAREST), foot) for f, foot in anims['breath']]
    for an in ('attack', 'breath', 'hit'):
        if an not in anims: continue
        hh = statistics.median(f.height for f, _ in anims[an])
        k = ref / hh
        if 1.04 < k < 1.6:
            anims[an] = [(f.resize((round(f.width * k), round(f.height * k)), Image.NEAREST), foot) for f, foot in anims[an]]
            print('크기 맞춤', name, an, round(k, 2))
    allf = [f for fr in anims.values() for f, _ in fr]
    cw = max(f.width for f in allf) + 16; ch = max(f.height for f in allf) + 8
    rows = []
    for anim, frames in anims.items():
        maxfoot = max(foot for _, foot in frames)
        cells = []
        for f, foot in frames:
            cell = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
            fx = int(round(cw / 2 - anchor(f)))
            fy = ch - 2 - f.height - (maxfoot - foot)
            cell.alpha_composite(f, (max(0, min(cw - f.width, fx)), max(0, fy)))
            cells.append(cell)
        # 사이 프레임 넣기: 반복 동작은 끝→처음도, 그 밖은 차례대로
        if len(cells) >= 2 and anim != 'skill':
            pairs = len(cells) if anim in LOOP else len(cells) - 1
            out = []
            for i in range(len(cells)):
                out.append(cells[i])
                if i < pairs: out.append(inbetween(cells[i], cells[(i + 1) % len(cells)]))
            cells = out
        rows.append((anim, cells))
    if name == 'dragon':
        base = dict(rows)['idle'][0]
        # 걷기 · 달리기: 시트의 걷기 줄은 다리가 거의 안 움직여서, 대기 그림에 뼈대를 넣어 온몸이 움직이는 걸음을 만든다
        walk, sw = walk_cycle(base, 8, A=0.34, bob=1.8, lean=0.02, lift=3.5, tail=0.14, nod=0.05, flap=0.08)
        run, sr = walk_cycle(base, 8, A=0.46, bob=2.8, lean=0.08, lift=5.0, tail=0.2, nod=0.08, flap=0.16)
        stride = {'walk': round(sw, 2), 'run': round(sr, 2)}
        rows = [(an, walk if an == 'walk' else run if an == 'run' else cs) for an, cs in rows]
    cols = max(len(c) for _, c in rows)
    sheet = Image.new('RGBA', (cols * cw, len(rows) * ch), (0, 0, 0, 0))
    meta = {}
    for r, (anim, cells) in enumerate(rows):
        for i, c in enumerate(cells): sheet.alpha_composite(c, (i * cw, r * ch))
        meta[anim] = {'row': r, 'n': len(cells)}
    fn = 'dragon_fire' if name == 'dragon' else f'king_{name}'
    sheet.save(f'{OUT}/{fn}.png')
    meta_all[fn] = {'w': cw, 'h': ch, 'anims': meta, 'scale': 0.62}
    if name == 'dragon': meta_all[fn]['stride'] = stride   # 발이 앞뒤로 가는 거리 (원본 픽셀)
    if PREV: sheet.save(f'{PREV}/{fn}_prev.png')
    print(fn, cw, ch, {k: v['n'] for k, v in meta.items()})
json.dump(meta_all, open(f'{OUT}/sheet_meta.json', 'w'), ensure_ascii=False)
print('done')
