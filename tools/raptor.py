# 랩터 도트: 두 발로 달리는 날렵한 공룡 (옆모습, 오른쪽을 본다). 야생 랩터 · 우두머리 · 안장을 얹은 탈것.
# 동작: 서기(4) · 달리기(6) · 물기(4). pixelrig 뼈대 도트로 프레임마다 관절을 새로 찍는다.
import math, sys, json
from pixelrig import Model, Part, Shape, sheet

W, H = 46, 34


def raptor(body, belly, stripe, saddle=False):
    parts = [
        Part('tail', 'body', (16, 19), 0.5, [Shape('poly', 'body', [(17, 16.5), (8, 15.5), (1.5, 13.0), (0.8, 14.6), (8, 19.2), (17, 21.4)])], tex=0.18),
        Part('thighF', 'body', (21, 21), 0.7, [Shape('ellipse', 'bodyFar', 21.5, 22.6, 3.4, 4.0)]),
        Part('shinF', 'thighF', (22, 25.6), 0.72, [Shape('capsule', 'bodyFar', (22, 25.6), (20.4, 30.2), 1.25), Shape('poly', 'claw', [(19.4, 30.2), (24.8, 30.2), (25.8, 31.6), (19.0, 31.6)])]),
        Part('armF', 'body', (29, 20), 0.8, [Shape('capsule', 'bodyFar', (29, 20), (31.4, 23.4), 0.9), Shape('line', 'clawF', (31.4, 23.4), (32.6, 24.6), 0.6, flat=True)]),
        Part('body', None, (22, 20), 1, [Shape('ellipse', 'body', 22.4, 19.4, 8.6, 5.0), Shape('ellipse', 'belly', 24.0, 22.0, 6.4, 2.4)], tex=0.18),
        Part('neck', 'body', (28.4, 17), 1.2, [Shape('capsule', 'body', (28.4, 17.6), (32.6, 11.4), 2.5), Shape('capsule', 'belly', (30.0, 18.4), (33.6, 12.4), 1.2)], tex=0.15),
        Part('head', 'neck', (32.6, 11.4), 1.3, [
            Shape('ellipse', 'body', 34.4, 9.6, 4.2, 3.0), Shape('poly', 'body', [(35.6, 7.6), (43.4, 9.4), (43.6, 10.8), (36.4, 11.6)]),
            Shape('ellipse', 'eyeW', 34.8, 8.6, 1.05, 1.0, flat=True), Shape('ellipse', 'eye', 35.1, 8.7, 0.55, 0.65, flat=True),
            Shape('line', 'stripeF', (32.6, 7.2), (36.4, 6.8), 0.8, flat=True), Shape('line', 'mouth', (37.0, 10.4), (43.2, 10.6), 0.5, flat=True)]),
        Part('jaw', 'head', (35, 11), 1.32, [Shape('poly', 'belly', [(35.0, 10.8), (42.4, 11.0), (41.8, 12.2), (35.6, 12.6)]), Shape('line', 'tooth', (37.4, 10.9), (41.8, 11.0), 0.4, flat=True)]),
        Part('thighN', 'body', (22, 21), 1.6, [Shape('ellipse', 'body', 22.4, 22.8, 3.6, 4.2)], tex=0.15),
        Part('shinN', 'thighN', (23, 26), 1.62, [Shape('capsule', 'body', (23, 26), (21.6, 30.2), 1.35), Shape('poly', 'claw', [(20.6, 30.2), (26.2, 30.2), (27.2, 31.6), (20.2, 31.6)]), Shape('line', 'clawF', (26.6, 30.4), (27.6, 29.0), 0.6, flat=True)]),
        Part('armN', 'body', (28, 20.4), 1.7, [Shape('capsule', 'body', (28, 20.4), (30.6, 24.0), 1.0), Shape('line', 'clawF', (30.6, 24.0), (31.8, 25.2), 0.6, flat=True)]),
    ]
    # 등줄무늬
    for i, x in enumerate((16, 19, 22, 25)):
        parts[4].shapes.append(Shape('line', 'stripeF', (x, 15.0), (x - 1.2, 17.6), 0.9, flat=True))
    if saddle:
        parts.append(Part('saddle', 'body', (22, 15), 1.9, [Shape('poly', 'leather', [(17.6, 14.6), (26.4, 14.6), (27.0, 17.2), (17.0, 17.2)]), Shape('line', 'gold', (17.4, 15.0), (26.6, 15.0), 0.6, flat=True),
                                                         Shape('line', 'strap', (21.6, 17.0), (22.6, 23.6), 0.7, flat=True), Shape('ellipse', 'leather', 26.4, 14.4, 1.1, 1.4)]))
        parts.append(Part('rein', 'neck', (31, 13), 1.35, [Shape('line', 'strap', (33.6, 10.6), (27.0, 14.4), 0.5, flat=True)]))
    ramps = {
        'body': body, 'bodyFar': [body[1], body[2], body[3], body[3]], 'belly': belly, 'claw': ['#e8e0cc', '#c8b898', '#8a7a64', '#5a4c3c'],
        'leather': ['#a8703e', '#7a4a2a', '#5a321c', '#3a1e10'],
    }
    flats = {'eye': '#1a0e08', 'eyeW': '#ffd040', 'stripeF': stripe, 'mouth': '#3a1a14', 'tooth': '#f4f0e0', 'clawF': '#f0e8d8', 'gold': '#e8c040', 'strap': '#4a2a16'}
    return Model(W, H, parts, ramps, '#140e0c', flats)


