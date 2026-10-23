# 짐승 · 괴물 도트 생성기: 사람(people.py)과 같은 pixelrig 뼈대 도트 · 같은 외곽선 · 같은 4단 명암.
# 예전에 다른 몬스터 그림에 색만 바꿔 쓰던 것들을 몸 구조부터 하나하나 새로 설계한다 (거머리는 거머리, 유리 거미는 거미).
# 몬스터 하나 = 서기(4) · 달리기(4) 두 줄. 크기가 제각각이라 creatures.png 한 장에 세로로 쌓고 creatures.json 에 위치(y0)와 칸 크기를 적는다.
import math, sys, json
from PIL import Image
from pixelrig import Model, Part, Shape

sn, cs, PI = math.sin, math.cos, math.pi
OUT = '#140e12'


def shade(h, k):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    if k >= 0: r, g, b = (int(c + (255 - c) * k) for c in (r, g, b))
    else: r, g, b = (int(c * (1 + k)) for c in (r, g, b))
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def ramp(h): return [shade(h, 0.22), h, shade(h, -0.22), shade(h, -0.48)]


# 짧게 쓰는 도형
def E(key, cx, cy, rx, ry, flat=False): return Shape('ellipse', key, cx, cy, rx, ry, flat=flat)
def C(key, a, b, r): return Shape('capsule', key, a, b, r)
def Pg(key, *pts, flat=False): return Shape('poly', key, list(pts), flat=flat)
def Ln(key, a, b, w, flat=True): return Shape('line', key, a, b, w, flat=flat)


def frames(n, fn): return [fn(i, i / n * PI * 2) for i in range(n)]


# ═════════ 1) 벌레 · 뱀 (거머리 · 이끼 민달팽이 · 서리 민달팽이 · 바다뱀 · 모래 벌레) ═════════
def worm(W, H, n, r, body, belly, head, extra=(), spots=None, rise=0):
    ramps = {'b': ramp(body), 'u': ramp(belly), 'x': ramp(spots or shade(body, -0.3)), 'fin': ramp(shade(body, 0.15))}
    flats = {'eye': '#1a0e10', 'eyeW': '#f8f0d0', 'mouth': '#2a0a10', 'tooth': '#f4ecd8', 'moss': '#5aa83a', 'moss2': '#8ad85a', 'ice': '#e8fcff', 'ice2': '#9ad8f0', 'ring': shade(body, -0.35), 'glow': '#ffe080', 'gill': shade(body, -0.4)}
    parts = []
    x0, x1 = 2 + r * 0.7, W - 3 - r * 1.15
    for i in range(n):
        u = i / (n - 1)
        ri = r * (0.5 + 0.5 * min(1, u * 1.6))
        x = x0 + (x1 - x0) * u
        y = H - 1.5 - ri - (rise * max(0, (u - 0.55) / 0.45) ** 1.4 if rise else 0)
        sh = [E('b', x, y, ri * 1.25, ri), E('u', x + 0.3, y + ri * 0.45, ri * 1.05, ri * 0.5)]
        if 'rings' in extra and i % 1 == 0: sh.append(Ln('ring', (x - ri * 0.9, y - ri * 0.8), (x - ri * 0.5, y + ri * 0.8), 0.7))
        if 'moss' in extra and i < n - 1: sh += [E('moss', x - 0.5, y - ri * 0.85, ri * 0.7, 0.9, flat=True), E('moss2', x - 0.8, y - ri * 0.95, ri * 0.35, 0.5, flat=True)]
        if 'ice' in extra and i < n - 1 and i % 2 == 0: sh += [Pg('ice2', (x - 1.2, y - ri * 0.7), (x - 0.2, y - ri - 2.8), (x + 1.0, y - ri * 0.7), flat=True), Pg('ice', (x - 0.6, y - ri * 0.8), (x - 0.2, y - ri - 2.0), (x + 0.2, y - ri * 0.8), flat=True)]
        if 'fin' in extra and 0 < i < n - 1: sh.insert(0, Pg('fin', (x - ri, y - ri * 0.6), (x - ri * 0.2, y - ri - 2.6), (x + ri * 0.6, y - ri * 0.7)))
        if spots and i % 2 == 1: sh.append(E('x', x - 0.6, y - ri * 0.3, ri * 0.4, ri * 0.32))
        parts.append(Part('s%d' % i, None, (x, y), 1 + i * 0.1, sh, tex=0.12))
    hx, hy = x1 + r * 0.55, H - 1.5 - r - (rise if rise else 0)
    if head == 'sucker':  # 거머리: 둥근 빨판 입
        hs = [E('b', hx, hy, r * 1.0, r * 0.95), E('mouth', hx + r * 0.7, hy + 0.3, r * 0.42, r * 0.62, flat=True), E('tooth', hx + r * 0.78, hy + 0.3, r * 0.18, r * 0.3, flat=True), E('eye', hx - 0.4, hy - r * 0.45, 0.6, 0.6, flat=True)]
    elif head == 'slug':  # 민달팽이: 더듬이 눈
        hs = [E('b', hx, hy + r * 0.2, r * 0.95, r * 0.8), C('b', (hx + 0.4, hy - r * 0.3), (hx + 2.2, hy - r - 3.2), 0.65), C('b', (hx - 0.8, hy - r * 0.3), (hx - 0.4, hy - r - 2.6), 0.6),
              E('eye', hx + 2.3, hy - r - 3.4, 0.9, 0.9, flat=True), E('eye', hx - 0.4, hy - r - 2.8, 0.8, 0.8, flat=True), Ln('mouth', (hx + r * 0.5, hy + r * 0.5), (hx + r * 0.9, hy + r * 0.3), 0.6)]
    elif head == 'serpent':  # 바다뱀: 길쭉한 머리 · 지느러미 갈기 · 노란 눈
        hs = [Pg('fin', (hx - r * 1.4, hy - r * 0.6), (hx - r * 0.8, hy - r - 4.2), (hx - r * 0.1, hy - r - 2.4), (hx + r * 0.4, hy - r * 0.6)),
              E('b', hx, hy, r * 1.2, r * 0.9), Pg('b', (hx + r * 0.4, hy - r * 0.6), (hx + r * 2.6, hy - r * 0.1), (hx + r * 2.6, hy + r * 0.4), (hx + r * 0.4, hy + r * 0.7)),
              Pg('u', (hx + r * 0.2, hy + r * 0.3), (hx + r * 2.4, hy + r * 0.45), (hx + r * 2.2, hy + r * 0.9), (hx + r * 0.2, hy + r * 0.95)), Ln('mouth', (hx + r * 0.6, hy + r * 0.38), (hx + r * 2.5, hy + r * 0.4), 0.5),
              E('glow', hx + r * 0.5, hy - r * 0.3, 0.95, 0.85, flat=True), E('eye', hx + r * 0.62, hy - r * 0.28, 0.4, 0.7, flat=True), Ln('gill', (hx - r * 0.6, hy - r * 0.2), (hx - r * 0.4, hy + r * 0.6), 0.6)]
    else:  # 'maw' 모래 벌레: 앞을 향해 벌린 둥근 아가리 · 이빨 고리
        hs = [E('b', hx, hy, r * 1.05, r * 1.1), E('mouth', hx + r * 0.55, hy, r * 0.5, r * 0.85, flat=True)]
        for k in range(6):
            a = k / 6 * PI * 2
            hs.append(Pg('tooth', (hx + r * 0.55 + cs(a) * r * 0.5, hy + sn(a) * r * 0.85), (hx + r * 0.55 + cs(a) * r * 0.2, hy + sn(a) * r * 0.4), (hx + r * 0.55 + cs(a + 0.4) * r * 0.5, hy + sn(a + 0.4) * r * 0.85), flat=True))
    parts.append(Part('head', None, (hx, hy), 2.5, hs, tex=0.1))
    m = Model(W, H, parts, ramps, OUT, flats)
    names = ['s%d' % i for i in range(n)] + ['head']

    def idle(i, f): return {nm: (0, 0, 0.6 * sn(f + j * 0.7) - (0.6 if nm == 'head' and rise else 0) * (1 + sn(f))) for j, nm in enumerate(names)}

    def run(i, f): return {nm: (0, -0.9 * sn(f) * j / len(names), -1.6 * max(0, sn(f - j * 0.9))) for j, nm in enumerate(names)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 2) 걷는 버섯 ═════════
