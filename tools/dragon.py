# 불 용 (용화): 오른쪽을 보고 선 네 발 용. 동작: 서기 · 걷기 · 브레스 · 날갯짓 · 할퀴기
import math, sys, json
from pixelrig import Model, Part, Shape, sheet

W, H = 72, 58

def tri(x, y, w=2, h=4):
    return [(x - w / 2, y), (x, y - h), (x + w / 2, y)]

def wing_shapes(ox, oy, key, bone):
    sh = lambda pts: [(x + ox, y + oy) for x, y in pts]
    mem = sh([(36, 26), (31, 13), (25, 4), (15, 1), (5, 6), (11, 10), (4, 14), (13, 16), (9, 21), (20, 22), (29, 26)])
    elbow, wrist = sh([(31, 13)])[0], sh([(25, 4)])[0]
    tips = sh([(15, 1), (5, 6), (4, 14), (9, 21)])
    root = sh([(36, 26)])[0]
    s = [Shape('poly', key, mem)]
    s.append(Shape('line', bone, root, elbow, 2.2, flat=True))
    s.append(Shape('line', bone, elbow, wrist, 1.8, flat=True))
    for t in tips: s.append(Shape('line', bone, elbow if t != tips[0] else wrist, t, 1.1, flat=True))
    return s

def leg(prefix, ox, oy, key, z, front):
    up, lo, ft = f'{prefix}_up', f'{prefix}_lo', f'{prefix}_ft'
    P = lambda x, y: (x + ox, y + oy)
    if front:
        upper = [Shape('ellipse', key, *P(44, 37), 4.2, 5.2), Shape('capsule', key, P(44.5, 38), P(44, 45), 3.1)]
        lower = [Shape('capsule', key, P(44, 45), P(44.5, 51), 2.5)]
        foot = [Shape('ellipse', key, *P(45.5, 52.6), 4.2, 1.9)]
        claws = [Shape('ellipse', 'claw', 49.2 + ox - i * 2.6, 54 + oy, 0.8, 0.8, flat=True) for i in range(3)]
        return [Part(up, 'body', P(44, 37), z, upper, tex=0.03),
                Part(lo, up, P(44, 45), z - 0.1, lower, sep=False, tex=0.03),
                Part(ft, lo, P(44.5, 51.5), z - 0.2, foot + claws, sep=False)]
    upper = [Shape('ellipse', key, *P(24, 40), 6.5, 7.2)]
    lower = [Shape('capsule', key, P(26, 45), P(22.5, 51), 2.6)]
    foot = [Shape('ellipse', key, *P(23.5, 52.6), 4.2, 1.9)]
    claws = [Shape('ellipse', 'claw', 27.2 + ox - i * 2.6, 54 + oy, 0.8, 0.8, flat=True) for i in range(3)]
    return [Part(up, 'body', P(24, 37), z, upper, tex=0.03),
            Part(lo, up, P(26, 45), z - 0.1, lower, sep=False, tex=0.03),
            Part(ft, lo, P(22.5, 51.5), z - 0.2, foot + claws, sep=False)]

parts = []
# z: 클수록 앞
parts.append(Part('wingF', 'body', (40, 22), 1, [Shape(sh.kind, sh.key, *[[(x * 0.82 + 13, y * 0.82 - 1) for x, y in a] if isinstance(a, list) else ((a[0] * 0.82 + 13, a[1] * 0.82 - 1) if isinstance(a, tuple) else a) for a in sh.args], flat=sh.flat) for sh in wing_shapes(0, 0, 'wingfar', 'bonefar')]))
parts += leg('legBF', 4, -1, 'bodyfar', 2, False)
parts += leg('legFF', 3, -1, 'bodyfar', 2.5, True)
parts.append(Part('tail1', 'body', (20, 34), 3, [Shape('poly', 'body', [(22, 29), (13, 32), (12, 38), (22, 40)])], tex=0.04))
parts.append(Part('tail2', 'tail1', (13, 35), 3.1, [Shape('poly', 'body', [(14, 32), (7, 34), (6, 38), (14, 38)])], tex=0.04))
parts.append(Part('tail3', 'tail2', (7, 36), 3.2, [Shape('poly', 'body', [(8, 34), (4, 31), (1, 33), (7, 38)]),
                                                   Shape('poly', 'spike', [(4, 32), (0, 25), (4, 28), (7, 25), (6, 31)])]))
