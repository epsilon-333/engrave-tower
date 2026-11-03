"""보내 주신 기사(tools/sprites/hero_final/knight.png) 그대로 움직이게: 그림은 고치지 않고 동작 프레임만 찍는다.
몸을 세 덩어리로 나눈다 — 위(머리 · 목도리 · 몸통) / 다리 둘 / 등 뒤 망토 끝.
  서기 4: 숨쉬기(머리 · 몸이 1칸 내려앉았다 올라옴) · 망토 끝이 살랑
  달리기 6: 다리를 번갈아 내딛고(앞뒤 · 들림) · 몸이 위아래로 · 망토가 뒤로 날린다
  베기 5: 치켜듦 · 내려치기 · 맞는 순간 · 따라가기 · 돌아오기 — 원래 그림엔 팔이 망토에 가려 있어, 같은 색 · 같은 외곽선으로 팔 · 장갑 · 검을 찍는다
    python3 tools/knight_anim.py   → art/preview_knight_anim.png (8배 · 맨 왼쪽은 원래 그림)
"""
import math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sprites', 'hero_final', 'knight.png')
PAD_L, PAD_R, PAD_T = 4, 14, 8          # 프레임 칸: 원래 그림 둘레에 칼이 나갈 자리
O = (24, 18, 26, 255)


def load():
    im = Image.open(SRC).convert('RGBA')
    w, h = im.size
    return im, w, h


def split(im):
    """위 · 왼다리 · 오른다리 · 망토 끝 (원래 그림의 칸 그대로 · 겹치는 칸 없이)"""
    w, h = im.size; px = im.load()
    parts = {k: Image.new('RGBA', (w, h), (0, 0, 0, 0)) for k in ('upper', 'legL', 'legR', 'cape')}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if not p[3]: continue
            if y >= 27 and 9 <= x <= 20: k = 'legL' if x <= 14 else 'legR'
            elif x <= 8 and y >= 19: k = 'cape'
            else: k = 'upper'
            parts[k].putpixel((x, y), p)
    return parts


def colors(im):
    px = im.load(); out = {}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3]: out[p[:3]] = out.get(p[:3], 0) + 1
    return out


def near(cols, want): return min(cols, key=lambda c: sum((a - b) ** 2 for a, b in zip(c, want))) + (255,)


