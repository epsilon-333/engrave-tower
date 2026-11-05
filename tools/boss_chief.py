"""가면 족장을 직접 그린다 (보내 주신 보스 그림과 같은 크기 · 약 80px).
부위 모양을 기본 자세로 정해 두고, 장면마다 관절 자세만 바꿔 픽셀을 처음부터 다시 찍는다 (그림을 잘라 옮기지 않는다).
명암은 모양마다 둥근 면의 방향(법선)을 셈해 왼쪽 위에서 오는 빛으로 다섯 단계 — 통처럼 납작하지 않게.
    python3 tools/boss_chief.py            → 미리 보기 art/preview_boss_chief.png (위: 보내 주신 그림 · 아래: 직접 그린 것)
    python3 tools/boss_chief.py --write    → 게임 시트 b_climbChief 를 이 그림으로
"""
import math, os, sys, json
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 136, 104
OX, OY = 8, 6  # 그림 전체를 칸 안쪽으로 (몽둥이가 잘리지 않게)
BASE = {'head': (0, 0, 0, 1.32, 1.32)}  # 머리 크게 (보내 주신 그림처럼 큰 머리)
LIGHT = (-0.52, -0.68, 0.52)
_ll = math.sqrt(sum(v * v for v in LIGHT)); LIGHT = tuple(v / _ll for v in LIGHT)
OUTLINE = (24, 14, 18, 255)

def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
RAMPS = {k: [hexc(c) for c in v] for k, v in {
    'skin': ['#d39a86', '#a86e60', '#7e4c48', '#56313c', '#331b26'],    # 보랏빛 도는 짙은 갈색 살 (보내 주신 그림처럼)
    'bone': ['#fffaea', '#eae0c6', '#c8b898', '#968568', '#5a4e3e'],
    'feather': ['#ff8a66', '#f0462e', '#c42a24', '#8a1a20', '#520e16'],
    'fur': ['#fbf4e6', '#ddd0b8', '#ad9c82', '#786a5a', '#463c34'],     # 흰 털가죽
    'mane': ['#ff6a58', '#e03a30', '#b02428', '#7a1620', '#480c16'],    # 붉은 갈기
    'cloth': ['#e0564a', '#b83630', '#8a2228', '#5c1620', '#360c14'],
    'wood': ['#c08c56', '#9a6a3e', '#73492a', '#4e301c', '#2e1c10'],
    'leather': ['#8a6a4a', '#6c4e34', '#503826', '#36241a', '#22160e'],
    'iron': ['#d8dce4', '#a8aeba', '#7a808e', '#525866', '#30343e'],
}.items()}
FLATS = {k: hexc(v) for k, v in {'socket': '#1a0c10', 'eye': '#fff6a0', 'eyec': '#ff9a2a', 'eyer': '#d8401a', 'tooth': '#fff4dc', 'line': '#5a2e1e', 'deep': '#3a1a12',
                                  'shaft': '#ffd8c8', 'crack': '#8a7a60', 'paint': '#d82a24', 'nail': '#f0e8d8'}.items()}

def seg_t(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; l2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)); return t, a[0] + t * dx, a[1] + t * dy

class S:
    """모양: ell(cx, cy, rx, ry) · cap(a, b, r1, r2: 끝으로 가며 가늘어지는 통) · poly(점들) · flat 이면 단색 (무늬 · 눈 · 이빨)"""
    def __init__(self, kind, key, *a, flat=False, z=0):
        self.kind, self.key, self.a, self.flat, self.dz = kind, key, a, flat, z
        if kind == 'poly':
            xs = [p[0] for p in a[0]]; ys = [p[1] for p in a[0]]
            self.c = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2); self.r = ((max(xs) - min(xs)) / 2 + 0.6, (max(ys) - min(ys)) / 2 + 0.6)
    def test(self, x, y):  # 안이면 둥근 면의 방향 (nx, ny) 을 돌려준다
        k, a = self.kind, self.a
        if k == 'ell':
            cx, cy, rx, ry = a; nx, ny = (x - cx) / rx, (y - cy) / ry
            return (nx, ny) if nx * nx + ny * ny <= 1 else None
        if k == 'cap':
            p0, p1, r1, r2 = a; t, qx, qy = seg_t(x, y, p0, p1); r = r1 + (r2 - r1) * t
            dx, dy = x - qx, y - qy
            return (dx / r, dy / r) if dx * dx + dy * dy <= r * r else None
        if k == 'poly':
            pts = a[0]; inside = False; j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi: inside = not inside
                j = i
            if not inside: return None
            nx, ny = (x - self.c[0]) / self.r[0], (y - self.c[1]) / self.r[1]; l = math.hypot(nx, ny)
            return (nx / max(1, l) * 0.85, ny / max(1, l) * 0.85)
        return None

