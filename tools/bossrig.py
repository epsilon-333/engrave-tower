"""탑 보스 20명 뼈대 도트 생성기 (사용자가 준 AI 그림 시트를 대신한다 · 2026-11-17)

사람(people.py) · 짐승(creatures.py)과 같은 pixelrig 뼈대 방식: 부위를 기본 자세로 그려 두고 장면마다 관절 각도만 바꿔
1배 해상도에서 픽셀을 새로 찍는다. 조각을 떼어 움직이지 않고, 장면마다 한 장의 그림이 통째로 나온다.
- 관절: 엉덩이 · 무릎 · 발목 · 허리 · 목 · 어깨 · 팔꿈치 · 손목. 다리는 IK(발을 땅에 꽂아 두고 엉덩이가 움직이면 무릎이 저절로 굽는다)
- 동작: 서기 8(숨쉬기 · 무게 옮기기) · 걷기 8(발이 미끄러지지 않는 걸음 · 몸 들썩임 · 팔 반대 흔들림) · 공격 7(준비 → 더 움츠림 → 휘두름 → 내려친 순간)
        · 기술 7(모았다가 펼친다 · 마지막 장면을 붙든다) · 맞음 4 · 쓰러짐 3(비틀 → 무릎 → 눕기)
- 장수 · 줄 이름은 render/renderer.js bossFrame 이 기대하는 그대로 (사이 그림을 넣은 뒤와 같은 장수 → boss_tween.py 는 건너뛴다)

    python3 tools/bossrig.py                 → 미리 보기 art/preview_bossrig.png (보스 전부 · 동작마다 한 줄)
    python3 tools/bossrig.py climbChief      → 그 보스만 미리 보기 (+ art/preview_bossrig.gif)
    python3 tools/bossrig.py --write         → public/assets/custom/bosses.png · tools/sprites/bosses.json · sprites.json 다시 만들기
필요: Pillow · numpy
"""
import math, os, sys, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixelrig import Model, Part, Shape
from pixelrig_np import render, joints, reduce_colors_np
from sprites import meta_path, build_manifest

sn, cs, PI = math.sin, math.cos, math.pi
OUT = '#140e12'
COLORS = 16  # 보스는 크니 사람(11)보다 조금 더


def shade(h, k):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    if k >= 0: r, g, b = (int(c + (255 - c) * k) for c in (r, g, b))
    else: r, g, b = (int(c * (1 + k)) for c in (r, g, b))
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def ramp(h): return [shade(h, 0.22), h, shade(h, -0.24), shade(h, -0.5)]


def E(key, cx, cy, rx, ry, flat=False): return Shape('ellipse', key, cx, cy, rx, ry, flat=flat)
def C(key, a, b, r, flat=False): return Shape('capsule', key, a, b, r, flat=flat)
def Pg(key, *pts, flat=False): return Shape('poly', key, list(pts), flat=flat)
def Ln(key, a, b, w, flat=True): return Shape('line', key, a, b, w, flat=flat)


def rot(p, c, ang):
    """점 p 를 c 둘레로 ang(도) 돌린 자리 (화면 좌표 · 시계 방향이 +)"""
    r = math.radians(ang); s, co = sn(r), cs(r)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * co - y * s, c[1] + x * s + y * co)


def ik2(A, T, l1, l2, bend=1):
    """두 마디 IK: 뿌리 A 에서 목표 T 까지 l1 · l2 로 닿는 방향(도) 둘과 가운데 관절 자리. bend=+1 이면 가운데가 앞(+x)쪽"""
    ax, ay = A; tx, ty = T
    dx, dy = tx - ax, ty - ay
    d = max(1e-6, min(math.hypot(dx, dy), l1 + l2 - 0.05))
    base = math.atan2(dy, dx)
    ca = max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    a = math.acos(ca)
    d1 = base - bend * a
    kx, ky = ax + cs(d1) * l1, ay + sn(d1) * l1
    d2 = math.atan2(ty - ky, tx - kx)
    return math.degrees(d1), math.degrees(d2), (kx, ky)


def lerp(a, b, t): return a + (b - a) * t
def ease(t): return t * t * (3 - 2 * t)