def mushroom(cap, spot, stem):
    W, H = 22, 26
    ramps = {'cap': ramp(cap), 'stem': ramp(stem), 'gill': ramp(shade(stem, -0.25)), 'leg': ramp(shade(stem, -0.15))}
    flats = {'spot': spot, 'eye': '#1a0e10', 'mouth': '#5a2a2a', 'cheek': shade(cap, 0.3)}
    parts = [
        Part('legF', 'stem', (9, 21), 0.8, [C('leg', (9, 21), (8.4, 24), 1.4), E('leg', 8.8, 24.6, 2.0, 1.0)], sep=False),
        Part('armF', 'stem', (8, 15.5), 0.9, [C('stem', (8, 15.5), (5.6, 19), 1.0)]),
        Part('stem', None, (11, 22), 2, [E('stem', 11, 18, 4.6, 5.0), E('eye', 12.6, 17.4, 0.7, 1.1, flat=True), E('eye', 15.0, 17.4, 0.6, 1.1, flat=True), Ln('mouth', (13.4, 20), (14.6, 20), 0.6), E('cheek', 10.4, 19, 0.9, 0.5, flat=True)], tex=0.06),
        Part('cap', 'stem', (11, 12.5), 3, [Pg('cap', (1.2, 13.6), (2.4, 8.6), (6.4, 4.4), (11, 3.0), (15.6, 4.4), (19.6, 8.6), (20.8, 13.6)), E('gill', 11, 13.6, 9.0, 1.2),
                                           E('spot', 6.6, 8.4, 1.6, 1.3, flat=True), E('spot', 12.0, 5.6, 1.4, 1.1, flat=True), E('spot', 16.4, 9.4, 1.2, 1.1, flat=True), E('spot', 10.4, 10.6, 0.9, 0.8, flat=True)], tex=0.08),
        Part('legN', 'stem', (13, 21), 2.2, [C('leg', (13, 21), (13.6, 24), 1.4), E('leg', 14.2, 24.6, 2.0, 1.0)], sep=False),
        Part('armN', 'stem', (15, 15.5), 2.4, [C('stem', (15, 15.5), (17.4, 19), 1.0)]),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'stem': (0, 0, [0, 0, 1, 1][i]), 'cap': (2 * sn(f), 0, 0, 1 + 0.04 * sn(f), 1 - 0.05 * sn(f)), 'armN': (8 * sn(f),), 'armF': (-8 * sn(f),)}

    def run(i, f): return {'stem': (6 * sn(f), 0, -abs(sn(f))), 'cap': (-4 * sn(f),), 'legN': (30 * sn(f),), 'legF': (-30 * sn(f),), 'armN': (-30 * sn(f),), 'armF': (30 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 3) 덩치 큰 괴물 (늪 마녀 여왕 · 늪 트롤 · 설인 · 미궁의 군주) ═════════
def brute(kind, skin, fur, extra):
    W, H = 44, 42
    G = H - 1  # 발바닥
    ramps = {'skin': ramp(skin), 'fur': ramp(fur), 'belly': ramp(shade(fur, 0.25)), 'wood': ramp('#7a5232'), 'iron': ramp('#8a8a96'), 'horn': ramp('#e8dcc0'), 'cloth': ramp(extra.get('cloth', '#3a4a2a')), 'hair': ramp(extra.get('hair', fur)), 'face': ramp(extra.get('face', shade(skin, 0.15)))}
    flats = {'eye': extra.get('eye', '#ffe040'), 'pupil': '#1a0e10', 'mouth': '#2a0e10', 'tusk': '#f4ecd8', 'gold': '#e8c040', 'moss': '#6aa83a', 'moss2': '#3a6a22', 'face': extra.get('face', shade(skin, 0.15)), 'nail': '#e8e0c8', 'red': '#c83a2a'}
    hipY, shY = G - 13, G - 25
    parts = []
    # 뒤 다리 · 뒤 팔
    parts.append(Part('legF', 'torso', (15, hipY), 0.6, [C('fur', (15, hipY), (14, G - 6), 3.0), C('skin' if kind != 'yeti' else 'fur', (14, G - 6), (14.4, G - 2), 2.3), E('skin' if kind != 'yeti' else 'fur', 15.6, G - 1.2, 3.2, 1.6)], sep=False))
    parts.append(Part('armF', 'torso', (13, shY), 0.7, [C('fur' if kind in ('yeti', 'mino') else 'skin', (13, shY), (11, G - 14), 2.7), C('skin' if kind != 'yeti' else 'fur', (11, G - 14), (11.6, G - 7), 2.3), E('skin' if kind != 'yeti' else 'face', 11.8, G - 5.6, 2.8, 2.4)]))
    # 몸통 (구부정)
    t = [E('fur', 18.5, G - 19, 9.2, 9.6), E('fur', 22.5, G - 24.5, 5.4, 4.6), E('belly', 21.5, G - 16.5, 5.6, 6.2)]
    if kind == 'hag':  # 늪 여왕: 이끼 낀 누더기 치마가 다리를 덮는다
        t = [E('skin', 18.5, G - 21, 7.6, 7.4), Pg('cloth', (10.4, G - 20), (26.4, G - 20), (30.6, G - 1), (6.4, G - 1)), Ln('moss2', (9, G - 4), (29, G - 4), 1.0)]
        for k in range(5): t.append(Pg('moss', (8 + k * 4.6, G - 1.5), (10 + k * 4.6, G + 0.5), (11.4 + k * 4.6, G - 1.5), flat=True))
        t += [E('moss', 14, G - 26, 2.2, 1.0, flat=True), E('moss', 22, G - 27, 1.8, 0.9, flat=True)]
    if kind == 'troll': t += [E('moss', 14, G - 27, 3.2, 1.4, flat=True), E('moss2', 13, G - 27.6, 1.6, 0.8, flat=True), E('moss', 19, G - 28.2, 2.2, 1.0, flat=True)]
    if kind == 'mino': t += [Ln('red', (12, G - 20), (25, G - 10), 1.4), E('gold', 18.4, G - 15.2, 0.9, 0.9, flat=True)]  # 가죽 띠
    parts.append(Part('torso', None, (18, G - 12), 2, t, tex=0.16 if kind in ('yeti', 'mino', 'troll') else 0.08))
    # 머리
    hx, hy = 28.6, G - 29.5
    if kind == 'troll':
        h = [E('skin', hx, hy, 5.0, 4.4), E('skin', hx + 4.6, hy + 1.6, 2.8, 2.0), Pg('skin', (hx - 3, hy - 2), (hx - 7.6, hy - 5.4), (hx - 3.6, hy + 0.6)),
             E('eye', hx + 1.4, hy - 1.0, 1.0, 0.9, flat=True), E('pupil', hx + 1.8, hy - 0.9, 0.45, 0.5, flat=True), Ln('mouth', (hx + 0.6, hy + 2.8), (hx + 3.6, hy + 2.8), 0.7), Pg('tusk', (hx + 2.2, hy + 3), (hx + 2.6, hy + 0.8), (hx + 3.2, hy + 3), flat=True)]
    elif kind == 'yeti':
        h = [E('fur', hx, hy - 0.4, 5.4, 5.2), E('face', hx + 1.8, hy + 0.8, 3.4, 3.4, flat=True), Pg('horn', (hx - 2.6, hy - 3.4), (hx - 5.2, hy - 8.2), (hx - 1.2, hy - 4.8)),
             E('eye', hx + 0.8, hy - 0.2, 0.9, 0.8, flat=True), E('eye', hx + 3.4, hy - 0.2, 0.8, 0.8, flat=True), E('mouth', hx + 2.4, hy + 2.6, 1.6, 0.8, flat=True), Pg('tusk', (hx + 1.2, hy + 2.2), (hx + 1.6, hy + 3.6), (hx + 2.0, hy + 2.2), flat=True), Pg('tusk', (hx + 3.0, hy + 2.2), (hx + 3.4, hy + 3.6), (hx + 3.8, hy + 2.2), flat=True)]
    elif kind == 'mino':
        h = [E('fur', hx, hy, 4.8, 4.6), E('face', hx + 4.4, hy + 1.8, 3.0, 2.4), Pg('horn', (hx - 1, hy - 3.4), (hx - 3.6, hy - 6.4), (hx - 1.8, hy - 9.6), (hx + 0.4, hy - 6.8), (hx + 1.4, hy - 3.6)),
             Pg('horn', (hx + 2.4, hy - 3.4), (hx + 5.6, hy - 5.8), (hx + 7.0, hy - 9.0), (hx + 5.0, hy - 4.2), (hx + 3.6, hy - 2.8)),
             E('red', hx + 1.2, hy - 0.6, 1.0, 0.8, flat=True), E('pupil', hx + 1.6, hy - 0.6, 0.4, 0.5, flat=True), E('pupil', hx + 6.4, hy + 1.2, 0.5, 0.5, flat=True), Ln('gold', (hx + 6.6, hy + 2.4), (hx + 6.6, hy + 4.0), 0.9), E('gold', hx + 6.6, hy + 4.0, 1.0, 0.8, flat=True)]
    else:  # hag
        h = [Pg('hair', (hx - 5.0, hy - 1), (hx - 1, hy - 5.2), (hx + 3.6, hy - 3.6), (hx - 2.4, hy + 1.4), (hx - 6.4, hy + 12), (hx - 9.6, hy + 11)),
             E('skin', hx, hy, 4.4, 4.4), E('skin', hx + 4.2, hy + 1.2, 2.0, 1.2), Pg('gold', (hx - 3.6, hy - 3.4), (hx - 3.2, hy - 8.0), (hx - 1.4, hy - 5.0), (hx + 0.4, hy - 8.8), (hx + 1.8, hy - 5.0), (hx + 3.8, hy - 7.6), (hx + 3.6, hy - 3.2), flat=True),
             E('red', hx + 0.4, hy - 6.0, 0.7, 0.7, flat=True), E('eye', hx + 1.4, hy - 0.4, 1.0, 0.9, flat=True), E('pupil', hx + 1.8, hy - 0.3, 0.45, 0.5, flat=True), Ln('mouth', (hx + 0.8, hy + 2.6), (hx + 3.0, hy + 2.4), 0.6)]
    parts.append(Part('head', 'torso', (24, G - 27), 3, h, tex=0.1 if kind in ('yeti', 'mino') else 0.04))
    # 앞 다리
    if kind != 'hag':
        parts.append(Part('legN', 'torso', (21, hipY), 2.4, [C('fur', (21, hipY), (21.6, G - 6), 3.1), C('skin' if kind != 'yeti' else 'fur', (21.6, G - 6), (21.6, G - 2), 2.4), E('skin' if kind != 'yeti' else 'fur', 23.2, G - 1.2, 3.4, 1.6), Ln('nail', (25.2, G - 1.4), (26.2, G - 1.4), 0.7)], sep=False))
    # 앞 팔 + 무기
    a = [C('fur' if kind in ('yeti', 'mino') else 'skin', (21.6, shY + 1.5), (25.4, G - 13), 2.9), C('skin' if kind != 'yeti' else 'fur', (25.4, G - 13), (27, G - 7.5), 2.4), E('skin' if kind != 'yeti' else 'face', 27.6, G - 5.8, 3.0, 2.6)]
    wpn = extra.get('weapon')
    if wpn == 'club': a = [C('wood', (28.4, G - 5), (34.6, G - 21), 1.4), E('wood', 34.6, G - 22, 3.0, 3.6), E('moss2', 33.4, G - 23.4, 0.7, 0.7, flat=True), E('moss2', 35.6, G - 21.2, 0.6, 0.6, flat=True)] + a
    if wpn == 'axe': a = [C('wood', (28.4, G - 3), (33.2, G - 30), 1.1), Pg('iron', (32.6, G - 31), (37.6, G - 34), (37.6, G - 23.6), (33.4, G - 25)), Pg('iron', (32.6, G - 26.6), (28.6, G - 30.4), (28.4, G - 23.2), (32.4, G - 24))] + a
    if wpn == 'staff': a = [C('wood', (28.4, G - 2), (31.0, G - 33), 1.0), E('gold', 31.2, G - 34, 1.9, 1.9, flat=True), E('moss', 31.2, G - 34, 0.9, 0.9, flat=True)] + a
    parts.append(Part('armN', 'torso', (21.6, shY + 1.5), 3.4, a))
    m = Model(W, H, parts, ramps, OUT, flats, offset=(2, 0))

    def idle(i, f): return {'torso': (0, 0, [0, 0, 1, 1][i]), 'head': (2 * sn(f),), 'armN': (4 * sn(f),), 'armF': (-4 * sn(f),)}

    def run(i, f): return {'torso': (5, 0, -round(abs(sn(f)) * 1.5)), 'head': (-4,), 'legN': (26 * sn(f),), 'legF': (-26 * sn(f),), 'armN': (-24 * sn(f) - 6,), 'armF': (24 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 4) 골렘 · 석상 (용암 골렘 · 얼음 골렘 · 고대 골렘 · 유적 파수꾼) ═════════
def golem(stone, crack, eye, extra=()):
    W, H = 42, 42
    G = H - 1
    ramps = {'st': ramp(stone), 'st2': ramp(shade(stone, -0.12)), 'cry': ramp(extra and 'ice' in extra and '#c8f4ff' or shade(stone, 0.2))}
    flats = {'crack': crack, 'eye': eye, 'moss': '#5a9a3a', 'moss2': '#3a6a2a', 'drip': shade(crack, 0.3), 'rune': eye}
    parts = [
        Part('legF', 'torso', (14, G - 11), 0.6, [Pg('st2', (11, G - 12), (17, G - 12), (17.4, G - 1), (10.6, G - 1))], sep=False),
        Part('armF', 'torso', (11, G - 26), 0.7, [E('st2', 10, G - 24, 4.0, 4.2), Pg('st2', (7.6, G - 22), (12.6, G - 22), (12.2, G - 13), (7.4, G - 13)), E('st2', 9.6, G - 10.6, 3.8, 3.4)]),
    ]
    t = [Pg('st', (8, G - 29), (28, G - 30), (30, G - 15), (25, G - 10), (11, G - 10), (6.6, G - 16)), Ln('crack', (14, G - 27), (17, G - 21), 0.8), Ln('crack', (17, G - 21), (15.4, G - 15), 0.8), Ln('crack', (22, G - 26), (24.6, G - 19), 0.8)]
    if 'moss' in extra: t += [E('moss', 12, G - 28.6, 3.6, 1.3, flat=True), E('moss2', 13, G - 28, 1.6, 0.7, flat=True), E('moss', 25, G - 29.2, 2.4, 1.0, flat=True)]
    if 'ice' in extra: t += [Pg('cry', (9.4, G - 29), (10.6, G - 36), (13.4, G - 29.4)), Pg('cry', (13.6, G - 29.4), (16.4, G - 35), (17.6, G - 29.6)), Pg('cry', (24, G - 30), (27.4, G - 35.4), (27.6, G - 29.6))]
    if 'rune' in extra: t += [E('rune', 18, G - 20, 2.2, 2.2, flat=True), E('st', 18, G - 20, 1.2, 1.2), Ln('rune', (18, G - 24), (18, G - 16), 0.6), Ln('rune', (14, G - 20), (22, G - 20), 0.6)]
    if 'lava' in extra: t += [E('crack', 19.4, G - 18, 2.6, 2.0, flat=True), E('drip', 19.4, G - 18.2, 1.2, 0.9, flat=True)]
    parts.append(Part('torso', None, (18, G - 10), 2, t, tex=0.2))
    hx, hy = 23.5, G - 31
    if 'helm' in extra:  # 유적 파수꾼: 볏 달린 투구 모양으로 깎은 머리
        h = [Pg('st', (hx - 4.4, hy + 3.4), (hx - 4.6, hy - 2.6), (hx - 1.4, hy - 5.4), (hx + 3.6, hy - 4.6), (hx + 5.0, hy - 0.4), (hx + 4.6, hy + 3.4)), Pg('st2', (hx - 3.6, hy - 4.2), (hx - 1.0, hy - 9.4), (hx + 1.6, hy - 5.0)),
             Ln('eye', (hx - 0.2, hy - 0.2), (hx + 4.4, hy - 0.2), 1.1)]
    else:
        h = [Pg('st', (hx - 4.2, hy + 3.8), (hx - 4.4, hy - 2.4), (hx - 0.6, hy - 4.8), (hx + 3.8, hy - 3.6), (hx + 4.8, hy + 1.4), (hx + 3.4, hy + 3.8)), E('eye', hx + 1.2, hy - 0.4, 1.0, 0.8, flat=True), E('eye', hx + 3.6, hy - 0.4, 0.8, 0.8, flat=True), Ln('crack', (hx - 2, hy + 2.4), (hx + 3, hy + 2.6), 0.6)]
    parts.append(Part('head', 'torso', (22, G - 28), 2.6, h, tex=0.18))
    parts.append(Part('legN', 'torso', (22, G - 11), 2.4, [Pg('st', (18.6, G - 12), (25.4, G - 12), (26.2, G - 1), (18.2, G - 1)), Ln('crack', (21, G - 9), (22.4, G - 4), 0.7)], sep=False))
    a = [E('st', 27, G - 25, 4.6, 4.6), Pg('st', (24.6, G - 22), (30.4, G - 22), (30.6, G - 12.4), (24.6, G - 12.4)), E('st', 28.2, G - 9.6, 4.6, 4.0), Ln('crack', (26.6, G - 11), (29.6, G - 8.6), 0.7)]
    if 'ice' in extra: a.insert(0, Pg('cry', (25, G - 28), (27.6, G - 35.6), (30.2, G - 27.6)))
    if 'spear' in extra: a = [C('st2', (29, G + 0), (33, G - 34), 0.9), Pg('st', (31.6, G - 33.6), (33.4, G - 40), (35.2, G - 33.2))] + a
    parts.append(Part('armN', 'torso', (27, G - 26), 3.2, a, tex=0.2))
    m = Model(W, H, parts, ramps, OUT, flats, offset=(3, 0))

    def idle(i, f): return {'torso': (0, 0, [0, 0, 1, 1][i]), 'head': (1.5 * sn(f),), 'armN': (3 * sn(f),), 'armF': (-3 * sn(f),)}

    def run(i, f): return {'torso': (3 * sn(f), 0, -round(abs(sn(f)))), 'legN': (0, 3 * sn(f), -max(0, 2 * sn(f))), 'legF': (0, -3 * sn(f), -max(0, -2 * sn(f))), 'armN': (-18 * sn(f),), 'armF': (18 * sn(f),), 'head': (-2,)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 5) 거미 (유리 거미) ═════════
def spider(body, accent):
    W, H = 36, 26
    G = H - 1
    ramps = {'b': ramp(body), 'leg': ramp(shade(body, -0.15)), 'cry': ramp(accent)}
    flats = {'eye': '#ff4a6a', 'shine': '#ffffff', 'fang': '#e8f8ff'}
    parts = []
    bx, by = 15, G - 9
    legs = [(-1, 'F', 0.5), (1, 'N', 2.6)]
    for side, nm, z in legs:
        for k in range(4):
            sx = bx + 1 + k * 2.4
            reach = [-11, -5, 4, 10][k]
            knee = (sx + reach * 0.45, by - 7 - (1 if side > 0 else 0))
            foot = (sx + reach, G - 0.5 - (0 if side > 0 else 1))
            parts.append(Part('leg%s%d' % (nm, k), 'body', (sx, by), z + k * 0.01, [C('leg', (sx, by), knee, 1.0 if side > 0 else 0.85), C('leg', knee, foot, 0.85 if side > 0 else 0.7)], sep=False))
    parts.append(Part('body', None, (bx, by), 2, [E('b', 9.6, by - 1.4, 7.2, 5.6), Pg('cry', (5, by - 5), (6.4, by - 11), (8.6, by - 5.6)), Pg('cry', (9, by - 6.4), (11.2, by - 12.4), (12.8, by - 6)), Pg('cry', (3.2, by - 2), (1.0, by - 6.6), (5.2, by - 4)),
                                                  E('shine', 7.6, by - 3.6, 1.4, 0.8, flat=True), E('b', 19.6, by, 4.4, 3.6), E('eye', 22.4, by - 1.4, 0.7, 0.7, flat=True), E('eye', 23.6, by - 0.4, 0.6, 0.6, flat=True), E('eye', 21.6, by - 0.2, 0.5, 0.5, flat=True),
                                                  Pg('fang', (23, by + 1.6), (23.6, by + 4), (24.2, by + 1.4), flat=True)], tex=0.1))
    m = Model(W, H, parts, ramps, OUT, flats)
    names = ['leg%s%d' % (nm, k) for _, nm, _ in legs for k in range(4)]

    def idle(i, f): return {'body': (0, 0, 0.6 * sn(f)), **{n: (3 * sn(f + j),) for j, n in enumerate(names)}}

    def run(i, f): return {'body': (0, 0, -abs(sn(f))), **{n: (16 * sn(f + (j % 2) * PI + (0 if j < 4 else PI)),) for j, n in enumerate(names)}}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 6) 웅크린 잠복자 (동굴 · 진흙 · 눈 잠복자) ═════════
def lurker(body, belly, eye, kind):
    W, H = 28, 22
    G = H - 1
    ramps = {'b': ramp(body), 'u': ramp(belly), 'claw': ramp('#e8e0cc')}
    flats = {'eye': eye, 'pupil': '#120a10', 'mouth': '#2a0a10', 'tooth': '#f4ecd8', 'drip': shade(body, -0.3), 'frost': '#e8f8ff'}
    parts = [
        Part('legF', 'body', (9, G - 6), 0.6, [C('b', (9, G - 6), (6.6, G - 1.6), 2.0), E('b', 7.4, G - 0.8, 2.6, 1.2)], sep=False),
        Part('armF', 'body', (17, G - 9), 0.7, [C('b', (17, G - 9), (19, G - 2), 1.4), Ln('claw', (19, G - 1.2), (21.4, G - 0.6), 0.9, flat=False)]),
    ]
    b = [E('b', 12, G - 7, 8.4, 5.6), E('u', 14, G - 4.6, 6.0, 2.8)]
    if kind == 'mud': b += [E('drip', 8, G - 2, 0.9, 1.6, flat=True), E('drip', 14, G - 1.4, 0.8, 1.2, flat=True), E('drip', 5, G - 9.6, 1.6, 0.8, flat=True)]
    if kind == 'snow': b += [Pg('frost', (6, G - 11.4), (7.6, G - 14), (9.4, G - 11.6), flat=True), Pg('frost', (10, G - 12.2), (12, G - 14.6), (13.4, G - 12.2), flat=True)]
    if kind == 'cave': b += [Pg('b', (6, G - 10), (2.4, G - 15), (8.4, G - 11.6))]
    parts.append(Part('body', None, (12, G - 6), 2, b, tex=0.16 if kind == 'snow' else 0.1))
    hx, hy = 20.5, G - 9
    h = [E('b', hx, hy, 5.0, 4.4), E('eye', hx + 1.0, hy - 1.2, 1.8, 1.8, flat=True), E('pupil', hx + 1.5, hy - 1.0, 0.7, 1.1, flat=True), E('eye', hx + 4.0, hy - 0.8, 1.2, 1.3, flat=True), E('pupil', hx + 4.3, hy - 0.7, 0.5, 0.8, flat=True),
         E('mouth', hx + 2.4, hy + 2.4, 2.2, 0.8, flat=True), Pg('tooth', (hx + 1, hy + 1.9), (hx + 1.4, hy + 3.0), (hx + 1.8, hy + 1.9), flat=True), Pg('tooth', (hx + 3.0, hy + 1.9), (hx + 3.4, hy + 3.0), (hx + 3.8, hy + 1.9), flat=True)]
    if kind == 'cave': h.insert(0, Pg('b', (hx - 2, hy - 2.6), (hx - 6.4, hy - 7.4), (hx - 0.4, hy - 4.2)))
    parts.append(Part('head', 'body', (18, G - 8), 3, h, tex=0.08))
    parts.append(Part('legN', 'body', (13, G - 5), 2.4, [C('b', (13, G - 5), (10.6, G - 1.6), 2.2), E('b', 11.6, G - 0.8, 2.8, 1.2)], sep=False))
    parts.append(Part('armN', 'body', (20, G - 7), 3.4, [C('b', (20, G - 7), (23.2, G - 2), 1.5), Ln('claw', (23.2, G - 1.2), (25.8, G - 0.8), 0.9, flat=False), Ln('claw', (22.4, G - 0.8), (24.2, G - 0.2), 0.8, flat=False)]))
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'body': (0, 0, 0.5 * sn(f), 1 + 0.03 * sn(f), 1 - 0.04 * sn(f)), 'head': (3 * sn(f),)}

    def run(i, f): return {'body': (-4 * sn(f), 0, -round(abs(sn(f)) * 2)), 'armN': (-30 * sn(f),), 'armF': (30 * sn(f),), 'legN': (25 * sn(f),), 'legF': (-25 * sn(f),), 'head': (4 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 7) 가스 부풀이 (떠다니는 독 주머니) ═════════
def bloat(body, vein):
    W, H = 26, 28
    ramps = {'b': ramp(body), 't': ramp(shade(body, -0.2))}
    flats = {'vein': vein, 'eye': '#1a0e10', 'eyeW': '#f8f0c0', 'mouth': '#3a1a10', 'spot': shade(body, 0.3)}
    parts = []
    for k, x in enumerate((8, 12, 16, 19)):
        parts.append(Part('t%d' % k, 'b', (x, 18), 0.6 + k * 0.01, [C('t', (x, 18), (x - 0.6, 23), 0.9), C('t', (x - 0.6, 23), (x + 0.4, 26.4), 0.7)], sep=False))
    parts.append(Part('b', None, (13, 12), 2, [E('b', 13, 11.5, 10.4, 8.6), Ln('vein', (6, 6), (9, 11), 0.6), Ln('vein', (9, 11), (7, 16), 0.6), Ln('vein', (17, 5), (15, 10), 0.6), Ln('vein', (15, 10), (19, 14), 0.6),
                                                E('spot', 9, 6.6, 2.0, 1.2, flat=True), E('eyeW', 17.8, 10.6, 1.6, 1.8, flat=True), E('eye', 18.2, 10.8, 0.7, 1.0, flat=True), E('mouth', 18.6, 15, 2.0, 1.0, flat=True)], tex=0.1))
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'b': (0, 0, sn(f), 1 + 0.06 * sn(f), 1 + 0.06 * sn(f)), **{'t%d' % k: (10 * sn(f + k),) for k in range(4)}}

    def run(i, f): return {'b': (6, 0, sn(f) * 1.5, 1 - 0.04 * sn(f), 1 + 0.05 * sn(f)), **{'t%d' % k: (-20 + 10 * sn(f + k),) for k in range(4)}}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 8) 독 뱉는 개구리 ═════════
