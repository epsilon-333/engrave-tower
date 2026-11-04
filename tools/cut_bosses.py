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
        small = []
        for f in frames:
            bb = f.getbbox(); f = f.crop(bb)
            s = fit_frame(f, sc)
            small.append(s)
        small = quantize_sheet(small, 28)
        small = [outline(s) for s in small]
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