# ═══════════════════════════ 사람꼴 뼈대 ═══════════════════════════
class Humanoid:
    """spec: 몸 치수 · 재질 · 머리 · 등 · 무기 · 동작 종류. 좌표는 오른쪽을 보는 몸, 바닥은 G."""

    def __init__(self, spec):
        self.spec = s = spec
        self.W, self.H = s.get('W', 160), s.get('H', 130)
        self.G = G = self.H - 2
        self.cx = cx = s.get('cx', self.W * 0.42)
        self.thigh, self.shin = s['thigh'], s['shin']
        self.upper, self.fore = s['upper'], s['fore']
        self.tl = s['torso']           # 허리 → 목
        self.hr = s['headR']           # 머리 반지름(가로)
        self.lt = s.get('limb', 5)     # 다리 굵기
        self.at = s.get('arm', 4.2)    # 팔 굵기
        self.footH = s.get('footH', 3)
        self.legGap = s.get('legGap', 4)
        self.hunch = s.get('hunch', 0)  # 허리 기본 굽힘(도, +면 앞으로 숙임)
        self.hipY = G - self.footH - self.shin - self.thigh + 1
        # 쉬는 관절 자리
        self.J = J = {}
        J['hipN'] = (cx + self.legGap * 0.5, self.hipY); J['hipF'] = (cx - self.legGap * 0.5, self.hipY)
        for k in 'NF':
            hx, hy = J['hip' + k]
            J['knee' + k] = (hx, hy + self.thigh); J['ankle' + k] = (hx, hy + self.thigh + self.shin)
        J['waist'] = (cx, self.hipY - 2)
        J['neck'] = (cx + s.get('neckX', 0), self.hipY - 2 - self.tl)
        sw = s.get('shoulderW', 7)
        J['shN'] = (cx + sw * 0.5 + s.get('shX', 0), self.hipY - 2 - self.tl + s.get('shDrop', 3))
        J['shF'] = (cx - sw * 0.5 + s.get('shX', 0), self.hipY - 2 - self.tl + s.get('shDrop', 3) - 1)
        for k in 'NF':
            sx, sy = J['sh' + k]
            J['elbow' + k] = (sx, sy + self.upper); J['wrist' + k] = (sx, sy + self.upper + self.fore)
        self.ramps, self.flats, self.parts = {}, {}, []
        self.build()
        self.model = Model(self.W, self.H, self.parts, self.ramps, OUT, self.flats)

    # ── 재질 ──
    def mat(self, key, color): self.ramps[key] = ramp(color)
    def flat(self, key, color): self.flats[key] = color
    def add(self, *a, **k): self.parts.append(Part(*a, **k))

    # ── 몸 만들기: spec 의 부품 이름으로 ──
    def build(self):
        s, J = self.spec, self.J
        skin = s.get('skin', '#c8a070')
        self.mat('skin', skin); self.mat('skin2', shade(skin, -0.12))
        self.flat('eye', s.get('eye', '#ffe040')); self.flat('eyeD', '#1a0e10'); self.flat('mouth', '#2a0c12'); self.flat('tooth', '#f4ecd8'); self.flat('glow', s.get('glow', '#ffe9a0')); self.flat('glow2', s.get('glow2', '#ff9a3a'))
        self.build_legs(); self.build_body(); self.build_head(); self.build_back(); self.build_arms()

    def leg_shapes(self, k, mat):
        hx, hy = self.J['hip' + k]; kx, ky = self.J['knee' + k]; ax, ay = self.J['ankle' + k]
        t = self.lt
        th = [C(mat, (hx, hy), (kx, ky), t * 0.95), E(mat, kx, ky, t * 0.8, t * 0.7)]
        sh = [C(mat, (kx, ky), (ax, ay), t * 0.78)]
        return th, sh

    def foot_shapes(self, k, mat='foot'):
        ax, ay = self.J['ankle' + k]; fh = self.footH; fl = self.spec.get('footL', self.lt * 1.9)
        return [Pg(mat, (ax - fl * 0.35, ay - 1), (ax + fl * 0.65, ay + 0.2), (ax + fl * 0.7, ay + fh), (ax - fl * 0.4, ay + fh))]

    def build_legs(self):
        s, J = self.spec, self.J
        leg = s.get('legMat', 'skin'); self.mat('foot', s.get('foot', shade(s.get('skin', '#c8a070'), -0.3)))
        if s.get('legs', True) is False: return  # 긴 옷이 다리를 덮는 보스(치마 폴리곤으로 대신)
        for k, z in (('F', 0.4), ('N', 3.0)):
            th, sh = self.leg_shapes(k, leg)
            self.add('thigh' + k, 'hips', J['hip' + k], z, th, tex=s.get('legTex', 0.05))
            self.add('shin' + k, 'thigh' + k, J['knee' + k], z + 0.05, sh, tex=s.get('legTex', 0.05))
            self.add('foot' + k, 'shin' + k, J['ankle' + k], z + 0.1, self.foot_shapes(k), sep=False)
            if s.get('claws'):
                ax, ay = J['ankle' + k]; fl = s.get('footL', self.lt * 1.9)
                self.parts[-1].shapes += [Pg('tooth', (ax + fl * 0.5, ay + 1), (ax + fl * 1.1, ay + 2.5), (ax + fl * 0.5, ay + 3), flat=True), Pg('tooth', (ax + fl * 0.15, ay + 1.5), (ax + fl * 0.5, ay + 3.4), (ax + fl * 0.1, ay + 3.2), flat=True)]

    def build_body(self):
        s, J = self.spec, self.J
        cx, hipY = self.cx, self.hipY; wx, wy = J['waist']; nx, ny = J['neck']
        bw = s.get('bodyW', 11)  # 가슴 반너비
        body = s.get('body', 'fur'); col = s.get('bodyCol', '#6a4a3a')
        self.mat('body', col); self.mat('body2', shade(col, -0.15)); self.mat('belt', s.get('belt', '#5a3a28')); self.mat('cloth', s.get('cloth', '#7a2a2a'))
        self.flat('metal', s.get('metalFlat', '#d8d0c0')); self.mat('trim', s.get('trim', '#c8a040'))
        # 엉덩이(뿌리): 골반 · 허리띠 · 허리 가리개
        hips = [E('belt', cx, hipY, bw * 0.75, 3.2)]
        if body in ('fur', 'skin', 'ogre'): hips.append(Pg('cloth', (cx - bw * 0.55, hipY), (cx + bw * 0.6, hipY), (cx + bw * 0.5, hipY + self.thigh * 0.55), (cx - bw * 0.4, hipY + self.thigh * 0.5)))
        if body == 'plate': hips.append(Pg('body2', (cx - bw * 0.6, hipY - 1), (cx + bw * 0.65, hipY - 1), (cx + bw * 0.55, hipY + self.thigh * 0.4), (cx - bw * 0.5, hipY + self.thigh * 0.4)))
        if body == 'robe':  # 긴 옷: 바닥까지 치마 (다리 대신)
            hem = s.get('hemW', bw * 1.5)
            hips = [Pg('body', (cx - bw * 0.7, hipY - 2), (cx + bw * 0.7, hipY - 2), (cx + hem, self.G - 1), (cx - hem * 0.9, self.G - 1)),
                    Pg('body2', (cx - bw * 0.1, hipY), (cx + bw * 0.2, hipY), (cx + hem * 0.45, self.G - 1), (cx - hem * 0.05, self.G - 1)),
                    E('belt', cx, hipY, bw * 0.72, 2.6)]
            if s.get('hemTrim'): hips.append(Ln('trim', (cx - hem * 0.9, self.G - 2.5), (cx + hem, self.G - 2.5), 1.6, flat=False))
        self.add('hips', None, (cx, hipY), 2.0, hips, tex=0.04)
        # 몸통: 허리 → 가슴 → 어깨
        tl = self.tl
        if body == 'ogre':
            tor = [E('body', cx - 1, wy - tl * 0.45, bw * 1.1, tl * 0.62), E('body', cx + 1, wy - tl * 0.8, bw * 0.95, tl * 0.4), E('skin2', cx + bw * 0.2, wy - tl * 0.35, bw * 0.55, tl * 0.4)]
        elif body == 'plate':
            tor = [Pg('body', (cx - bw * 0.85, wy - tl * 0.95), (cx + bw * 0.9, wy - tl * 0.95), (cx + bw * 0.75, wy), (cx - bw * 0.7, wy)), Pg('body2', (cx - bw * 0.3, wy - tl * 0.9), (cx + bw * 0.55, wy - tl * 0.9), (cx + bw * 0.45, wy - 1), (cx - bw * 0.2, wy - 1)),
                   Ln('metal', (cx - bw * 0.5, wy - tl * 0.5), (cx + bw * 0.7, wy - tl * 0.5), 1.2), Ln('metal', (cx - bw * 0.4, wy - tl * 0.25), (cx + bw * 0.6, wy - tl * 0.25), 1.2)]
        elif body == 'robe':
            tor = [Pg('body', (cx - bw * 0.8, wy - tl * 0.95), (cx + bw * 0.85, wy - tl * 0.95), (cx + bw * 0.7, wy + 1), (cx - bw * 0.65, wy + 1)), Pg('body2', (cx + bw * 0.1, wy - tl * 0.9), (cx + bw * 0.6, wy - tl * 0.9), (cx + bw * 0.45, wy), (cx + bw * 0.05, wy))]
            if s.get('robeTrim'): tor.append(Ln('trim', (cx + bw * 0.05, wy - tl * 0.95), (cx + bw * 0.1, wy + 1), 1.4, flat=False))
        elif body == 'skin':
            tor = [E('body', cx, wy - tl * 0.5, bw * 0.95, tl * 0.58), E('skin2', cx + bw * 0.25, wy - tl * 0.3, bw * 0.5, tl * 0.32)]
        else:  # fur: 털 가죽 몸
            tor = [E('body', cx, wy - tl * 0.5, bw * 1.05, tl * 0.6), E('skin', cx + bw * 0.3, wy - tl * 0.28, bw * 0.52, tl * 0.34), E('body2', cx - bw * 0.2, wy - tl * 0.85, bw * 0.75, tl * 0.3)]
        for extra in s.get('torsoExtra', []): tor.append(extra(self))
        self.add('torso', 'hips', (wx, wy), 2.2, tor, tex=s.get('bodyTex', 0.12 if body in ('fur', 'ogre') else 0.04))

    def build_head(self):
        s, J = self.spec, self.J
        nx, ny = J['neck']; hr = self.hr; hy = ny - hr * 0.9 + s.get('headDrop', 0); hx = nx + s.get('headX', 1)
        self.headC = (hx, hy)
        kind = s.get('head', 'skull')
        hcol = s.get('headCol', s.get('skin', '#c8a070'))
        self.mat('head', hcol); self.mat('hair', s.get('hair', '#a02020')); self.mat('horn', s.get('horn', '#e8dcc0')); self.mat('bone', s.get('bone', '#ece4d0'))
        sh = []
        if kind == 'skull':  # 해골 가면 (가면 족장)
            sh = [E('bone', hx, hy, hr, hr * 1.05), Pg('bone', (hx - hr * 0.5, hy + hr * 0.5), (hx + hr * 0.7, hy + hr * 0.5), (hx + hr * 0.55, hy + hr * 1.25), (hx - hr * 0.3, hy + hr * 1.2)),
                  E('eyeD', hx + hr * 0.45, hy - hr * 0.05, hr * 0.26, hr * 0.3, flat=True), E('eyeD', hx - hr * 0.2, hy - hr * 0.05, hr * 0.22, hr * 0.28, flat=True),
                  E('eye', hx + hr * 0.47, hy - hr * 0.03, hr * 0.1, hr * 0.12, flat=True), E('eye', hx - hr * 0.2, hy - hr * 0.03, hr * 0.08, hr * 0.1, flat=True),
                  Pg('eyeD', (hx + hr * 0.3, hy + hr * 0.35), (hx + hr * 0.5, hy + hr * 0.35), (hx + hr * 0.4, hy + hr * 0.6), flat=True)]
            for i in range(4): x = hx - hr * 0.25 + i * hr * 0.26; sh.append(Ln('eyeD', (x, hy + hr * 0.75), (x, hy + hr * 1.15), 0.9))
            for sx in (-0.6, 0.75): sh.append(Pg('horn', (hx + sx * hr, hy - hr * 0.55), (hx + sx * hr * 1.6, hy - hr * 1.7), (hx + sx * hr * 1.15, hy - hr * 0.35)))
        elif kind == 'ogre':  # 큰 턱 · 엄니 · 작은 눈 · 왕관 얼음
            sh = [E('head', hx, hy, hr, hr * 0.95), Pg('head', (hx - hr * 0.7, hy + hr * 0.3), (hx + hr * 1.05, hy + hr * 0.25), (hx + hr * 0.95, hy + hr * 1.1), (hx - hr * 0.5, hy + hr * 1.05)),
                  Ln('mouth', (hx - hr * 0.2, hy + hr * 0.75), (hx + hr * 0.95, hy + hr * 0.7), 1.3), Pg('tooth', (hx + hr * 0.75, hy + hr * 0.75), (hx + hr * 0.95, hy + hr * 0.15), (hx + hr * 1.0, hy + hr * 0.8), flat=True), Pg('tooth', (hx + hr * 0.2, hy + hr * 0.78), (hx + hr * 0.35, hy + hr * 0.3), (hx + hr * 0.45, hy + hr * 0.8), flat=True),
                  E('eyeD', hx + hr * 0.55, hy - hr * 0.1, hr * 0.17, hr * 0.14, flat=True), E('eye', hx + hr * 0.57, hy - hr * 0.1, hr * 0.08, hr * 0.07, flat=True), E('eyeD', hx - hr * 0.05, hy - hr * 0.12, hr * 0.14, hr * 0.12, flat=True),
                  Ln('skin2', (hx + hr * 0.2, hy - hr * 0.35), (hx + hr * 0.8, hy - hr * 0.3), 1.2, flat=False)]
            for i in range(5): a = -0.9 + i * 0.45; sh.append(Pg('ice', (hx + cs(PI * 1.5 + a) * hr * 0.9, hy + sn(PI * 1.5 + a) * hr * 0.85), (hx + cs(PI * 1.5 + a) * hr * 1.7, hy + sn(PI * 1.5 + a) * hr * 1.7 - 1), (hx + cs(PI * 1.5 + a + 0.25) * hr * 0.9, hy + sn(PI * 1.5 + a + 0.25) * hr * 0.85)))
        elif kind == 'hood':  # 두건 · 그늘진 얼굴 · 빛나는 눈
            sh = [Pg('hair', (hx - hr * 1.1, hy + hr * 0.9), (hx - hr * 0.9, hy - hr * 0.6), (hx, hy - hr * 1.35), (hx + hr * 1.0, hy - hr * 0.5), (hx + hr * 1.15, hy + hr * 0.9)),
                  E('eyeD', hx + hr * 0.25, hy + hr * 0.15, hr * 0.7, hr * 0.62, flat=True), E('eye', hx + hr * 0.55, hy + hr * 0.02, hr * 0.14, hr * 0.1, flat=True), E('eye', hx + hr * 0.05, hy + hr * 0.02, hr * 0.12, hr * 0.09, flat=True)]
        elif kind == 'helm':  # 투구 · 뿔 · 눈구멍
            sh = [E('head', hx, hy, hr, hr), Pg('head', (hx - hr * 0.8, hy), (hx + hr * 1.05, hy), (hx + hr * 0.9, hy + hr * 1.1), (hx - hr * 0.6, hy + hr * 1.05)),
                  Ln('eyeD', (hx + hr * 0.1, hy + hr * 0.05), (hx + hr * 0.95, hy + hr * 0.05), 2.4), E('eye', hx + hr * 0.6, hy + hr * 0.05, hr * 0.13, hr * 0.1, flat=True), E('eye', hx + hr * 0.15, hy + hr * 0.05, hr * 0.11, hr * 0.09, flat=True),
                  Ln('metal', (hx - hr * 0.3, hy - hr * 0.95), (hx + hr * 0.45, hy - hr * 0.95), 1.4)]
            for sx in (-0.75, 0.85): sh.append(Pg('horn', (hx + sx * hr, hy - hr * 0.3), (hx + sx * hr * 1.9, hy - hr * 1.3), (hx + sx * hr * 1.15, hy - hr * 0.05)))
        elif kind == 'hat':  # 마녀 모자 · 긴 코
            sh = [E('head', hx, hy + hr * 0.1, hr * 0.85, hr * 0.9), Pg('head', (hx + hr * 0.5, hy + hr * 0.25), (hx + hr * 1.55, hy + hr * 0.5), (hx + hr * 0.55, hy + hr * 0.6)), Ln('mouth', (hx + hr * 0.2, hy + hr * 0.8), (hx + hr * 0.6, hy + hr * 0.75), 1.1),
                  E('eye', hx + hr * 0.4, hy, hr * 0.17, hr * 0.14, flat=True), E('eyeD', hx + hr * 0.45, hy, hr * 0.07, hr * 0.08, flat=True),
                  Pg('hair', (hx - hr * 1.5, hy - hr * 0.35), (hx + hr * 1.25, hy - hr * 0.35), (hx + hr * 0.65, hy - hr * 0.7), (hx - hr * 0.2, hy - hr * 2.9), (hx - hr * 0.95, hy - hr * 0.8)), Ln('belt', (hx - hr * 0.95, hy - hr * 0.72), (hx + hr * 0.7, hy - hr * 0.72), 1.5, flat=False)]
        elif kind == 'crown':  # 왕관 · 사람 얼굴 · 수염
            sh = [E('head', hx, hy, hr * 0.9, hr), Pg('hair', (hx - hr * 0.9, hy + hr * 0.3), (hx + hr * 0.9, hy + hr * 0.35), (hx + hr * 0.5, hy + hr * 1.6), (hx - hr * 0.4, hy + hr * 1.5)),
                  E('eyeD', hx + hr * 0.45, hy - hr * 0.05, hr * 0.14, hr * 0.14, flat=True), E('eyeD', hx - hr * 0.1, hy - hr * 0.05, hr * 0.12, hr * 0.13, flat=True), Ln('mouth', (hx + hr * 0.1, hy + hr * 0.45), (hx + hr * 0.5, hy + hr * 0.45), 0.9),
                  Pg('trim', (hx - hr * 0.95, hy - hr * 0.55), (hx + hr * 0.95, hy - hr * 0.55), (hx + hr * 1.0, hy - hr * 1.5), (hx + hr * 0.5, hy - hr * 1.0), (hx, hy - hr * 1.7), (hx - hr * 0.5, hy - hr * 1.0), (hx - hr * 1.0, hy - hr * 1.5))]
        elif kind == 'mirror':  # 거울 투구: 얼굴 없이 비치는 면
            sh = [E('head', hx, hy, hr, hr * 1.05), Ln('glow', (hx - hr * 0.3, hy - hr * 0.6), (hx + hr * 0.5, hy + hr * 0.4), 1.2), Pg('horn', (hx - hr * 0.2, hy - hr * 0.9), (hx + hr * 0.1, hy - hr * 2.2), (hx + hr * 0.4, hy - hr * 0.9))]
        elif kind == 'shardCrown':  # 유리 조각 왕관 · 창백한 얼굴
            sh = [E('head', hx, hy, hr * 0.9, hr), Pg('hair', (hx - hr * 1.2, hy + hr * 1.6), (hx - hr * 1.0, hy - hr * 0.6), (hx, hy - hr * 1.1), (hx + hr * 0.6, hy - hr * 0.7), (hx + hr * 0.2, hy + hr * 0.2), (hx - hr * 0.5, hy + hr * 1.2)),
                  E('eye', hx + hr * 0.45, hy, hr * 0.15, hr * 0.14, flat=True), Ln('mouth', (hx + hr * 0.2, hy + hr * 0.55), (hx + hr * 0.6, hy + hr * 0.5), 0.8)]
            for i in range(5): a = -1.3 + i * 0.5; sh.append(Pg('ice', (hx + cs(PI * 1.5 + a) * hr * 0.8, hy + sn(PI * 1.5 + a) * hr * 0.9), (hx + cs(PI * 1.5 + a) * hr * (1.9 if i % 2 else 2.4), hy + sn(PI * 1.5 + a) * hr * (1.8 if i % 2 else 2.3)), (hx + cs(PI * 1.5 + a + 0.3) * hr * 0.8, hy + sn(PI * 1.5 + a + 0.3) * hr * 0.9)))
        elif kind == 'mitre':  # 대사제: 높은 관 · 베일
            sh = [E('head', hx, hy, hr * 0.85, hr * 0.95), Pg('body', (hx - hr * 0.95, hy - hr * 0.3), (hx + hr * 0.95, hy - hr * 0.3), (hx + hr * 0.55, hy - hr * 2.8), (hx - hr * 0.55, hy - hr * 2.8)), Ln('trim', (hx - hr * 0.1, hy - hr * 0.3), (hx, hy - hr * 2.6), 1.4, flat=False),
                  Ln('trim', (hx - hr * 0.9, hy - hr * 0.35), (hx + hr * 0.9, hy - hr * 0.35), 1.6, flat=False), E('eyeD', hx + hr * 0.4, hy, hr * 0.12, hr * 0.12, flat=True), E('eyeD', hx - hr * 0.1, hy, hr * 0.1, hr * 0.12, flat=True), Ln('mouth', (hx + hr * 0.1, hy + hr * 0.45), (hx + hr * 0.45, hy + hr * 0.45), 0.8)]
        elif kind == 'scholar':  # 대서고관: 납작한 학사모 · 외알 안경 · 수염
            sh = [E('head', hx, hy, hr * 0.85, hr * 0.95), Pg('hair', (hx - hr * 0.7, hy + hr * 0.45), (hx + hr * 0.7, hy + hr * 0.45), (hx + hr * 0.3, hy + hr * 1.8), (hx - hr * 0.3, hy + hr * 1.7)),
                  Pg('body2', (hx - hr * 1.0, hy - hr * 0.55), (hx + hr * 1.0, hy - hr * 0.55), (hx + hr * 0.9, hy - hr * 1.1), (hx - hr * 0.9, hy - hr * 1.1)), Pg('body2', (hx - hr * 1.5, hy - hr * 1.1), (hx + hr * 1.3, hy - hr * 1.1), (hx + hr * 1.2, hy - hr * 1.5), (hx - hr * 1.4, hy - hr * 1.5)),
                  E('glow', hx + hr * 0.45, hy, hr * 0.26, hr * 0.26, flat=True), E('eyeD', hx + hr * 0.45, hy, hr * 0.12, hr * 0.12, flat=True), E('eyeD', hx - hr * 0.15, hy, hr * 0.1, hr * 0.12, flat=True)]
        elif kind == 'starHood':  # 별을 읽는 자: 깊은 두건 속 별빛 눈 · 이마의 별
            sh = [Pg('body', (hx - hr * 1.2, hy + hr * 1.1), (hx - hr * 1.0, hy - hr * 0.7), (hx, hy - hr * 1.5), (hx + hr * 1.1, hy - hr * 0.6), (hx + hr * 1.25, hy + hr * 1.1)),
                  E('eyeD', hx + hr * 0.25, hy + hr * 0.2, hr * 0.72, hr * 0.68, flat=True), E('glow', hx + hr * 0.55, hy + hr * 0.05, hr * 0.14, hr * 0.12, flat=True), E('glow', hx + hr * 0.08, hy + hr * 0.05, hr * 0.12, hr * 0.1, flat=True),
                  Pg('glow', (hx + hr * 0.1, hy - hr * 1.25), (hx + hr * 0.25, hy - hr * 0.95), (hx + hr * 0.55, hy - hr * 0.9), (hx + hr * 0.3, hy - hr * 0.7), (hx + hr * 0.4, hy - hr * 0.4), (hx + hr * 0.1, hy - hr * 0.6), (hx - hr * 0.2, hy - hr * 0.4), (hx - hr * 0.1, hy - hr * 0.7), (hx - hr * 0.35, hy - hr * 0.9), (hx - hr * 0.05, hy - hr * 0.95), flat=True)]
        elif kind == 'harpy':  # 하피 여왕: 깃털 관 · 매서운 눈 · 부리 같은 입
            sh = [E('head', hx, hy, hr * 0.85, hr * 0.95), Pg('hair', (hx - hr * 1.0, hy + hr * 0.9), (hx - hr * 0.9, hy - hr * 0.5), (hx, hy - hr * 0.95), (hx + hr * 0.6, hy - hr * 0.6), (hx + hr * 0.1, hy), (hx - hr * 0.4, hy + hr * 0.9)),
                  E('eye', hx + hr * 0.45, hy - hr * 0.05, hr * 0.16, hr * 0.12, flat=True), E('eyeD', hx + hr * 0.5, hy - hr * 0.05, hr * 0.06, hr * 0.08, flat=True), Pg('horn', (hx + hr * 0.6, hy + hr * 0.25), (hx + hr * 1.3, hy + hr * 0.5), (hx + hr * 0.6, hy + hr * 0.6))]
            for i in range(5): a = -1.1 + i * 0.42; sh.append(Pg('cloth', (hx + cs(PI * 1.5 + a) * hr * 0.75, hy + sn(PI * 1.5 + a) * hr * 0.8), (hx + cs(PI * 1.5 + a - 0.15) * hr * 2.3, hy + sn(PI * 1.5 + a - 0.15) * hr * 2.2), (hx + cs(PI * 1.5 + a + 0.25) * hr * 0.75, hy + sn(PI * 1.5 + a + 0.25) * hr * 0.8)))
        elif kind == 'wraith':  # 망령 기사단장: 빈 투구 속 푸른 불
            sh = [Pg('head', (hx - hr * 0.9, hy - hr * 0.9), (hx + hr * 0.95, hy - hr * 0.9), (hx + hr * 1.0, hy + hr * 1.0), (hx - hr * 0.8, hy + hr * 1.0)), E('head', hx, hy - hr * 0.7, hr * 0.95, hr * 0.55),
                  Pg('eyeD', (hx - hr * 0.2, hy - hr * 0.15), (hx + hr * 0.95, hy - hr * 0.15), (hx + hr * 0.95, hy + hr * 0.3), (hx - hr * 0.2, hy + hr * 0.3), flat=True), E('eye', hx + hr * 0.55, hy + hr * 0.05, hr * 0.15, hr * 0.13, flat=True), E('eye', hx + hr * 0.1, hy + hr * 0.05, hr * 0.13, hr * 0.12, flat=True),
                  Pg('horn', (hx - hr * 0.4, hy - hr * 0.95), (hx - hr * 0.3, hy - hr * 2.4), (hx + hr * 0.1, hy - hr * 0.95)), Pg('horn', (hx + hr * 0.5, hy - hr * 0.95), (hx + hr * 0.9, hy - hr * 2.1), (hx + hr * 0.95, hy - hr * 0.9))]
        for extra in s.get('headExtra', []): sh += extra(self, hx, hy)
        self.add('head', 'torso', J['neck'], 2.6, sh, tex=0.02)

    def build_back(self):
        s, J = self.spec, self.J
        cx, wy = self.cx, J['waist'][1]; nx, ny = J['neck']; bw = s.get('bodyW', 11)
        back = s.get('back')
        if back == 'cape':
            self.mat('cape', s.get('capeCol', '#4a1a2a'))
            L = s.get('capeLen', self.tl + self.thigh * 0.9)
            self.add('cape', 'torso', (cx - bw * 0.4, ny + 2), 0.2, [Pg('cape', (cx - bw * 0.7, ny + 1), (cx + bw * 0.3, ny + 1), (cx + bw * 0.1, ny + L), (cx - bw * 0.4, ny + L + 3), (cx - bw * 1.2, ny + L - 2), (cx - bw * 1.1, ny + L * 0.5))], tex=0.03)
        elif back == 'mane':  # 붉은 갈기 (가면 족장)
            L = self.tl * 1.1
            self.add('mane', 'torso', (cx - bw * 0.3, ny + 1), 0.3, [Pg('hair', (cx - bw * 0.5, ny - self.hr * 1.2), (cx + bw * 0.4, ny - self.hr * 1.4), (cx + bw * 0.3, ny + 2), (cx - bw * 0.2, ny + L * 0.7), (cx - bw * 1.3, ny + L), (cx - bw * 1.5, ny + L * 0.45), (cx - bw * 1.2, ny - self.hr * 0.3))], tex=0.1)
        elif back == 'wings':  # 깃털 날개 (하피)
            self.mat('wing', s.get('wingCol', '#5a7aa8')); self.mat('wing2', shade(s.get('wingCol', '#5a7aa8'), 0.2))
            for k, z, sx in (('F', 0.1, -1), ('N', 2.35, 1)):
                px, py = cx - bw * 0.2 + (2 if k == 'N' else -2), ny + 3
                L = s.get('wingLen', 42)
                shp = [Pg('wing', (px, py), (px - L * 0.55, py - L * 0.65), (px - L * 1.0, py - L * 0.55), (px - L * 0.95, py - L * 0.2), (px - L * 0.6, py + L * 0.25), (px - L * 0.2, py + L * 0.3))]
                for i in range(5): u = i / 4; shp.append(Pg('wing2', (px - L * (0.95 - u * 0.75), py - L * (0.2 + u * 0.15) + L * 0.35 * u), (px - L * (0.98 - u * 0.72), py + L * (0.05 + u * 0.28)), (px - L * (0.86 - u * 0.68), py + L * (0.02 + u * 0.3))))
                self.add('wing' + k, 'torso', (px, py), z, shp, tex=0.05)
        elif back == 'boneWings':  # 뼈 날개 (망령)
            for k, z in (('F', 0.1), ('N', 0.15)):
                px, py = cx - bw * 0.3, ny + 2; L = s.get('wingLen', 36); sgn = 1 if k == 'N' else 0.85
                self.add('wing' + k, 'torso', (px, py), z, [C('bone', (px, py), (px - L * 0.5 * sgn, py - L * 0.5), 1.6), C('bone', (px - L * 0.5 * sgn, py - L * 0.5), (px - L * 1.0 * sgn, py - L * 0.2), 1.3), C('bone', (px - L * 0.5 * sgn, py - L * 0.5), (px - L * 0.75 * sgn, py + L * 0.15), 1.1), C('bone', (px - L * 0.5 * sgn, py - L * 0.5), (px - L * 0.45 * sgn, py + L * 0.3), 1.0)], sep=False)
        for extra in s.get('backExtra', []): extra(self)

    # ── 팔 · 무기 ──
    def arm_shapes(self, k):
        sx, sy = self.J['sh' + k]; ex, ey = self.J['elbow' + k]; wx, wy = self.J['wrist' + k]
        t = self.at; am = self.spec.get('armMat', 'skin'); fm = self.spec.get('foreMat', am)
        up = [E(am, sx, sy, t * 1.25, t * 1.15), C(am, (sx, sy), (ex, ey), t)]
        if self.spec.get('pauldron'): up.insert(0, E('body2' if self.spec.get('body') != 'plate' else 'body', sx, sy - 1, t * 1.9, t * 1.5))
        fo = [C(fm, (ex, ey), (wx, wy), t * 0.9), E(fm, ex, ey, t * 0.85, t * 0.8)]
        if self.spec.get('bracer'): fo.append(C('belt', (ex + (wx - ex) * 0.45, ey + (wy - ey) * 0.45), (wx, wy), t * 1.0))
        hand = [E(self.spec.get('handMat', 'skin2'), wx, wy + t * 0.5, t * 1.05, t * 0.95)]
        return up, fo, hand

    def build_arms(self):
        s, J = self.spec, self.J
        self.mat('wood', s.get('wood', '#6a4630')); self.mat('iron', s.get('iron', '#8a8a96')); self.mat('gold', s.get('gold', '#d8b040')); self.mat('ice', s.get('ice', '#bfe8ff'))
        self.flat('ice', s.get('iceFlat', '#e8fbff')); self.mat('blade', s.get('blade', '#c8d0dc')); self.mat('gem', s.get('gem', '#60e080'))
        for k, z in (('F', 0.5), ('N', 3.5)):
            up, fo, hand = self.arm_shapes(k)
            self.add('arm' + k, 'torso', J['sh' + k], z, up, tex=s.get('armTex', 0.05))
            self.add('fore' + k, 'arm' + k, J['elbow' + k], z + 0.05, fo, tex=s.get('armTex', 0.05))
            self.add('hand' + k, 'fore' + k, J['wrist' + k], z + 0.1, hand, sep=False)
        wk = s.get('weapon')
        if wk:
            wx, wy = J['wristN']
            shp, grip2 = WEAPONS[wk](self, wx, wy)
            self.add('weapon', 'handN', (wx, wy), 3.65 if not s.get('weaponBehind') else 3.45, shp, sep=False)
            self.grip2 = grip2
            if grip2: self.add('grip2', 'weapon', grip2, 0, [], sep=False)
        ok = s.get('offhand')
        if ok:
            wx, wy = J['wristF']
            shp, _ = WEAPONS[ok](self, wx, wy)
            self.add('offhand', 'handF', (wx, wy), 0.65 if not s.get('offhandFront') else 3.62, shp, sep=False)

    # ═══════ 자세 풀기: 높은 수준의 설명 → pixelrig pose ═══════
    def solve(self, P):
        """P 키: hips=(dx,dy[,ang]) torso=ang head=(ang[,dx,dy]) ankleN/F=(x,y) 세계 좌표(없으면 쉬는 자리) footN/F=발끝 추가 각
        armN/F=(어깨각, 팔꿈치각, 손목각) 또는 wristN/F=(x,y) 목표 · weapon=각 · 그 밖은 그대로 pose 로"""
        s, J = self.spec, self.J
        pose = {}
        hdx, hdy = P.get('hips', (0, 0))[:2]; hang = P.get('hips', (0, 0, 0))[2] if len(P.get('hips', (0, 0))) > 2 else 0
        pose['hips'] = (hang, hdx, hdy)
        tang = P.get('torso', 0) + self.hunch
        pose['torso'] = (tang,)
        hd = P.get('head', (0,)); pose['head'] = (hd[0], hd[1] if len(hd) > 1 else 0, hd[2] if len(hd) > 2 else 0)
        # 다리: 발목 목표 → IK
        if s.get('legs', True) is not False:
            for k in 'NF':
                hip = rot((J['hip' + k][0] + hdx, J['hip' + k][1] + hdy), (self.cx + hdx, self.hipY + hdy), hang)
                tgt = P.get('ankle' + k)
                if tgt is None: tgt = J['ankle' + k]
                d1, d2, _ = ik2(hip, tgt, self.thigh, self.shin, bend=1)
                pose['thigh' + k] = (d1 - 90 - hang,)
                pose['shin' + k] = (d2 - d1,)
                pose['foot' + k] = (-(d2 - 90) + P.get('foot' + k, 0),)
        # 팔: 각도 또는 손목 목표
        for k in 'NF':
            a = P.get('arm' + k)
            if a is None and P.get('wrist' + k) is not None:
                shw = self.joint_world(pose, 'arm' + k)
                prot = hang + tang
                d1, d2, _ = ik2(shw, P['wrist' + k], self.upper, self.fore, bend=P.get('bend' + k, -1))
                a = (d1 - 90 - prot, d2 - d1, P.get('hand' + k, 0))
            if a is None: a = (0, 0, 0)
            pose['arm' + k] = (a[0],); pose['fore' + k] = (a[1],); pose['hand' + k] = (a[2] if len(a) > 2 else 0,)
        if 'weapon' in self.model.by: pose['weapon'] = (P.get('weapon', 0),)
        if 'offhand' in self.model.by: pose['offhand'] = (P.get('offhand', 0),)
        for k, v in P.items():
            if k in self.model.by and k not in pose: pose[k] = v if isinstance(v, tuple) else (v,)
        if '_hide' in P: pose['_hide'] = P['_hide']
        return pose

    def joint_world(self, pose, name):
        return joints(self.model, {k: v for k, v in pose.items() if k != '_hide'}, [name])[name]

    def two_hand(self, P, pose):
        """두 손 무기: 먼 손을 무기의 둘째 손잡이에 붙인다"""
        if not getattr(self, 'grip2', None): return pose
        g = self.joint_world(pose, 'grip2')
        shw = self.joint_world(pose, 'armF')
        prot = (pose['hips'][0] if len(pose['hips']) > 0 else 0) + pose['torso'][0]
        d1, d2, _ = ik2(shw, g, self.upper, self.fore, bend=P.get('bendF', -1))
        pose['armF'] = (d1 - 90 - prot,); pose['foreF'] = (d2 - d1,); pose['handF'] = (0,)
        return pose

    def P(self, **kw):
        pose = self.solve(kw)
        if kw.get('twoHand', self.spec.get('twoHand')): pose = self.two_hand(kw, pose)
        return pose

    # ═══════ 동작 ═══════
    def anims(self):
        s = self.spec
        A = {}
        A['idle'] = [self.idle(i, i / 8 * 2 * PI) for i in range(8)]
        A['run'] = [self.run(i, i / 8 * 2 * PI) for i in range(8)]
        A['attack'] = [getattr(self, 'atk_' + s.get('attack', 'smash'))(i) for i in range(7)]
        A['skill'] = [getattr(self, 'skl_' + s.get('skill', 'roar'))(i) for i in range(7)]
        A['hit'] = [self.hit(i) for i in range(4)]
        A['death'] = [self.death(i) for i in range(3)]
        return A

    # 쉬는 손: 무기를 든 손은 아래로 내리고 조금 앞으로, 빈 손은 늘어뜨린다
    def rest_arms(self, f=0, sway=1.0):
        s = self.spec
        restN = s.get('restN', (18, -22, 0)); restF = s.get('restF', (-14, -18, 0))
        armN = (restN[0] + 2.5 * sway * sn(f), restN[1] + 2 * sway * sn(f + 0.6), restN[2])
        armF = (restF[0] - 2.5 * sway * sn(f), restF[1] - 2 * sway * sn(f + 0.6), restF[2])
        return armN, armF

    def idle(self, i, f):
        s = self.spec
        br = sn(f)  # 숨: 가슴이 오르내린다
        armN, armF = self.rest_arms(f)
        ws = s.get('restW', 0)
        return self.P(hips=(0.4 * sn(f * 0.5), 0.9 - 0.9 * br), torso=-1.5 * br, head=(1.2 * br + 1, 0, 0.3 * br),
                      ankleN=self.J['ankleN'], ankleF=self.J['ankleF'], armN=armN, armF=armF, weapon=ws + 2 * sn(f), offhand=s.get('restO', 0),
                      **self.secondary(f, 1.0))

    def secondary(self, f, k):
        """등 장식(망토 · 갈기 · 날개)의 뒤따르는 움직임"""
        s = self.spec; o = {}
        if s.get('back') == 'cape': o['cape'] = (-3 * k * sn(f - 0.9),)
        if s.get('back') == 'mane': o['mane'] = (2 * k * sn(f - 0.9),)
        if s.get('back') == 'wings':
            o['wingN'] = (-26 + 22 * sn(f) if s.get('fly') else 6 + 4 * sn(f),); o['wingF'] = (-26 + 22 * sn(f + 0.4) if s.get('fly') else 6 + 4 * sn(f + 0.4),)
        if s.get('back') == 'boneWings': o['wingN'] = (-6 + 7 * sn(f),); o['wingF'] = (-6 + 7 * sn(f + 0.5),)
        return o

    def run(self, i, f):
        s = self.spec; J = self.J
        S = s.get('stride', (self.thigh + self.shin) * 0.36); lift = s.get('lift', self.shin * 0.42)
        def foot(ph, k):
            ph %= 2 * PI
            ax, ay = J['ankle' + k]
            if ph < PI: return (ax + S * (1 - 2 * ph / PI), ay), 0  # 땅을 딛고 뒤로 (일정한 빠르기)
            u = (ph - PI) / PI
            return (ax - S + 2 * S * ease(u), ay - lift * sn(u * PI)), 18 * sn(u * PI)  # 들어 앞으로 (발끝이 처진다)
        aN, tN = foot(f, 'N'); aF, tF = foot(f + PI, 'F')
        bob = s.get('bob', 2.2)
        hdy = 1.2 - bob * abs(sn(f)) ** 1.5 * -1  # 발을 디딜 때 낮고 지날 때 높다
        hdy = 1.0 - bob * (sn(f) ** 2)
        lean = s.get('lean', 8)
        swing = s.get('armSwing', 18)
        restN, restF = s.get('restN', (18, -22, 0)), s.get('restF', (-14, -18, 0))
        armN = (restN[0] - swing * 0.6 * cs(f), restN[1] - 8 * max(0, -cs(f)), restN[2])
        armF = (restF[0] + swing * cs(f), restF[1] - 10 * max(0, cs(f)), restF[2])
        if s.get('fly'):  # 나는 보스: 다리를 모으고 날개로 간다
            return self.P(hips=(0, 1.5 * sn(f)), torso=lean, head=(-lean * 0.5, 0, 0), ankleN=(J['ankleN'][0] - 3, J['ankleN'][1] - 2 + 0.6 * sn(f)), ankleF=(J['ankleF'][0] - 5, J['ankleF'][1] - 2 + 0.6 * sn(f + 1)),
                          armN=armN, armF=armF, weapon=s.get('restW', 0), offhand=s.get('restO', 0), **self.secondary(f * 2, 1))
        return self.P(hips=(0, hdy), torso=lean + 1.5 * sn(2 * f), head=(-lean * 0.6, 0, -0.5 * sn(2 * f)), ankleN=aN, ankleF=aF, footN=tN, footF=tF,
                      armN=armN, armF=armF, weapon=s.get('restW', 0) + 4 * sn(f), offhand=s.get('restO', 0), **self.secondary(f * 2, 1.4))

    # ── 공격: 두 손으로 머리 위에서 내려치기 (몽둥이 · 대검) ──
    def atk_smash(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.3
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S * 1.1, J['ankleF'][1])
        wUp = s.get('wUp', -150)  # 무기를 치켜든 각 (손목 기준)
        K = [  # (hips dx, dy, torso, head, armN(어깨, 팔꿈치), weapon)
            (-1, 1, -16, 8, (-105, -70), wUp - 20), (-2, 2, -22, 10, (-120, -80), wUp - 40), (-2, 2, -24, 12, (-128, -82), wUp - 44),
            (0, 1, -4, 0, (-70, -40), wUp + 10), (2, 2, 14, -6, (-5, -20), wUp + 110), (4, 4, 30, -10, (35, -10), wUp + 180), (5, 6, 36, -12, (52, 6), wUp + 196)]
        dx, dy, tor, hd, (a0, a1), wa = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), weapon=wa, twoHand=True, bendF=-1, **self.secondary(i * 0.8 - 1, 2.2))

    # ── 공격: 한 손 옆으로 베기 (검 · 지팡이) ──
    def atk_slash(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.28
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        w0 = s.get('wUp', -100)
        K = [(-1, 1, -12, 6, (-95, -60), w0 - 30, (-20, -30)), (-2, 2, -18, 8, (-110, -70), w0 - 50, (-28, -36)), (-2, 2, -20, 9, (-115, -72), w0 - 54, (-30, -38)),
             (0, 1, -2, 0, (-40, -40), w0 + 20, (-10, -30)), (2, 2, 14, -6, (20, -25), w0 + 120, (10, -20)), (4, 3, 26, -9, (50, -10), w0 + 175, (22, -12)), (5, 4, 30, -10, (62, 0), w0 + 190, (26, -8))]
        dx, dy, tor, hd, (a0, a1), wa, (f0, f1) = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=wa, offhand=s.get('restO', 0), **self.secondary(i * 0.8 - 1, 2.2))

    # ── 공격: 주먹 내지르기 (오우거 · 거인) ──
    def atk_punch(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.3
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        K = [(-1, 1, -14, 6, (-30, -100), (-20, -60)), (-2, 2, -20, 8, (-40, -115), (-26, -70)), (-3, 2, -22, 9, (-44, -118), (-28, -72)),
             (0, 1, -2, 0, (-60, -60), (-10, -50)), (3, 2, 14, -6, (-85, -8), (10, -40)), (5, 3, 24, -9, (-92, 0), (20, -30)), (6, 4, 28, -10, (-95, 4), (24, -26))]
        dx, dy, tor, hd, (a0, a1), (f0, f1) = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=s.get('restW', 0), offhand=s.get('restO', 0), **self.secondary(i * 0.8 - 1, 2.2))

    # ── 공격: 지팡이 · 손을 앞으로 내밀어 쏘기 (마법 보스) ──
    def atk_cast(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.22
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        w0 = s.get('wUp', -90)
        K = [(-1, 0, -8, 4, (-40, -70), w0 - 10, (-30, -40), ()), (-2, 1, -12, 6, (-50, -80), w0 - 20, (-40, -50), ()), (-2, 1, -14, 6, (-55, -84), w0 - 24, (-44, -54), ()),
             (0, 0, 0, 0, (-75, -30), w0 + 10, (-20, -30), ('g',)), (2, 1, 10, -4, (-95, -5), w0 + 40, (0, -20), ('g', 'G')), (3, 1, 14, -5, (-100, 0), w0 + 46, (8, -16), ('g', 'G')), (3, 1, 14, -5, (-100, 0), w0 + 46, (8, -16), ('g', 'G'))]
        dx, dy, tor, hd, (a0, a1), wa, (f0, f1), gl = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=wa, offhand=s.get('restO', 0), _hide=self.glow_hide(gl), **self.secondary(i * 0.8 - 1, 1.6))

    def glow_hide(self, show):
        """빛 부위: 켠 것만 보인다 (이름이 glow 로 시작하는 부위)"""
        return tuple(p.name for p in self.parts if p.name.startswith('glow') and not any(p.name == 'glow_' + g for g in show))

    # ── 기술: 두 팔을 벌리고 포효 ──
    def skl_roar(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.3
        fN, fF = (J['ankleN'][0] + S * 0.8, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        K = [(0, 3, 14, 10, (-20, -60), (10, -50), ()), (0, 5, 20, 14, (-10, -80), (20, -70), ()), (0, 5, 22, 15, (-5, -85), (25, -75), ('g',)),
             (0, 1, -8, -14, (-120, -60), (120, 60), ('g',)), (0, -1, -18, -26, (-150, -30), (150, 30), ('g', 'G')), (0, -1, -20, -30, (-155, -22), (155, 22), ('g', 'G')), (0, -1, -20, -30, (-155, -22), (155, 22), ('g', 'G'))]
        dx, dy, tor, hd, (a0, a1), (f0, f1), gl = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=s.get('skW', s.get('restW', 0)) - 20 * (i >= 3), offhand=s.get('restO', 0), _hide=self.glow_hide(gl), **self.secondary(i * 0.9 - 1.5, 2.5))

    # ── 기술: 지팡이를 머리 위로 치켜들고 빛 ──
    def skl_raise(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.22
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        w0 = s.get('wUp', -90)
        K = [(0, 2, 10, 8, (-30, -60), w0 + 20, (-20, -40), ()), (0, 3, 14, 10, (-40, -70), w0 + 10, (-30, -50), ()), (0, 3, 14, 10, (-45, -72), w0 + 8, (-32, -52), ('g',)),
             (0, 1, -6, -8, (-120, -30), w0 - 40, (-100, -20), ('g',)), (0, -1, -14, -18, (-165, -10), w0 - 70, (-150, -5), ('g', 'G')), (0, -1, -16, -20, (-172, -6), w0 - 76, (-158, 0), ('g', 'G')), (0, -1, -16, -20, (-172, -6), w0 - 76, (-158, 0), ('g', 'G'))]
        dx, dy, tor, hd, (a0, a1), wa, (f0, f1), gl = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=wa, offhand=s.get('restO', 0), _hide=self.glow_hide(gl), **self.secondary(i * 0.9 - 1.5, 2.5))

    # ── 기술: 두 주먹을 들었다 땅에 내리찍기 ──
    def skl_slam(self, i):
        s = self.spec; J = self.J
        S = (self.thigh + self.shin) * 0.3
        fN, fF = (J['ankleN'][0] + S, J['ankleN'][1]), (J['ankleF'][0] - S, J['ankleF'][1])
        K = [(-1, 1, -10, 4, (-120, -50), (-110, -50), ()), (-2, 0, -18, 6, (-150, -40), (-140, -40), ()), (-2, -1, -22, 8, (-160, -36), (-150, -36), ('g',)),
             (0, 1, -6, 2, (-110, -40), (-100, -40), ('g',)), (3, 5, 26, -8, (-20, -30), (-10, -30), ('g', 'G')), (4, 8, 40, -12, (20, -16), (28, -14), ('g', 'G')), (4, 8, 42, -12, (24, -14), (32, -12), ('g', 'G'))]
        dx, dy, tor, hd, (a0, a1), (f0, f1), gl = K[i]
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=fN, ankleF=fF, armN=(a0, a1, 0), armF=(f0, f1, 0), weapon=s.get('restW', 0), offhand=s.get('restO', 0), _hide=self.glow_hide(gl), **self.secondary(i * 0.9 - 1.5, 2.5))

    def hit(self, i):
        s = self.spec; J = self.J
        K = [(-2, 1, -10, -16, (-30, -40), (-20, -30)), (-3, 2, -16, -24, (-40, -50), (-28, -36)), (-2, 1, -8, -12, (-20, -36), (-12, -28)), (-1, 0, -3, -4, (-5, -30), (-4, -24))]
        dx, dy, tor, hd, (a0, a1), (f0, f1) = K[i]
        rN, rF = self.rest_arms(0, 0)
        return self.P(hips=(dx, dy), torso=tor, head=(hd, 0, 0), ankleN=(J['ankleN'][0] + 2, J['ankleN'][1]), ankleF=(J['ankleF'][0] - 3, J['ankleF'][1]), armN=(rN[0] + a0, rN[1] + a1, 0), armF=(rF[0] + f0, rF[1] + f1, 0), weapon=s.get('restW', 0) - 10, offhand=s.get('restO', 0), **self.secondary(1.5 + i, 2))

    def death(self, i):
        s = self.spec; J = self.J
        rN, rF = self.rest_arms(0, 0)
        if i == 0: return self.P(hips=(-3, 2), torso=-22, head=(-26, 0, 0), ankleN=(J['ankleN'][0] + 3, J['ankleN'][1]), ankleF=(J['ankleF'][0] - 5, J['ankleF'][1]), armN=(rN[0] - 40, rN[1] - 20, 0), armF=(rF[0] - 30, rF[1] - 20, 0), weapon=s.get('restW', 0) - 30, offhand=s.get('restO', 0), **self.secondary(2, 2))
        if i == 1:  # 무릎 꿇기: 엉덩이가 내려앉아 무릎이 굽는다
            drop = self.thigh * 0.75
            return self.P(hips=(-2, drop), torso=18, head=(12, 0, 0), ankleN=(J['ankleN'][0] + 4, J['ankleN'][1]), ankleF=(J['ankleF'][0] - 8, J['ankleF'][1] - 2), armN=(rN[0] + 10, rN[1] + 5, 0), armF=(rF[0] + 10, rF[1] + 5, 0), weapon=s.get('restW', 0) + 40, offhand=s.get('restO', 0), **self.secondary(3, 2))
        # 눕기: 몸 전체를 뒤로 눕힌다 (FK)
        lie = s.get('lie', -84)
        pose = self.solve(dict(hips=(-self.tl * 0.1, self.thigh + self.shin - self.hr * 0.9 - 2 + s.get('lieDy', 0), lie), torso=4, head=(6, 0, 0), armN=(-150, -40, 0), armF=(-120, -30, 0), weapon=s.get('restW', 0) + 60, offhand=s.get('restO', 0), **self.secondary(4, 1)))
        if s.get('legs', True) is not False:
            pose['thighN'] = (-12,); pose['shinN'] = (14,); pose['footN'] = (0,); pose['thighF'] = (-24,); pose['shinF'] = (34,); pose['footF'] = (0,)
        return pose


