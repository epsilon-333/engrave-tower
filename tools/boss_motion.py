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

# 가면 족장 (게임 크기 80×82 · 발밑 80): 다리 · 발은 66~80줄 · 뒷발 x 14~31 · 앞발 x 35~53 · 허리 위는 0~62줄
def chief(F):
    A, B, K, S = F['idle0'], F['idle1'], F['atk'], F['skill']
    breathe = lambda im: shift_band(im, 0, 44, dy=1, x1=60)  # 숨을 내쉬면 가슴 위(머리 · 어깨)가 한 칸 내려앉는다 (몽둥이 위에서 끊어 줄이 생기지 않게)
    idle = [A, breathe(A), B, breathe(B)]
    up = lambda im: shift_band(im, 0, 66, dy=-1)  # 걸음 사이: 몸이 한 칸 떠오른다
    lift_f = lambda im: shift_band(im, 68, 81, dy=-3, x0=35, x1=54)  # 앞발 떼기
    lift_b = lambda im: shift_band(im, 68, 81, dy=-3, x0=12, x1=32)  # 뒷발 떼기
    walk = [lift_f(breathe(A)), up(A), lift_b(breathe(A)), up(A)]
    windup = glow_eyes(shift_band(B, 0, 44, dx=-1, dy=1, x1=60), [(45, 29), (51, 31)])  # 준비: 머리 · 어깨를 뒤로 낮추고 눈이 번쩍
    impact = dust(shift_band(K, 0, 44, dy=1, x1=60), [(57, 77, 2), (63, 76, 3), (69, 78, 2), (74, 77, 2)])  # 내려친 순간: 몸이 실리고 흙이 튄다
    attack = [windup, K, impact]
    skill = [S, glow_eyes(shift_band(S, 0, 44, dy=-1), [(48, 24), (54, 26)]), glow_eyes(S, [(48, 25), (54, 27)])]  # 포효: 가슴을 펴며 눈에 불이 켜진다
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