body = [Shape('ellipse', 'body', 33, 34, 15.5, 9.5), Shape('ellipse', 'body', 43, 31, 7, 7.5),
        Shape('ellipse', 'belly', 35, 38.5, 11, 4)]
for x in (22, 26, 30, 34, 38):
    body.insert(0, Shape('poly', 'spike', tri(x, 26 - (0 if x < 30 else 1), 3, 4)))
parts.append(Part('body', None, (33, 34), 4, body, tex=0.04))
parts += leg('legBN', 0, 0, 'body', 5, False)
parts.append(Part('wingN', 'body', (34, 25), 5.5, wing_shapes(-3, 1, 'wing', 'bone')))
neck = [Shape('poly', 'body', [(40, 31), (44, 23), (49, 16), (54, 13), (57, 17), (52, 22), (48, 30), (46, 35)]),
        Shape('poly', 'belly', [(47, 31), (51, 22), (55, 17), (56.5, 18.5), (51.5, 25), (48.5, 32)])]
for (x, y) in ((44, 22), (48, 17), (52, 13.5)):
    neck.insert(0, Shape('poly', 'spike', [(x - 2, y + 1), (x - 3, y - 3), (x + 1, y)]))
parts.append(Part('neck', 'body', (44, 29), 6, neck, tex=0.04))
head = [Shape('poly', 'body', [(50, 13), (53, 9), (57, 8), (62, 9), (68, 11.5), (70, 14.5), (63, 16), (56, 17.5), (51, 17)]),
        Shape('poly', 'horn', [(52.5, 10.5), (46, 4), (47.5, 3), (55.5, 9)]),
        Shape('poly', 'horn', [(55.5, 9), (52, 1.5), (53.5, 0.8), (58.5, 8.3)]),
        Shape('poly', 'spike', [(51, 14), (47.5, 13), (51, 16.5)]),
        Shape('ellipse', 'eye', 60, 11.4, 1.3, 1.0, flat=True),
        Shape('ellipse', 'pupil', 60.6, 11.5, 0.45, 0.9, flat=True),
        Shape('ellipse', 'pupil', 67.6, 12.3, 0.5, 0.5, flat=True)]
parts.append(Part('head', 'neck', (54, 15), 7, head, tex=0.06))
jaw = [Shape('poly', 'body', [(54, 16), (62, 16), (68, 15.5), (67, 18), (59, 19.5), (54, 18.5)]),
       Shape('poly', 'mouth', [(56, 16.2), (66.5, 15.8), (63, 17), (57, 17.2)], flat=True)]
for x in (59, 62, 65):
    jaw.append(Shape('poly', 'tooth', [(x - 0.8, 16), (x, 17.6), (x + 0.8, 16)], flat=True))
parts.append(Part('jaw', 'head', (55, 16.5), 6.9, jaw))
parts += leg('legFN', 0, 0, 'body', 8, True)

ramps = {
    'body': ['#f5873e', '#d9482a', '#a52a1c', '#6e1610'],
    'bodyfar': ['#c0482a', '#a8341e', '#7c2214', '#561208'],
    'belly': ['#ffe08a', '#f6be52', '#d8902e', '#a8641c'],
    'wing': ['#ff9e4a', '#ec6a2e', '#c0441e', '#7a2412'],
    'wingfar': ['#e07038', '#c4502a', '#96341a', '#641e0e'],
    'horn': ['#fff4d8', '#f0d8a8', '#c8a878', '#8a6a48'],
    'spike': ['#ffd070', '#f39a38', '#c86a20', '#8a4414'],
}
flats = {'bone': '#6a1c0e', 'bonefar': '#4a140a', 'eye': '#ffe04a', 'pupil': '#1a0806', 'tooth': '#fff6e0', 'claw': '#f4e6c8', 'mouth': '#4a0e08'}
model = Model(W, H, parts, ramps, '#2a0c08', flats)