# ═══════════════════════════ 무기 (손목 = (wx, wy) · 날은 위(-y)로) ═══════════════════════════
def w_club(h, wx, wy):  # 뼈 몽둥이 · 가시
    L = h.spec.get('wLen', 40); t = 2.6
    shp = [C('wood', (wx, wy + 5), (wx, wy - L), t), C('bone', (wx, wy - L * 0.45), (wx, wy - L), t * 1.9)]
    for k in range(5):
        y = wy - L * 0.5 - k * L * 0.11; sx = 1 if k % 2 else -1
        shp.append(Pg('tooth', (wx + sx * t * 1.4, y + 1.5), (wx + sx * t * 3.6, y - 1), (wx + sx * t * 1.4, y - 2), flat=True))
    shp.append(C('belt', (wx, wy + 3), (wx, wy - 4), t * 1.1))
    return shp, (wx, wy - L * 0.22)


def w_greatsword(h, wx, wy):
    L = h.spec.get('wLen', 52); bw = h.spec.get('bladeW', 4.5)
    shp = [C('belt', (wx, wy + 7), (wx, wy - 9), 1.8), Ln('iron', (wx - 7, wy - 9), (wx + 7, wy - 9), 2.4, flat=False),
           Pg('blade', (wx - bw, wy - 10), (wx + bw, wy - 10), (wx + bw * 0.9, wy - L * 0.82), (wx, wy - L), (wx - bw * 0.9, wy - L * 0.82)), Ln('blade', (wx, wy - 12), (wx, wy - L * 0.8), 1.2),
           E('gem', wx, wy - 9, 1.6, 1.6, flat=True)]
    if h.spec.get('runes'):
        for k in range(4): shp.append(E('glow', wx + (1.5 if k % 2 else -1.5), wy - 18 - k * 8, 1.1, 1.6, flat=True))
    return shp, (wx, wy + 5)