def frog(body, belly, spot):
    W, H = 26, 20
    G = H - 1
    ramps = {'b': ramp(body), 'u': ramp(belly), 'sac': ramp(shade(belly, 0.1))}
    flats = {'spot': spot, 'eye': '#1a0e10', 'eyeW': '#ffe04a', 'mouth': '#3a0e1a', 'drip': '#b8f04a'}
    parts = [
        Part('legF', 'b', (8, G - 5), 0.6, [C('b', (8, G - 5), (5, G - 1.4), 2.2), E('b', 4.6, G - 0.8, 3.0, 1.0)], sep=False),
        Part('b', None, (12, G - 4), 2, [E('b', 12, G - 6.4, 8.2, 5.6), E('u', 14.6, G - 3.6, 5.6, 2.6), E('spot', 8.6, G - 9.6, 1.4, 1.1, flat=True), E('spot', 12.4, G - 11, 1.1, 0.9, flat=True), E('spot', 6.6, G - 6.4, 1.0, 0.9, flat=True)], tex=0.08),
        Part('head', 'b', (17, G - 8), 2.6, [E('b', 19, G - 8, 5.4, 4.0), E('sac', 20.6, G - 4.6, 3.2, 2.2), E('b', 18, G - 12, 2.2, 2.2), E('eyeW', 18.4, G - 12.4, 1.5, 1.5, flat=True), E('eye', 18.8, G - 12.2, 0.6, 1.0, flat=True),
                                             Ln('mouth', (17.4, G - 7), (24, G - 7.4), 0.7), E('drip', 24.2, G - 6.2, 0.6, 1.1, flat=True), E('spot', 21, G - 9.8, 0.9, 0.7, flat=True)], tex=0.06),
        Part('legN', 'b', (12, G - 4), 2.4, [C('b', (12, G - 4), (9.6, G - 1.2), 2.4), E('b', 9.6, G - 0.6, 3.2, 1.1)], sep=False),
        Part('armN', 'b', (19, G - 4), 2.8, [C('b', (19, G - 4), (20, G - 0.8), 1.1), E('b', 21, G - 0.4, 1.8, 0.8)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'b': (0, 0, 0, 1, 1 + 0.03 * sn(f)), 'head': (0, 0, 0, 1, 1), 'legN': (0,)}

    def run(i, f):
        up = [0, 3, 2, 0][i]
        return {'b': ([0, -10, -6, 4][i], 0, -up), 'legN': ([0, 50, 40, 0][i],), 'legF': ([0, 50, 40, 0][i],), 'armN': ([0, -20, -10, 10][i],)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 9) 산호 게 ═════════
def crab(shell, claw, coral):
    W, H = 30, 20
    G = H - 1
    ramps = {'s': ramp(shell), 'c': ramp(claw), 'leg': ramp(shade(shell, -0.1)), 'co': ramp(coral)}
    flats = {'eye': '#1a0e10', 'co2': shade(coral, 0.35)}
    parts = []
    for side, nm, z in ((-1, 'F', 0.5), (1, 'N', 2.4)):
        for k in range(3):
            sx = 10 + k * 4
            parts.append(Part('leg%s%d' % (nm, k), 'body', (sx, G - 6), z + k * 0.01, [C('leg', (sx, G - 6), (sx - 3 + k, G - 4), 0.9), C('leg', (sx - 3 + k, G - 4), (sx - 4.4 + k * 1.4, G - 0.5), 0.75)], sep=False))
    parts.append(Part('clawF', 'body', (21, G - 8), 0.7, [C('c', (21, G - 8), (24.6, G - 11), 1.2), E('c', 26, G - 12.4, 2.6, 2.0)]))
    parts.append(Part('body', None, (15, G - 6), 2, [E('s', 15, G - 7.6, 9.0, 4.6), E('s', 15.6, G - 5.4, 8.0, 2.6), Pg('co', (8, G - 11), (7.2, G - 16.4), (9.6, G - 13), (10.6, G - 17.2), (11.6, G - 11.6)),
                                                    Pg('co', (14.6, G - 12), (15.6, G - 15.6), (17.4, G - 12.2)), E('co2', 10.4, G - 16.6, 0.7, 0.7, flat=True), E('co2', 7.4, G - 15.8, 0.6, 0.6, flat=True),
                                                    C('s', (19.6, G - 10.4), (20.6, G - 14), 0.55), C('s', (21.4, G - 10), (23, G - 13.2), 0.55), E('eye', 20.6, G - 14.4, 0.9, 0.9, flat=True), E('eye', 23.2, G - 13.6, 0.9, 0.9, flat=True)], tex=0.14))
    parts.append(Part('clawN', 'body', (22, G - 6), 3, [C('c', (22, G - 6), (25.6, G - 7), 1.4), E('c', 27.2, G - 7.6, 2.8, 2.4), Pg('c', (27, G - 9.6), (29.6, G - 11), (29.4, G - 8.2)), Pg('s', (27.2, G - 6.6), (29.8, G - 5.4), (27.8, G - 5.0))]))
    m = Model(W, H, parts, ramps, OUT, flats)
    names = ['leg%s%d' % (nm, k) for nm in 'FN' for k in range(3)]

    def idle(i, f): return {'body': (0, 0, 0.4 * sn(f)), 'clawN': (8 * sn(f),), 'clawF': (-6 * sn(f),)}

    def run(i, f): return {'body': (0, 0, -abs(sn(f))), 'clawN': (-10 + 10 * sn(f),), 'clawF': (10 * sn(f),), **{n: (22 * sn(f + j * PI / 1.5),) for j, n in enumerate(names)}}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 10) 해파리 ═════════
def jelly(bell, glow):
    W, H = 22, 28
    ramps = {'bell': ramp(bell), 'in': ramp(shade(bell, 0.3)), 't': ramp(shade(bell, -0.1))}
    flats = {'glow': glow, 'core': shade(glow, 0.5)}
    parts = []
    for k, x in enumerate((6, 9, 12, 15)):
        parts.append(Part('t%d' % k, 'bell', (x, 11), 0.6 + k * 0.01, [C('t', (x, 11), (x + 0.8, 16.6), 0.7), C('t', (x + 0.8, 16.6), (x - 0.4, 22.4), 0.6), C('t', (x - 0.4, 22.4), (x + 0.6, 26.6), 0.5)], sep=False))
    parts.append(Part('arm', 'bell', (11, 11), 0.9, [C('in', (10, 11), (11, 18), 1.6), C('in', (11, 18), (10, 21), 1.0)], sep=False))
    parts.append(Part('bell', None, (11, 7), 2, [Pg('bell', (1.4, 11.6), (2.2, 6.6), (5.4, 2.6), (11, 1.2), (16.6, 2.6), (19.8, 6.6), (20.6, 11.6), (17.4, 10.6), (14.6, 12), (11, 10.8), (7.4, 12), (4.6, 10.6)),
                                                 E('glow', 11, 6.6, 3.4, 2.6, flat=True), E('core', 11, 6.2, 1.6, 1.1, flat=True), E('in', 6.4, 4.8, 1.6, 0.9)], tex=0.05))
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'bell': (0, 0, sn(f), 1 + 0.08 * sn(f), 1 - 0.08 * sn(f)), **{'t%d' % k: (10 * sn(f + k * 0.8),) for k in range(4)}, 'arm': (6 * sn(f),)}

    def run(i, f): return {'bell': (8, 0, -1.5 * sn(f), 1 - 0.1 * sn(f), 1 + 0.1 * sn(f)), **{'t%d' % k: (-14 + 12 * sn(f + k * 0.8),) for k in range(4)}, 'arm': (-10,)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 11) 나는 벌레 · 가시 요정 ═════════