S = lambda a: math.sin(a)
def idle(n=4):
    out = []
    for i in range(n):
        t = i / n * math.pi * 2
        out.append({'body': (0, 0, round(S(t) * 0.6 + 0.4)), 'wingN': (-4 * S(t),), 'wingF': (-5 * S(t + 0.4),), 'neck': (2 * S(t),), 'head': (-2 * S(t),),
                    'tail1': (3 * S(t),), 'tail2': (5 * S(t + 0.6),), 'tail3': (8 * S(t + 1.2),)})
    return out

def walk(n=6):
    out = []
    for i in range(n):
        f = i / n * math.pi * 2
        a, b = S(f), S(f + math.pi)
        out.append({'body': (0, 0, -round(abs(S(f)))), 'neck': (3 * S(2 * f),), 'head': (-3 * S(2 * f),),
                    'legFN_up': (18 * a,), 'legFN_lo': (-14 * max(0, -a),), 'legBF_up': (18 * a,), 'legBF_lo': (16 * max(0, -a),),
                    'legFF_up': (18 * b,), 'legFF_lo': (-14 * max(0, -b),), 'legBN_up': (18 * b,), 'legBN_lo': (16 * max(0, -b),),
                    'wingN': (-6 + 3 * S(2 * f),), 'wingF': (-6 + 3 * S(2 * f + 0.5),),
                    'tail1': (6 * S(f),), 'tail2': (8 * S(f + 0.7),), 'tail3': (10 * S(f + 1.4),)})
    return out

def breath():
    seq = [(0, 0, 0), (8, -6, 8), (14, -4, 24), (14, -4, 26)]
    return [{'neck': (nk,), 'head': (hd,), 'jaw': (jw,), 'body': (0, -1 if i else 0, 0), 'wingN': (6,), 'wingF': (5,), 'tail1': (-4,), 'tail2': (-4,), 'tail3': (-6,)}
            for i, (nk, hd, jw) in enumerate(seq)]

def fly(n=4):
    seq = [38, 12, -30, -8]
    tuck = {'legFN_up': (-30,), 'legFN_lo': (50,), 'legFF_up': (-30,), 'legFF_lo': (50,), 'legBN_up': (-35,), 'legBN_lo': (55,), 'legBF_up': (-35,), 'legBF_lo': (55,)}
    out = []
    for i, a in enumerate(seq):
        p = {'body': (0, 0, -4 + (1 if a < 0 else 0)), 'wingN': (a,), 'wingF': (a * 0.9,), 'neck': (-4,), 'head': (4,), 'tail1': (8,), 'tail2': (6 * S(i),), 'tail3': (10 * S(i + 1),)}
        p.update(tuck)
        out.append(p)
    return out

def claw():
    seq = [(-50, 30), (-95, 20), (10, -10), (0, 0)]
    return [{'legFN_up': (u,), 'legFN_lo': (l,), 'body': (-6 if i == 1 else 0, 0, 0, 1, 1), 'neck': (-6 if i == 1 else 4 if i == 2 else 0,), 'head': (3,), 'jaw': (12 if i == 2 else 0,), 'wingN': (10 if i == 1 else 0,)}
            for i, (u, l) in enumerate(seq)]

if __name__ == '__main__':
    out = sys.argv[1]
    anims = [('idle', idle()), ('walk', walk()), ('breath', breath()), ('fly', fly()), ('claw', claw())]
    img, meta = sheet(model, anims, out + '/dragon_fire.png')
    json.dump({'w': W, 'h': H, 'anims': meta, 'mouth': [69, 16]}, open(out + '/dragon_fire.json', 'w'))
    print(meta)