S = math.sin

def idle(n=4):
    return [{'body': (0, 0, [0, 0, 1, 1][i]), 'neck': (3 * S(i / n * 6.28),), 'head': (-3 * S(i / n * 6.28),), 'tail': (4 * S(i / n * 6.28 + 1),), 'armN': (6 * S(i / n * 6.28),), 'armF': (6 * S(i / n * 6.28),)} for i in range(n)]

def run(n=6):
    out = []
    for i in range(n):
        f = i / n * math.pi * 2
        out.append({'body': (-4, 0, -round(abs(S(f)) * 1.5)), 'thighN': (38 * S(f),), 'shinN': (-30 * max(0, S(f + 1.2)),), 'thighF': (-38 * S(f),), 'shinF': (-30 * max(0, S(f + 1.2 + math.pi)),),
                    'neck': (-10 + 4 * S(f * 2),), 'head': (8,), 'tail': (-8 + 6 * S(f),), 'armN': (30,), 'armF': (30,), 'jaw': (0,)})
    return out

def bite(n=4):
    seq = [(-6, 0), (-14, 18), (10, 4), (0, 0)]
    return [{'body': (a * 0.3,), 'neck': (a,), 'head': (-a * 0.5,), 'jaw': (j,), 'tail': (-a * 0.5,), 'armN': (20,), 'armF': (20,)} for a, j in seq]


if __name__ == '__main__':
    out = sys.argv[1]
    meta = {}
    for name, body, belly, stripe, saddle in (
        ('raptor', ['#7ac85a', '#4a9a3a', '#2e6a26', '#1a4016'], ['#f0e0a0', '#d8c078', '#a89050', '#6a5a30'], '#2a5a1e', False),
        ('raptor_alpha', ['#d8604a', '#a83a2a', '#6e2218', '#40120c'], ['#f0d8a0', '#d0b070', '#9a7a48', '#5a4428'], '#3a0e0a', False),
        ('raptor_mount', ['#5ab0c8', '#3a7e9a', '#265a70', '#163a48'], ['#f0e8c0', '#d8cc98', '#a89a68', '#6a5e40'], '#1a3e4e', True),
    ):
        m = raptor(body, belly, stripe, saddle)
        _, mt = sheet(m, [('idle', idle()), ('run', run()), ('bite', bite())], f'{out}/{name}.png')
        meta[name] = {'w': W, 'h': H, 'anims': mt}
    json.dump(meta, open(f'{out}/raptors.json', 'w'))
    print(meta)
