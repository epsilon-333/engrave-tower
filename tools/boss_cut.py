# 보스 동작 시트를 도트 한 칸씩 "그대로" 딴다 (고쳐 그리지 않는다) — 사용자가 준 4×4 시트
#   배경: 반투명 시트는 투명도로, 꽉 찬 시트는 테두리에서 이어진 배경색 칸을 지운다 (몸 안의 짙은 칸은 남긴다)
#   색은 시트에서 뽑은 12가지로 고정(칸마다 가장 많이 나온 색) · 짙은 외곽선 1칸 · 줄마다 발을 같은 바닥에
#   python tools/boss_cut.py <climbChief|mossLord> [--gif 미리보기.gif]
#   결과: public/assets/custom/boss_<id>_motion.png + tools/sprites/boss_pixel.json(b_<id>) → sprites.json
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
from sprites import meta_path, build_manifest

R4 = lambda r: [(r, i) for i in range(4)]
BOSSES = {
    'climbChief': {  # 가면 족장 (5층 수호자): 서기 4 / 걷기 4 / 공격 4 / 맞음 · 쓰러짐 · 포효 2
        'src': 'sheet_chief_motion3.webp', 'ncol': 12,
        'rows': {'idle': R4(0), 'run': R4(1), 'attack': R4(2), 'skill': [(3, 2), (3, 3)], 'hit': [(3, 0)], 'death': [(3, 0), (3, 1)]},
    },
    'bogHag': {  # 늪 마녀 수장 (15층 수호자): 서기 4 / 지팡이 휘두르기 4 / 서기 2 · 마법 휘감기 2 / 쓰러짐 2 · 땅에서 솟기 2
        'src': 'sheet_bog_witch.webp', 'ncol': 14,
        'rows': {'idle': R4(0), 'run': R4(0), 'attack': R4(1), 'skill': [(2, 2), (2, 3)], 'hit': [(2, 0)], 'death': [(3, 0), (3, 1)], 'rise': [(3, 2), (3, 3)]},
    },
    'mossLord': {  # 이끼 골렘 (10층 주인): 걷기 4 / 주먹 내려치기 4 / 두 팔 땅 찍기 4 / 무너짐 3 · 달려듦 1
        'src': 'sheet_moss_golem.webp', 'ncol': 12, 'pal': 'bright', 'pink': True,  # pink: 12색에 묻히는 머리 위 분홍 꽃을 한 색 더 남긴다  # 사용자가 고른 12색(밝기 순 시작) 버전 · 눈은 원래 눈과 가장 덜 달라지는 직사각형 둘로만 다듬는다
        # 왼눈 왼쪽 위 (잘라 낸 장면 안 자리 · 장면마다 눈으로 보고 적었다)
        'eyeAt': {('idle', 0): (30, 19), ('idle', 1): (29, 20), ('run', 0): (30, 19), ('run', 1): (30, 19), ('run', 2): (29, 20), ('run', 3): (29, 19),
                  ('attack', 0): (30, 20), ('attack', 1): (30, 21), ('attack', 2): (31, 25), ('attack', 3): (30, 24),
                  ('skill', 0): (29, 18), ('skill', 1): (28, 16), ('skill', 2): (27, 23), ('skill', 3): (29, 28), ('hit', 0): (29, 20),
                  ('death', 0): (29, 31), ('death', 1): (30, 37), ('death', 2): (31, 40), ('dash', 0): (35, 25)},
        # 눈 다듬기 (최소로 · 장면마다 칸을 보고 손으로): del = 직사각형 밖으로 삐진 칸(같은 줄 옆 색으로 메움) · add = 비어 있던 칸(그 눈 색)
        # 눈 모양 맞추기 (eyeFix 뒤): 장면마다 지금 눈 (왼눈 x 처음, 끝, 위 · 오른눈 x 처음, 끝, 위) → 두 눈 가운데는 그대로, 1×3 두 눈 · 사이 2칸
        'eyeShape': {'w': 1, 'h': 3, 'gap': 2},
        'eyeNow': {('idle', 0): ((30, 30, 19), (32, 32, 19)), ('run', 0): ((30, 30, 19), (32, 32, 19)),
                   ('idle', 1): ((29, 29, 20), (31, 32, 20)), ('run', 2): ((29, 29, 20), (31, 32, 20)),
                   ('run', 1): ((29, 29, 19), (32, 32, 19)), ('run', 3): ((29, 29, 19), (31, 32, 19)),
                   ('attack', 0): ((29, 30, 20), (32, 33, 20)), ('attack', 1): ((31, 32, 21), (34, 34, 22)),
                   ('attack', 2): ((30, 31, 25), (33, 34, 26)), ('attack', 3): ((29, 30, 24), (32, 33, 24)),
                   ('skill', 0): ((28, 29, 17), (31, 31, 18)), ('skill', 1): ((28, 28, 16), (30, 31, 16)),
                   ('skill', 2): ((26, 27, 22), (29, 30, 23)), ('skill', 3): ((28, 29, 27), (31, 32, 28)), ('hit', 0): ((28, 29, 19), (31, 31, 20)),
                   ('death', 0): ((29, 29, 31), (31, 32, 31)), ('death', 1): ((29, 30, 36), (32, 33, 37)), ('death', 2): ((29, 30, 40), (33, 34, 40)),
                   ('dash', 0): ((34, 35, 25), (37, 38, 25))},
        # 얼굴 손질 (눈 맞춘 뒤): grow = 그 칸을 왼쪽 얼굴 색으로 (얼굴을 오른쪽으로 한 칸) · out = 테두리 색으로 (모서리 깎기 · 밀린 테두리)
        'faceFix': {k: v for ks, v in [
            ((('idle', 0), ('run', 0)), {'grow': [(34, 19), (34, 20), (34, 21), (34, 22)], 'out': [(34, 15)]}),
            ((('idle', 1), ('run', 2)), {'grow': [(34, 17), (34, 18), (34, 19), (34, 20), (34, 21), (34, 22)], 'out': [(35, 17), (35, 18), (35, 19), (35, 20), (35, 21), (35, 22)]}),
        ] for k in ks},
        'eyeFix': {('idle', 0): {'del': [(29, 21), (32, 22)]}, ('run', 0): {'del': [(29, 21), (32, 22)]},
                   ('idle', 1): {'del': [(30, 21), (29, 19)]}, ('run', 2): {'del': [(30, 21), (29, 19)]},
                   ('run', 1): {'del': [(31, 20), (29, 18)]}, ('run', 3): {'del': [(28, 21), (31, 22), (29, 22)]},
                   ('attack', 0): {'del': [(30, 19)], 'add': [(33, 22)]}, ('attack', 1): {'del': [(35, 22)]},
                   ('attack', 2): {'del': [(30, 28), (32, 28), (35, 27)], 'add': [(34, 28)]}, ('attack', 3): {'del': [(29, 27), (34, 26), (32, 27)]},
                   ('skill', 0): {'del': [(28, 20)]}, ('hit', 0): {'del': [(28, 22)]}, ('skill', 1): {'del': [(28, 15)]},
                   ('skill', 2): {'del': [(31, 23), (31, 24)], 'add': [(26, 22)]}, ('skill', 3): {'del': [(30, 30), (33, 29), (34, 29)], 'add': [(32, 30), (29, 28), (29, 29)]},
                   ('death', 1): {'del': [(28, 38), (28, 39), (29, 39), (31, 39)], 'add': [(30, 38), (33, 39)]}, ('death', 2): {'del': [(28, 42), (32, 42), (33, 43), (29, 43), (30, 43)]}},  # 눈 높이는 모두 세 칸  # ('exact': True 로 두면 색 · 외곽선 없이 원본 그대로 — 사용자가 외곽선 버전을 골랐다)
        'rows': {'idle': [(0, 0), (0, 2)], 'run': R4(0), 'attack': R4(1), 'skill': R4(2), 'hit': [(2, 0)], 'death': [(3, 0), (3, 1), (3, 2)], 'dash': [(3, 3)]},
    },
}
ORDER = ['idle', 'run', 'attack', 'skill', 'hit', 'death', 'dash', 'rise']


