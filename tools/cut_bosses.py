"""사용법: python3 tools/cut_bosses.py build  (자른 자세 보기: python3 tools/cut_bosses.py <폴더>)
사용자가 준 보스 시트(art/source/sheet_tower_bosses.png: 한 줄에 보스 셋 × 자세 넷, 일곱 줄)에서 자세마다 잘라 낸다.
줄마다 기대하는 칸 경계(128px마다) 둘레에서 그림이 가장 적은 세로줄을 골라 자르고, 가장자리에서부터 배경색을 지운다."""
import sys, os
import numpy as np
from PIL import Image
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art', 'source', 'sheet_tower_bosses.png')
ROWS = [(10, 162), (178, 322), (333, 476), (480, 630), (630, 778), (782, 900), (900, 1022)]
# 줄마다 보스 셋 (왼쪽부터) · None = 쓰지 않음
ORDER = [['climbChief', 'mossLord', 'bogHag'], ['climbQueen', 'demonCaptain', 'climbRift'], ['frostOgre', 'climbWitch', 'wraithLord'],
         ['engraveKing', 'stormHarpy', 'skyWhale'], ['mirrorSelf', 'shardQueen', 'foreman'], ['clockKeeper', 'archivist', 'starReader'],
         ['clockKeeper2', 'highPriest', 'lastKing']]

def load():
    im = Image.open(SRC).convert('RGB'); a = np.array(im).astype(int)
    return a

