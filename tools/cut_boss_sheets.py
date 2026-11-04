"""보내 주신 보스 시트(장면마다 통째로 그린 동작)를 잘라 게임 시트로: art/source/boss_*.png → public/assets/custom/bosses.png 의 b_<보스>
줄마다 그림이 있는 세로 띠를 찾아 장면을 나누고(붙어 있으면 장면 수대로 고르게), 가장자리에서 배경색을 지우고,
발밑을 맞춘 같은 크기의 칸에 넣은 뒤 게임 크기로 줄인다 (28색 · 1px 외곽선 · tools/pixelfit.py 와 같은 규칙).
    python3 tools/cut_boss_sheets.py            → 미리 보기 art/preview_boss_sheets.png
    python3 tools/cut_boss_sheets.py --write    → 게임에 넣는다 (tools/cut_bosses.py build 로 만든 시트에 덧붙인다)
"""
import os, sys, json
import numpy as np
from collections import deque
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SRC = os.path.join(HERE, '..', 'art', 'source')

GRID = {'idle': [0, 1, 2, 3], 'run': [4, 5, 6, 7], 'attack': [8, 9, 10, 11], 'skill': [12, 13, 14, 15], 'hit': [16, 17], 'death': [18, 19]}
# (파일, 줄 번호(None = 모든 줄을 차례로), 줄마다 장면 수, 보스, 동작 → 장면 번호, 게임 키(px))
SHEETS = [
    ('boss_climbChief.png', None, 4, 'climbChief', GRID, 80),
    ('boss_mossLord.png', None, 4, 'mossLord', GRID, 88),
    ('boss_bogHag.png', None, 4, 'bogHag', GRID, 82),
    ('boss_climbQueen.png', None, 4, 'climbQueen', GRID, 86),
    ('boss_demonCaptain.png', None, 4, 'demonCaptain', GRID, 82),
    ('boss_climbRift.png', None, 4, 'climbRift', GRID, 90),
    ('boss_frostOgre.png', None, 4, 'frostOgre', GRID, 84),
    ('boss_climbWitch.png', None, 4, 'climbWitch', GRID, 88),
    ('boss_wraithLord.png', None, 4, 'wraithLord', GRID, 84),
    ('boss_engraveKing.png', None, 4, 'engraveKing', GRID, 96),
]
ROW9 = 'boss_row9_rift_ogre_witch_wraith_king.png'
# 한 줄에 한 보스 (줄 번호, 보스, 동작 → 그 줄의 장면 번호, 게임 키)
ROW9_BOSSES = [
    (0, 'climbRift', {'idle': [0, 1, 2, 1], 'run': [0, 1, 2, 3], 'attack': [3, 4], 'skill': [5, 6], 'hit': [7], 'death': [8]}, 90),
    (1, 'frostOgre', {'idle': [0, 1], 'run': [2, 3], 'attack': [4, 5, 6], 'skill': [5, 6], 'hit': [7], 'death': [8]}, 82),
    (2, 'climbWitch', {'idle': [0, 1, 2, 1], 'run': [0, 1, 2, 1], 'attack': [4, 3], 'skill': [4, 5], 'hit': [6], 'death': [7]}, 88),
    (3, 'wraithLord', {'idle': [0, 1], 'run': [1, 2], 'attack': [2, 3, 4], 'skill': [5], 'hit': [6], 'death': [7]}, 82),
    (4, 'engraveKing', {'idle': [0, 1], 'run': [1, 2], 'attack': [3, 2], 'skill': [4, 5], 'hit': [6], 'death': [7]}, 96),
]

def load(fn):
    a = np.array(Image.open(os.path.join(SRC, fn)).convert('RGB')).astype(int)
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3)]), 0)
    return a, bg, np.abs(a - bg).sum(2)

def bands(v, minlen, gap):
    out, s, z = [], None, 0
    for i, x in enumerate(v):
        if x:
            if s is None: s = i
            z = 0
        elif s is not None:
            z += 1
            if z > gap:
                if i - z - s >= minlen: out.append((s, i - z + 1))
                s = None
    if s is not None: out.append((s, len(v)))
    return out

