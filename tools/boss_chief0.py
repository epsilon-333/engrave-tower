"""가면 족장을 플레이어(0x72) 그림체로: 큰 머리 · 짧은 몸 · 재질마다 2~3단 · 짙은 외곽선 · 12색 안팎, 키 약 44px (플레이어의 두 배쯤).
장면마다 관절 자세를 바꿔 픽셀을 처음부터 다시 찍는다 (tools/boss_chief.py 의 그리는 틀을 쓴다).
    python3 tools/boss_chief0.py   → art/preview_boss_chief0.png (플레이어 · 0x72 오우거와 나란히)
"""
import math, os, sys
from PIL import Image
import boss_chief as bc
from boss_chief import S, Part, render, hexc

HERE = os.path.dirname(os.path.abspath(__file__))
bc.W, bc.H = 64, 52
bc.OX, bc.OY = 6, 2
bc.BASE = {}
# 0x72처럼 재질마다 세 단 (밝음 · 중간 · 그늘) — 다섯 칸 중 같은 색을 겹쳐 세 단만 남긴다
def r3(l, m, d): return [hexc(l), hexc(l), hexc(m), hexc(d), hexc(d)]
bc.RAMPS = {
    'skin': r3('#9a6a5a', '#74484a', '#4c2c38'), 'bone': r3('#fffbee', '#d8ccb0', '#9a8a72'), 'feather': r3('#ff6a4a', '#d42e2a', '#8a1a24'),
    'fur': r3('#f2ead8', '#c4b498', '#8a7a64'), 'cloth': r3('#d8443a', '#9a2a2c', '#5e1a24'), 'wood': r3('#b07a46', '#7a4e2e', '#4a2e1c'), 'leather': r3('#6a4c36', '#4a3426', '#2e2018'),
}
bc.FLATS = {k: hexc(v) for k, v in {'socket': '#1a0c10', 'eye': '#ffe14a', 'tooth': '#fffbee', 'nail': '#fffbee'}.items()}
bc.LIGHT = (-0.55, -0.72, 0.42)
E = lambda k, cx, cy, rx, ry, **o: S('ell', k, cx, cy, rx, ry, **o)
Cp = lambda k, a, b, r1, r2=None, **o: S('cap', k, a, b, r1, r2 if r2 is not None else r1, **o)
Pg = lambda k, *pts, **o: S('poly', k, pts, **o)

# 발밑 y=48 · 오른쪽을 본다. 0x72 비율: 머리가 몸만큼 크다
def chief():
    return [
        Part('cape', 'torso', (20, 26), 1, [Pg('cloth', (16, 24), (24, 24), (24, 38), (21, 42), (19, 39), (16, 43), (14, 38))]),
        Part('legB', 'hips', (22, 38), 2, [Cp('skin', (22, 38), (20, 44), 2.8, 2.4), E('skin', 21.5, 46.5, 3.4, 1.6)]),
        Part('armB', 'torso', (19, 28), 3, [Cp('skin', (19, 28), (17, 35), 2.8, 2.4), E('skin', 17.5, 36.5, 2.7, 2.4)]),
        Part('hips', None, (26, 37), 5, [Pg('cloth', (21, 36), (31, 36), (32, 42), (29, 41), (26, 43), (23, 41), (20, 42)), E('fur', 26, 36, 6.5, 1.8)]),
        Part('legF', 'hips', (29, 38), 6, [Cp('skin', (29, 38), (31, 44), 2.9, 2.5), E('skin', 32.5, 46.5, 3.6, 1.6)]),
        Part('torso', 'hips', (26, 36), 10, [E('skin', 26, 31, 7.5, 6.5), E('fur', 21, 25, 5.5, 3.8), Pg('fur', (16, 26), (17, 23), (19, 26), (20, 22), (22, 25), (23, 22), (25, 25), (25, 28), (17, 29))]),  # 흰 털 어깨
        Part('crest', 'head', (27, 10), 15, [Cp('feather', (27, 10), (27 + 9 * math.cos(math.radians(a)), 10 + 9 * math.sin(math.radians(a))), 2.4, 1.0) for a in (-165, -138, -112, -88)]),  # 굵은 깃털 넷 (플레이어 깃털처럼)
        # 해골 가면: 크고 둥근 머리뼈 · 짧은 주둥이 · 큰 눈구멍과 노란 눈빛 · 이빨 · 작은 뿔
        Part('head', 'torso', (28, 24), 20, [Pg('bone', (23, 9), (21, 4), (25, 7)), Pg('bone', (34, 8), (37, 3), (36, 9)),
                                             E('bone', 29, 15, 8, 7.5), Pg('bone', (24, 16), (37, 16), (38, 21), (35, 23), (27, 23), (24, 21)),
                                             E('socket', 27, 15, 2.2, 2.4, flat=True), E('socket', 33.5, 15, 2.0, 2.3, flat=True), E('eye', 27.3, 15.3, 0.7, 0.8, flat=True), E('eye', 33.7, 15.3, 0.6, 0.8, flat=True),
                                             *[S('poly', 'tooth', [(28 + i * 2, 21), (29.2 + i * 2, 21), (28.6 + i * 2, 23.4)], flat=True) for i in range(4)],
                                             S('poly', 'socket', [(30, 18.2), (31.4, 18.2), (30.7, 19.6)], flat=True)]),
        Part('armF', 'torso', (31, 28), 25, [E('skin', 31, 28, 3.4, 3.0), Cp('skin', (31, 28), (34, 34), 3.0, 2.5), E('bone', 31.5, 26, 2.6, 1.8)]),
        Part('foreF', 'armF', (34, 34), 27, [E('skin', 35, 36, 2.9, 2.6), E('nail', 36.5, 37, 0.5, 0.5, flat=True)]),
        Part('club', 'foreF', (35, 36), 26, [Cp('wood', (33, 39), (42, 28), 1.3, 1.6), Cp('wood', (40.5, 30.5), (46, 22), 2.6, 3.8),
                                             *[S('poly', 'bone', [(x - 0.9, y), (x + dx, y + dy), (x + 0.9, y)]) for x, y, dx, dy in ((42, 25, -3, -2), (45, 21, 0, -3.5), (48, 24, 3, -1), (46, 28, 2.5, 2))]]),
    ]