def outline(fr):
    w, h = fr.size; src = fr.copy().load(); px = fr.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] and src[x + dx, y + dy][:3] != O[:3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[x, y] = O
    return fr


def put(fr, x, y, c):
    if 0 <= x < fr.width and 0 <= y < fr.height: fr.putpixel((x, y), c)


def line(fr, x0, y0, x1, y1, c, w=1):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        for dx in range(w):
            for dy in range(w): put(fr, x + dx - w // 2, y + dy - w // 2, c)


class Pal:
    def __init__(self, im):
        cs = colors(im)
        self.L = near(cs, (232, 222, 230)); self.M = near(cs, (200, 186, 200)); self.D = near(cs, (160, 140, 165))
        self.W = (250, 244, 248, 255)
        self.gold, self.gold2 = (240, 196, 92, 255), (168, 118, 46, 255)
        self.X, self.x, self.y = (255, 255, 255, 255), (200, 228, 255, 255), (140, 180, 236, 255)


def arm(fr, P, sx, sy, ex, ey, hx, hy):
    """원래 그림의 갑옷 색으로 팔(2칸) · 장갑 주먹"""
    line(fr, sx, sy, ex, ey, P.D, 2); line(fr, sx + 1, sy - 1, ex + 1, ey - 1, P.M)
    line(fr, ex, ey, hx, hy, P.M, 2); line(fr, ex + 1, ey - 1, hx + 1, hy - 1, P.L)
    put(fr, hx, hy - 1, P.W); put(fr, hx + 1, hy - 1, P.L); put(fr, hx, hy, P.L); put(fr, hx + 1, hy, P.M)


def sword(fr, P, hx, hy, dx, dy, n=12):
    l = math.hypot(dx, dy); ux, uy = dx / l, dy / l; qx, qy = -uy, ux
    put(fr, round(hx - ux), round(hy - uy), P.gold2)
    for k in (-2, -1, 1, 2): put(fr, round(hx + ux * 2 + qx * k), round(hy + uy * 2 + qy * k), P.gold if abs(k) == 1 else P.gold2)
    for i in range(2, n):
        x, y = hx + ux * i, hy + uy * i
        put(fr, round(x), round(y), P.W if i < n - 1 else P.L)
        if i < n - 2: put(fr, round(x + qx), round(y + qy), P.L if i % 3 else P.M)


def smear(fr, P, cx, cy, r, a0, a1, thick=3):
    steps = int(abs(a1 - a0) * r * 1.6) + 1
    for i in range(steps + 1):
        t = i / steps; a = a0 + (a1 - a0) * t; w = max(1, round(thick * (0.35 + 0.65 * t)))
        for k in range(w):
            rr = r - k
            put(fr, round(cx + math.cos(a) * rr), round(cy + math.sin(a) * rr), P.X if k == 0 and t > 0.3 else P.x if k < 2 else P.y)


def frame(parts, P, w, h, up=(0, 0), legL=(0, 0), legR=(0, 0), cape=(0, 0), head=(0, 0), extra=None, behind=None):
    """up: 위 덩어리 (x, y) · legL/legR: 다리 (앞뒤, 들림) · cape: 망토 끝 · head: 머리만 더 (윗 18줄)"""
    W, H = w + PAD_L + PAD_R, h + PAD_T
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ox, oy = PAD_L, PAD_T
    if behind: behind(fr, ox, oy)
    fr.alpha_composite(parts['cape'], (ox + cape[0] + up[0], oy + cape[1] + up[1]))
    for k, (dx, lift) in (('legL', legL), ('legR', legR)): fr.alpha_composite(parts[k], (ox + dx, oy - lift))
    body = parts['upper']
    if head != (0, 0):  # 머리(윗 18줄)만 따로 조금 더 기울인다
        top = body.crop((0, 0, w, 18)); rest = body.crop((0, 18, w, h))
        fr.alpha_composite(rest, (ox + up[0], oy + 18 + up[1])); fr.alpha_composite(top, (ox + up[0] + head[0], oy + up[1] + head[1]))
    else: fr.alpha_composite(body, (ox + up[0], oy + up[1]))
    if extra: extra(fr, ox + up[0], oy + up[1])
    return outline(fr)


def build():
    im, w, h = load(); parts = split(im); P = Pal(im)
    F = {}
    F['idle'] = [frame(parts, P, w, h), frame(parts, P, w, h, cape=(-1, 0)), frame(parts, P, w, h, up=(0, 1), cape=(-1, 1)), frame(parts, P, w, h, up=(0, 1), cape=(0, 1))]
    run = [((-3, 0), (3, 0), 0), ((-2, 0), (1, 2), 1), ((0, 2), (0, 0), 0), ((3, 0), (-3, 0), 0), ((1, 2), (-2, 0), 1), ((0, 0), (0, 2), 0)]  # 보폭 3칸 · 드는 발 2칸
    F['run'] = [frame(parts, P, w, h, up=(1, -b), legL=l, legR=r, cape=(-2 - (i % 2), -1), head=(1, 0)) for i, (l, r, b) in enumerate(run)]
    SH = (18, 21)  # 오른쪽 어깨 (원래 그림 좌표: 목도리 아래 몸통 오른쪽)
    def sl(e, hnd, sw=None, sm=None, back=False):
        def f(fr, ox, oy):
            sx, sy = ox + SH[0], oy + SH[1]
            arm(fr, P, sx, sy, sx + e[0], sy + e[1], sx + hnd[0], sy + hnd[1])
            if sw and not back: sword(fr, P, sx + hnd[0], sy + hnd[1], *sw)
            if sm: smear(fr, P, sx + sm[0], sy + sm[1], *sm[2:])
        def b(fr, ox, oy):
            if sw and back: sx, sy = ox + SH[0], oy + SH[1]; sword(fr, P, sx + hnd[0], sy + hnd[1], *sw)
        return f, b
    poses = [
        dict(up=(-1, 1), head=(-1, 0), legL=(-2, 0), legR=(1, 0), cape=(-1, 0), arm=sl((1, -5), (2, -10), (-2, -3, 13), back=True)),                     # 치켜듦: 몸을 낮추고 칼을 머리 위 뒤로
        dict(up=(0, 0), head=(1, 0), legL=(-2, 0), legR=(2, 0), cape=(-2, -1), arm=sl((3, -4), (7, -6), (3, -2, 13), (1, 0, 13, -2.0, -0.9, 3))),         # 내려치기: 몸을 앞으로 던지며
        dict(up=(1, 2), head=(2, 0), legL=(-3, 0), legR=(3, 0), cape=(-3, -1), arm=sl((5, 1), (9, 4), (3, 2, 13), (3, 0, 15, -1.55, 0.55, 4))),          # 맞는 순간: 깊이 디디고 팔을 쭉
        dict(up=(1, 2), head=(1, 0), legL=(-3, 0), legR=(3, 0), cape=(-2, -1), arm=sl((4, 3), (6, 7), (2, 3, 12), (3, 0, 14, 0.0, 1.0, 2))),             # 따라가기: 칼끝이 아래로
        dict(up=(0, 1), legL=(-1, 0), legR=(1, 0), cape=(-1, 0), arm=sl((3, 3), (5, 5), (3, -1, 12))),                                                  # 돌아오기
    ]
    F['slash'] = []
    for q in poses:
        f, b = q.pop('arm'); F['slash'].append(frame(parts, P, w, h, extra=f, behind=b, **q))
    return im, F


if __name__ == '__main__':
    im, F = build()
    S, gap = 8, 2
    rows = [('원래', [im])] + list(F.items())
    fw = max(f.width for _, fs in rows for f in fs); fh = max(f.height for _, fs in rows for f in fs)
    out = Image.new('RGBA', (6 * (fw + gap) * S, len(rows) * (fh + gap) * S), (58, 84, 58, 255))
    for r, (_, fs) in enumerate(rows):
        for i, f in enumerate(fs):
            dy = fh - f.height  # 발을 맞춘다
            out.alpha_composite(f.resize((f.width * S, f.height * S), Image.NEAREST), ((i * (fw + gap) + (PAD_L if f is im else 0)) * S, (r * (fh + gap) + dy) * S))
    p = os.path.join(HERE, '..', 'art', 'preview_knight_anim.png'); out.save(p); print('미리 보기:', p)