def w_sword(h, wx, wy):
    L = h.spec.get('wLen', 34); bw = h.spec.get('bladeW', 3)
    return [C('belt', (wx, wy + 4), (wx, wy - 6), 1.5), Ln('gold', (wx - 5, wy - 6), (wx + 5, wy - 6), 2, flat=False), Pg('blade', (wx - bw, wy - 7), (wx + bw, wy - 7), (wx + bw * 0.9, wy - L * 0.85), (wx, wy - L), (wx - bw * 0.9, wy - L * 0.85)), Ln('blade', (wx, wy - 8), (wx, wy - L * 0.8), 1.0)], None


def w_staff(h, wx, wy):  # 지팡이 · 끝의 구슬 (빛 부위는 따로: glow_g, glow_G)
    L = h.spec.get('wLen', 48)
    shp = [C('wood', (wx, wy + L * 0.45), (wx, wy - L * 0.5), 1.7), C('wood', (wx, wy - L * 0.5), (wx - 3, wy - L * 0.62), 1.6), C('wood', (wx, wy - L * 0.5), (wx + 3.5, wy - L * 0.6), 1.5), E('gem', wx + 0.3, wy - L * 0.6, 3.6, 3.6)]
    gx, gy = wx + 0.3, wy - L * 0.6
    h.parts.append(Part('glow_g', 'weapon', (wx, wy), 3.7, [E('glow2', gx, gy, 5.2, 5.2, flat=True), E('glow', gx, gy, 3.2, 3.2, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'weapon', (wx, wy), 3.69, [E('glow2', gx, gy, 8.5, 8.5, flat=True), E('glow', gx, gy, 5.5, 5.5, flat=True), E('glow2', gx + 9, gy - 6, 1.6, 1.6, flat=True), E('glow2', gx - 8, gy - 8, 1.4, 1.4, flat=True), E('glow2', gx + 4, gy - 11, 1.2, 1.2, flat=True)], sep=False))
    return shp, None


def w_icestaff(h, wx, wy):
    L = h.spec.get('wLen', 50)
    shp = [C('iron', (wx, wy + L * 0.4), (wx, wy - L * 0.55), 1.6), Pg('ice', (wx - 4, wy - L * 0.55), (wx, wy - L * 0.95), (wx + 4, wy - L * 0.55), (wx, wy - L * 0.45)), Pg('ice', (wx - 6, wy - L * 0.62), (wx - 7, wy - L * 0.78), (wx - 3.5, wy - L * 0.68), flat=True), Pg('ice', (wx + 6, wy - L * 0.6), (wx + 7.5, wy - L * 0.75), (wx + 3.5, wy - L * 0.66), flat=True)]
    gx, gy = wx, wy - L * 0.7
    h.parts.append(Part('glow_g', 'weapon', (wx, wy), 3.7, [E('glow', gx, gy, 4.5, 6, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'weapon', (wx, wy), 3.69, [E('glow2', gx, gy, 8, 10, flat=True), E('glow', gx, gy, 5, 7, flat=True)], sep=False))
    return shp, None


def w_shield(h, wx, wy):  # 큰 방패 (왼손): 손목 앞에 세워 든다
    R = h.spec.get('shieldR', 14)
    shp = [Pg('iron', (wx - R * 0.8, wy - R * 1.1), (wx + R * 0.8, wy - R * 1.1), (wx + R * 0.85, wy + R * 0.5), (wx, wy + R * 1.2), (wx - R * 0.85, wy + R * 0.5)), Pg('body', (wx - R * 0.55, wy - R * 0.85), (wx + R * 0.55, wy - R * 0.85), (wx + R * 0.6, wy + R * 0.4), (wx, wy + R * 0.9), (wx - R * 0.6, wy + R * 0.4)), E('gold', wx, wy - R * 0.1, R * 0.22, R * 0.22)]
    h.parts.append(Part('glow_g', 'offhand', (wx, wy), 0.66, [E('glow', wx, wy - R * 0.1, R * 0.35, R * 0.35, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'offhand', (wx, wy), 0.66, [E('glow2', wx, wy - R * 0.1, R * 0.7, R * 0.7, flat=True), E('glow', wx, wy - R * 0.1, R * 0.45, R * 0.45, flat=True)], sep=False))
    return shp, None


def w_flail(h, wx, wy):  # 사슬 철퇴
    L = h.spec.get('wLen', 30)
    shp = [C('wood', (wx, wy + 5), (wx, wy - 10), 1.8)]
    for k in range(6): shp.append(E('iron', wx, wy - 12 - k * 3, 1.6, 1.3))
    shp += [E('iron', wx, wy - L, 6, 6)]
    for k in range(6): a = k / 6 * PI * 2; shp.append(Pg('metal', (wx + cs(a) * 5, wy - L + sn(a) * 5), (wx + cs(a) * 9, wy - L + sn(a) * 9), (wx + cs(a + 0.5) * 5, wy - L + sn(a + 0.5) * 5), flat=True))
    return shp, None


def w_tome(h, wx, wy):  # 떠다니는 책 (손 위)
    shp = [Pg('cloth', (wx - 6, wy - 3), (wx + 6, wy - 3), (wx + 6, wy - 11), (wx - 6, wy - 11)), Pg('bone', (wx - 5, wy - 4), (wx + 5, wy - 4), (wx + 5, wy - 10), (wx - 5, wy - 10)), Ln('trim', (wx, wy - 4), (wx, wy - 10), 1.2, flat=False)]
    h.parts.append(Part('glow_g', 'weapon', (wx, wy), 3.7, [E('glow', wx, wy - 7, 4, 2.5, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'weapon', (wx, wy), 3.69, [E('glow2', wx, wy - 7, 9, 6, flat=True), E('glow', wx, wy - 7, 6, 4, flat=True)], sep=False))
    return shp, None


def w_orb(h, wx, wy):  # 손 위에 뜬 구슬 (별 · 거울)
    shp = [E('gem', wx, wy - 6, 4, 4)]
    h.parts.append(Part('glow_g', 'weapon', (wx, wy), 3.7, [E('glow', wx, wy - 6, 5.5, 5.5, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'weapon', (wx, wy), 3.69, [E('glow2', wx, wy - 6, 10, 10, flat=True), E('glow', wx, wy - 6, 6.5, 6.5, flat=True)], sep=False))
    return shp, None


def w_halo(h, wx, wy):  # 대사제의 심판 바퀴
    R = h.spec.get('wLen', 11)
    shp = [E('gold', wx, wy - R - 2, R, R), E('body', wx, wy - R - 2, R * 0.62, R * 0.62)]
    for k in range(8): a = k / 8 * PI * 2; shp.append(Pg('gold', (wx + cs(a) * R * 0.9, wy - R - 2 + sn(a) * R * 0.9), (wx + cs(a) * R * 1.45, wy - R - 2 + sn(a) * R * 1.45), (wx + cs(a + 0.35) * R * 0.9, wy - R - 2 + sn(a + 0.35) * R * 0.9)))
    h.parts.append(Part('glow_g', 'weapon', (wx, wy), 3.7, [E('glow', wx, wy - R - 2, R * 0.5, R * 0.5, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'weapon', (wx, wy), 3.69, [E('glow2', wx, wy - R - 2, R * 1.1, R * 1.1, flat=True), E('glow', wx, wy - R - 2, R * 0.7, R * 0.7, flat=True)], sep=False))
    return shp, None


def w_icefist(h, wx, wy):  # 얼음 덩이를 두른 주먹
    t = h.at
    return [E('ice', wx, wy + t * 0.6, t * 1.7, t * 1.5), Pg('ice', (wx + t, wy - t * 0.5), (wx + t * 2.6, wy - t * 1.4), (wx + t * 1.6, wy + t * 0.4)), Pg('ice', (wx - t * 0.8, wy - t * 0.6), (wx - t * 0.6, wy - t * 2.2), (wx + t * 0.3, wy - t * 0.4))], None


def w_none(h, wx, wy): return [], None


WEAPONS = {'club': w_club, 'greatsword': w_greatsword, 'sword': w_sword, 'staff': w_staff, 'icestaff': w_icestaff, 'shield': w_shield, 'flail': w_flail, 'tome': w_tome, 'orb': w_orb, 'halo': w_halo, 'icefist': w_icefist, 'none': w_none}


# 빛나는 눈 · 입 (기술 때): 머리 자식 부위
def eye_glow(h, hx, hy):
    hr = h.hr
    h.parts.append(Part('glow_g', 'head', h.J['neck'], 2.7, [E('glow', hx + hr * 0.45, hy - hr * 0.03, hr * 0.2, hr * 0.2, flat=True), E('glow', hx - hr * 0.2, hy - hr * 0.03, hr * 0.17, hr * 0.18, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'head', h.J['neck'], 2.69, [E('glow2', hx + hr * 0.45, hy - hr * 0.03, hr * 0.36, hr * 0.36, flat=True), E('glow2', hx - hr * 0.2, hy - hr * 0.03, hr * 0.3, hr * 0.32, flat=True)], sep=False))
    return []


def chest_core(h):  # 가슴의 빛나는 핵 (균열 수호자 · 증기 거신)
    cx, wy = h.cx, h.J['waist'][1]; tl = h.tl
    h.parts.append(Part('glow_g', 'torso', h.J['waist'], 2.3, [E('glow', cx + 1, wy - tl * 0.55, 4.5, 4.5, flat=True)], sep=False))
    h.parts.append(Part('glow_G', 'torso', h.J['waist'], 2.29, [E('glow2', cx + 1, wy - tl * 0.55, 8, 8, flat=True), E('glow', cx + 1, wy - tl * 0.55, 5.5, 5.5, flat=True)], sep=False))
    return E('eyeD', cx + 1, wy - tl * 0.55, 5.5, 5.5, flat=True)


# ═══════════════════════════ 보스 20명 ═══════════════════════════
def spec_of(bid):
    S = {}
    if bid == 'climbChief':  # 가면 족장: 구부정한 덩치 · 해골 가면 · 붉은 갈기 · 가시 뼈 몽둥이
        S = dict(thigh=15, shin=14, upper=15, fore=14, torso=24, headR=8.5, limb=5.5, arm=5, bodyW=12, shoulderW=9, hunch=8, skin='#b88a62', bodyCol='#5a3c30', hair='#c82828', cloth='#8a1e22', belt='#3a2420',
                 head='skull', back='mane', weapon='club', wLen=40, twoHand=False, restN=(22, -18, 0), restW=-30, attack='smash', skill='roar', eye='#ffd040', glow='#ffe080', glow2='#ff7030', headExtra=[eye_glow], bone='#ece0c8')
    elif bid == 'bogHag':  # 늪 마녀 수장: 구부정한 노파 · 긴 코 · 모자 · 지팡이
        S = dict(thigh=12, shin=12, upper=12, fore=11, torso=22, headR=7, limb=3.8, arm=3.4, bodyW=9, shoulderW=7, hunch=14, skin='#8aa060', headCol='#8aa060', bodyCol='#3a5a30', hair='#2a3a22', belt='#4a3a20', cloth='#3a5a30',
                 body='robe', legs=False, hemW=16, head='hat', weapon='staff', wLen=46, restN=(12, -10, 0), restW=10, attack='cast', skill='raise', eye='#c8ff60', glow='#d8ff80', glow2='#5ad040', gem='#4ab040', wood='#4a3222')
    elif bid == 'demonCaptain':  # 방패 악귀 대장: 판금 갑옷 · 뿔 투구 · 사슬 철퇴 · 큰 방패
        S = dict(thigh=15, shin=14, upper=14, fore=13, torso=25, headR=8, limb=5.5, arm=5, bodyW=12, shoulderW=10, hunch=2, skin='#7a2a2a', bodyCol='#4a2a3a', belt='#2a1a20', headCol='#5a3040', horn='#2a1a1e', metalFlat='#9a8a9a',
                 body='plate', legMat='body', armMat='body', foreMat='body', pauldron=True, head='helm', weapon='flail', offhand='shield', shieldR=15, restN=(24, -30, 0), restF=(-6, -4, 0), restW=-40, restO=-10, attack='slash', wUp=-60, skill='roar', eye='#ff8030', glow='#ffd060', glow2='#ff6030', headExtra=[eye_glow], back='cape', capeCol='#5a1a1e', iron='#6a6a78')
    elif bid == 'frostOgre':  # 얼음 오우거 왕: 거대한 몸 · 엄니 · 얼음 왕관 · 얼음 주먹
        S = dict(thigh=14, shin=13, upper=18, fore=16, torso=28, headR=9, limb=7, arm=6.5, bodyW=16, shoulderW=12, hunch=10, skin='#7ab8e0', bodyCol='#5a94c0', hair='#304868', belt='#3a2a30', cloth='#3a4a6a', headCol='#7ab8e0', ice='#cfefff', iceFlat='#eafcff',
                 body='ogre', head='ogre', weapon='icefist', restN=(20, -16, 0), restF=(-12, -12, 0), attack='punch', skill='slam', eye='#ffffff', glow='#e8ffff', glow2='#8ad8ff', headExtra=[eye_glow], armTex=0.1)
    elif bid == 'climbWitch':  # 서리 마녀: 길쭉한 몸 · 얼음 관 · 얼음 지팡이
        S = dict(thigh=14, shin=13, upper=13, fore=12, torso=26, headR=7, limb=4, arm=3.4, bodyW=9, shoulderW=7, hunch=0, skin='#d8e8f8', headCol='#d8e8f8', bodyCol='#3a5aa0', hair='#9ad0f0', belt='#203050', cloth='#3a5aa0', trim='#bfe8ff',
                 body='robe', legs=False, hemW=15, robeTrim=True, hemTrim=True, head='shardCrown', ice='#cfefff', iceFlat='#eafcff', weapon='icestaff', wLen=50, restN=(14, -8, 0), restW=6, attack='cast', skill='raise', eye='#9fe3ff', glow='#e8fbff', glow2='#7ac8ff', gem='#9ad0f0', backExtra=[])
    elif bid == 'wraithLord':  # 망령 기사단장: 검은 갑옷 · 빈 투구 속 푸른 불 · 대검 · 찢긴 망토 · 뼈 날개
        S = dict(thigh=15, shin=14, upper=14, fore=13, torso=26, headR=8, limb=5, arm=4.6, bodyW=11, shoulderW=10, hunch=2, skin='#3a3e52', bodyCol='#2e3246', belt='#1a1c28', headCol='#3a3e52', horn='#5a6a8a', metalFlat='#7a86a8', bone='#9aa6c4',
                 body='plate', legMat='body', armMat='body', foreMat='body', pauldron=True, head='wraith', weapon='greatsword', wLen=52, twoHand=True, restN=(20, -16, 0), restW=-20, attack='smash', wUp=-150, skill='roar', eye='#7ab8ff', glow='#bfe0ff', glow2='#4a8aff', headExtra=[eye_glow], back='cape', capeCol='#2a2c44', capeLen=40, blade='#9aa6c4', gem='#4a8aff')
    elif bid == 'engraveKing':  # 각인의 왕: 금빛 갑옷 · 왕관 · 룬 검 · 긴 망토
        S = dict(thigh=17, shin=16, upper=15, fore=14, torso=28, headR=8, limb=5.5, arm=4.8, bodyW=12, shoulderW=10, hunch=0, skin='#e0b890', bodyCol='#c89a40', belt='#6a4820', headCol='#e0b890', hair='#f0e0c0', trim='#ffe080', metalFlat='#fff0b0',
                 body='plate', legMat='body', armMat='body', foreMat='body', pauldron=True, head='crown', weapon='greatsword', wLen=50, bladeW=4, runes=True, twoHand=True, restN=(18, -14, 0), restW=-12, attack='smash', wUp=-150, skill='raise', wUp2=-90, eye='#ffe080', glow='#fff4c0', glow2='#ffc84a', headExtra=[eye_glow], back='cape', capeCol='#8a2a3a', capeLen=46, blade='#f0f0ff', gem='#ffc84a', gold='#ffd860')
    elif bid == 'stormHarpy':  # 폭풍 하피 여왕: 깃털 날개 · 발톱 · 깃털 관 · 하늘을 난다
        S = dict(thigh=12, shin=11, upper=11, fore=10, torso=22, headR=7, limb=3.6, arm=3.2, bodyW=9, shoulderW=7, hunch=4, skin='#e8d0c8', headCol='#e8d0c8', bodyCol='#4a6aa0', hair='#e8f0ff', belt='#2a3a60', cloth='#7ac8ff', foot='#d8c070', footL=9, claws=True,
                 body='skin', head='harpy', back='wings', wingCol='#5a7ab8', wingLen=44, fly=True, weapon='none', restN=(10, -10, 0), restF=(-8, -8, 0), attack='slash', wUp=-100, skill='roar', eye='#ffe040', glow='#ffffff', glow2='#9ad8ff', headExtra=[eye_glow])
    elif bid == 'mirrorSelf':  # 거울 기사: 비치는 은빛 갑옷 · 수정 검 · 거울 방패
        S = dict(thigh=14, shin=13, upper=13, fore=12, torso=24, headR=7.5, limb=4.8, arm=4.2, bodyW=11, shoulderW=9, hunch=0, skin='#c8d4e8', bodyCol='#c8d4e8', belt='#6a7a98', headCol='#dce6f4', horn='#eef4ff', metalFlat='#ffffff',
                 body='plate', legMat='body', armMat='body', foreMat='body', pauldron=True, head='mirror', weapon='sword', wLen=36, offhand='shield', shieldR=12, iron='#dce6f4', restN=(20, -24, 0), restF=(-6, -4, 0), restW=-30, restO=-10, attack='slash', wUp=-100, skill='roar', eye='#ffffff', glow='#ffffff', glow2='#bfe0ff', blade='#e8f6ff', gem='#bfe0ff')
    elif bid == 'shardQueen':  # 깨진 거울의 여왕: 유리 조각 드레스 · 조각 왕관 · 맨손 마법
        S = dict(thigh=15, shin=14, upper=13, fore=12, torso=26, headR=7, limb=4, arm=3.4, bodyW=9.5, shoulderW=7, hunch=0, skin='#eef0f8', headCol='#eef0f8', bodyCol='#8aa0c8', hair='#dde8ff', belt='#50607a', trim='#ffffff', ice='#dff4ff', iceFlat='#ffffff',
                 body='robe', legs=False, hemW=17, robeTrim=True, head='shardCrown', weapon='orb', restN=(16, -40, 0), restF=(-10, -10, 0), restW=0, attack='cast', wUp=-60, skill='raise', eye='#ffffff', glow='#ffffff', glow2='#bfe0ff', gem='#dff4ff',
                 torsoExtra=[lambda h: Pg('ice', (h.cx - 4, h.J['waist'][1] - h.tl * 0.9), (h.cx + 2, h.J['waist'][1] - h.tl * 1.25), (h.cx + 6, h.J['waist'][1] - h.tl * 0.85))])
    elif bid == 'archivist':  # 대서고관: 보라 학사 가운 · 외알 안경 · 떠다니는 책
        S = dict(thigh=14, shin=13, upper=13, fore=12, torso=25, headR=7.5, limb=4.2, arm=3.6, bodyW=10, shoulderW=8, hunch=6, skin='#d8c0a8', headCol='#d8c0a8', bodyCol='#4a3a7a', hair='#c8c0c0', belt='#2a2040', cloth='#6a5aa8', trim='#c8b0ff',
                 body='robe', legs=False, hemW=14, robeTrim=True, head='scholar', weapon='tome', restN=(50, -70, 0), restF=(-10, -12, 0), attack='cast', wUp=-40, skill='raise', eye='#c8b0ff', glow='#e8dcff', glow2='#9a70ff', gem='#9a70ff')
    elif bid == 'starReader':  # 별을 읽는 자: 별이 박힌 두건 로브 · 손 위의 별 구슬
        S = dict(thigh=15, shin=14, upper=13, fore=12, torso=27, headR=7.5, limb=4.2, arm=3.6, bodyW=10, shoulderW=8, hunch=4, skin='#c8d0f0', headCol='#c8d0f0', bodyCol='#2a2a6a', belt='#1a1a40', cloth='#4a4aa0', trim='#a8b8ff',
                 body='robe', legs=False, hemW=16, robeTrim=True, hemTrim=True, head='starHood', weapon='orb', restN=(40, -60, 0), restF=(-8, -10, 0), attack='cast', wUp=-50, skill='raise', eye='#e0e8ff', glow='#ffffff', glow2='#8aa0ff', gem='#a8b8ff',
                 torsoExtra=[lambda h: E('glow', h.cx + 3, h.J['waist'][1] - h.tl * 0.55, 1.2, 1.2, flat=True), lambda h: E('glow', h.cx - 3, h.J['waist'][1] - h.tl * 0.3, 1.0, 1.0, flat=True)])
    elif bid == 'highPriest':  # 교단 대사제: 흰 금빛 제의 · 높은 관 · 심판 바퀴
        S = dict(thigh=15, shin=14, upper=13, fore=12, torso=27, headR=7.5, limb=4.2, arm=3.6, bodyW=10.5, shoulderW=8, hunch=0, skin='#e8d0c0', headCol='#e8d0c0', bodyCol='#f0ecdc', belt='#c8a040', cloth='#d8c8a0', trim='#e0b040', gold='#e8c040',
                 body='robe', legs=False, hemW=16, robeTrim=True, hemTrim=True, head='mitre', weapon='halo', wLen=11, restN=(30, -60, 0), restF=(-8, -10, 0), attack='cast', wUp=-30, skill='raise', eye='#c45cff', glow='#f8e8ff', glow2='#c45cff', gem='#c45cff')
    elif bid == 'lastKing':  # 마지막 왕: 검붉은 왕의 갑옷 · 큰 왕관 · 불꽃 검
        S = dict(thigh=17, shin=16, upper=15, fore=14, torso=28, headR=8.5, limb=5.5, arm=4.8, bodyW=12.5, shoulderW=10, hunch=0, skin='#e0c0a0', bodyCol='#6a2a34', belt='#3a1a20', headCol='#e0c0a0', hair='#e8e0d0', trim='#ffd860', metalFlat='#ffe8a0',
                 body='plate', legMat='body', armMat='body', foreMat='body', pauldron=True, head='crown', weapon='greatsword', wLen=50, bladeW=4.2, runes=True, twoHand=False, restN=(20, -16, 0), restW=-24, attack='slash', wUp=-110, skill='roar', eye='#ffe8a0', glow='#fff0b0', glow2='#ff8040', headExtra=[eye_glow], back='cape', capeCol='#2a1a30', capeLen=48, blade='#ffd0a0', gem='#ff8040', gold='#ffd860')
    return S


# ═══════════════════════════ 사람꼴이 아닌 보스 ═══════════════════════════
class Golem(Humanoid):
    """돌 · 쇠 거인: 작은 다리 · 거대한 팔 · 어깨가 머리보다 높다. 공격은 주먹 내려찍기, 기술은 두 주먹 땅 찍기"""

    def build_body(self):
        s, J = self.spec, self.J
        cx, hipY = self.cx, self.hipY; wx, wy = J['waist']; nx, ny = J['neck']; bw = s.get('bodyW', 18); tl = self.tl
        col = s.get('bodyCol', '#6a6a60'); self.mat('body', col); self.mat('body2', shade(col, -0.18)); self.mat('belt', s.get('belt', '#3a3a34')); self.mat('cloth', s.get('cloth', '#4a4a40')); self.mat('trim', s.get('trim', '#c8a040')); self.flat('metal', s.get('metalFlat', '#d8d0c0'))
        self.mat('moss', s.get('moss', '#5aa83a')); self.flat('moss2', shade(s.get('moss', '#5aa83a'), 0.3))
        self.add('hips', None, (cx, hipY), 2.0, [E('body2', cx, hipY, bw * 0.6, 4)], tex=0.1)
        kind = s.get('golem', 'rock')
        if kind == 'rock':  # 바위 덩어리 몸 · 이끼
            tor = [E('body', cx - 2, wy - tl * 0.5, bw * 1.1, tl * 0.6), E('body', cx + 3, wy - tl * 0.78, bw * 0.9, tl * 0.4), E('body2', cx + bw * 0.3, wy - tl * 0.3, bw * 0.5, tl * 0.33),
                   Pg('body', (cx - bw * 0.9, wy - tl * 0.6), (cx - bw * 0.5, wy - tl * 1.05), (cx + bw * 0.2, wy - tl * 0.95), (cx + bw * 0.6, wy - tl * 0.5)), Ln('body2', (cx - bw * 0.3, wy - tl * 0.75), (cx + bw * 0.1, wy - tl * 0.45), 1.2, flat=False)]
            if s.get('mossy'): tor += [E('moss', cx - bw * 0.3, wy - tl * 1.0, bw * 0.55, 3, flat=False), E('moss', cx + bw * 0.5, wy - tl * 0.7, bw * 0.3, 2.2, flat=False), E('moss2', cx - bw * 0.35, wy - tl * 1.08, bw * 0.25, 1.2, flat=True)]
        elif kind == 'steam':  # 보일러 몸통 · 리벳 · 연통
            tor = [Pg('body', (cx - bw * 0.9, wy - tl * 0.95), (cx + bw * 0.9, wy - tl * 0.95), (cx + bw * 0.85, wy + 1), (cx - bw * 0.85, wy + 1)), E('body', cx, wy - tl * 0.95, bw * 0.9, 4),
                   Pg('body2', (cx + bw * 0.35, wy - tl * 0.9), (cx + bw * 0.85, wy - tl * 0.9), (cx + bw * 0.8, wy), (cx + bw * 0.3, wy)), Ln('belt', (cx - bw * 0.9, wy - tl * 0.5), (cx + bw * 0.9, wy - tl * 0.5), 2, flat=False),
                   C('body2', (cx - bw * 0.55, wy - tl * 0.9), (cx - bw * 0.6, wy - tl * 1.55), 3), C('body2', (cx - bw * 0.2, wy - tl * 0.9), (cx - bw * 0.25, wy - tl * 1.4), 2.6)]
            for k in range(5): tor.append(E('metal', cx - bw * 0.8 + k * bw * 0.4, wy - tl * 0.7, 1.1, 1.1, flat=True))
            for k in range(5): tor.append(E('metal', cx - bw * 0.8 + k * bw * 0.4, wy - tl * 0.2, 1.1, 1.1, flat=True))
        else:  # 'dark': 금 간 검은 돌 · 가슴 핵
            tor = [E('body', cx - 1, wy - tl * 0.5, bw * 1.05, tl * 0.62), E('body', cx + 2, wy - tl * 0.82, bw * 0.85, tl * 0.38), Pg('body', (cx - bw * 0.95, wy - tl * 0.55), (cx - bw * 0.5, wy - tl * 1.08), (cx + bw * 0.3, wy - tl * 1.0), (cx + bw * 0.65, wy - tl * 0.5)),
                   Ln('glow2', (cx - bw * 0.6, wy - tl * 0.9), (cx - bw * 0.3, wy - tl * 0.5), 1.0), Ln('glow2', (cx + bw * 0.5, wy - tl * 0.85), (cx + bw * 0.35, wy - tl * 0.4), 1.0), Ln('glow2', (cx - bw * 0.2, wy - tl * 0.25), (cx + bw * 0.2, wy - tl * 0.05), 1.0)]
        for extra in s.get('torsoExtra', []): tor.append(extra(self))
        self.add('torso', 'hips', (wx, wy), 2.2, tor, tex=s.get('bodyTex', 0.14))

    def build_head(self):
        s, J = self.spec, self.J
        nx, ny = J['neck']; hr = self.hr; hx, hy = nx + s.get('headX', 3), ny - hr * 0.5 + s.get('headDrop', 0)
        self.mat('head', s.get('headCol', s.get('bodyCol'))); self.mat('horn', s.get('horn', '#8a7a5a')); self.mat('hair', s.get('hair', '#4a4a40')); self.mat('bone', '#ece4d0')
        kind = s.get('golemHead', 'rock')
        if kind == 'rock':  # 낮은 바위 머리 · 가지뿔 · 초록 눈
            sh = [Pg('head', (hx - hr, hy + hr * 0.6), (hx - hr * 0.8, hy - hr * 0.6), (hx + hr * 0.3, hy - hr * 0.85), (hx + hr * 1.1, hy - hr * 0.3), (hx + hr * 1.15, hy + hr * 0.5), (hx + hr * 0.3, hy + hr * 0.8)),
                  E('eyeD', hx + hr * 0.6, hy - hr * 0.05, hr * 0.26, hr * 0.2, flat=True), E('eye', hx + hr * 0.62, hy - hr * 0.05, hr * 0.14, hr * 0.1, flat=True), E('eyeD', hx, hy - hr * 0.1, hr * 0.2, hr * 0.17, flat=True), E('eye', hx + hr * 0.02, hy - hr * 0.1, hr * 0.1, hr * 0.08, flat=True),
                  Ln('mouth', (hx + hr * 0.1, hy + hr * 0.5), (hx + hr * 0.95, hy + hr * 0.42), 1.2)]
            for k in range(3): sh.append(Pg('tooth', (hx + hr * (0.25 + k * 0.28), hy + hr * 0.5), (hx + hr * (0.32 + k * 0.28), hy + hr * 0.2), (hx + hr * (0.42 + k * 0.28), hy + hr * 0.5), flat=True))
            # 가지뿔
            for sx, L in ((-0.5, 1.0), (0.4, 0.9)):
                bx, by = hx + sx * hr, hy - hr * 0.7
                sh += [C('horn', (bx, by), (bx + sx * hr * 0.8, by - hr * L * 1.6), 1.5), C('horn', (bx + sx * hr * 0.4, by - hr * L * 0.8), (bx + sx * hr * 1.4, by - hr * L * 1.3), 1.2), C('horn', (bx + sx * hr * 0.65, by - hr * L * 1.3), (bx + sx * hr * 0.3, by - hr * L * 2.2), 1.1)]
        elif kind == 'steam':  # 둥근 쇠 머리 · 불 눈 · 굴뚝
            sh = [E('head', hx, hy, hr, hr * 0.9), Pg('head', (hx - hr * 0.7, hy + hr * 0.3), (hx + hr * 1.0, hy + hr * 0.3), (hx + hr * 0.9, hy + hr * 0.9), (hx - hr * 0.6, hy + hr * 0.9)), Ln('eyeD', (hx - hr * 0.1, hy), (hx + hr * 0.95, hy), 2.6),
                  E('eye', hx + hr * 0.6, hy, hr * 0.14, hr * 0.12, flat=True), E('eye', hx + hr * 0.15, hy, hr * 0.12, hr * 0.1, flat=True), C('body2', (hx - hr * 0.3, hy - hr * 0.7), (hx - hr * 0.35, hy - hr * 1.6), 2.2)]
            for k in range(4): sh.append(E('metal', hx - hr * 0.4 + k * hr * 0.4, hy + hr * 0.6, 0.9, 0.9, flat=True))
        else:  # 'dark': 금 간 돌 얼굴 · 빛 눈
            sh = [Pg('head', (hx - hr * 0.9, hy + hr * 0.7), (hx - hr * 0.85, hy - hr * 0.7), (hx + hr * 0.2, hy - hr * 1.0), (hx + hr * 1.0, hy - hr * 0.4), (hx + hr * 1.05, hy + hr * 0.6), (hx + hr * 0.2, hy + hr * 0.9)),
                  Ln('eyeD', (hx - hr * 0.3, hy - hr * 0.05), (hx + hr * 0.9, hy - hr * 0.05), 2.4), E('eye', hx + hr * 0.6, hy - hr * 0.05, hr * 0.15, hr * 0.11, flat=True), E('eye', hx + hr * 0.05, hy - hr * 0.05, hr * 0.13, hr * 0.1, flat=True),
                  Ln('glow2', (hx - hr * 0.5, hy + hr * 0.6), (hx - hr * 0.1, hy + hr * 0.2), 0.9)]
            for sx in (-0.5, 0.5): sh.append(Pg('horn', (hx + sx * hr - hr * 0.2, hy - hr * 0.8), (hx + sx * hr * 1.3, hy - hr * 1.9), (hx + sx * hr + hr * 0.25, hy - hr * 0.75)))
        for extra in s.get('headExtra', []): sh += extra(self, hx, hy)
        self.headC = (hx, hy)
        self.add('head', 'torso', J['neck'], 2.6, sh, tex=0.1)

    def arm_shapes(self, k):
        sx, sy = self.J['sh' + k]; ex, ey = self.J['elbow' + k]; wx, wy = self.J['wrist' + k]
        t = self.at; kind = self.spec.get('golem', 'rock')
        up = [E('body', sx, sy - 2, t * 1.6, t * 1.4), C('body', (sx, sy), (ex, ey), t * 1.05)]
        fo = [C('body', (ex, ey), (wx, wy), t * 1.15), E('body', ex, ey, t * 1.05, t * 1.0)]
        if kind == 'steam': fo.append(Ln('belt', (ex, ey + 3), (wx, wy - 3), t * 0.6, flat=False)); fo.append(E('metal', wx, wy - 4, 1, 1, flat=True))
        if self.spec.get('mossy'): up.append(E('moss', sx - t * 0.4, sy - t * 1.6, t * 1.1, 1.6, flat=False))
        hand = [E('body2', wx, wy + t * 0.9, t * 1.7, t * 1.5)]
        for kk in range(3): hand.append(Pg('body2' if kind != 'steam' else 'belt', (wx + t * (1.6 - kk * 1.0), wy + t * 1.6), (wx + t * (1.9 - kk * 1.0), wy + t * 2.7), (wx + t * (1.0 - kk * 1.0), wy + t * 1.7)))
        return up, fo, hand

    def rest_arms(self, f=0, sway=1.0):
        return (6 + 3 * sway * sn(f), -6 + 2 * sway * sn(f + 0.6), 0), (-5 - 3 * sway * sn(f), -5 - 2 * sway * sn(f + 0.6), 0)


class Blob(Humanoid):
    """늪의 거인: 진흙 덩어리 몸이 바닥까지 퍼지고 팔 둘 · 머리가 솟아 있다. 다리 없음. 공격은 주먹, 기술은 두 팔을 들어 토해 내기"""

    def build_legs(self): pass

    def build_body(self):
        s, J = self.spec, self.J
        cx, hipY = self.cx, self.hipY; wx, wy = J['waist']; bw = s.get('bodyW', 20); tl = self.tl; G = self.G
        col = s.get('bodyCol', '#3a6a3a'); self.mat('body', col); self.mat('body2', shade(col, -0.18)); self.mat('belt', shade(col, -0.3)); self.mat('cloth', col); self.mat('trim', '#c8a040'); self.flat('metal', '#d8d0c0')
        self.mat('moss', s.get('moss', '#7ac84a')); self.flat('moss2', '#b8f080'); self.flat('drip', shade(col, 0.1))
        base = [E('body', cx - 2, G - 6, bw * 1.5, 7), E('body', cx + 4, G - 10, bw * 1.1, 8), E('body2', cx + bw * 0.6, G - 4, bw * 0.6, 3.4)]
        for k in range(6): x = cx - bw * 1.3 + k * bw * 0.52; base.append(E('body2', x, G - 2.5, 3, 1.6))
        for k in range(4): x = cx - bw * 0.9 + k * bw * 0.6; base.append(E('moss2', x, G - 11 + (k % 2) * 3, 1.3, 0.9, flat=True))
        self.add('hips', None, (cx, hipY), 1.8, base, tex=0.1)
        tor = [E('body', cx, wy - tl * 0.45, bw * 0.95, tl * 0.65), E('body', cx + 3, wy - tl * 0.85, bw * 0.75, tl * 0.35), E('moss', cx - bw * 0.3, wy - tl * 1.0, bw * 0.5, 2.6), E('body2', cx + bw * 0.25, wy - tl * 0.3, bw * 0.45, tl * 0.3),
               E('drip', cx - bw * 0.5, wy - tl * 0.2, 1.6, 3, flat=True), E('drip', cx + bw * 0.6, wy - tl * 0.1, 1.4, 2.6, flat=True)]
        self.add('torso', 'hips', (wx, wy), 2.2, tor, tex=0.12)

    def build_head(self):
        s, J = self.spec, self.J
        nx, ny = J['neck']; hr = self.hr; hx, hy = nx + 3, ny - hr * 0.55
        self.mat('head', s.get('bodyCol')); self.mat('horn', '#6a7a4a'); self.mat('hair', '#4a6a3a'); self.mat('bone', '#ece4d0')
        sh = [E('head', hx, hy, hr * 1.1, hr * 0.85), E('eyeD', hx + hr * 0.1, hy + hr * 0.35, hr * 0.8, hr * 0.32, flat=True), E('eye', hx + hr * 0.55, hy - hr * 0.2, hr * 0.2, hr * 0.17, flat=True), E('eye', hx - hr * 0.1, hy - hr * 0.25, hr * 0.17, hr * 0.15, flat=True), E('eye', hx + hr * 0.25, hy - hr * 0.5, hr * 0.12, hr * 0.1, flat=True)]
        for k in range(5): sh.append(Pg('tooth', (hx - hr * 0.55 + k * hr * 0.33, hy + hr * 0.12), (hx - hr * 0.45 + k * hr * 0.33, hy + hr * 0.5), (hx - hr * 0.35 + k * hr * 0.33, hy + hr * 0.12), flat=True))
        for extra in s.get('headExtra', []): sh += extra(self, hx, hy)
        self.headC = (hx, hy)
        self.add('head', 'torso', J['neck'], 2.6, sh, tex=0.08)

    def arm_shapes(self, k):
        sx, sy = self.J['sh' + k]; ex, ey = self.J['elbow' + k]; wx, wy = self.J['wrist' + k]; t = self.at
        up = [E('body', sx, sy - 1, t * 1.5, t * 1.3), C('body', (sx, sy), (ex, ey), t * 1.05), E('moss', sx - t * 0.3, sy - t * 1.3, t * 1.0, 1.4, flat=False)]
        fo = [C('body', (ex, ey), (wx, wy), t * 1.1), E('body', ex, ey, t, t * 0.95), E('drip', ex + t * 0.6, ey + t * 1.2, 1.2, 2.2, flat=True)]
        hand = [E('body2', wx, wy + t * 0.8, t * 1.6, t * 1.4)]
        for kk in range(3): hand.append(Pg('body2', (wx + t * (1.5 - kk * 0.95), wy + t * 1.5), (wx + t * (1.8 - kk * 0.95), wy + t * 2.6), (wx + t * (0.9 - kk * 0.95), wy + t * 1.6)))
        return up, fo, hand

    def rest_arms(self, f=0, sway=1.0):
        return (10 + 3 * sway * sn(f), -10 + 2 * sway * sn(f + 0.6), 0), (-8 - 3 * sway * sn(f), -8 - 2 * sway * sn(f + 0.6), 0)

    def run(self, i, f):  # 흘러가듯: 몸이 늘었다 줄며 앞으로 기운다
        return self.P(hips=(0, 0.8 * sn(f), 0), torso=6 + 2 * sn(f), head=(-4 - 2 * sn(f), 0, 0), armN=(18 - 10 * cs(f), -14, 0), armF=(-12 + 10 * cs(f), -12, 0))

    def death(self, i):
        if i < 2: return super().death(i) if i == 0 else self.P(hips=(0, 6), torso=24, head=(14, 0, 0), armN=(30, 10, 0), armF=(30, 10, 0))
        return self.P(hips=(0, 10), torso=70, head=(20, 0, 0), armN=(60, 20, 0), armF=(60, 20, 0))


def golem_spec(bid):
    if bid == 'mossLord':
        return dict(cls=Golem, thigh=9, shin=8, upper=22, fore=20, torso=26, headR=8, limb=7, arm=7.5, bodyW=17, shoulderW=16, shDrop=-2, hunch=6, bodyCol='#7a6a58', moss='#5aa83a', mossy=True, golem='rock', golemHead='rock', headCol='#7a6a58', horn='#8a7050', legMat='body',
                    foot='#5a4a3c', footL=11, restN=(6, -6, 0), attack='punch', skill='slam', eye='#9be15d', glow='#d8ffb0', glow2='#5ad040', headExtra=[eye_glow], bodyTex=0.16, legTex=0.12)
    if bid == 'climbRift':
        return dict(cls=Golem, thigh=10, shin=9, upper=22, fore=20, torso=28, headR=8, limb=7, arm=7.5, bodyW=17, shoulderW=16, shDrop=-2, hunch=4, bodyCol='#3a2e3e', golem='dark', golemHead='dark', headCol='#3a2e3e', horn='#2a1e2e', legMat='body',
                    foot='#2a2030', footL=11, restN=(6, -6, 0), attack='punch', skill='slam', eye='#ffe14a', glow='#fff4b0', glow2='#ffb020', headExtra=[eye_glow], torsoExtra=[chest_core], bodyTex=0.12, legTex=0.1)
    if bid == 'foreman':
        return dict(cls=Golem, thigh=11, shin=10, upper=20, fore=18, torso=28, headR=7.5, limb=6.5, arm=6.5, bodyW=16, shoulderW=15, shDrop=-1, hunch=2, bodyCol='#a07a48', belt='#4a3a2a', golem='steam', golemHead='steam', headCol='#8a7050', metalFlat='#e8d8a0', legMat='body',
                    foot='#4a3a2a', footL=10, restN=(6, -6, 0), attack='punch', skill='slam', eye='#ff8030', glow='#ffe0a0', glow2='#ff7030', headExtra=[eye_glow], torsoExtra=[chest_core], bodyTex=0.05, legTex=0.04)
    if bid == 'climbQueen':
        return dict(cls=Blob, thigh=12, shin=12, upper=20, fore=18, torso=26, headR=9, limb=6, arm=7, bodyW=20, shoulderW=14, shDrop=0, hunch=6, bodyCol='#3a6a3a', moss='#7ac84a', foot='#2a4a2a', restN=(10, -10, 0), attack='punch', skill='roar', eye='#5dff9e', glow='#d8ffe0', glow2='#5dff9e', headExtra=[eye_glow], skW=0)
    return None


# ═══════════════════════════ 네발 · 날개 (뼈 용 · 하늘 고래) ═══════════════════════════
class Beast:
    """하늘 고래 · 뼈 용: 몸통 뿌리에서 머리 · 꼬리 · 다리 · 날개가 달린 뼈대"""

    def __init__(self, bid):
        self.bid = bid; self.W, self.H = 170, 120; self.G = self.H - 2
        self.ramps, self.flats, self.parts = {}, {}, {}
        self.parts = []
        getattr(self, 'build_' + bid)()
        self.model = Model(self.W, self.H, self.parts, self.ramps, OUT, self.flats)

    def mat(self, key, color): self.ramps[key] = ramp(color)
    def flat(self, key, color): self.flats[key] = color
    def add(self, *a, **k): self.parts.append(Part(*a, **k))

    # ── 하늘 고래 아에로: 떠 있는 고래 · 지느러미 · 꼬리 · 빛나는 무늬 · 입 ──
    def build_skyWhale(self):
        self.mat('body', '#6a94c8'); self.mat('belly', '#d8ecf8'); self.mat('fin', '#5a84b8'); self.flat('eye', '#1a1e30'); self.flat('eyeW', '#ffffff'); self.flat('glow', '#cfefff'); self.flat('glow2', '#8ad8ff'); self.flat('mouth', '#2a3a5a'); self.flat('tooth', '#f0f4ff')
        W, H = self.W, self.H; cx, cy = W * 0.5, H * 0.55; L = 62; r = 22
        self.C = (cx, cy)
        body = [E('body', cx, cy, L * 0.72, r), E('body', cx + L * 0.35, cy - 2, L * 0.42, r * 0.85), E('belly', cx + L * 0.1, cy + r * 0.45, L * 0.6, r * 0.5)]
        for k in range(5): body.append(Ln('belly', (cx - L * 0.3 + k * 8, cy + r * 0.2), (cx - L * 0.3 + k * 8 + 1, cy + r * 0.85), 0.8))
        for k in range(6): body.append(E('glow', cx - L * 0.45 + k * L * 0.19, cy - r * 0.55 + (k % 2) * 4, 1.3, 1.3, flat=True))
        self.add('body', None, (cx, cy), 2, body, tex=0.05)
        # 머리 (몸 앞) · 턱 (아래로 벌어진다)
        hx, hy = cx + L * 0.6, cy
        self.add('head', 'body', (hx, hy), 2.5, [E('body', hx + 4, hy - 4, 16, 14), Pg('body', (hx - 4, hy - 14), (hx + 20, hy - 8), (hx + 22, hy + 2), (hx - 2, hy + 4)), E('eyeW', hx + 2, hy - 7, 2.8, 2.6, flat=True), E('eye', hx + 2.6, hy - 7, 1.4, 1.5, flat=True)], tex=0.03)
        self.add('jaw', 'head', (hx, hy + 2), 2.4, [Pg('belly', (hx - 6, hy + 1), (hx + 21, hy + 1), (hx + 19, hy + 8), (hx - 4, hy + 10))] + [Pg('tooth', (hx + 2 + k * 4, hy + 1), (hx + 3.2 + k * 4, hy + 3.5), (hx + 4.4 + k * 4, hy + 1), flat=True) for k in range(4)], sep=False)
        self.parts.append(Part('glow_g', 'jaw', (hx, hy + 2), 2.45, [E('glow', hx + 8, hy + 4, 9, 2.6, flat=True)], sep=False))
        self.parts.append(Part('glow_G', 'jaw', (hx, hy + 2), 2.44, [E('glow2', hx + 10, hy + 4, 14, 5, flat=True), E('glow', hx + 10, hy + 4, 9, 3, flat=True)], sep=False))
        # 지느러미 (가슴) 앞 · 뒤 · 등지느러미
        fx, fy = cx + L * 0.2, cy + r * 0.5
        self.add('finN', 'body', (fx, fy), 2.8, [Pg('fin', (fx - 4, fy - 3), (fx + 6, fy - 1), (fx + 2, fy + 22), (fx - 10, fy + 16))], sep=False)
        self.add('finF', 'body', (fx - 8, fy - 6), 0.5, [Pg('fin', (fx - 12, fy - 9), (fx - 2, fy - 7), (fx - 6, fy + 12), (fx - 18, fy + 8))], sep=False)
        self.add('dorsal', 'body', (cx - L * 0.15, cy - r), 1.5, [Pg('fin', (cx - L * 0.3, cy - r + 2), (cx - L * 0.1, cy - r - 10), (cx + L * 0.05, cy - r + 2))], sep=False)
        # 꼬리: 두 마디 + 꼬리지느러미
        tx, ty = cx - L * 0.65, cy
        self.add('tail1', 'body', (tx + 6, ty), 1.8, [C('body', (tx + 6, ty), (tx - 14, ty - 1), 8)], tex=0.05)
        self.add('tail2', 'tail1', (tx - 14, ty - 1), 1.7, [C('body', (tx - 14, ty - 1), (tx - 28, ty - 3), 5), Pg('fin', (tx - 26, ty - 3), (tx - 40, ty - 16), (tx - 34, ty - 2), (tx - 42, ty + 10), (tx - 26, ty))], tex=0.05)

    def anims_skyWhale(self):
        def P(f, k=1, jaw=0, glow=(), tilt=0, dy=0, dx=0, finA=0):
            o = {'body': (tilt, dx, dy), 'head': (2 * sn(f) * k,), 'jaw': (jaw,), 'tail1': (8 * sn(f - 0.8) * k,), 'tail2': (12 * sn(f - 1.5) * k,), 'finN': (finA + 12 * sn(f - 0.4) * k,), 'finF': (finA + 12 * sn(f + 0.4) * k,), 'dorsal': (0,)}
            o['_hide'] = tuple(n for n in ('glow_g', 'glow_G') if n[5:] not in glow)
            return o
        idle = [P(i / 8 * 2 * PI, dy=1.5 * sn(i / 8 * 2 * PI)) for i in range(8)]
        run = [P(i / 8 * 2 * PI, k=1.8, tilt=-4, dy=1.5 * sn(i / 4 * PI)) for i in range(8)]
        atk = [P(0, jaw=4, tilt=-6, dx=-3), P(0.5, jaw=8, tilt=-10, dx=-5), P(1, jaw=10, tilt=-12, dx=-6), P(1.5, jaw=22, tilt=-2, dx=0), P(2, jaw=34, tilt=8, dx=6, glow=('g',)), P(2.5, jaw=38, tilt=12, dx=9, glow=('g', 'G')), P(3, jaw=38, tilt=12, dx=10, glow=('g', 'G'))]
        skl = [P(0, jaw=6, tilt=-6, dy=-2), P(0.4, jaw=10, tilt=-12, dy=-4), P(0.8, jaw=14, tilt=-18, dy=-6, glow=('g',)), P(1.2, jaw=26, tilt=-24, dy=-8, glow=('g',)), P(1.6, jaw=34, tilt=-28, dy=-9, glow=('g', 'G')), P(2.0, jaw=36, tilt=-30, dy=-10, glow=('g', 'G')), P(2.4, jaw=36, tilt=-30, dy=-10, glow=('g', 'G'))]
        hit = [P(0, tilt=6, dx=-3, jaw=10), P(0.5, tilt=9, dx=-5, jaw=14), P(1, tilt=4, dx=-3, jaw=8), P(1.5, tilt=1, dx=-1, jaw=3)]
        death = [P(0, tilt=10, dx=-3, jaw=16), P(0, tilt=24, dy=6, jaw=20, finA=20), P(0, tilt=38, dy=14, jaw=26, finA=40)]
        return {'idle': idle, 'run': run, 'attack': atk, 'skill': skl, 'hit': hit, 'death': death}

    # ── 시계탑에 묶인 뼈 용: 네 발 · 긴 목 · 뼈 날개 · 꼬리 · 가슴의 톱니와 사슬 ──
    def build_clockKeeper(self):
        self.mat('bone', '#e4d8bc'); self.mat('bone2', '#c0b094'); self.mat('iron', '#6a6a78'); self.mat('gold', '#d8b040'); self.flat('eye', '#ffd88a'); self.flat('eyeD', '#1a1410'); self.flat('glow', '#fff0c0'); self.flat('glow2', '#ffb040'); self.flat('metal', '#e8d8a0'); self.flat('tooth', '#f4ecd8')
        W, H = self.W, self.H; G = self.G; cx = W * 0.46; by = G - 34
        self.C = (cx, by)
        body = [C('bone', (cx - 26, by + 2), (cx + 22, by - 4), 7)]
        for k in range(6): x = cx - 20 + k * 8; body.append(C('bone', (x, by - 6), (x + 1, by + 14 - (k % 2) * 2), 1.6))  # 갈비뼈
        body += [E('gold', cx + 2, by + 6, 6, 6), E('iron', cx + 2, by + 6, 3.4, 3.4)]
        for k in range(8): a = k / 8 * PI * 2; body.append(Pg('gold', (cx + 2 + cs(a) * 5.5, by + 6 + sn(a) * 5.5), (cx + 2 + cs(a) * 8, by + 6 + sn(a) * 8), (cx + 2 + cs(a + 0.4) * 5.5, by + 6 + sn(a + 0.4) * 5.5)))  # 톱니
        body += [C('bone2', (cx - 20, by - 2), (cx + 18, by - 7), 2.2)]
        for k in range(7): body.append(Pg('bone', (cx - 20 + k * 7, by - 7), (cx - 17 + k * 7, by - 15), (cx - 14 + k * 7, by - 7)))  # 등 가시
        self.add('body', None, (cx, by), 2, body, tex=0.04)
        # 사슬 (몸에서 땅으로)
        self.add('chain', 'body', (cx - 10, by + 8), 0.9, [E('iron', cx - 10 - k * 3, by + 10 + k * 3.2, 1.6, 1.3) for k in range(8)], sep=False)
        # 목 두 마디 · 머리 · 턱
        n0 = (cx + 20, by - 4); n1 = (n0[0] + 12, n0[1] - 14); n2 = (n1[0] + 8, n1[1] - 16)
        self.add('neck1', 'body', n0, 2.3, [C('bone', n0, n1, 4.5), C('bone2', (n0[0] + 2, n0[1] - 3), (n1[0] + 2, n1[1] - 3), 1.2)], tex=0.03)
        self.add('neck2', 'neck1', n1, 2.35, [C('bone', n1, n2, 4), C('bone2', (n1[0] + 2, n1[1] - 3), (n2[0] + 2, n2[1] - 3), 1.1)], tex=0.03)
        hx, hy = n2
        self.add('head', 'neck2', (hx, hy), 2.6, [E('bone', hx + 2, hy - 2, 9, 7.5), Pg('bone', (hx + 2, hy - 8), (hx + 24, hy - 3), (hx + 24, hy + 2), (hx + 2, hy + 4)), E('eyeD', hx + 6, hy - 3, 3.2, 2.6, flat=True), E('eye', hx + 6.4, hy - 3, 1.6, 1.3, flat=True),
                                                 Pg('bone2', (hx - 2, hy - 8), (hx - 10, hy - 20), (hx + 2, hy - 7)), Pg('bone2', (hx + 5, hy - 8), (hx + 1, hy - 18), (hx + 8, hy - 7))] + [Pg('tooth', (hx + 8 + k * 4, hy + 2), (hx + 9.5 + k * 4, hy + 5), (hx + 11 + k * 4, hy + 2), flat=True) for k in range(4)], tex=0.02)
        self.add('jaw', 'head', (hx + 2, hy + 2), 2.5, [Pg('bone2', (hx, hy + 2), (hx + 22, hy + 3), (hx + 20, hy + 7), (hx + 2, hy + 8))] + [Pg('tooth', (hx + 7 + k * 4.5, hy + 3), (hx + 8.5 + k * 4.5, hy), (hx + 10 + k * 4.5, hy + 3), flat=True) for k in range(3)], sep=False)
        self.parts.append(Part('glow_g', 'head', (hx, hy), 2.65, [E('glow', hx + 6, hy - 3, 3.2, 2.8, flat=True)], sep=False))
        self.parts.append(Part('glow_G', 'head', (hx, hy), 2.64, [E('glow2', hx + 14, hy + 2, 10, 4, flat=True), E('glow', hx + 14, hy + 2, 7, 2.6, flat=True), E('glow2', hx + 6, hy - 3, 4.5, 4, flat=True)], sep=False))
        # 다리 넷 (앞 · 뒤 × 가까운 · 먼): 허벅지 · 정강이 · 발
        self.legs = {}
        for name, (lx, ly), z in (('fl', (cx + 14, by + 2), 2.8), ('bl', (cx - 18, by + 3), 2.7), ('fr', (cx + 8, by), 0.6), ('br', (cx - 24, by + 1), 0.5)):
            l1, l2 = 16, 15
            k1 = (lx + 2, ly + l1); a = (k1[0] - 1, k1[1] + l2)
            self.legs[name] = (lx, ly, l1, l2)
            self.add('th_' + name, 'body', (lx, ly), z, [C('bone', (lx, ly), k1, 3.4), E('bone2', lx, ly, 4, 3.5)], tex=0.03)
            self.add('sh_' + name, 'th_' + name, k1, z + 0.05, [C('bone', k1, a, 2.6), E('bone2', k1[0], k1[1], 3, 2.8)], tex=0.03)
            self.add('ft_' + name, 'sh_' + name, a, z + 0.1, [Pg('bone2', (a[0] - 4, a[1] - 1), (a[0] + 8, a[1] - 1), (a[0] + 9, a[1] + 2), (a[0] - 5, a[1] + 2))] + [Pg('tooth', (a[0] + 2 + kk * 3, a[1] + 1), (a[0] + 4 + kk * 3, a[1] + 4), (a[0] + 4.5 + kk * 3, a[1] + 1), flat=True) for kk in range(3)], sep=False)
        # 꼬리 세 마디
        t0 = (cx - 26, by + 2); t1 = (t0[0] - 16, t0[1] + 4); t2 = (t1[0] - 14, t1[1] + 2); t3 = (t2[0] - 12, t2[1] - 4)
        self.add('tail1', 'body', t0, 1.8, [C('bone', t0, t1, 4)], tex=0.03)
        self.add('tail2', 'tail1', t1, 1.7, [C('bone', t1, t2, 3)], tex=0.03)
        self.add('tail3', 'tail2', t2, 1.6, [C('bone', t2, t3, 2.2), Pg('bone2', (t3[0] + 2, t3[1] - 2), (t3[0] - 8, t3[1] - 6), (t3[0] - 2, t3[1] + 3))], tex=0.03)
        # 뼈 날개 (등에서 위로)
        for k, z, sg in (('N', 2.9, 1), ('F', 0.3, 0.9)):
            px, py = cx - 2 + (4 if k == 'N' else -6), by - 7
            L = 44
            self.add('wing' + k, 'body', (px, py), z, [C('bone', (px, py), (px - L * 0.35 * sg, py - L * 0.6), 2.2), C('bone', (px - L * 0.35 * sg, py - L * 0.6), (px - L * 1.0 * sg, py - L * 0.55), 1.8), C('bone2', (px - L * 0.35 * sg, py - L * 0.6), (px - L * 0.9 * sg, py - L * 0.15), 1.4), C('bone2', (px - L * 0.35 * sg, py - L * 0.6), (px - L * 0.65 * sg, py + L * 0.1), 1.3),
                                                        Pg('iron', (px - L * 0.35 * sg, py - L * 0.6), (px - L * 1.0 * sg, py - L * 0.55), (px - L * 0.9 * sg, py - L * 0.15), (px - L * 0.65 * sg, py + L * 0.1), flat=False)], sep=False, tex=0.0)
        self.ramps['iron'] = ramp('#4a4a58')

    def leg_ik(self, name, tgt, pose, bdx=0, bdy=0, bang=0):
        lx, ly, l1, l2 = self.legs[name]
        hip = rot((lx + bdx, ly + bdy), (self.C[0] + bdx, self.C[1] + bdy), bang)
        d1, d2, _ = ik2(hip, tgt, l1, l2, bend=-1 if name[0] == 'f' else 1)  # 앞다리 팔꿈치는 뒤, 뒷다리 무릎은 앞
        r1 = math.degrees(math.atan2(l1, 2)); r2 = math.degrees(math.atan2(l2, -1))
        pose['th_' + name] = (d1 - r1 - bang,); pose['sh_' + name] = (d2 - d1 - (r2 - r1),); pose['ft_' + name] = (-(d2 - 90),)

    def anims_clockKeeper(self):
        G = self.G
        rest = {n: (self.legs[n][0] + 1, G - 2) for n in self.legs}
        def P(f, k=1.0, bdx=0, bdy=0, bang=0, neck=(0, 0), head=0, jaw=0, wing=0, glow=(), feet=None, tail=1.0):
            pose = {'body': (bang, bdx, bdy), 'neck1': (neck[0] + 2 * sn(f) * k,), 'neck2': (neck[1] + 2 * sn(f - 0.5) * k,), 'head': (head + 2 * sn(f - 1) * k,), 'jaw': (jaw,), 'chain': (0,),
                    'tail1': (6 * sn(f - 0.6) * tail,), 'tail2': (10 * sn(f - 1.2) * tail,), 'tail3': (14 * sn(f - 1.8) * tail,), 'wingN': (wing + 5 * sn(f) * k,), 'wingF': (wing + 5 * sn(f + 0.5) * k,)}
            for n in self.legs: self.leg_ik(n, (feet or rest)[n], pose, bdx, bdy, bang)
            pose['_hide'] = tuple(n for n in ('glow_g', 'glow_G') if n[5:] not in glow)
            return pose
        idle = [P(i / 8 * 2 * PI, bdy=0.8 - 0.8 * sn(i / 8 * 2 * PI)) for i in range(8)]
        run = []
        S, lift = 7, 7
        for i in range(8):
            f = i / 8 * 2 * PI; feet = {}
            for n, ph in (('fl', 0), ('br', 0), ('fr', PI), ('bl', PI)):  # 대각선 걸음
                p = (f + ph) % (2 * PI); ax, ay = rest[n]
                if p < PI: feet[n] = (ax + S * (1 - 2 * p / PI), ay)
                else: u = (p - PI) / PI; feet[n] = (ax - S + 2 * S * ease(u), ay - lift * sn(u * PI))
            run.append(P(f, k=1.5, bdy=1 - 1.6 * sn(f) ** 2, bang=-2, feet=feet, tail=1.6))
        atk = [P(0, bang=-4, bdx=-2, neck=(-18, -10), head=-8, jaw=6), P(0.5, bang=-6, bdx=-3, neck=(-26, -14), head=-10, jaw=8), P(1, bang=-7, bdx=-3, neck=(-30, -16), head=-10, jaw=10),
               P(1.5, bang=-2, bdx=0, neck=(-10, 0), head=0, jaw=18, glow=('g',)), P(2, bang=6, bdx=4, neck=(20, 22), head=14, jaw=30, glow=('g', 'G')), P(2.5, bang=10, bdx=7, neck=(30, 30), head=18, jaw=36, glow=('g', 'G')), P(3, bang=11, bdx=8, neck=(32, 32), head=18, jaw=36, glow=('g', 'G'))]
        skl = [P(0, bang=2, bdy=2, neck=(10, 10), head=6, jaw=4, wing=10), P(0.4, bang=4, bdy=3, neck=(16, 14), head=8, jaw=6, wing=16), P(0.8, bang=4, bdy=3, neck=(18, 16), head=8, jaw=8, wing=18, glow=('g',)),
               P(1.2, bang=-6, bdy=-1, neck=(-20, -26), head=-14, jaw=22, wing=-20, glow=('g',)), P(1.6, bang=-12, bdy=-4, neck=(-36, -40), head=-20, jaw=34, wing=-40, glow=('g', 'G')), P(2.0, bang=-14, bdy=-5, neck=(-40, -44), head=-22, jaw=38, wing=-46, glow=('g', 'G')), P(2.4, bang=-14, bdy=-5, neck=(-40, -44), head=-22, jaw=38, wing=-46, glow=('g', 'G'))]
        hit = [P(0, bang=4, bdx=-2, neck=(-14, -10), head=-8, jaw=12), P(0.5, bang=6, bdx=-4, neck=(-20, -14), head=-10, jaw=16), P(1, bang=3, bdx=-2, neck=(-10, -6), head=-5, jaw=8), P(1.5, bang=1, bdx=-1, neck=(-3, -2), head=-2, jaw=3)]
        low = {n: (rest[n][0] + (6 if n[0] == 'b' else -4), rest[n][1]) for n in rest}
        death = [P(0, bang=5, bdx=-3, neck=(-20, -16), head=-10, jaw=16, wing=14), P(0, bdy=14, bang=2, neck=(10, 20), head=14, jaw=20, wing=30, feet=low), P(0, bdy=24, bang=6, neck=(30, 42), head=30, jaw=26, wing=52, feet=low)]
        return {'idle': idle, 'run': run, 'attack': atk, 'skill': skl, 'hit': hit, 'death': death}

    def anims(self): return getattr(self, 'anims_' + self.bid)()


# ═══════════════════════════ 만들기 ═══════════════════════════
BOSSES = ['climbChief', 'mossLord', 'bogHag', 'climbQueen', 'demonCaptain', 'climbRift', 'frostOgre', 'climbWitch', 'wraithLord', 'engraveKing',
          'stormHarpy', 'skyWhale', 'mirrorSelf', 'shardQueen', 'foreman', 'clockKeeper', 'archivist', 'starReader', 'highPriest', 'lastKing']


def make(bid):
    if bid in ('skyWhale', 'clockKeeper'): return Beast(bid)
    g = golem_spec(bid)
    if g: cls = g.pop('cls'); g.setdefault('W', 170); g.setdefault('H', 120); return cls(g)
    s = spec_of(bid); s.setdefault('W', 170); s.setdefault('H', 130)
    return Humanoid(s)


def render_boss(bid, colors=COLORS):
    """→ (동작 → (H,W,4) 장면 목록, cx) 모두 같은 크기로 잘라서"""
    rig = make(bid); anims = rig.anims(); model = rig.model
    frames, keys = [], []
    for k, poses in anims.items():
        for p in poses:
            p = dict(p); hide = p.pop('_hide', ())
            frames.append(render(model, p, hide)); keys.append(k)
    outline = model.outline
    if colors: frames = reduce_colors_np(frames, colors, outline)
    # 자르기: 가운데(cx)를 기준으로 좌우 같은 너비 · 위는 가장 높은 곳 · 아래는 바닥 + 2
    cx = getattr(rig, 'cx', None) or rig.C[0]
    alpha = np.stack([f[..., 3] > 0 for f in frames]).any(0)
    ys, xs = np.where(alpha)
    half = int(max(cx - xs.min(), xs.max() - cx)) + 2
    x0, x1 = int(round(cx)) - half, int(round(cx)) + half
    y0 = max(0, ys.min() - 1); y1 = rig.H
    out = {}
    for f, k in zip(frames, keys):
        pad = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        sx0, sx1 = max(0, x0), min(rig.W, x1)
        pad[:, sx0 - x0:sx1 - x0] = f[y0:y1, sx0:sx1]
        out.setdefault(k, []).append(pad)
    return out


def write_all(ids):
    mf = meta_path('bosses'); meta = json.load(open(mf, encoding='utf-8')) if os.path.exists(mf) else {}
    sheet_path = os.path.join(HERE, '..', 'public', 'assets', 'custom', 'bosses.png')
    rows = []  # (prefix, anims dict)
    for bid in ids:
        print('그리는 중:', bid, flush=True)
        rows.append(('b_' + bid, render_boss(bid)))
    # 안 바꾸는 보스(목록에 없는)는 예전 시트에서 그대로 가져온다
    keep = {}
    if os.path.exists(sheet_path) and meta:
        old = np.array(Image.open(sheet_path).convert('RGBA'))
        for pre, m in meta.items():
            if pre[2:] in ids: continue
            fr = {}
            for k, a in m['anims'].items():
                y = m['y0'] + a['row'] * m['h']
                fr[k] = [old[y:y + m['h'], i * m['w']:(i + 1) * m['w']] for i in range(a['n'])]
            keep[pre] = (m, fr)
    width = 0; y = 0; placed = []
    newmeta = {}
    order = [pre for pre in meta if pre not in dict(rows)] + [pre for pre, _ in rows]
    byrow = dict(rows)
    for pre in order:
        if pre in byrow:
            fr = byrow[pre]; h, w = next(iter(fr.values()))[0].shape[:2]
            m = {'w': w, 'h': h, 'y0': y, 'foot': h - 2, 'full': True, 'anims': {k: {'row': r, 'n': len(v)} for r, (k, v) in enumerate(fr.items())}, 'tween': 1, 'rig': 1}
        elif pre in keep:
            m, fr = keep[pre]; m = dict(m); m['y0'] = y; w, h = m['w'], m['h']
        else: continue
        newmeta[pre] = m; placed.append((pre, fr, m)); width = max(width, max(len(v) for v in fr.values()) * w); y += h * len(fr)
    sheet = np.zeros((y, width, 4), np.uint8)
    for pre, fr, m in placed:
        for k, v in fr.items():
            yy = m['y0'] + m['anims'][k]['row'] * m['h']
            for i, f in enumerate(v): sheet[yy:yy + m['h'], i * m['w']:(i + 1) * m['w']] = f
    Image.fromarray(sheet).save(sheet_path, optimize=True)
    json.dump(newmeta, open(mf, 'w', encoding='utf-8'), ensure_ascii=False)
    build_manifest()
    print(f'bosses.png {sheet.shape[1]}x{sheet.shape[0]}')


def preview(ids, gif=False):
    S = 2
    tiles = []
    for bid in ids:
        print('미리 보기:', bid, flush=True)
        fr = render_boss(bid)
        h, w = next(iter(fr.values()))[0].shape[:2]
        cols = max(len(v) for v in fr.values())
        tile = np.zeros((h * len(fr), w * cols, 4), np.uint8)
        for r, (k, v) in enumerate(fr.items()):
            for i, f in enumerate(v): tile[r * h:(r + 1) * h, i * w:(i + 1) * w] = f
        tiles.append(tile)
        if gif:
            seq = [('idle', i) for i in range(8)] * 2 + [('run', i) for i in range(8)] * 2 + [('attack', 0)] * 4 + [('attack', i) for i in (1, 1, 2, 3, 4, 5, 6, 6, 6)] + [('idle', 0)] * 2 + [('skill', i) for i in (0, 1, 2, 3, 4, 5, 6, 6, 6, 6)] + [('hit', i) for i in (0, 1, 2, 3)] + [('death', i) for i in (0, 1, 2, 2, 2, 2)]
            ims = []
            for k, i in seq:
                o = Image.new('RGBA', (w * S, h * S), (46, 44, 56, 255)); o.alpha_composite(Image.fromarray(fr[k][i]).resize((w * S, h * S), Image.NEAREST)); ims.append(o.convert('P', palette=Image.ADAPTIVE))
            dur = {'idle': 200, 'run': 110, 'attack': 120, 'skill': 90, 'hit': 250, 'death': 150}
            ims[0].save(os.path.join(HERE, '..', 'art', 'preview_bossrig.gif'), save_all=True, append_images=ims[1:], duration=[dur[k] for k, _ in seq], loop=0)
    Wt = max(t.shape[1] for t in tiles); Ht = sum(t.shape[0] for t in tiles)
    png = Image.new('RGBA', (Wt * S, Ht * S), (46, 44, 56, 255)); y = 0
    for t in tiles: png.alpha_composite(Image.fromarray(t).resize((t.shape[1] * S, t.shape[0] * S), Image.NEAREST), (0, y)); y += t.shape[0] * S
    p = os.path.join(HERE, '..', 'art', 'preview_bossrig.png'); png.save(p); print(p)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = args or BOSSES
    if '--write' in sys.argv: write_all(ids)
    else: preview(ids, gif=len(ids) == 1)
