"""보내 주신 보스 그림을 밑그림으로 장면을 더 그린다: 원래 그림의 픽셀을 바탕으로 달라지는 곳만 고쳐 찍어 장면 하나하나를 완성한다.
(조각을 떼어 따로 움직이지 않는다 — 장면마다 한 장의 그림)
지금은 가면 족장만: 숨쉬기 · 걷기(발 떼기) · 공격 준비 · 내려친 순간 · 포효 때 눈빛
    python3 tools/boss_motion.py           → 미리 보기 art/preview_boss_motion.gif / .png
    python3 tools/boss_motion.py --write   → 게임 시트 b_climbChief 에 넣는다
"""
import os, sys, json
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CUSTOM = os.path.join(HERE, '..', 'public', 'assets', 'custom')
sys.path.insert(0, HERE)

def frames_of(meta, sheet, pre):
    m = meta[pre]; W, H = m['w'], m['h']
    get = lambda r, i: sheet.crop((i * W, m['y0'] + r * H, (i + 1) * W, m['y0'] + (r + 1) * H))
    return m, {'idle0': get(0, 0), 'idle1': get(0, 1), 'atk': get(2, 0), 'skill': get(3, 0)}

def shift_band(im, y0, y1, dx=0, dy=0, x0=0, x1=None):
    """한 띠(가로 x0~x1 · 세로 y0~y1)를 통째로 dx, dy 만큼 다시 찍는다. 띠 밖은 그대로. 비는 줄은 바로 옆 줄로 메운다."""
    W, H = im.size; x1 = W if x1 is None else x1
    src = im.copy(); out = im.copy(); po, ps = out.load(), src.load()
    for y in range(y0, y1):
        for x in range(x0, x1): po[x, y] = (0, 0, 0, 0)
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = ps[x, y]
            if not p[3]: continue
            X, Y = x + dx, y + dy
            if 0 <= X < W and 0 <= Y < H: po[X, Y] = p
    if dy < 0:  # 위로 떠오르면 띠 아래 끝에 빈 줄이 생긴다: 원래 그 줄 그림으로 메운다
        for x in range(x0, x1):
            for yy in range(y1 + dy, y1):
                if 0 <= yy < H and not po[x, yy][3] and ps[x, yy][3]: po[x, yy] = ps[x, yy]
    if dy > 0:  # 아래로 내려앉으면 띠와 아래 사이 줄을 아래 끝 줄로 메운다
        for x in range(x0, x1):
            for k in range(dy):
                yy = y1 + k
                if yy < H and not po[x, yy][3] and ps[x, y1 - 1][3]: po[x, yy] = ps[x, y1 - 1]
    return out

def glow_eyes(im, pts, r=2):
    # 눈구멍(짙은 칸) 안쪽을 불빛으로: 가운데 흰 노랑 → 노랑 → 바깥 주황 (구멍 밖 뼈는 건드리지 않는다)
    out = im.copy(); po = out.load()
    for cx, cy in pts:
        for y in range(cy - r - 1, cy + r + 2):
            for x in range(cx - r - 1, cx + r + 2):
                q = po[x, y]
                if not q[3] or sum(q[:3]) > 200: continue
                d = abs(x - cx) + abs(y - cy)
                po[x, y] = (255, 250, 210, 255) if d == 0 else (255, 214, 74, 255) if d <= 1 else (236, 120, 40, 255) if d <= 2 else q
    return out

def dust(im, puffs):  # 내려친 순간: 땅에서 흙먼지 덩어리 (가운데 밝게 · 테두리 짙게)
    out = im.copy(); po = out.load()
    for cx, cy, r in puffs:
        for y in range(cy - r - 1, cy + r + 2):
            for x in range(cx - r - 1, cx + r + 2):
                if not (0 <= x < im.width and 0 <= y < im.height) or po[x, y][3]: continue
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r - 0.6: po[x, y] = (196, 170, 136, 255) if y < cy else (150, 124, 98, 255)
                elif d <= r + 0.5: po[x, y] = (40, 26, 30, 255)
    return out