sn = lambda i: math.sin(i / 4 * math.pi * 2)
CB = -52
def club(t, arm, fore): return t - CB - arm - fore
def idle(i):
    b = [0, 0, 1, 1][i]  # 0x72처럼 한 칸씩 숨쉬기
    return {'torso': (0, 0, b), 'head': (0, 0, b * 0), 'crest': (3 * sn(i),), 'cape': (2 * sn(i),), 'armF': (-6,), 'club': (club(-30, -6, 0),), 'armB': (-4 * sn(i),)}
def walk(i):
    s = [1, 0, -1, 0][i]; bob = [0, -1, 0, -1][i]
    return {'hips': (0, 0, bob), 'torso': (4,), 'legF': (-26 * s,), 'legB': (26 * s,), 'armF': (-6 + 8 * s,), 'club': (club(-30 - 6 * s, -6 + 8 * s + 4, 0),), 'armB': (-20 * s,), 'cape': (-10 + 5 * s,), 'crest': (-6 + 4 * s,)}
def attack(i):
    lean, dy, arm, tgt = [(-10, 0, 160, -160), (12, 1, -60, 15), (18, 2, -30, 42), (5, 0, -10, -15)][i]
    return {'hips': (0, 0, dy), 'torso': (lean,), 'armF': (arm,), 'club': (club(tgt, arm + lean, 0),), 'armB': (-30 if i == 0 else 30,), 'crest': (lean * 0.6,), 'cape': (-lean * 0.6,), 'legF': ([-10, -24, -28, -8][i],), 'legB': ([10, 18, 22, 6][i],)}
def roar(i):
    k = [0.6, 1, 1, 0.8][i]
    return {'torso': (-10 * k, 0, -k), 'head': (-14 * k,), 'crest': (-6 * k + 3 * sn(i), 0, 0, 1 + 0.15 * k, 1 + 0.15 * k), 'armF': (-20 * k,), 'club': (club(-5, -20 * k - 10 * k, 0),), 'armB': (155 * k,), 'cape': (14 * k,), 'legF': (-12 * k,), 'legB': (12 * k,)}
ANIMS = [('idle', idle), ('run', walk), ('attack', attack), ('skill', roar)]

def build():
    parts = chief()
    return [[render(parts, f(i)) for i in range(4)] for _, f in ANIMS]  # 재질마다 세 단이라 색 줄이기는 하지 않는다 (눈빛이 바래지 않게)

if __name__ == '__main__':
    bc.reduce.__globals__['W'], bc.reduce.__globals__['H'] = bc.W, bc.H
    rows = build()
    S_ = 6
    src = Image.open(os.path.join(HERE, '..', 'public', 'assets', '0x72', 'sheet.png')).convert('RGBA')
    knight = src.crop((128, 100, 144, 128)); ogre = src.crop((16, 380, 48, 416))
    out = Image.new('RGBA', ((4 * bc.W + 60) * S_, 4 * bc.H * S_), (46, 44, 56, 255))
    for r, row in enumerate(rows):
        for i, im in enumerate(row): out.alpha_composite(im.resize((bc.W * S_, bc.H * S_), Image.NEAREST), (i * bc.W * S_, r * bc.H * S_))
    out.alpha_composite(knight.resize((16 * S_, 28 * S_), Image.NEAREST), ((4 * bc.W + 4) * S_, (bc.H - 32) * S_))
    out.alpha_composite(ogre.resize((32 * S_, 36 * S_), Image.NEAREST), ((4 * bc.W + 24) * S_, (bc.H - 40) * S_ + bc.H * S_))
    p = os.path.join(HERE, '..', 'art', 'preview_boss_chief0.png'); out.save(p); print(p)