def frames_of(fn, n_per_row, x_skip=0, n_rows=5, grid=None):
    grids = grid
    a, bg, d = load(fn); fg = d > 70
    rows = bands(fg[:, x_skip:].any(1), 30, 6)
    rp = fg[:, x_skip:].sum(1)
    while len(rows) < n_rows:  # 반짝이 · 연기로 줄이 붙었다: 가장 높은 띠를 그림이 가장 적은 가로줄에서 가른다
        i = max(range(len(rows)), key=lambda k: rows[k][1] - rows[k][0]); r0, r1 = rows[i]
        m = (r0 + r1) // 2; cut = min(range(m - (r1 - r0) // 3, m + (r1 - r0) // 3), key=lambda y: rp[y])
        rows[i:i + 1] = [(r0, cut), (cut, r1)]
    out = []
    for ri, (y0, y1) in enumerate(rows):
        prof = fg[y0:y1, x_skip:].sum(0)
        grid = grids[ri] if isinstance(grids, list) else grids
        want = n_per_row[ri] if isinstance(n_per_row, list) else n_per_row
        if grid:  # 고른 칸: 칸 경계 둘레에서 그림이 가장 적은 세로줄로 자른다
            Wd = len(prof); P = Wd / grid
            cuts = [0] + [min(range(int(k * P - P * 0.22), int(k * P + P * 0.22)), key=lambda x: (prof[x], abs(x - k * P))) for k in range(1, grid)] + [Wd]
            cols = [(cuts[k] + x_skip, cuts[k + 1] + x_skip) for k in range(grid)]
            want = grid
        else:
            cols = bands(prof > 0, 6, 4)
        cols = [(c0 + x_skip, c1 + x_skip) for c0, c1 in cols]
        # 좁은 조각(반짝이 · 연기 한 줌)은 가까운 이웃 장면에 붙인다
        while len(cols) > 1 and not grid:
            ws = [c1 - c0 for c0, c1 in cols]; i = min(range(len(cols)), key=lambda k: ws[k])
            if ws[i] > 0.35 * sorted(ws)[len(ws) // 2]: break
            j = i - 1 if i == len(cols) - 1 or (i > 0 and cols[i][0] - cols[i - 1][1] < cols[i + 1][0] - cols[i][1]) else i + 1
            lo, hi = min(i, j), max(i, j); cols[lo:hi + 1] = [(cols[lo][0], cols[hi][1])]
        if want is None: want = len(cols)
        # 장면 수에 맞춘다: 많으면 가까운 것끼리 합치고, 적으면 가장 넓은 띠를 그림이 가장 적은 세로줄에서 가른다
        while len(cols) > want:
            gaps = [(cols[i + 1][0] - cols[i][1], i) for i in range(len(cols) - 1)]; _, i = min(gaps)
            cols[i:i + 2] = [(cols[i][0], cols[i + 1][1])]
        while len(cols) < want:  # 붙은 띠: 다른 장면 너비로 몇 장면인지 셈해 한꺼번에 고르게 (그림이 가장 적은 세로줄에서)
            ws = sorted(c1 - c0 for c0, c1 in cols); med = ws[len(ws) // 2]
            i = max(range(len(cols)), key=lambda k: cols[k][1] - cols[k][0]); c0, c1 = cols[i]
            m = max(2, min(want - len(cols) + 1, round((c1 - c0) / med)))
            P = (c1 - c0) / m; cuts = [c0]
            for k in range(1, m):
                t = int(c0 + k * P); cuts.append(min(range(int(t - P * 0.18), int(t + P * 0.18)), key=lambda x: prof[x - x_skip]))
            cuts.append(c1); cols[i:i + 1] = [(cuts[k], cuts[k + 1]) for k in range(m)]
        for c0, c1 in cols:
            sub = a[y0:y1, c0:c1]; dd = d[y0:y1, c0:c1]; h, w = dd.shape
            seen = np.zeros((h, w), bool); q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)])
            while q:
                y, x = q.popleft()
                if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or dd[y, x] > 60: continue
                seen[y, x] = True; q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
            seen |= dd < 26
            keep = ~seen
            # 칸 가장자리에 걸린 옆 장면 조각 지우기: 가장 큰 덩어리의 6%보다 작고 칸 왼쪽 · 오른쪽 끝에 닿은 덩어리
            lab = np.zeros((h, w), int); comps = []
            for sy in range(h):
                for sx in range(w):
                    if not keep[sy, sx] or lab[sy, sx]: continue
                    k = len(comps) + 1; st = [(sy, sx)]; lab[sy, sx] = k; n = 0; edge = False
                    while st:
                        y, x = st.pop(); n += 1; edge |= x <= 1 or x >= w - 2
                        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                            if 0 <= yy < h and 0 <= xx < w and keep[yy, xx] and not lab[yy, xx]: lab[yy, xx] = k; st.append((yy, xx))
                    comps.append((n, edge))
            if comps:
                big = max(n for n, _ in comps)
                for k, (n, edge) in enumerate(comps, 1):
                    if n < big * 0.06 and edge: keep[lab == k] = False
            im = Image.fromarray(np.dstack([sub.astype(np.uint8), keep.astype(np.uint8) * 255]), 'RGBA')
            out.append(im.crop(im.getbbox()) if im.getbbox() else im); out[-1].row = ri
    return out