def eyes_of(im, box):
    """해골 눈구멍: 밝은 뼈 사이에 갇힌 짙은 칸 덩어리 둘의 가운데"""
    px = im.load(); x0, y0, x1, y1 = box
    pts = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if px[x, y][3] and sum(px[x, y][:3]) < 140
           and any(sum(px[x, y - k][:3]) > 560 for k in range(1, 5)) and any(sum(px[x, y + k][:3]) > 560 for k in range(1, 6))]
    if not pts: return []
    mid = sorted(p[0] for p in pts)[len(pts) // 2]
    out = []
    for grp in ([p for p in pts if p[0] < mid], [p for p in pts if p[0] >= mid]):
        if grp: out.append((round(sum(x for x, _ in grp) / len(grp)), round(sum(y for _, y in grp) / len(grp))))
    return out

def feet_of(im):
    """맨 아래 여섯 줄에서 발 둘의 가로 자리"""
    W, H = im.size; px = im.load()
    cols = [x for x in range(W) if any(px[x, y][3] for y in range(H - 7, H))]
    if not cols: return (0, W // 2), (W // 2, W)
    gaps = [(cols[i + 1] - cols[i], i) for i in range(len(cols) - 1)]
    g, i = max(gaps) if gaps else (0, len(cols) // 2)
    if g < 2: i = len(cols) // 2
    return (cols[0] - 1, cols[i] + 1), (cols[i + 1] - 1 if i + 1 < len(cols) else cols[i], cols[-1] + 2)

# 가면 족장: 허리 위(가슴 위쪽)는 0~54%줄 · 몸은 0~80%줄 · 발은 아래 18%
def chief(F):
    A, B, K, S = F['idle0'], F['idle1'], F['atk'], F['skill']
    W, H = A.size; chest, body, leg = int(H * 0.54), int(H * 0.8), int(H * 0.83)
    head = (int(W * 0.45), int(H * 0.15), int(W * 0.8), int(H * 0.45))
    breathe = lambda im: shift_band(im, 0, chest, dy=1, x1=int(W * 0.75))  # 숨을 내쉬면 머리 · 어깨가 한 칸 내려앉는다 (몽둥이 위에서 끊는다)
    idle = [A, breathe(A), B, breathe(B)]
    up = lambda im: shift_band(im, 0, body, dy=-1)
    (bx0, bx1), (fx0, fx1) = feet_of(A)
    lift_f = lambda im: shift_band(im, leg, H, dy=-2, x0=fx0, x1=fx1)
    lift_b = lambda im: shift_band(im, leg, H, dy=-2, x0=bx0, x1=bx1)
    walk = [lift_f(breathe(A)), up(A), lift_b(breathe(A)), up(A)]
    wb = shift_band(B, 0, chest, dx=-1, dy=1, x1=int(W * 0.75))
    windup = glow_eyes(wb, eyes_of(wb, head), r=1)
    kb = shift_band(K, 0, chest, dy=1, x1=int(W * 0.75))
    impact = dust(kb, [(int(W * 0.72), H - 3, 2), (int(W * 0.8), H - 4, 2), (int(W * 0.88), H - 3, 1)])
    attack = [windup, K, impact]
    su = shift_band(S, 0, chest, dy=-1)
    skill = [S, glow_eyes(su, eyes_of(su, head), r=1), glow_eyes(S, eyes_of(S, head), r=1)]
    return {'idle': idle, 'run': walk, 'attack': attack, 'skill': skill}

if __name__ == '__main__':
    metaf = os.path.join(HERE, 'sprites', 'bosses.json'); meta = json.load(open(metaf, encoding='utf-8'))
    sheetf = os.path.join(CUSTOM, 'bosses.png'); sheet = Image.open(sheetf).convert('RGBA')
    pre = 'b_climbChief'
    m, F = frames_of(meta, sheet, pre)
    if m.get('motion'): print('이미 넣었다 (tools/cut_bosses.py build 로 되돌린 뒤 다시)'); sys.exit()
    anims = chief(F); W, H = m['w'], m['h']
    if '--write' in sys.argv:
        from sprites import build_manifest
        y0 = sheet.height; rows = list(anims.items())
        out = Image.new('RGBA', (max(sheet.width, 4 * W), y0 + len(rows) * H), (0, 0, 0, 0)); out.alpha_composite(sheet, (0, 0))
        for r, (k, fr) in enumerate(rows):
            for i, im in enumerate(fr): out.alpha_composite(im, (i * W, y0 + r * H))
        out.save(sheetf)
        meta[pre] = {**m, 'y0': y0, 'motion': True, 'anims': {k: {'row': r, 'n': len(fr)} for r, (k, fr) in enumerate(rows)}}
        json.dump(meta, open(metaf, 'w', encoding='utf-8'), ensure_ascii=False); build_manifest()
    else:
        S = 5
        allf = [im for k in ('idle', 'run', 'attack', 'skill') for im in anims[k]]
        png = Image.new('RGBA', (4 * W * S, 4 * H * S), (46, 44, 56, 255))
        for r, k in enumerate(('idle', 'run', 'attack', 'skill')):
            for i, im in enumerate(anims[k]): png.alpha_composite(im.resize((W * S, H * S), Image.NEAREST), (i * W * S, r * H * S))
        png.save(os.path.join(HERE, '..', 'art', 'preview_boss_motion.png'))
        seq = [('idle', i) for i in (0, 1, 0, 1, 2, 3, 2, 3)] + [('run', i % 4) for i in range(8)] + [('attack', i) for i in (0, 0, 1, 2, 2)] + [('idle', 0)] * 2 + [('skill', i) for i in (0, 1, 2, 1, 2)] + [('idle', 0)] * 2
        gif = []
        for k, i in seq:
            o = Image.new('RGBA', (W * S, H * S), (46, 44, 56, 255)); o.alpha_composite(anims[k][i].resize((W * S, H * S), Image.NEAREST)); gif.append(o.convert('P', palette=Image.ADAPTIVE))
        dur = {'idle': 380, 'run': 150, 'attack': 140, 'skill': 200}
        gif[0].save(os.path.join(HERE, '..', 'art', 'preview_boss_motion.gif'), save_all=True, append_images=gif[1:], duration=[dur[k] for k, _ in seq], loop=0)
        print('ok')