def bg_color(a):
    edge = np.concatenate([a[0:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, 0:4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    return np.median(edge, 0)

def cuts_for_row(fgmask):
    prof = fgmask.sum(0)
    cuts = [0]
    for k in range(1, 12):
        c = 128 * k; lo, hi = c - 34, c + 34
        best = min(range(lo, hi), key=lambda x: (prof[x - 1:x + 2].sum(), abs(x - c)))
        cuts.append(best)
    cuts.append(a_w)
    return cuts

def cut_all():
    global a_w
    a = load(); H, W, _ = a.shape; a_w = W
    bg = bg_color(a)
    dist = np.abs(a - bg).sum(2)
    fg = dist > 70
    out = {}
    for ri, (y0, y1) in enumerate(ROWS):
        cuts = cuts_for_row(fg[y0:y1])
        for k in range(12):
            x0, x1 = cuts[k], cuts[k + 1]
            sub = a[y0:y1, x0:x1]; d = dist[y0:y1, x0:x1]
            h, w = d.shape
            # 가장자리에서 이어진 배경만 지운다 (그림 안의 보라색은 남는다)
            seen = np.zeros((h, w), bool); q = deque()
            for y in range(h):
                for x in (0, w - 1): q.append((y, x))
            for x in range(w):
                for y in (0, h - 1): q.append((y, x))
            while q:
                y, x = q.popleft()
                if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or d[y, x] > 58: continue
                seen[y, x] = True
                q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
            seen |= d < 26  # 그림 안쪽에 갇힌 배경 (팔과 지팡이 사이 등): 배경색과 거의 같은 칸만
            alpha = (~seen).astype(np.uint8) * 255
            # 작은 떨어진 티끌 지우기: 넓이 12px 미만 덩어리
            img = np.dstack([sub.astype(np.uint8), alpha])
            ys, xs = np.nonzero(alpha)
            if not len(ys): continue
            fr = Image.fromarray(img, 'RGBA')
            boss = ORDER[ri][k // 4]
            out.setdefault(boss, []).append((fr, (x0, y0)))
    return out

if __name__ == '__main__' and sys.argv[1:] and sys.argv[1] != 'build':
    od = sys.argv[1]
    res = cut_all()
    for boss, frs in res.items():
        for i, (fr, _) in enumerate(frs):
            fr.save(os.path.join(od, f'{boss}_{i}.png'))
    print({k: len(v) for k, v in res.items()})


# ───── 게임 그림으로: 자세마다 통째로 (조각으로 나누지 않는다) ─────
# idle: 숨쉬기 두 자세 · attack: 내려치는 자세 · skill: 대표 기술 자세 (시트의 자세 번호)
POSES = {
    'climbChief': ([0, 1], 3, 2), 'mossLord': ([0, 2], 1, 3), 'bogHag': ([0, 3], 1, 2), 'climbQueen': ([0, 1], 2, 3),
    'demonCaptain': ([0, 1], 2, 3), 'climbRift': ([0, 1], 2, 3), 'frostOgre': ([0, 3], 1, 2), 'climbWitch': ([0, 3], 1, 2),
    'wraithLord': ([0, 1], 2, 3), 'engraveKing': ([0, 3], 2, 1), 'stormHarpy': ([0, 1], 2, 3), 'skyWhale': ([0, 3], 1, 2),
    'mirrorSelf': ([0, 3], 2, 1), 'shardQueen': ([0, 3], 1, 2), 'foreman': ([0, 1], 2, 3), 'clockKeeper': ([0, 3], 1, 2),
    'clockKeeper2': ([0, 3], 1, 2), 'archivist': ([0, 3], 1, 2), 'starReader': ([0, 1], 3, 2), 'highPriest': ([0, 3], 1, 2), 'lastKing': ([0, 3], 2, 1),
}
# 게임 크기 (원본 대비): 수호자 0.6 (플레이어의 약 4배) · 주인 0.66 · 50층 · 100층 0.72 · 하늘 고래 0.7
LORDS = ['mossLord', 'climbQueen', 'climbRift', 'climbWitch', 'shardQueen', 'clockKeeper', 'clockKeeper2', 'starReader']
SCALE = {**{k: 0.66 for k in LORDS}, 'engraveKing': 0.72, 'lastKing': 0.72, 'skyWhale': 0.7}

# ───── 도트 따기: AI 그림은 한 점이 약 2px인 번진 그림이라, 섞어서 줄이지 않고 2×2 칸마다 대표색 하나를 고른다 ─────
OUTL = (22, 14, 20, 255)
PIX, COLORS = 3, 14  # 원본 3×3 칸 = 게임 픽셀 하나 · 보스마다 14색 (플레이어 그림체처럼 덩어리로)
def pixelize(fr, k=2):
    a = np.array(fr).astype(int); H, W, _ = a.shape
    best = None
    for oy in range(k):  # 칸 경계가 그림의 점 경계와 가장 잘 맞는 자리 (칸 안 색 차이가 가장 작은 곳)
        for ox in range(k):
            b = a[oy:oy + (H - oy) // k * k, ox:ox + (W - ox) // k * k]
            blk = b.reshape(b.shape[0] // k, k, b.shape[1] // k, k, 4).transpose(0, 2, 1, 3, 4).reshape(b.shape[0] // k, b.shape[1] // k, k * k, 4)
            var = blk[..., :3].std(2).sum()
            if best is None or var < best[0]: best = (var, blk)
    blk = best[1]
    # 대표색: 칸 안에서 다른 칸들과 가장 가까운 색 (평균이 아니라 실제 있는 색 하나 · 경계 번짐을 버린다)
    rgb = blk[..., :3]; al = blk[..., 3]
    d = np.abs(rgb[:, :, :, None, :] - rgb[:, :, None, :, :]).sum(-1).sum(-1)
    pick = d.argmin(2)
    out = np.take_along_axis(rgb, pick[:, :, None, None].repeat(3, 3), 2)[:, :, 0]
    alpha = (al > 127).sum(2) >= (k * k + 1) // 2
    img = np.dstack([out, np.where(alpha, 255, 0)]).astype(np.uint8)
    return Image.fromarray(img, 'RGBA')

def palette_all(frames, n):
    tot = [p for f in frames for p in np.array(f).reshape(-1, 4) if p[3]]
    strip = Image.fromarray(np.array(tot, np.uint8)[None, :, :3], 'RGB')
    pal = strip.quantize(colors=n, method=Image.Quantize.MAXCOVERAGE, kmeans=4, dither=Image.Dither.NONE)
    out = []
    for f in frames:
        q = np.array(f.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')); al = np.array(f)[:, :, 3]
        out.append(Image.fromarray(np.dstack([q, al]).astype(np.uint8), 'RGBA'))
    return out

def clean(f, line=True):
    # 잡티: 여덟 이웃 누구와도 같지 않고 이웃 대부분이 한 색이면 그 색으로 · 떨어진 점 지우기 · 짙은 색은 외곽선 색으로 · 1px 외곽선
    a = np.array(f).astype(int); H, W, _ = a.shape; o = a.copy()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not a[y, x, 3]: continue
            nb = [tuple(a[y + dy, x + dx]) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dx or dy)]
            me = tuple(a[y, x])
            if me in nb: continue
            from collections import Counter
            c, n = Counter(nb).most_common(1)[0]
            if n >= 5: o[y, x] = c
    al = o[:, :, 3] > 0
    for y in range(H):
        for x in range(W):
            if al[y, x] and sum(al[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < H and 0 <= xx < W) == 0: o[y, x, 3] = 0
    # 가장자리에 남은 원본 배경색 번짐 (투명한 칸에 닿은 배경빛 보라 칸) — 두 번
    for _ in range(2):
        al = o[:, :, 3] > 0
        edge = al & ~(np.roll(al, 1, 0) & np.roll(al, -1, 0) & np.roll(al, 1, 1) & np.roll(al, -1, 1))
        near = np.minimum(np.abs(o[:, :, :3] - np.array([100, 77, 168])).sum(2), np.abs(o[:, :, :3] - np.array([72, 54, 128])).sum(2)) < 48
        o[edge & near, 3] = 0
    # 발밑에 남은 원본 배경의 보랏빛 그림자 (아래 다섯 줄)
    bgsh = np.abs(o[:, :, :3] - np.array([72, 54, 128])).sum(2) < 60
    bgsh[: max(0, H - 5)] = False; o[bgsh & (o[:, :, 3] > 0), 3] = 0
    dark = (o[:, :, :3].sum(2) < 95) & (o[:, :, 3] > 0); o[dark] = OUTL
    if not line: return Image.fromarray(o.astype(np.uint8), 'RGBA')
    al = o[:, :, 3] > 0; out = o.copy()
    for y in range(H):
        for x in range(W):
            if al[y, x]: continue
            if any(0 <= yy < H and 0 <= xx < W and al[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))): out[y, x] = OUTL
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

def anchor(fr):
    a = np.array(fr)[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    y1 = ys.max(); low = ys > y1 - (y1 - ys.min()) * 0.3
    return xs[low].mean(), y1  # 발밑 가운데

def build():
    sys.path.insert(0, HERE)
    from pixelfit import fit_frame, outline, quantize_sheet
    from sprites import meta_path, build_manifest
    import json
    res = cut_all()
    sheets, meta, y = [], {}, 0
    for boss, frs in res.items():
        frames = [f for f, _ in frs]
        sc = SCALE.get(boss, 0.6)
        small = [pixelize(f.crop(f.getbbox()), PIX) for f in frames]  # 원본의 점 하나 = 게임 픽셀 하나
        small = [clean(clean(s, False)) for s in palette_all(small, COLORS)]  # 잡티 정리는 두 번
        anc = [anchor(s) for s in small]
        L = max(ax for ax, _ in anc) + 2; R = max(s.width - ax for s, (ax, _) in zip(small, anc)) + 2
        T = max(ay for _, ay in anc) + 2
        W, H = int(np.ceil(L + R)), int(np.ceil(T + 2))
        cells = []
        for s, (ax, ay) in zip(small, anc):
            c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(s, (int(round(L - ax)), int(round(T - ay)))); cells.append(c)
        idle, atk, skl = POSES[boss]
        rows = [[cells[i] for i in idle], [cells[i] for i in idle], [cells[atk]], [cells[skl]]]
        sheets.append((boss, W, H, rows))
        meta['b_' + boss] = {'w': W, 'h': H, 'y0': y, 'foot': int(T), 'anims': {'idle': {'row': 0, 'n': 2}, 'run': {'row': 1, 'n': 2}, 'attack': {'row': 2, 'n': 1}, 'skill': {'row': 3, 'n': 1}}}
        y += H * 4
    out = Image.new('RGBA', (max(W * 2 for _, W, _, _ in sheets), y), (0, 0, 0, 0))
    for boss, W, H, rows in sheets:
        y0 = meta['b_' + boss]['y0']
        for r, row in enumerate(rows):
            for i, c in enumerate(row): out.alpha_composite(c, (i * W, y0 + r * H))
    out.save(os.path.join(HERE, '..', 'public', 'assets', 'custom', 'bosses.png'))
    json.dump(meta, open(meta_path('bosses'), 'w', encoding='utf-8'), ensure_ascii=False)
    build_manifest()
    print({k: (v['w'], v['h']) for k, v in meta.items()})

if __name__ == '__main__' and sys.argv[1:] == ['build']:
    build()