if __name__ == '__main__' and sys.argv[1:2] == ['--peek']:
    fn, n, skip = sys.argv[2], json.loads(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0
    fr = frames_of(fn, n, skip); n = max(n) if isinstance(n, list) else n
    cw = max(f.width for f in fr) + 8; ch = max(f.height for f in fr) + 8; rows = (len(fr) + n - 1) // n
    o = Image.new('RGBA', (n * cw, rows * ch), (40, 40, 48, 255))
    for i, f in enumerate(fr): o.alpha_composite(f, ((i % n) * cw, (i // n) * ch + ch - f.height - 4))
    o.save(sys.argv[5]); print(len(fr))


# ───── 게임 시트로 ─────
def anchor(fr):
    a = np.array(fr)[:, :, 3] > 0; ys, xs = np.nonzero(a); y1 = ys.max(); low = ys > y1 - (y1 - ys.min()) * 0.25
    return xs[low].mean(), y1

def boss_sets():
    out = []
    for fn, _, n, boss, anims, tall in SHEETS: out.append((boss, frames_of(fn, n), anims, tall))
    done = {b for _, _, _, b, _, _ in SHEETS}
    if any(b not in done for _, b, _, _ in ROW9_BOSSES):  # 한 줄 9장면 시트: 4칸 × 5줄 시트가 없는 보스만
        allf = frames_of(ROW9, [9, 9, 8, 8, 8])
        for r, boss, anims, tall in ROW9_BOSSES:
            if boss not in done: out.append((boss, [f for f in allf if f.row == r], anims, tall))
    return out

def build_sets():
    from pixelfit import fit_frame, outline, quantize_sheet
    res = []
    for boss, frames, anims, tall in boss_sets():
        idle_h = frames[anims['idle'][0]].height; sc = tall / idle_h  # 서 있는 키를 게임 키에 맞춘다 (장면마다 같은 배율)
        small = quantize_sheet([fit_frame(f, sc) for f in frames], 28); small = [outline(x) for x in small]
        anc = [anchor(x) for x in small]
        L = max(ax for ax, _ in anc) + 2; R = max(x.width - ax for x, (ax, _) in zip(small, anc)) + 2; T = max(ay for _, ay in anc) + 2
        W, H = int(np.ceil(L + R)), int(np.ceil(T + 2))
        cells = []
        for x, (ax, ay) in zip(small, anc):
            c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(x, (int(round(L - ax)), int(round(T - ay)))); cells.append(c)
        res.append((boss, W, H, int(T), {k: [cells[i] for i in v] for k, v in anims.items()}))
    return res

if __name__ == '__main__' and sys.argv[1:2] != ['--peek']:
    sets = build_sets()
    if '--write' in sys.argv:
        from sprites import meta_path, build_manifest
        metaf = meta_path('bosses'); meta = json.load(open(metaf, encoding='utf-8'))
        sheetf = os.path.join(HERE, '..', 'public', 'assets', 'custom', 'bosses.png'); sheet = Image.open(sheetf).convert('RGBA')
        need = sum(H * len(an) for _, _, H, _, an in sets); y0 = sheet.height
        out = Image.new('RGBA', (max(sheet.width, max(W * max(len(v) for v in an.values()) for _, W, _, _, an in sets)), y0 + need), (0, 0, 0, 0)); out.alpha_composite(sheet, (0, 0))
        for boss, W, H, foot, an in sets:
            rows = list(an.items())
            for r, (k, cells) in enumerate(rows):
                for i, c in enumerate(cells): out.alpha_composite(c, (i * W, y0 + r * H))
            meta['b_' + boss] = {'w': W, 'h': H, 'y0': y0, 'foot': foot, 'full': True, 'anims': {k: {'row': r, 'n': len(c)} for r, (k, c) in enumerate(rows)}}
            y0 += H * len(rows)
        out.save(sheetf); json.dump(meta, open(metaf, 'w', encoding='utf-8'), ensure_ascii=False); build_manifest()
        print('넣음:', [b for b, *_ in sets])
    else:
        S = 2; order = ['idle', 'run', 'attack', 'skill', 'hit', 'death']
        cw = max(W for _, W, *_ in sets); ch = max(H for _, _, H, *_ in sets)
        o = Image.new('RGBA', (16 * cw * S, len(sets) * ch * S), (46, 44, 56, 255))
        for r, (boss, W, H, foot, an) in enumerate(sets):
            x = 0
            for k in order:
                for c in an.get(k, []): o.alpha_composite(c.resize((W * S, H * S), Image.NEAREST), (x, r * ch * S)); x += W * S
        o.save(os.path.join(HERE, '..', 'art', 'preview_boss_sheets.png')); print('미리 보기')