class Part:
    def __init__(self, name, parent, pivot, z, shapes, tex=0.0):
        self.name, self.parent, self.pivot, self.z, self.shapes, self.tex = name, parent, pivot, z, shapes, tex

def mat(px, py, ang, dx=0, dy=0, sx=1, sy=1):
    r = math.radians(ang); c, s = math.cos(r), math.sin(r)
    return (sx * c, -sy * s, px + dx - (sx * c * px - sy * s * py), sx * s, sy * c, py + dy - (sx * s * px + sy * c * py))
def mul(A, B):
    a, b, c, d, e, f = A; g, h, i, j, k, l = B
    return (a * g + b * j, a * h + b * k, a * i + b * l + c, d * g + e * j, d * h + e * k, d * i + e * l + f)
def inv(M):
    a, b, c, d, e, f = M; det = a * e - b * d
    return (e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det)
def hsh(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff; n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535

def render(parts, pose):
    by = {p.name: p for p in parts}; M = {}
    def world(p):
        if p.name in M: return M[p.name]
        v = pose.get(p.name, BASE.get(p.name, (0,))); v = tuple(v) + (0, 0, 1, 1)[len(v) - 1:]
        if p.name in BASE and len(pose.get(p.name, ())) < 4: v = v[:3] + BASE[p.name][3:]
        m = mat(p.pivot[0], p.pivot[1], v[0], v[1], v[2], v[3], v[4])
        m = mul(world(by[p.parent]), m) if p.parent else mul((1, 0, OX, 0, 1, OY), m)
        M[p.name] = m; return m
    order = sorted(parts, key=lambda p: -p.z)
    iv = [(p, inv(world(p)), world(p)) for p in order]
    img = Image.new('RGBA', (W, H)); px = img.load(); pid = {}
    for y in range(H):
        for x in range(W):
            X, Y = x + 0.5, y + 0.5
            for idx, (p, I, Mw) in enumerate(iv):
                lx = I[0] * X + I[1] * Y + I[2]; ly = I[3] * X + I[4] * Y + I[5]
                hit = None
                for s in reversed(p.shapes):
                    n = s.test(lx, ly)
                    if n is not None: hit = (s, n); break
                if not hit: continue
                s, (nx, ny) = hit
                if s.flat: c = FLATS[s.key]
                else:
                    # 법선을 세계로 돌린다 (부위가 돌아가면 빛도 그대로 왼쪽 위에서)
                    wx, wy = Mw[0] * nx + Mw[1] * ny, Mw[3] * nx + Mw[4] * ny
                    ll = math.hypot(wx, wy);
                    if ll > 1: wx, wy = wx / ll, wy / ll
                    nz = math.sqrt(max(0.0, 1 - wx * wx - wy * wy))
                    lum = wx * LIGHT[0] + wy * LIGHT[1] + nz * LIGHT[2]
                    if p.tex: lum += (hsh(int(lx // 1.5), int(ly // 1.5), len(p.name)) - 0.5) * p.tex
                    lvl = 0 if lum > 0.86 else 1 if lum > 0.58 else 2 if lum > 0.22 else 3 if lum > -0.15 else 4
                    c = RAMPS[s.key][lvl]
                px[x, y] = c; pid[(x, y)] = (idx, p.z, s.flat, s.key)
                break
    # 접촉 그늘: 앞 부위와 맞닿은 뒤 부위의 테두리는 가장 어둡게 (부위가 겹친 곳이 또렷하게)
    out = img.copy(); po = out.load()
    for (x, y), (idx, z, fl, key) in pid.items():
        if fl: continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = pid.get((x + dx, y + dy))
            if q and q[0] != idx and q[1] > z + 0.5: po[x, y] = RAMPS[key][4]; break
    # 바깥 외곽선
    fin = out.copy(); pf = fin.load()
    for y in range(H):
        for x in range(W):
            if (x, y) in pid: continue
            if any((x + dx, y + dy) in pid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): pf[x, y] = OUTLINE
    return fin

# ───── 가면 족장 (오른쪽을 본다 · 구부정한 큰 어깨 · 발밑 y=90) ─────
E = lambda k, cx, cy, rx, ry, **o: S('ell', k, cx, cy, rx, ry, **o)
Cp = lambda k, a, b, r1, r2=None, **o: S('cap', k, a, b, r1, r2 if r2 is not None else r1, **o)
Pg = lambda k, *pts, **o: S('poly', k, pts, **o)
def feather(cx, cy, ang, ln, wd):  # 깃털 하나: 뿌리에서 끝으로 가늘어지는 잎 모양
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
    pts = [(cx + vx * wd * 0.5, cy + vy * wd * 0.5), (cx + ux * ln * 0.55 + vx * wd, cy + uy * ln * 0.55 + vy * wd), (cx + ux * ln, cy + uy * ln),
           (cx + ux * ln * 0.55 - vx * wd, cy + uy * ln * 0.55 - vy * wd), (cx - vx * wd * 0.5, cy - vy * wd * 0.5)]
    return [Pg('feather', *pts), Cp('shaft', (cx, cy), (cx + ux * ln * 0.8, cy + uy * ln * 0.8), 0.35, flat=True)]
def spike(x, y, ang, ln, k='bone'):
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
    return Pg(k, (x + vx * 1.4, y + vy * 1.4), (x + ux * ln, y + uy * ln), (x - vx * 1.4, y - vy * 1.4))

def chief():
    return [
        Part('cape', 'torso', (38, 28), 1, [Pg('cloth', (32, 24), (44, 24), (43, 46), (41, 66), (37, 62), (34, 72), (30, 64), (25, 71), (24, 52), (27, 36))]),
        # 뒤쪽 다리 (넓게 벌린 자세)
        Part('thighB', 'hips', (42, 61), 2, [Cp('skin', (42, 61), (36, 72), 6.4, 5.0)], tex=0.2),
        Part('shinB', 'thighB', (36, 72), 2, [Cp('skin', (36, 72), (35, 84), 5.4, 3.6), Cp('leather', (35.6, 79), (35.4, 83), 4.2), E('skin', 38, 88, 6.2, 2.9), *[spike(40 + i * 2.2, 89, 10, 3, 'bone') for i in range(2)]], tex=0.2),
        # 뒤쪽 팔: 늘어뜨린 큰 주먹
        Part('armB', 'torso', (34, 31), 3, [E('skin', 34, 31, 6.5, 6), Cp('skin', (34, 31), (29, 44), 6.0, 4.6)], tex=0.2),
        Part('foreB', 'armB', (29, 44), 3, [Cp('skin', (29, 44), (31, 54), 5.4, 4.0), Cp('leather', (29.6, 48), (30.4, 52), 4.8), E('skin', 31.5, 57, 5.0, 4.4), E('nail', 34, 59, 0.8, 0.8, flat=True), E('nail', 31.5, 60.5, 0.8, 0.8, flat=True)], tex=0.2),
        # 허리: 털 허리띠 · 해골 장식 · 너덜너덜한 붉은 허리 천
        Part('hips', None, (47, 60), 5, [Pg('cloth', (39, 60), (57, 60), (60, 74), (56, 71), (53, 77), (49, 72), (45, 78), (42, 71), (37, 74)),
            E('fur', 47, 59, 14, 4.6), E('bone', 48, 60.5, 3.0, 2.6), E('socket', 47, 60.2, 0.7, 0.8, flat=True), E('socket', 49, 60.2, 0.7, 0.8, flat=True)], tex=0.35),
        # 앞쪽 다리
        Part('thighF', 'hips', (53, 62), 6, [Cp('skin', (53, 62), (60, 72), 6.6, 5.2)], tex=0.2),
        Part('shinF', 'thighF', (60, 72), 6, [Cp('skin', (60, 72), (62, 84), 5.6, 3.8), Cp('leather', (61.4, 79), (61.8, 83), 4.4), E('skin', 66, 88, 7, 3.0), *[spike(70 + i * 2.4, 89, 5, 3.4, 'bone') for i in range(2)]], tex=0.2),
        # 몸통: 굽은 등 · 앞으로 내민 넓은 가슴 · 배 · 근육 선 · 전쟁 물감
        Part('torso', 'hips', (47, 58), 10, [
            E('skin', 42, 34, 12.5, 10), E('skin', 53, 37, 12, 10.5), E('skin', 50, 49, 9.5, 7.5),
            Cp('line', (51, 33), (51, 54), 0.5, flat=True), Cp('line', (44, 42), (50, 43), 0.5, flat=True), Cp('line', (52, 43), (59, 40), 0.5, flat=True),
            Cp('line', (45, 48), (50, 49), 0.45, flat=True), Cp('line', (52, 49), (57, 47), 0.45, flat=True), Cp('line', (46, 53.5), (56, 53.5), 0.45, flat=True),
            Cp('paint', (44, 38), (48, 45), 0.8, flat=True), Cp('paint', (55, 37), (58, 43), 0.8, flat=True),
            # 어깨 털가죽: 아래가 들쭉날쭉
            Pg('fur', (29, 30), (31, 23), (39, 19), (48, 21), (52, 26), (49, 30), (46, 27), (43, 32), (40, 28), (37, 33), (34, 29), (31, 34)),
            *[spike(x, y, a, 4, 'fur') for x, y, a in ((31, 24, -150), (35, 20, -120), (41, 19, -95))],
            # 뼈 목걸이
            *[E('bone', 46 + i * 3.2, 33 + abs(i - 2) * -0.6 + 1.8, 1.6, 1.4) for i in range(5)], E('tooth', 52.4, 37.5, 0.9, 2.0, flat=True),
        ], tex=0.22),
        # 붉은 갈기: 머리 뒤에서 등을 타고 흘러내린다
        Part('mane', 'head', (56, 22), 4, [Pg('mane', (56, 14), (60, 22), (54, 32), (52, 44), (48, 40), (46, 50), (42, 42), (38, 48), (38, 36), (34, 40), (36, 28), (44, 18))]),
        # 깃털 관: 해골 위에서 뒤로 넘어가는 붉은 깃털 부채 (두 겹)
        Part('crest', 'head', (60, 15), 15, [*[q for a, ln in ((-170, 21), (-150, 24), (-132, 25), (-114, 24), (-97, 21), (-80, 17)) for q in feather(59, 15, a, ln, 2.9)],
                                             *[q for a, ln in ((-160, 16), (-141, 18), (-122, 18), (-104, 16)) for q in feather(60, 16, a, ln, 2.2)]]),
        # 해골 가면: 짐승 머리뼈 · 휘어 솟은 뿔 · 앞으로 튀어나온 주둥이 · 깊은 눈구멍 속 불빛 · 송곳니
        Part('head', 'torso', (58, 30), 20, [
            Pg('bone', (56, 13), (52, 7), (51, 1), (54, 4), (57, 9), (59, 12)), Pg('bone', (66, 13), (68, 6), (72, 1), (71, 6), (69, 12)),
            E('bone', 61, 19, 8.6, 8.0),
            Pg('bone', (58, 20), (70, 19), (77, 22), (77, 27), (72, 30), (63, 30), (57, 27)),
            E('socket', 58.8, 18.6, 2.8, 3.1, flat=True), E('socket', 66.6, 18.2, 2.6, 2.9, flat=True),
            E('eyer', 59.2, 19.2, 1.7, 1.8, flat=True), E('eyer', 67, 18.8, 1.6, 1.7, flat=True), E('eye', 59.4, 18.8, 0.85, 0.95, flat=True), E('eye', 67.2, 18.4, 0.8, 0.9, flat=True),
            E('socket', 74.5, 23, 1.0, 0.8, flat=True), E('socket', 72, 23.4, 0.9, 0.7, flat=True),
            *[Pg('tooth', (62 + i * 3, 28.2), (63.4 + i * 3, 28.2), (62.7 + i * 3, 31.6), flat=True) for i in range(5)],
            Pg('bone', (72.5, 28), (76, 28), (74.2, 36)), Pg('bone', (64, 29), (67, 29), (65.4, 35.5)),  # 아래로 늘어진 큰 송곳니
            Cp('crack', (62, 12), (64, 16), 0.4, flat=True), Cp('crack', (64, 16), (63, 19), 0.4, flat=True),
            Cp('paint', (56, 23), (60, 26), 0.6, flat=True),
        ]),
        # 앞쪽 팔: 부푼 어깨 · 굵은 팔뚝 · 가죽 손목 띠 · 큰 주먹
        Part('armF', 'torso', (60, 32), 25, [E('skin', 60, 32, 7, 6.4), Cp('skin', (60, 33), (66, 44), 6.4, 5.0), E('bone', 61, 28, 5.2, 3.6), E('socket', 60, 28, 1.0, 1.0, flat=True), E('socket', 62.6, 28, 1.0, 1.0, flat=True)], tex=0.2),
        Part('foreF', 'armF', (66, 44), 27, [Cp('skin', (66, 44), (70, 53), 5.8, 4.3), Cp('leather', (67.6, 48), (68.8, 52), 5.2), E('nail', 69.8, 49.4, 0.6, 0.6, flat=True), E('skin', 71, 56, 5.2, 4.6),
                                             Cp('deep', (68.5, 55), (73.5, 55), 0.35, flat=True), Cp('deep', (68.5, 57.4), (73.5, 57.4), 0.35, flat=True)], tex=0.2),
        # 몽둥이: 손에서 앞위로 · 끝으로 굵어지는 나무 · 박힌 뼈 가시 · 쇠 띠
        Part('club', 'foreF', (71, 56), 26, [
            Cp('wood', (68, 62), (83, 41), 2.4, 3.0), Cp('wood', (80, 45), (92, 29), 4.2, 6.4), Cp('iron', (81.2, 43.6), (82.6, 41.6), 4.6),
            *[spike(x, y, a, 4.4) for x, y, a in ((84, 39, -150), (87, 33, -125), (91, 28, -80), (95, 29, -20), (95, 34, 25), (91, 39, 60), (88, 40, 100), (85.5, 36, 180))],
            Cp('deep', (83, 41), (90, 32), 0.4, flat=True),
        ], tex=0.25),
    ]

sn = lambda i: math.sin(i / 4 * math.pi * 2)
CB = -54  # 몽둥이가 기본 자세에서 가리키는 쪽 (도) — 장면마다 몽둥이가 가리킬 쪽을 직접 정한다
def club(target, arm, fore): return target - CB - arm - fore
def idle(i):  # 숨쉬기: 가슴이 오르내리고 깃털 · 망토 · 몽둥이가 따라 흔들린다
    b = [0, 0.5, 1, 0.5][i]
    arm, fore = -8 + 1.5 * sn(i), -30
    return {'hips': (0, 0, b * 0.3), 'torso': (0.6 * sn(i), 0, b * 0.7), 'head': (-1.2 * sn(i),), 'crest': (2.5 * sn(i),), 'cape': (2 * sn(i),), 'mane': (2 * sn(i),), 'armF': (arm,), 'foreF': (fore,), 'club': (club(14 + sn(i), arm, fore),), 'armB': (-2.5 * sn(i),), 'foreB': (2 * sn(i),)}
def walk(i):  # 걷기: 다리 엇갈림 · 무릎 굽힘 · 몸이 오르내림 · 팔 · 망토가 다리 반대로
    s = [1, 0, -1, 0][i]; bob = [1, -1, 1, -1][i]
    return {'hips': (0, 0, bob), 'torso': (6, 0, 0), 'thighF': (-20 * s,), 'shinF': ([6, 24, 10, 4][i],), 'thighB': (20 * s,), 'shinB': ([10, 4, 6, 24][i],),
            'armF': (-8 + 8 * s,), 'foreF': (-30,), 'club': (club(14 - 4 * s, -8 + 8 * s + 6, -30),), 'armB': (-16 * s,), 'foreB': (-8 * s,), 'cape': (-10 + 4 * s,), 'mane': (-6 + 3 * s,), 'crest': (-5 + 3 * s,), 'head': (2 - s,)}
def attack(i):  # 몽둥이: 등 뒤로 크게 치켜들기 → 앞으로 내려치기 → 땅까지 따라가기 → 돌아오기
    P = [  # (몸통 기울기, 엉덩이 dy, 팔, 아래팔, 몽둥이가 가리킬 쪽, 앞다리, 뒷다리, 뒤팔)
        (-12, 1, 165, 25, -168, -8, 12, -40),
        (14, 2, -62, -18, 22, -24, 18, 25),
        (22, 4, -30, -8, 70, -30, 22, 38),
        (6, 1, -12, 0, -20, -10, 8, 10),
    ][i]
    lean, dy, arm, fore, tgt, tf, tb, ab = P
    return {'hips': (0, 0, dy), 'torso': (lean,), 'head': (lean * 0.35,), 'armF': (arm,), 'foreF': (fore,), 'club': (club(tgt, arm + lean, fore),), 'armB': (ab,),
            'crest': (lean * 0.5,), 'cape': (-lean * 0.6,), 'mane': (-lean * 0.7,), 'thighF': (tf,), 'shinF': (abs(tf) * 0.6,), 'thighB': (tb,), 'shinB': (6,)}
def roar(i):  # 포효 (돌격 · 등장): 가슴을 펴고 머리를 젖히고, 몽둥이를 옆으로 쥔 채 빈 주먹을 치켜든다
    k = [0.55, 1, 1, 0.8][i]; arm, fore = 15 * k, -20
    return {'torso': (-10 * k, 0, -k), 'head': (-16 * k, 0, 0, 1.32, 1.32), 'crest': (-6 * k + 2 * sn(i), 0, 0, 1 + 0.1 * k, 1 + 0.1 * k), 'mane': (12 * k,), 'armF': (arm,), 'foreF': (fore,), 'club': (club(40, arm - 10 * k, fore),),
            'armB': (150 * k,), 'foreB': (20 * k,), 'cape': (12 * k + 2 * sn(i),), 'thighF': (-12 * k,), 'thighB': (12 * k,)}

ANIMS = [('idle', idle), ('run', walk), ('attack', attack), ('skill', roar)]

def reduce(rows, n=28):
    frames = [im for r in rows for im in r]
    pix = [p[:3] for im in frames for p in im.getdata() if p[3] and p != OUTLINE]
    strip = Image.new('RGB', (len(pix), 1)); strip.putdata(pix)
    pal = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for r in rows:
        nr = []
        for im in r:
            q = im.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'); o = im.copy(); po, pq, pi = o.load(), q.load(), im.load()
            for y in range(H):
                for x in range(W):
                    if pi[x, y][3] and pi[x, y] != OUTLINE: po[x, y] = pq[x, y] + (255,)
            nr.append(o)
        out.append(nr)
    return out

def build():
    parts = chief()
    return reduce([[render(parts, f(i)) for i in range(4)] for _, f in ANIMS], 32)

if __name__ == '__main__':
    rows = build()
    if '--write' in sys.argv:
        sys.path.insert(0, HERE)
        from sprites import meta_path, build_manifest
        metaf = meta_path('bosses'); meta = json.load(open(metaf, encoding='utf-8'))
        sheetf = os.path.join(HERE, '..', 'public', 'assets', 'custom', 'bosses.png'); sheet = Image.open(sheetf).convert('RGBA')
        old = meta.get('b_climbChief'); y0 = old['y0'] if old and old.get('drawn') else sheet.height
        out = Image.new('RGBA', (max(sheet.width, 4 * W), max(sheet.height, y0 + 4 * H)), (0, 0, 0, 0)); out.alpha_composite(sheet, (0, 0))
        for r, row in enumerate(rows):
            out.paste(Image.new('RGBA', (4 * W, H)), (0, y0 + r * H))
            for i, im in enumerate(row): out.alpha_composite(im, (i * W, y0 + r * H))
        out.save(sheetf)
        meta['b_climbChief'] = {'w': W, 'h': H, 'y0': y0, 'foot': 90, 'drawn': True, 'anims': {k: {'row': r, 'n': 4} for r, (k, _) in enumerate(ANIMS)}}
        json.dump(meta, open(metaf, 'w', encoding='utf-8'), ensure_ascii=False); build_manifest()
    else:
        S = 4
        # 위 줄: 보내 주신 그림 (게임 크기) · 아래: 직접 그린 장면
        ref = Image.open(os.path.join(HERE, '..', 'art', 'source', 'sheet_tower_bosses.png')).convert('RGBA')
        refs = [ref.crop((x0, 14, x1, 160)) for x0, x1 in ((12, 140), (140, 268), (268, 396), (396, 524))]
        out = Image.new('RGBA', (4 * W * S, 5 * H * S), (46, 44, 56, 255))
        for i, rf in enumerate(refs):
            k = (H * S - 8) / rf.height; rr = rf.resize((int(rf.width * k), int(rf.height * k)), Image.NEAREST)
            out.alpha_composite(rr, (i * W * S, 0))
        for r, row in enumerate(rows):
            for i, im in enumerate(row): out.alpha_composite(im.resize((W * S, H * S), Image.NEAREST), (i * W * S, (r + 1) * H * S))
        p = os.path.join(HERE, '..', 'art', 'preview_boss_chief.png'); out.save(p); print(p)