def wasp(body, stripe, wing):
    W, H = 26, 22
    ramps = {'b': ramp(body), 'st': ramp(stripe), 'leg': ramp('#2a2018')}
    flats = {'wing': wing, 'wing2': shade(wing, -0.15), 'eye': '#c83a2a', 'sting': '#f4ecd8'}
    parts = [
        Part('wingF', 'b', (12, 8), 0.5, [Pg('wing2', (12, 8), (6, 1.4), (3.4, 3.6), (9.6, 9.4), flat=True)], sep=False),
        Part('legs', 'b', (13, 12), 0.8, [Ln('leg', (11, 12), (9.6, 17), 0.7, flat=False), Ln('leg', (13, 12.4), (12.6, 17.6), 0.7, flat=False), Ln('leg', (15, 12), (16, 16.6), 0.7, flat=False)], sep=False),
        Part('b', None, (13, 10), 2, [E('st', 7, 12.6, 5.0, 3.4), Ln('b', (4.4, 10.6), (5.6, 15.4), 1.2, flat=False), Ln('b', (7.6, 9.4), (8.6, 15.8), 1.2, flat=False), Pg('sting', (2.2, 13.2), (-0.6, 16.6), (3.4, 14.6), flat=True),
                                       E('b', 13.6, 10, 3.2, 2.8), E('b', 18.6, 9.0, 3.0, 2.8), E('eye', 19.8, 8.4, 1.3, 1.6, flat=True), Ln('leg', (20.6, 11), (22.4, 12.6), 0.6, flat=False), Ln('leg', (18.6, 6.6), (20.6, 3.4), 0.5, flat=False)], tex=0.06),
        Part('wingN', 'b', (13, 8), 2.6, [Pg('wing', (13, 8), (9.4, 0.4), (6.2, 1.4), (10.4, 9.2), flat=True)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'b': (0, 0, sn(f)), 'wingN': ([0, -40, 0, -40][i],), 'wingF': ([-40, 0, -40, 0][i],)}

    def run(i, f): return {'b': (12, 0, sn(f)), 'wingN': ([0, -45, 0, -45][i],), 'wingF': ([-45, 0, -45, 0][i],), 'legs': (20,)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


def sprite_fairy(body, leaf, glow):
    W, H = 22, 24
    ramps = {'b': ramp(body), 'leaf': ramp(leaf), 'th': ramp('#6a4a2a')}
    flats = {'glow': glow, 'eye': glow, 'wing': '#e8fff0', 'wing2': '#b8e8d0'}
    parts = [
        Part('wingF', 'b', (9, 10), 0.5, [Pg('wing2', (9, 10), (3.4, 4), (2, 8.4), (7.4, 12), flat=True)], sep=False),
        Part('b', None, (11, 14), 2, [Pg('leaf', (7.6, 13), (14.4, 13), (15, 20.4), (11, 22.6), (7, 20.4)), Ln('th', (11, 13.4), (11, 21.6), 0.6, flat=False),
                                       E('b', 11.6, 9.4, 4.0, 3.8), Pg('th', (8.6, 6.4), (8.4, 2.4), (9.8, 5.6)), Pg('th', (11.2, 5.8), (11.8, 1.4), (12.8, 5.8)), Pg('th', (13.6, 6.4), (15.4, 3.0), (15.0, 7.0)),
                                       E('eye', 12.8, 9.4, 0.8, 1.0, flat=True), E('eye', 15.0, 9.2, 0.6, 0.9, flat=True), E('glow', 11, 17, 1.2, 1.2, flat=True)], tex=0.05),
        Part('wingN', 'b', (11, 10), 2.6, [Pg('wing', (11, 10), (8, 2.6), (5.4, 4), (8.6, 12), flat=True)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'b': (4 * sn(f), 0, sn(f)), 'wingN': ([0, -35, -10, -35][i],), 'wingF': ([-35, 0, -35, -10][i],)}

    def run(i, f): return {'b': (14, 0, sn(f)), 'wingN': ([0, -40, 0, -40][i],), 'wingF': ([-40, 0, -40, 0][i],)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


def bat(body, wing, eye):
    W, H = 26, 20
    ramps = {'b': ramp(body), 'w': ramp(wing)}
    flats = {'eye': eye, 'fang': '#f4ecd8', 'memb': shade(wing, 0.2), 'ear': shade(body, 0.3)}
    parts = [
        Part('wingF', 'b', (12, 9), 0.5, [Pg('w', (12, 9), (6, 3), (1, 5), (2.6, 9), (1.4, 12), (5, 11.4), (7, 14), (10.4, 11.6))], sep=False),
        Part('b', None, (13, 10), 2, [E('b', 13, 10.4, 3.4, 4.2), E('b', 14, 5.8, 2.8, 2.6), Pg('b', (12, 4), (11.4, 0.6), (13.4, 3.4)), Pg('b', (14.6, 3.4), (16.4, 0.4), (16.2, 4.2)), E('ear', 15.6, 2.6, 0.5, 0.9, flat=True),
                                       E('eye', 15.2, 5.6, 0.8, 0.8, flat=True), Pg('fang', (15.4, 7.4), (15.8, 8.8), (16.2, 7.4), flat=True), C('b', (12, 14), (11, 16.6), 0.6), C('b', (14, 14), (14.6, 16.6), 0.6)], tex=0.1),
        Part('wingN', 'b', (14, 9), 2.6, [Pg('w', (14, 9), (20, 2.6), (25, 4.6), (23.4, 8.6), (24.6, 12), (21, 11.4), (19, 14), (15.6, 11.6)), Pg('memb', (16, 9.4), (20, 4.4), (22.6, 9.6), (19.4, 11.6), flat=True)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'b': (0, 0, 1.2 * sn(f)), 'wingN': ([0, -30, -50, -20][i],), 'wingF': ([0, 30, 50, 20][i],)}

    def run(i, f): return {'b': (10, 0, 1.2 * sn(f)), 'wingN': ([10, -30, -55, -20][i],), 'wingF': ([-10, 30, 55, 20][i],)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


def turtle(shell, skin):
    W, H = 30, 22
    G = H - 1
    ramps = {'sh': ramp(shell), 'sk': ramp(skin), 'rim': ramp(shade(shell, 0.3))}
    flats = {'eye': '#1a0e08', 'eyeW': '#f8f0e0', 'plate': shade(shell, -0.35), 'mouth': '#4a3a2a', 'brow': '#e8e0d0'}
    parts = [
        Part('lF', 'body', (9, G - 5), 0.5, [C('sk', (9, G - 5), (7.4, G - 1.2), 1.8), E('sk', 7, G - 0.8, 2.2, 0.9)], sep=False),
        Part('lF2', 'body', (19, G - 5), 0.55, [C('sk', (19, G - 5), (20.4, G - 1.2), 1.8), E('sk', 21, G - 0.8, 2.2, 0.9)], sep=False),
        Part('tail', 'body', (5, G - 5), 0.8, [Pg('sk', (6, G - 6), (1.6, G - 4.4), (6, G - 3.6))], sep=False),
        Part('body', None, (14, G - 6), 2, [Pg('sh', (4, G - 4.6), (5.4, G - 10.6), (9.4, G - 14), (15, G - 14.8), (20.4, G - 13), (23.4, G - 8.6), (24, G - 4.6)), E('rim', 14, G - 4.6, 10.6, 1.6),
                                             Ln('plate', (9.4, G - 13.4), (8.4, G - 5.2), 0.7), Ln('plate', (14.8, G - 14.4), (14.8, G - 5.4), 0.7), Ln('plate', (20, G - 12.4), (20.4, G - 5.2), 0.7), Ln('plate', (5.6, G - 9.4), (23, G - 9.0), 0.7)], tex=0.06),
        Part('head', 'body', (22, G - 6), 3, [C('sk', (22, G - 6), (25, G - 9), 2.2), E('sk', 26.2, G - 10, 3.0, 2.6), E('eyeW', 26.8, G - 10.8, 1.0, 1.0, flat=True), E('eye', 27.2, G - 10.7, 0.5, 0.7, flat=True),
                                               Ln('brow', (25.6, G - 12.2), (27.6, G - 12.0), 0.6), Ln('mouth', (26.6, G - 8.6), (28.6, G - 8.8), 0.5), Pg('brow', (27.4, G - 8.4), (28.4, G - 5.4), (29, G - 8.6), flat=True)], tex=0.04),
        Part('lN', 'body', (11, G - 4), 2.4, [C('sk', (11, G - 4), (10, G - 1.2), 1.9), E('sk', 9.8, G - 0.8, 2.3, 0.9)], sep=False),
        Part('lN2', 'body', (20, G - 4), 2.45, [C('sk', (20, G - 4), (21.6, G - 1.2), 1.9), E('sk', 22.2, G - 0.8, 2.3, 0.9)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'body': (0, 0, [0, 0, 1, 1][i] * 0.5), 'head': (5 * sn(f),), 'tail': (8 * sn(f),)}

    def run(i, f): return {'body': (0, 0, -abs(sn(f)) * 0.6), 'lN': (20 * sn(f),), 'lF2': (20 * sn(f),), 'lF': (-20 * sn(f),), 'lN2': (-20 * sn(f),), 'head': (-4,)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 12) 덩굴 정령 ═════════
def vine(body, leaf, flower):
    W, H = 28, 32
    G = H - 1
    ramps = {'v': ramp(body), 'leaf': ramp(leaf), 'fl': ramp(flower)}
    flats = {'eye': '#ffe86a', 'pupil': '#1a1408', 'core': '#ffd040'}
    parts = [
        Part('armF', 'body', (11, G - 18), 0.6, [C('v', (11, G - 18), (6, G - 12), 1.3), C('v', (6, G - 12), (3, G - 16), 1.0), E('leaf', 2.6, G - 17.6, 2.0, 1.2)], sep=False),
        Part('roots', 'body', (14, G - 6), 0.8, [C('v', (12, G - 6), (8, G - 0.6), 1.3), C('v', (14, G - 6), (14, G - 0.4), 1.4), C('v', (16, G - 6), (20.6, G - 0.6), 1.3)], sep=False),
        Part('body', None, (14, G - 6), 2, [C('v', (14, G - 5), (13, G - 20), 3.4), C('v', (11.6, G - 8), (15.4, G - 15), 1.4), E('leaf', 10, G - 12, 2.6, 1.4), E('leaf', 17.4, G - 16, 2.6, 1.4), E('leaf', 11, G - 19, 2.2, 1.2)], tex=0.14),
        Part('head', 'body', (14, G - 21), 3, [Pg('fl', (8.4, G - 24), (10, G - 30.6), (13.4, G - 27), (17, G - 30.6), (19.6, G - 24.6), (18, G - 20.4), (10.6, G - 20.4)),
                                                E('core', 14.4, G - 24.4, 3.6, 3.0, flat=True), E('eye', 15.2, G - 24.6, 1.8, 1.8, flat=True), E('pupil', 15.8, G - 24.4, 0.6, 1.2, flat=True)], tex=0.06),
        Part('armN', 'body', (16, G - 17), 3.4, [C('v', (16, G - 17), (22, G - 12), 1.4), C('v', (22, G - 12), (25.6, G - 16.4), 1.0), Pg('v', (25, G - 17), (27.4, G - 19.6), (26.4, G - 15.2))], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'body': (3 * sn(f),), 'head': (-4 * sn(f),), 'armN': (12 * sn(f),), 'armF': (-12 * sn(f),), 'roots': (0,)}

    def run(i, f): return {'body': (8 + 3 * sn(f), 0, -abs(sn(f))), 'head': (-6,), 'armN': (-30 * sn(f),), 'armF': (30 * sn(f),), 'roots': (10 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 13) 네발짐승 (하이에나 · 돌진 멧돼지 · 마차 말) ═════════
def quad(kind, body, belly, mane, spots=None):
    big = kind == 'horse'
    W, H = (38, 32) if big else (32, 22)
    G = H - 1
    ramps = {'b': ramp(body), 'u': ramp(belly), 'm': ramp(mane), 'hoof': ramp('#3a2a20'), 'tusk': ramp('#f0e8d0'), 'har': ramp('#6a3a1e')}
    flats = {'eye': '#1a0e08', 'spot': spots or shade(body, -0.3), 'mouth': '#2a0e0e', 'nose': '#2a1a14', 'gold': '#e8c040', 'tooth': '#f4ecd8'}
    if big:  # 말: 긴 다리 · 높은 목 · 갈기 · 마구
        bx, by, legL = 17, G - 15, 12
        body_sh = [E('b', bx, by, 9.6, 5.4), E('u', bx + 1, by + 2.8, 7.4, 2.4), Ln('har', (bx + 5.6, by - 4.6), (bx + 7.4, by + 4.6), 1.3, flat=False), Ln('gold', (bx + 6.6, by - 0.4), (bx + 6.6, by + 0.6), 1.2), C('har', (bx - 9, by - 3), (bx + 6, by - 4.6), 0.7)]
        neck = [C('b', (bx + 7, by - 1), (bx + 11.6, by - 9.6), 3.2), Pg('m', (bx + 5.4, by - 3.4), (bx + 8.6, by - 12.2), (bx + 10.4, by - 11.4), (bx + 8.6, by - 2.4))]
        head = [E('b', bx + 13.4, by - 11.4, 3.2, 2.6), C('b', (bx + 13.4, by - 11.6), (bx + 18.4, by - 8.6), 2.0), E('nose', bx + 18.6, by - 8.4, 0.7, 0.7, flat=True), E('eye', bx + 13.8, by - 12.0, 0.7, 0.7, flat=True),
                Pg('b', (bx + 11.6, by - 13), (bx + 12, by - 16.4), (bx + 13.6, by - 13.6)), Ln('har', (bx + 13, by - 13.4), (bx + 17.4, by - 7.6), 0.7, flat=False)]
        tail = [C('m', (bx - 9, by - 2), (bx - 12.4, by + 3), 1.6), C('m', (bx - 12.4, by + 3), (bx - 12.6, by + 8.6), 1.3)]
    elif kind == 'hyena':  # 하이에나: 앞이 높고 뒤가 낮은 등 · 얼룩 · 둥근 귀 · 짧은 갈기
        bx, by, legL = 15, G - 9, 7.4
        body_sh = [Pg('b', (bx - 8.4, by - 1), (bx - 4, by - 4.4), (bx + 5.6, by - 6.4), (bx + 8.4, by - 2), (bx + 6, by + 3.2), (bx - 6.6, by + 3.0)), E('u', bx, by + 2, 6.4, 1.8),
                   E('spot', bx - 3, by - 1.6, 1.2, 1.0, flat=True), E('spot', bx + 1, by - 3.4, 1.1, 0.9, flat=True), E('spot', bx + 3.6, by - 0.6, 1.0, 0.9, flat=True), E('spot', bx - 5.6, by + 0.6, 0.9, 0.8, flat=True),
                   Pg('m', (bx - 2, by - 4.6), (bx + 6.6, by - 7.6), (bx + 6, by - 5.6), (bx - 1.6, by - 3.4))]
        neck = [C('b', (bx + 6, by - 3), (bx + 9.6, by - 5.4), 2.6)]
        head = [E('b', bx + 11, by - 5.6, 3.4, 2.8), Pg('b', (bx + 12, by - 6.8), (bx + 16.8, by - 5.4), (bx + 16.6, by - 3.6), (bx + 12.4, by - 3.2)), E('nose', bx + 16.6, by - 5.0, 0.7, 0.6, flat=True),
                E('b', bx + 9.6, by - 8.6, 1.3, 1.5), E('eye', bx + 12.2, by - 6.4, 0.6, 0.6, flat=True), Ln('mouth', (bx + 12.4, by - 3.8), (bx + 16.2, by - 4.0), 0.6), Pg('tooth', (bx + 14.6, by - 4.0), (bx + 15, by - 3.0), (bx + 15.4, by - 4.0), flat=True)]
        tail = [C('m', (bx - 8, by - 1), (bx - 11, by + 3), 1.0)]
    elif kind == 'wolf':  # 늑대: 곧은 등 · 뾰족한 귀 · 긴 주둥이 · 북슬한 꼬리
        bx, by, legL = 15, G - 9, 7.6
        body_sh = [E('b', bx, by - 1, 8.6, 4.4), E('u', bx + 1, by + 1.6, 6.4, 2.0), Pg('m', (bx + 2, by - 5), (bx + 8.6, by - 4.4), (bx + 8, by + 1), (bx + 3, by - 1.6)), E('m', bx - 2, by - 4.2, 3.6, 1.0, flat=False)]
        neck = [C('b', (bx + 6, by - 2), (bx + 9.4, by - 5), 2.6)]
        head = [E('b', bx + 11, by - 5.6, 3.2, 2.8), Pg('b', (bx + 12.4, by - 6.6), (bx + 17.4, by - 5.0), (bx + 17, by - 3.4), (bx + 12.4, by - 3.2)), E('nose', bx + 17.2, by - 4.8, 0.7, 0.6, flat=True),
                Pg('b', (bx + 9, by - 7.4), (bx + 9.6, by - 11.4), (bx + 11.6, by - 8)), Pg('m', (bx + 9.6, by - 8), (bx + 9.9, by - 10.2), (bx + 10.8, by - 8.2)), E('eye', bx + 12.4, by - 6.6, 0.7, 0.55, flat=True),
                Ln('mouth', (bx + 12.8, by - 3.6), (bx + 16.4, by - 3.8), 0.6), Pg('tooth', (bx + 15.2, by - 3.8), (bx + 15.6, by - 2.8), (bx + 16, by - 3.8), flat=True)]
        tail = [C('m', (bx - 8, by - 2), (bx - 11.6, by + 1), 1.8), C('m', (bx - 11.6, by + 1), (bx - 13, by + 4), 1.3)]
    elif kind == 'salamander':  # 불 도롱뇽: 낮게 붙은 긴 몸 · 짧은 다리 · 긴 꼬리 · 등 무늬
        bx, by, legL = 15, G - 5, 4.2
        body_sh = [E('b', bx, by, 8.0, 3.0), E('u', bx + 1, by + 1.4, 6.6, 1.4)] + [E('spot', bx - 4 + k * 3.2, by - 1.8, 1.0, 0.7, flat=True) for k in range(4)]
        neck = []
        head = [E('b', bx + 9.4, by - 1, 3.6, 2.6), Pg('b', (bx + 10, by - 2), (bx + 14.4, by - 0.6), (bx + 14, by + 1), (bx + 10, by + 1.4)), E('eye', bx + 10.4, by - 2.4, 0.8, 0.8, flat=True), Ln('mouth', (bx + 10.6, by + 0.4), (bx + 14, by + 0.2), 0.5)]
        tail = [C('b', (bx - 7, by), (bx - 11, by + 1), 1.8), C('b', (bx - 11, by + 1), (bx - 14, by - 1.4), 1.2), E('spot', bx - 11, by + 0.4, 0.8, 0.6, flat=True)]
    else:  # 'boar' 돌진 멧돼지: 낮고 두툼한 몸 · 등 갈기 · 엄니
        bx, by, legL = 15, G - 8, 6.0
        body_sh = [E('b', bx, by, 9.0, 5.2), E('u', bx + 1, by + 2.6, 6.4, 2.0), Pg('m', (bx - 7, by - 3), (bx - 3, by - 7.6), (bx + 1, by - 5.0), (bx + 4, by - 8), (bx + 7, by - 4.4), (bx + 5, by - 3.6), (bx - 5, by - 2.6))]
        neck = []
        head = [E('b', bx + 9.4, by - 0.4, 4.4, 3.8), Pg('b', (bx + 11, by - 1.6), (bx + 16, by + 0.2), (bx + 16, by + 2.6), (bx + 11.6, by + 2.4)), E('nose', bx + 16, by + 1.4, 0.9, 1.2, flat=True),
                E('eye', bx + 11, by - 1.4, 0.7, 0.7, flat=True), Pg('b', (bx + 7, by - 3), (bx + 7.6, by - 6.4), (bx + 9.4, by - 3.6)),
                Pg('tusk', (bx + 13, by + 2.4), (bx + 15.6, by - 0.8), (bx + 14.4, by + 2.8))]
        tail = [C('m', (bx - 8.6, by - 1.6), (bx - 10.6, by - 3.4), 0.7)]
    parts = []
    legs = [('lFb', bx - 6, 0.4), ('lFf', bx + 5, 0.45), ('lNb', bx - 4.4, 2.4), ('lNf', bx + 6.6, 2.45)]
    for nm, lx, z in legs:
        near = nm[1] == 'N'
        key = 'b' if near else 'u'
        sh = [C(key, (lx, by + 1), (lx, by + legL * 0.55), 1.9 if big else 1.6), C(key, (lx, by + legL * 0.55), (lx + 0.3, G - 1.2), 1.15 if big else 1.0), E('hoof', lx + 0.5, G - 0.6, 1.6 if big else 1.4, 0.8)]
        parts.append(Part(nm, 'body', (lx, by + 1), z, sh, sep=False))
    parts.append(Part('tail', 'body', (bx - 8, by - 1), 0.9, tail, sep=False))
    parts.append(Part('body', None, (bx, by), 2, body_sh + neck, tex=0.1))
    parts.append(Part('head', 'body', (bx + (12 if big else 9), by - (9 if big else 3)), 3, head, tex=0.06))
    m = Model(W, H, parts, ramps, OUT, flats)

    def idle(i, f): return {'body': (0, 0, [0, 0, 1, 1][i] * 0.6), 'head': (3 * sn(f),), 'tail': (10 * sn(f),)}

    def run(i, f):
        a = 30 if not big else 24
        return {'body': (-2 * sn(f), 0, -abs(sn(f)) * (1.4 if not big else 1)), 'lNf': (a * sn(f),), 'lFf': (a * sn(f + 0.6),), 'lNb': (-a * sn(f),), 'lFb': (-a * sn(f + 0.6),), 'head': (6 * sn(f * 2),), 'tail': (-20 + 10 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 14) 사막 전갈 ═════════
def scorpion(body, accent):
    W, H = 32, 24
    G = H - 1
    ramps = {'b': ramp(body), 'leg': ramp(shade(body, -0.15)), 'c': ramp(accent)}
    flats = {'eye': '#1a0e08', 'sting': '#3a1a10', 'venom': '#a8f04a'}
    parts = []
    for side, nm, z in ((-1, 'F', 0.5), (1, 'N', 2.4)):
        for k in range(3):
            sx = 11 + k * 3
            parts.append(Part('leg%s%d' % (nm, k), 'body', (sx, G - 5), z + k * 0.01, [C('leg', (sx, G - 5), (sx - 2 + k, G - 6.6), 0.8), C('leg', (sx - 2 + k, G - 6.6), (sx - 3 + k * 1.4, G - 0.5), 0.7)], sep=False))
    tail = []
    pts = [(8, G - 6), (4.6, G - 9.6), (3.4, G - 14), (5, G - 18.4), (9, G - 20.4)]
    for k in range(4): tail.append(C('b', pts[k], pts[k + 1], 1.9 - k * 0.2))
    tail += [E('c', 11, G - 20, 2.2, 1.8), Pg('sting', (12.6, G - 20.4), (15.4, G - 18.2), (12.6, G - 18.8), flat=True), E('venom', 15.2, G - 18.0, 0.5, 0.5, flat=True)]
    parts.append(Part('tail', 'body', (8, G - 6), 1.5, tail, tex=0.08))
    parts.append(Part('clawF', 'body', (19, G - 6), 0.7, [C('c', (19, G - 6), (23, G - 8.4), 1.0), E('c', 24.6, G - 9, 2.2, 1.6)]))
    parts.append(Part('body', None, (14, G - 5), 2, [E('b', 13.6, G - 5.4, 7.4, 3.4), Ln('leg', (10, G - 8.2), (10.6, G - 3), 0.6, flat=False), Ln('leg', (13.4, G - 8.6), (14, G - 2.8), 0.6, flat=False), E('b', 20, G - 5.8, 3.0, 2.6), E('eye', 21.6, G - 7.0, 0.6, 0.6, flat=True)], tex=0.08))
    parts.append(Part('clawN', 'body', (20, G - 4), 3, [C('c', (20, G - 4), (24.4, G - 4.4), 1.2), E('c', 26.6, G - 4.8, 2.6, 2.0), Pg('c', (27.4, G - 6.4), (31, G - 7.2), (29.4, G - 5)), Pg('c', (27.6, G - 3.6), (30.6, G - 2.4), (28.4, G - 4.0))]))
    m = Model(W, H, parts, ramps, OUT, flats)
    names = ['leg%s%d' % (nm, k) for nm in 'FN' for k in range(3)]

    def idle(i, f): return {'body': (0, 0, 0.4 * sn(f)), 'tail': (5 * sn(f),), 'clawN': (6 * sn(f),), 'clawF': (-6 * sn(f),)}

    def run(i, f): return {'body': (0, 0, -abs(sn(f)) * 0.8), 'tail': (-6 + 4 * sn(f),), 'clawN': (-8,), 'clawF': (-8,), **{n: (24 * sn(f + j * PI / 1.5),) for j, n in enumerate(names)}}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 15) 큰 딱정벌레 (장수풍뎅이 모양) ═════════
def beetle(shell, horn):
    W, H = 32, 22
    G = H - 1
    ramps = {'s': ramp(shell), 'leg': ramp('#2a2220'), 'h': ramp(horn)}
    flats = {'shine': shade(shell, 0.55), 'eye': '#ffd04a', 'seam': shade(shell, -0.5)}
    parts = []
    for side, nm, z in ((-1, 'F', 0.5), (1, 'N', 2.4)):
        for k in range(3):
            sx = 10 + k * 5
            parts.append(Part('leg%s%d' % (nm, k), 'body', (sx, G - 6), z + k * 0.01, [C('leg', (sx, G - 6), (sx - 2.6 + k * 1.6, G - 3.4), 0.9), C('leg', (sx - 2.6 + k * 1.6, G - 3.4), (sx - 3.6 + k * 2.6, G - 0.4), 0.7)], sep=False))
    parts.append(Part('body', None, (15, G - 6), 2, [E('s', 13.6, G - 9, 10.4, 6.4), Ln('seam', (14.6, G - 15.2), (13, G - 3.4), 0.7), E('shine', 9.6, G - 12.6, 3.2, 1.2, flat=True), E('shine', 18, G - 13, 1.6, 0.7, flat=True),
                                                    E('s', 24.6, G - 7.6, 3.6, 3.2), E('eye', 26.6, G - 8.4, 0.7, 0.7, flat=True)], tex=0.04))
    parts.append(Part('horn', 'body', (25, G - 8), 2.6, [Pg('h', (25, G - 8.6), (29.4, G - 12), (30.6, G - 17.4), (31.4, G - 11), (28, G - 6)), Pg('h', (29.4, G - 12.6), (27.6, G - 15.4), (28.6, G - 12))]))
    m = Model(W, H, parts, ramps, OUT, flats)
    names = ['leg%s%d' % (nm, k) for nm in 'FN' for k in range(3)]

    def idle(i, f): return {'body': (0, 0, 0.4 * sn(f)), 'horn': (3 * sn(f),)}

    def run(i, f): return {'body': (0, 0, -abs(sn(f)) * 0.8), 'horn': (-4,), **{n: (22 * sn(f + j * PI / 1.5),) for j, n in enumerate(names)}}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 16) 하피 (사람 상반신 · 새 날개 · 새 다리) ═════════
def harpy(skin, feather, hair):
    W, H = 34, 36
    G = 29  # 날개가 위로 칠 자리를 비워 둔다 (그림을 6px 내려 그린다)
    ramps = {'skin': ramp(skin), 'f': ramp(feather), 'f2': ramp(shade(feather, 0.25)), 'hair': ramp(hair), 'leg': ramp('#c8a040')}
    flats = {'eye': '#c83a1a', 'eyeW': '#ffe8a0', 'mouth': '#8a3a2a', 'talon': '#2a1a10'}
    parts = [
        Part('wingF', 'body', (14, G - 19), 0.5, [Pg('f', (14, G - 19), (4, G - 26), (0.6, G - 22), (2, G - 16), (6, G - 14), (12, G - 15))], sep=False),
        Part('legs', 'body', (15, G - 10), 0.8, [C('leg', (14, G - 10), (13, G - 2), 0.8), C('leg', (17, G - 10), (17.6, G - 2), 0.8), Ln('talon', (12, G - 1), (15, G - 1), 0.9), Ln('talon', (16.6, G - 1), (19.6, G - 1), 0.9)], sep=False),
        Part('body', None, (15, G - 10), 2, [Pg('f', (11, G - 18), (19, G - 18), (20.4, G - 8), (15, G - 6.4), (9.6, G - 8)), Pg('f2', (12.6, G - 15), (18, G - 15), (17, G - 9.6), (13, G - 9.6)),
                                              E('skin', 15.6, G - 18.6, 3.2, 1.8)], tex=0.16),
        Part('head', 'body', (16, G - 20), 3, [Pg('hair', (12, G - 18), (12.4, G - 25.4), (16, G - 27.6), (20, G - 26), (19.6, G - 23.4), (16, G - 24.4), (13.6, G - 22), (13.6, G - 15.4), (10.6, G - 14)),
                                                E('skin', 17.4, G - 22.6, 3.4, 3.4), E('eyeW', 18.4, G - 23, 0.9, 1.0, flat=True), E('eye', 18.7, G - 22.9, 0.5, 0.7, flat=True), Ln('mouth', (18.4, G - 20.6), (19.6, G - 20.8), 0.5),
                                                Pg('f2', (13, G - 25.4), (11, G - 29.4), (15, G - 26.4))], tex=0.04),
        Part('wingN', 'body', (16, G - 18), 2.8, [Pg('f', (16, G - 18), (24, G - 27), (30, G - 26.4), (31, G - 20), (27, G - 15), (21, G - 13.4)), Pg('f2', (20, G - 19), (26, G - 24), (29.4, G - 22), (25, G - 16.4))], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats, offset=(1, 6))

    def idle(i, f): return {'body': (0, 0, -sn(f)), 'wingN': ([0, -28, -10, 18][i],), 'wingF': ([0, 28, 10, -18][i],), 'legs': (6 * sn(f),)}

    def run(i, f): return {'body': (10, 0, -sn(f)), 'wingN': ([10, -30, -12, 22][i],), 'wingF': ([-10, 30, 12, -22][i],), 'legs': (30,), 'head': (-6,)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 17) 용 (습격 보스 · 네발 · 날개 · 긴 목) ═════════
def drake(scale, belly, wing):
    W, H = 62, 54
    G = 45
    ramps = {'s': ramp(scale), 'u': ramp(belly), 'w': ramp(wing), 'horn': ramp('#e8dcc0'), 'claw': ramp('#e8e0cc')}
    flats = {'eye': '#ffe040', 'pupil': '#1a0e08', 'mouth': '#2a0808', 'fire': '#ffb03a', 'tooth': '#f4ecd8', 'memb': shade(wing, 0.25)}
    bx, by = 26, G - 15
    parts = [
        Part('wingF', 'body', (bx + 2, by - 6), 0.4, [Pg('w', (bx + 2, by - 6), (bx - 6, by - 26), (bx - 14, by - 30), (bx - 12, by - 20), (bx - 18, by - 16), (bx - 8, by - 8))], sep=False),
        Part('lFb', 'body', (bx - 8, by + 2), 0.5, [C('u', (bx - 8, by + 2), (bx - 10, by + 8), 3.0), C('u', (bx - 10, by + 8), (bx - 9, G - 1.6), 2.0), E('claw', bx - 7.6, G - 0.8, 2.6, 1.0)], sep=False),
        Part('lFf', 'body', (bx + 8, by + 2), 0.55, [C('u', (bx + 8, by + 2), (bx + 9, G - 1.6), 2.4), E('claw', bx + 10.4, G - 0.8, 2.6, 1.0)], sep=False),
        Part('tail', 'body', (bx - 10, by), 0.9, [C('s', (bx - 10, by), (bx - 18, by + 4), 3.4), C('s', (bx - 18, by + 4), (bx - 24, by + 2), 2.4), C('s', (bx - 24, by + 2), (bx - 25.6, by - 3), 1.6), Pg('s', (bx - 26.6, by - 3), (bx - 25.4, by - 8), (bx - 23.6, by - 3))], sep=False),
        Part('body', None, (bx, by), 2, [E('s', bx, by, 12.4, 7.2), E('u', bx + 1.6, by + 3.6, 9.4, 3.0)] + [Pg('horn', (bx - 8 + k * 4, by - 6.4), (bx - 6.6 + k * 4, by - 9.6), (bx - 5 + k * 4, by - 6.6)) for k in range(4)] +
             [C('s', (bx + 10, by - 2), (bx + 17, by - 13), 4.0), C('u', (bx + 12, by + 0), (bx + 18.6, by - 11), 2.0)], tex=0.16),
        Part('head', 'body', (bx + 18, by - 14), 3, [E('s', bx + 19.6, by - 16, 5.2, 4.2), Pg('s', (bx + 21, by - 18.6), (bx + 30, by - 15.6), (bx + 30, by - 12.4), (bx + 21, by - 12.2)),
                                                       Pg('u', (bx + 21, by - 13.4), (bx + 29.4, by - 12.6), (bx + 28.4, by - 10.6), (bx + 21.4, by - 10.8)), Ln('mouth', (bx + 22, by - 12.8), (bx + 30, by - 13), 0.7),
                                                       Pg('tooth', (bx + 26, by - 13), (bx + 26.4, by - 11.8), (bx + 26.8, by - 13), flat=True), E('fire', bx + 30.2, by - 12.6, 1.0, 0.7, flat=True),
                                                       Pg('horn', (bx + 17, by - 19), (bx + 12, by - 25), (bx + 15.6, by - 18)), Pg('horn', (bx + 19.6, by - 19.6), (bx + 17, by - 26.6), (bx + 21.4, by - 19.6)),
                                                       E('eye', bx + 21.6, by - 17, 1.3, 1.0, flat=True), E('pupil', bx + 22, by - 17, 0.45, 0.9, flat=True)], tex=0.1),
        Part('lNb', 'body', (bx - 6, by + 2), 2.4, [C('s', (bx - 6, by + 1), (bx - 8, by + 8), 3.4), C('s', (bx - 8, by + 8), (bx - 6.6, G - 1.6), 2.2), E('claw', bx - 5, G - 0.8, 2.8, 1.1)], sep=False),
        Part('lNf', 'body', (bx + 10, by + 2), 2.45, [C('s', (bx + 10, by + 2), (bx + 11, G - 1.6), 2.6), E('claw', bx + 12.6, G - 0.8, 2.8, 1.1)], sep=False),
        Part('wingN', 'body', (bx + 3, by - 5), 2.8, [Pg('w', (bx + 3, by - 5), (bx + 2, by - 28), (bx - 4, by - 36), (bx - 10, by - 26), (bx - 14, by - 22), (bx - 6, by - 12)),
                                                       Pg('memb', (bx + 1, by - 26), (bx - 3, by - 32), (bx - 8, by - 25), (bx - 3, by - 14), flat=True), Ln('s', (bx + 2, by - 28), (bx - 6, by - 12), 0.8, flat=False)], sep=False),
    ]
    m = Model(W, H, parts, ramps, OUT, flats, offset=(1, 8))

    def idle(i, f): return {'body': (0, 0, [0, 0, 1, 1][i]), 'head': (3 * sn(f),), 'wingN': (6 * sn(f),), 'wingF': (-6 * sn(f),), 'tail': (6 * sn(f),)}

    def run(i, f): return {'body': (-2 * sn(f), 0, -abs(sn(f)) * 1.5), 'lNf': (24 * sn(f),), 'lFf': (24 * sn(f + 0.6),), 'lNb': (-24 * sn(f),), 'lFb': (-24 * sn(f + 0.6),), 'head': (-4 + 3 * sn(f * 2),), 'wingN': (-14 + 10 * sn(f),), 'wingF': (14 - 10 * sn(f),), 'tail': (-10 + 8 * sn(f),)}
    return m, [('idle', frames(4, idle)), ('run', frames(4, run))]


# ═════════ 몬스터 목록 ═════════
C_ = {
    # 벌레 · 뱀
    'leech': lambda: worm(28, 14, 5, 3.6, '#6a2a2a', '#a85a4a', 'sucker', ('rings',)),
    'mossSlug': lambda: worm(24, 14, 4, 3.2, '#7a8a4a', '#c8c890', 'slug', ('moss',)),
    'frostSlug': lambda: worm(24, 14, 4, 3.2, '#8ab8d8', '#e8f4ff', 'slug', ('ice',)),
    'seaSerpent': lambda: worm(40, 26, 7, 3.6, '#2a8a8a', '#c8e8b0', 'serpent', ('fin',), rise=10),
    'sandWorm': lambda: worm(40, 22, 6, 5.0, '#c89a5a', '#e8d0a0', 'maw', ('rings',)),
    # 버섯 · 덩굴 · 요정
    'shroom': lambda: mushroom('#c83a3a', '#f8f0e0', '#e8dcc0'),
    'vineSpirit': lambda: vine('#4a7a2a', '#6ab83a', '#e85a8a'),
    'thornSprite': lambda: sprite_fairy('#a8784a', '#3a8a3a', '#ffe86a'),
    # 덩치 큰 괴물
    'swampQueen': lambda: brute('hag', '#8aa86a', '#4a5a3a', {'cloth': '#3a4a2a', 'hair': '#3a5a2a', 'weapon': 'staff', 'eye': '#ffe86a'}),
    'swampTroll': lambda: brute('troll', '#6a8a5a', '#5a6a4a', {'weapon': 'club'}),
    'yeti': lambda: brute('yeti', '#9ab0c8', '#e8eef4', {'face': '#7a98b8', 'eye': '#1a2a4a'}),
    'labyrinthLord': lambda: brute('mino', '#8a5a3a', '#6a3a22', {'face': '#a8785a', 'weapon': 'axe'}),
    # 골렘
    'magmaGolem': lambda: golem('#4a3a3a', '#ff7a2a', '#ffd040', ('lava',)),
    'iceGolem': lambda: golem('#9ac8e0', '#6a98b8', '#e8fcff', ('ice',)),
    'raidGolem': lambda: golem('#8a8a80', '#55554e', '#7af0ff', ('moss', 'rune')),
    'ruinSentinel': lambda: golem('#c8b088', '#8a7050', '#ffd040', ('helm', 'spear')),
    # 벌레 · 거미 · 게
    'glassSpider': lambda: spider('#5ab8c8', '#e8fcff'),
    'jungleWasp': lambda: wasp('#2a2018', '#e8b830', '#e8f4ff'),
    'coralCrab': lambda: crab('#d85a3a', '#f08a5a', '#f86aa8'),
    'jellyfish': lambda: jelly('#c88ae8', '#f8d8ff'),
    'sandScorpion': lambda: scorpion('#c8a060', '#a87a40'),
    'bigBeetle': lambda: beetle('#2a5a4a', '#3a3a2a'),
    # 잠복자 · 부풀이 · 개구리
    'caveLurker': lambda: lurker('#4a3a5a', '#7a6a8a', '#e8f0a0', 'cave'),
    'mudLurker': lambda: lurker('#6a4a2a', '#8a6a4a', '#ffd06a', 'mud'),
    'snowLurker': lambda: lurker('#e0e8f0', '#ffffff', '#5ab8f8', 'snow'),
    'gasBloat': lambda: bloat('#b8c85a', '#6a7a2a'),
    'venomSpitter': lambda: frog('#5ab83a', '#e8e06a', '#8a3ac8'),
    # 네발짐승 · 하피 · 용
    'hyena': lambda: quad('hyena', '#c8a46a', '#e8d4a8', '#4a3424', '#6a4a2a'),
    'boarRunner': lambda: quad('boar', '#8a4a2a', '#b8805a', '#3a2418'),
    'horse': lambda: quad('horse', '#9a5a2e', '#c8905a', '#3a2214'),
    'frostWolf': lambda: quad('wolf', '#c8dcec', '#f4f8fc', '#7a9ab8'),
    'salamander': lambda: quad('salamander', '#e86a2a', '#f8c06a', '#c84a1a', '#ffd04a'),
    'toad': lambda: frog('#8a7a4a', '#c8b888', '#5a4a2a'),
    'bat': lambda: bat('#4a3a5a', '#3a2a4a', '#ff5a4a'),
    'turtle': lambda: turtle('#4a7a5a', '#a8b878'),
    'harpy': lambda: harpy('#e8c8a0', '#8a5a3a', '#4a2a1a'),
    'raidDragon': lambda: drake('#b83a2a', '#e8b06a', '#7a1e1a'),
}


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:] or None
    blocks, meta, y = [], {}, 0
    for cid, fn in C_.items():
        if only and cid not in only: continue
        model, an = fn()
        rows = [[model.render(dict(p)) for p in fr] for _, fr in an]
        cols = max(len(r) for r in rows)
        blk = Image.new('RGBA', (cols * model.w, len(rows) * model.h), (0, 0, 0, 0))
        for r, fr in enumerate(rows):
            for c, im in enumerate(fr): blk.alpha_composite(im, (c * model.w, r * model.h))
        meta[cid] = {'w': model.w, 'h': model.h, 'y0': y, 'anims': {nm: {'row': r, 'n': len(fr)} for r, (nm, fr) in enumerate(an)}}
        blocks.append((blk, y)); y += blk.height
    img = Image.new('RGBA', (max(b.width for b, _ in blocks), y), (0, 0, 0, 0))
    for b, yy in blocks: img.alpha_composite(b, (0, yy))
    img.save(out + '/creatures.png')
    json.dump(meta, open(out + '/creatures.json', 'w'))
    print(len(meta), 'creatures', img.size)