def grid_fit(A, D0):
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


def dot_size(A):
    """한 도트 크기: 가로로 붙은 픽셀 차이가 칸 안에서 가장 작아지는 간격"""
    best = None; dX = np.abs(np.diff(A, axis=1)).sum(2)
    for d in np.arange(5.0, 10.01, 0.1):
        for ox in np.arange(0, d, 1.0):
            cx = ((np.arange(A.shape[1]) - ox) // d); sx = cx[1:] == cx[:-1]
            cost = dX[:, sx].mean()
            if best is None or cost < best[0]: best = (cost, d)
    return best[1]


def cut(bid, gif=None):
    B = BOSSES[bid]
    im0 = Image.open(os.path.join(ROOT, 'art', 'source', B['src']))
    RGBA = np.array(im0.convert('RGBA')).astype(float); src, alpha = RGBA[..., :3], RGBA[..., 3]
    translucent = alpha.min() < 200  # 반투명 배경 시트
    BG = np.median(src[:8, :8].reshape(-1, 3), 0)  # 꽉 찬 시트: 왼쪽 위 구석 색이 배경
    CELL = src.shape[0] / 4
    D0 = dot_size(src[:int(CELL), :int(CELL)])

    def sample(r, c):
        x0, y0 = round(c * CELL), round(r * CELL)
        sl0 = (slice(y0 + 6, round(y0 + CELL) - 6), slice(x0 + 6, round(x0 + CELL) - 6))  # 칸 사이 경계선은 빼고
        A, Al = src[sl0], alpha[sl0]
        d, ox, oy = grid_fit(A, D0)
        nw, nh = int((A.shape[1] - ox) // d), int((A.shape[0] - oy) // d)
        blocks = {}
        for j in range(nh):
            for i in range(nw):
                cx, cy = ox + (i + 0.5) * d, oy + (j + 0.5) * d
                sl = (slice(int(cy - d * 0.3), int(cy + d * 0.3) + 1), slice(int(cx - d * 0.3), int(cx + d * 0.3) + 1))
                px = A[sl].reshape(-1, 3)
                if translucent:
                    keep = Al[sl].reshape(-1) > 200
                    if keep.mean() > 0.5: blocks[(i, j)] = px[keep]
                else: blocks[(i, j)] = px
        if not translucent:  # 테두리에서 이어진 배경색 칸만 지운다
            isbg = {k: np.abs(np.median(b, 0) - BG).sum() < 30 for k, b in blocks.items()}
            seen, stack = set(), [(i, j) for (i, j) in blocks if i in (0, nw - 1) or j in (0, nh - 1)]
            while stack:
                k = stack.pop()
                if k in seen or k not in blocks or not isbg[k]: continue
                seen.add(k); i, j = k; stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
            for k in seen: del blocks[k]
        return blocks, (nw, nh), d, (ox, oy)

    if B.get('exact'): return cut_exact(bid, B, sample, D0, gif)
    RCS = sorted({rc for v in B['rows'].values() for rc in v})
    raw = {rc: sample(*rc) for rc in RCS}
    # 12색: 모든 칸의 가운데 색을 모아 밝기 순으로 고르게 뽑은 색에서 출발해 맞춘다 (k-평균)
    meds = np.array([np.median(b, 0) for rc in RCS for b in raw[rc][0].values()])
    if B.get('pal') == 'bright':  # 시작 색: 밝기 순으로 고르게
        order = meds.sum(1).argsort(); P = meds[order[np.linspace(0, len(order) - 1, B['ncol']).astype(int)]].copy()
    else:  # 시작 색: 가장 먼 색부터 차례로 (꽃 같은 드문 색도 한 자리를 얻는다)
        P = [meds[meds.sum(1).argsort()[len(meds) // 2]]]
        while len(P) < B['ncol']: P.append(meds[((meds[:, None] - np.array(P)[None]) ** 2).sum(2).min(1).argmax()])
        P = np.array(P, float)
    for _ in range(25):
        lab = ((meds[:, None] - P[None]) ** 2).sum(2).argmin(1)
        P = np.array([meds[lab == k].mean(0) if (lab == k).any() else P[k] for k in range(len(P))])
    if B.get('pink'):
        pk = meds[(meds[:, 0] - meds[:, 1] > 45) & (meds[:, 0] > 150)]
        if len(pk): P = np.vstack([P, pk.mean(0)])
    P = P.round().astype(int)

    def to_image(rc):
        blocks, (nw, nh), _, _ = raw[rc]
        im = Image.new('RGBA', (nw, nh), (0, 0, 0, 0)); px = im.load()
        for (i, j), b in blocks.items():
            k = np.bincount(((b[:, None] - P[None]) ** 2).sum(2).argmin(1), minlength=len(P)).argmax()
            px[i, j] = tuple(int(v) for v in P[k]) + (255,)
        # 외톨이 점(둘레 넷이 모두 비었다)은 지운다 — 배경의 얼룩
        for (i, j) in blocks:
            if all(not (0 <= i + dx < nw and 0 <= j + dy < nh) or px[i + dx, j + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[i, j] = (0, 0, 0, 0)
        return im

    cells = {rc: to_image(rc) for rc in RCS}
    FW = max(im.width for im in cells.values()) + 2
    FH = max(im.getbbox()[3] - im.getbbox()[1] for im in cells.values()) + 2
    frames = {}
    for name, rcs in B['rows'].items():
        ground = max(cells[rc].getbbox()[3] for rc in rcs)  # 줄마다 가장 낮은 발밑을 바닥에
        fl = []
        for rc in rcs:
            im = cells[rc]; o = Image.new('RGBA', (FW, FH + 40), (0, 0, 0, 0))
            o.paste(im, ((FW - im.width) // 2, FH + 40 - 1 - ground), im); fl.append(o)
        frames[name] = fl
    OUTLINE = (20, 14, 18, 255)
    for fl in frames.values():
        for f in fl:
            px = f.load(); w, h = f.size
            todo = [(x, y) for y in range(h) for x in range(w) if not px[x, y][3] and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
            for q in todo: px[q] = OUTLINE
    bb = [f.getbbox() for fl in frames.values() for f in fl]
    y0, x0, x1 = min(b[1] for b in bb), min(b[0] for b in bb), max(b[2] for b in bb)
    H = frames['idle'][0].height
    frames = {n: [f.crop((x0, y0, x1, H)) for f in fl] for n, fl in frames.items()}
    FW, FH = x1 - x0, H - y0
    for (n, k), fx in B.get('eyeFix', {}).items(): edit_eyes(frames[n][k], fx)
    for (n, k), now in B.get('eyeNow', {}).items(): shape_eyes(frames[n][k], now, B['eyeShape'])
    for (n, k), fx in B.get('faceFix', {}).items():
        px = frames[n][k].load()
        for (x, y) in fx.get('grow', []): px[x, y] = px[x - 1, y]
        for (x, y) in fx.get('out', []): px[x, y] = (20, 14, 18, 255)
    order = [n for n in ORDER if n in frames]
    cols = max(len(frames[n]) for n in order)
    sheet = Image.new('RGBA', (FW * cols, FH * len(order)), (0, 0, 0, 0))
    for r, n in enumerate(order):
        for c, f in enumerate(frames[n]): sheet.alpha_composite(f, (c * FW, r * FH))
    out = os.path.join(ROOT, 'public', 'assets', 'custom', f'boss_{bid}_motion.png'); sheet.save(out)
    mp = meta_path('boss_pixel'); meta = json.load(open(mp)) if os.path.exists(mp) else {}
    meta[f'b_{bid}'] = {'img': os.path.basename(out), 'w': FW, 'h': FH, 'y0': 0, 'anims': {n: {'row': r, 'n': len(frames[n])} for r, n in enumerate(order)}}
    json.dump(meta, open(mp, 'w')); build_manifest(os.path.dirname(out))
    print(bid, 'dot', round(D0, 2), 'frame', FW, 'x', FH, {rc: cells[rc].getbbox() and (cells[rc].getbbox()[2] - cells[rc].getbbox()[0], cells[rc].getbbox()[3] - cells[rc].getbbox()[1]) for rc in RCS})
    if gif:
        s = 6; seq = []
        for n, dur, rep in [('idle', 300, 2), ('run', 160, 3), ('attack', 150, 2), ('skill', 150, 2), ('hit', 200, 2), ('dash', 200, 2), ('death', 300, 1)]:
            if n not in frames: continue
            for _ in range(rep):
                for f in frames[n]:
                    bg = Image.new('RGBA', (FW * s, FH * s), (60, 60, 72, 255)); bg.alpha_composite(f.resize((FW * s, FH * s), Image.NEAREST)); seq.append((bg.convert('RGB'), dur))
        seq[0][0].save(gif, save_all=True, append_images=[f for f, _ in seq[1:]], duration=[d for _, d in seq], loop=0)
        big = Image.new('RGBA', (sheet.width * s, sheet.height * s), (60, 60, 72, 255)); big.alpha_composite(sheet.resize((sheet.width * s, sheet.height * s), Image.NEAREST))
        big.save(gif.rsplit('.', 1)[0] + '_sheet.png')


def edit_eyes(f, fx):
    """손으로 적은 눈 다듬기: del 칸은 같은 줄 가까운 옆(짙지 않은) 칸 색으로, add 칸은 그 둘레 눈 색(가장 가까운 짙은 칸)으로"""
    px = f.load(); w, h = f.size
    op = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    isdark = lambda x, y: op(x, y) and sum(px[x, y][:3]) < 150
    dels = set(fx.get('del', []))
    for (x, y) in fx.get('add', []):
        near = min(((abs(dx) + abs(dy), px[x + dx, y + dy]) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and isdark(x + dx, y + dy) and (x + dx, y + dy) not in dels), default=None, key=lambda t: t[0])
        if near: px[x, y] = near[1]
    for (x, y) in dels:
        for d in (1, 2, 3):
            c = next((px[x + s2 * d, y] for s2 in (-1, 1) if op(x + s2 * d, y) and not isdark(x + s2 * d, y)), None)
            if c: px[x, y] = c; break


def shape_eyes(f, now, E):
    """두 눈을 같은 모양으로: 지금 두 눈 칸(짙은 칸)을 지우고(같은 줄 옆 색) · 두 눈 가운데를 그대로 두고 w×h 두 눈 · 사이 gap 칸을 원래 눈 색으로"""
    px = f.load(); w, h = f.size; (l0, l1, lt), (r0, r1, rt) = now
    op = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    isdark = lambda x, y: op(x, y) and sum(px[x, y][:3]) < 150
    old = [(x, y) for (a, b, t) in now for x in range(a, b + 1) for y in range(t - 1, t + 4) if isdark(x, y)]
    cols = sorted((px[q] for q in old), key=lambda c: sum(c[:3])); col = cols[len(cols) // 2] if cols else (40, 32, 34, 255)
    ew, gap = E['w'], E['gap']; L = int(np.floor((l0 + r1) / 2 - (2 * ew + gap - 1) / 2)); R = L + ew + gap
    new = {(x, y) for (x0, t) in ((L, lt), (R, rt)) for x in range(x0, x0 + ew) for y in range(t, t + E['h'])}
    for (x, y) in old:
        if (x, y) in new: continue
        for d in (1, 2, 3):
            c = next((px[x + s2 * d, y] for s2 in (-1, 1) if op(x + s2 * d, y) and not isdark(x + s2 * d, y) and (x + s2 * d, y) not in new), None)
            if c: px[x, y] = c; break
    for q in new:
        if op(*q): px[q] = col


def fix_eyes(f, E, at):
    """눈 다듬기 (최소로): at(왼눈 왼쪽 위) 둘레 몸 안의 짙은 칸 D를 보고, 두 직사각형(너비 1~2 · 높이 2~4 · 한 칸 이상 띄움 · 높이 차 1 이하)
    가운데 D와 가장 덜 다른 쌍을 고른다 → 직사각형 밖으로 삐진 칸은 같은 줄 옆 색으로 메우고, 빈 칸만 원래 눈 색으로 채운다"""
    px = f.load(); w, h = f.size; lx, ty = at
    op = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    isdark = lambda x, y: op(x, y) and sum(px[x, y][:3]) < 150
    dark = lambda x, y: isdark(x, y) and all(op(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    X0, X1, Y0, Y1 = lx - 2, lx + 6, ty - 1, ty + 4
    D = {(x, y) for y in range(Y0, Y1 + 1) for x in range(X0, X1 + 1) if dark(x, y)}
    if not D: return 0
    rects = [(x, y, rw, rh) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1) for rw in (1, 2) for rh in (2, 3, 4) if x + rw - 1 <= X1 and y + rh - 1 <= Y1]
    cells = lambda r: {(r[0] + i, r[1] + j) for i in range(r[2]) for j in range(r[3])}
    rc = {r: cells(r) for r in rects}
    best = None
    for a in rects:
        for b in rects:
            if b[0] < a[0] + a[2] + 1 or abs(a[1] - b[1]) > 1: continue
            R = rc[a] | rc[b]; cost = len(D ^ R)
            if best is None or cost < best[0]: best = (cost, R)
    R = best[1]
    cols = sorted((px[q] for q in D), key=lambda c: sum(c[:3])); col = cols[len(cols) // 2]
    for (x, y) in D - R:
        for d in (1, 2, 3):
            c = next((px[x + s2 * d, y] for s2 in (-1, 1) if op(x + s2 * d, y) and not isdark(x + s2 * d, y) and (x + s2 * d, y) not in R), None)
            if c: px[x, y] = c; break
    for q in R - D:
        if op(*q): px[q] = col
    return best[0]


def cut_exact(bid, B, sample, D0, gif):
    """원본 그대로: 칸(도트)마다 원래 색(가운데값) · 외곽선 · 색 줄이기 · 점 지우기 없음 · 16장을 원본 4×4 자리 그대로 한 장에"""
    cells = {}
    for r in range(4):
        for c in range(4):
            blocks, (nw, nh), d, (ox, oy) = sample(r, c)
            dx, dy = round(ox / d), round(oy / d)  # 칸 안 자리도 원본대로
            im = Image.new('RGBA', (nw + dx, nh + dy), (0, 0, 0, 0)); px = im.load()
            for (i, j), b in blocks.items(): px[i + dx, j + dy] = tuple(int(v) for v in np.median(b, 0).round()) + (255,)
            cells[(r, c)] = im
    bb = [im.getbbox() for im in cells.values()]
    x0, y0, x1, y1 = min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb)  # 모든 장면을 같은 테두리로 자른다 (서로 자리 그대로)
    FW, FH = x1 - x0, y1 - y0
    sheet = Image.new('RGBA', (FW * 4, FH * 4), (0, 0, 0, 0))
    for (r, c), im in cells.items(): sheet.alpha_composite(im.crop((x0, y0, x1, y1)), (c * FW, r * FH))
    out = os.path.join(ROOT, 'public', 'assets', 'custom', f'boss_{bid}_motion.png'); sheet.save(out)
    anims = {}
    for n, rcs in B['rows'].items(): anims[n] = {'row': rcs[0][0], 'col': rcs[0][1], 'n': len(rcs)}  # 한 줄에서 이어진 칸들
    mp = meta_path('boss_pixel'); meta = json.load(open(mp)) if os.path.exists(mp) else {}
    meta[f'b_{bid}'] = {'img': os.path.basename(out), 'w': FW, 'h': FH, 'y0': 0, 'anims': anims}
    json.dump(meta, open(mp, 'w')); build_manifest(os.path.dirname(out))
    print(bid, 'exact', 'dot', round(D0, 2), 'frame', FW, 'x', FH, 'colors', len(set(sheet.getdata())) - 1)
    if gif:
        s = 6; big = Image.new('RGBA', (sheet.width * s, sheet.height * s), (60, 60, 72, 255)); big.alpha_composite(sheet.resize((sheet.width * s, sheet.height * s), Image.NEAREST))
        big.save(gif.rsplit('.', 1)[0] + '_sheet.png')


if __name__ == '__main__':
    cut(sys.argv[1], sys.argv[sys.argv.index('--gif') + 1] if '--gif' in sys.argv else None)
