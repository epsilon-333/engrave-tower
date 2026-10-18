# 정령왕 3종: 불(용암 바위 거인) · 숲(나무 거인) · 바람(회오리 거인). 동작: 서기 · 걷기 · 오른주먹 · 왼주먹
import math, sys, json
from pixelrig import Model, Part, Shape, sheet

W, H = 76, 64  # 주먹을 뻗어도 잘리지 않게 좌우 여백 (그림은 offset 10)

def build(kind):
    rock = {'fire': 'rock', 'forest': 'bark', 'wind': 'cloud'}[kind]
    fistk = 'rock' if kind != 'forest' else 'bark'
    parts = []
    # 떠다니는 조각 (부모 없음, 제자리에서 둥실)
    debris_pos = [(6, 20), (50, 18), (4, 40), (52, 42), (12, 8), (45, 6), (9, 57), (48, 58)]
    for i, (x, y) in enumerate(debris_pos):
        if kind == 'fire':
            sh = [Shape('poly', 'rock', [(x - 2, y), (x - 1, y - 2.2), (x + 2, y - 1.5), (x + 2, y + 1.5), (x - 1, y + 2)]),
                  Shape('line', 'lava', (x - 1, y), (x + 1.5, y - 0.5), 0.9, flat=True)]
        elif kind == 'forest':
            sh = [Shape('poly', 'leaf', [(x - 2.5, y + 1), (x - 1, y - 2), (x + 2.5, y - 1), (x + 1, y + 2)])]
        else:
            sh = [Shape('poly', 'rock', [(x - 2, y + 0.5), (x - 0.5, y - 2), (x + 2.2, y - 1), (x + 1.5, y + 2)])] if i % 2 == 0 else [Shape('ellipse', 'cloud', x, y, 2.6, 1.6)]
        parts.append(Part(f'deb{i}', None, (x, y), 0.5 if i % 3 else 9, sh, sep=False))
    if kind != 'wind':
        for side, (x1, x2) in (('L', (22, 21)), ('R', (34, 35))):
            parts.append(Part(f'leg{side}', 'torso', (x1, 44), 1 if side == 'L' else 1.5,
                              [Shape('capsule', rock, (x1, 46), (x2, 57), 4.6), Shape('ellipse', rock, x2, 59.5, 5.8, 2.6)]
                              + ([Shape('line', 'lava', (x1 - 1, 49), (x2 + 1, 54), 0.9, flat=True)] if kind == 'fire' else [])
                              + ([Shape('ellipse', 'moss', x1 + 1.5, 48, 2.5, 2)] if kind == 'forest' else []), tex=0.06))
    else:
        vort = [Shape('ellipse', 'cloud', 28, 46, 11, 4.5), Shape('ellipse', 'cloud', 27, 51, 8.5, 3.4), Shape('ellipse', 'cloud', 29.5, 55, 6, 2.8), Shape('ellipse', 'cloud', 28, 59, 3.5, 2)]
        vort += [Shape('line', 'swirl', (19, 47), (33, 49), 0.9, flat=True), Shape('line', 'swirl', (22, 52), (32, 53), 0.9, flat=True), Shape('line', 'swirl', (25, 56), (32, 56.5), 0.8, flat=True)]
        parts.append(Part('vortex', 'torso', (28, 44), 1, vort))
    torso = [Shape('ellipse', rock, 28, 34, 13, 12), Shape('ellipse', rock, 28, 44, 9.5, 5)]
    if kind == 'fire':
        torso += [Shape('line', 'lava', (22, 28), (27, 33), 1.0, flat=True), Shape('line', 'lava', (34, 27), (29, 33), 1.0, flat=True), Shape('line', 'lava', (28, 34), (26, 42), 1.0, flat=True),
                  Shape('ellipse', 'lava', 28, 33, 4, 3.6, flat=True), Shape('ellipse', 'core', 28, 33, 2.4, 2.2, flat=True)]
    elif kind == 'forest':
        torso += [Shape('ellipse', 'moss', 21, 29, 5, 3.5), Shape('ellipse', 'moss', 34, 40, 4, 3), Shape('line', 'barkline', (25, 38), (24, 46), 0.9, flat=True), Shape('line', 'barkline', (32, 36), (33, 45), 0.9, flat=True),
                  Shape('ellipse', 'coreRing', 28.5, 32, 3.6, 3.6, flat=True), Shape('ellipse', 'core', 28.5, 32, 2.2, 2.2, flat=True)]
    else:
        torso += [Shape('line', 'swirl', (17, 30), (31, 37), 1.6, flat=True), Shape('line', 'swirl', (25, 25), (39, 32), 1.6, flat=True), Shape('line', 'swirl', (19, 40), (36, 42), 1.4, flat=True), Shape('line', 'swirlHi', (18, 28.5), (30, 34.5), 0.8, flat=True), Shape('line', 'swirlHi', (26, 23.5), (37, 29), 0.8, flat=True)]
    parts.append(Part('torso', None, (28, 44), 3, torso, tex=0.06 if kind != 'wind' else 0))
    head = [Shape('ellipse', rock, 28, 18, 6.8, 6.2)]
    if kind == 'wind':
        head += [Shape('ellipse', 'face', 25.6, 18, 1.0, 1.5, flat=True), Shape('ellipse', 'face', 30.6, 18, 1.0, 1.5, flat=True), Shape('line', 'face', (26.5, 21.5), (29.8, 21.5), 0.9, flat=True)]
    elif kind == 'fire':
        head += [Shape('ellipse', 'lava', 25.8, 18.5, 1.1, 0.8, flat=True), Shape('ellipse', 'lava', 30.4, 18.5, 1.1, 0.8, flat=True)]
    else:
        head += [Shape('ellipse', 'eyeG', 25.8, 18.5, 1.0, 0.8, flat=True), Shape('ellipse', 'eyeG', 30.4, 18.5, 1.0, 0.8, flat=True)]
    parts.append(Part('head', 'torso', (28, 23), 4, head, tex=0.05 if kind != 'wind' else 0))
    if kind == 'fire':
        fl = [Shape('poly', 'flame', [(21, 15), (20, 6), (24, 10), (26, 2), (29, 8), (32, 1), (34, 9), (37, 5), (36, 15)]),
              Shape('poly', 'flameIn', [(24, 15), (25, 9), (28, 11), (30, 6), (32, 12), (33, 15)])]
        parts.append(Part('crown', 'head', (28, 14), 4.2, fl, sep=False))
    elif kind == 'forest':
        cn = [Shape('ellipse', 'leaf', x, y, rx, ry) for x, y, rx, ry in [(28, 9, 8, 5.5), (20, 12, 5, 4), (36, 11.5, 5, 4), (24, 5, 4.5, 3.5), (32.5, 4.5, 4.5, 3.5), (28, 1.5, 3, 2.2), (17.5, 8, 3, 2.6), (39, 7.5, 3, 2.6), (22, 15.5, 3.5, 2.5), (34, 15.5, 3.5, 2.5)]]
        parts.append(Part('crown', 'head', (28, 14), 4.2, cn, sep=False, tex=0.12))
    else:
        # 머리 위로 말려 올라가는 바람 갈기
        cn = [Shape('capsule', 'cloud', (24, 13), (22, 7), 2.4), Shape('capsule', 'cloud', (22, 7), (26, 3), 2.2), Shape('capsule', 'cloud', (26, 3), (33, 2), 2.0), Shape('capsule', 'cloud', (33, 2), (37, 5), 1.7), Shape('capsule', 'cloud', (37, 5), (35, 8), 1.3),
              Shape('line', 'swirl', (23.5, 10), (24.5, 5), 0.8, flat=True), Shape('line', 'swirl', (27, 3.6), (33, 3), 0.8, flat=True)]
        parts.append(Part('crown', 'head', (28, 14), 4.2, cn, sep=False))
    for side, sgn, z in (('L', -1, 2), ('R', 1, 5)):
        sx = 28 + sgn * 12
        ex, wx = 28 + sgn * 17, 28 + sgn * 18
        upk = 'cloud' if kind == 'wind' else rock
        shoulder = [Shape('ellipse', upk, sx, 26, 6, 5)] + ([Shape('ellipse', 'moss', sx, 24.5, 4, 2.5)] if kind == 'forest' else [])
        parts.append(Part(f'arm{side}', 'torso', (sx, 26), z, shoulder + [Shape('capsule', upk, (sx, 27), (ex, 36), 3.8)]
                          + ([Shape('line', 'lava', (sx, 28), (ex, 35), 0.8, flat=True)] if kind == 'fire' else []), tex=0.05 if kind != 'wind' else 0))
        parts.append(Part(f'fore{side}', f'arm{side}', (ex, 36), z + 0.1, [Shape('capsule', upk, (ex, 36), (wx, 43), 3.6)], sep=False, tex=0.05 if kind != 'wind' else 0))
        fist = [Shape('ellipse', fistk, wx, 47, 6, 5.5)]
        if kind == 'fire': fist += [Shape('line', 'lava', (wx - 3, 46), (wx + 2, 48), 0.9, flat=True)]
        if kind == 'forest': fist += [Shape('ellipse', 'moss', wx + sgn, 44.5, 3, 2)]
        parts.append(Part(f'fist{side}', f'fore{side}', (wx, 43), z + 0.2, fist, sep=False, tex=0.06))
    return parts

RAMPS = {
    'fire': {'rock': ['#7e6a5e', '#58463e', '#3a2c2a', '#1e1618'], 'flame': ['#fff2a0', '#ffb030', '#ff5a1a', '#b02a0a'], 'flameIn': ['#ffffff', '#fff2a0', '#ffd25a', '#ffb030']},
    'forest': {'bark': ['#9a7c60', '#6e5440', '#4a382a', '#2a2018'], 'moss': ['#a8e878', '#6ab848', '#3e8a2e', '#1e4a16'], 'leaf': ['#b4f080', '#6cc048', '#3e8a2e', '#1e4a16']},
    'wind': {'cloud': ['#ffffff', '#dceaf8', '#a4c0dc', '#6a88a8'], 'rock': ['#b8c0cc', '#8a94a4', '#5e6878', '#3a4252']},
}
FLATS = {
    'fire': {'lava': '#ff7a1e', 'core': '#fff2a0'},
    'forest': {'core': '#e8ffd0', 'coreRing': '#3cff6a', 'barkline': '#3a2a1e', 'eyeG': '#9cff7a'},
    'wind': {'face': '#2a3a52', 'swirl': '#6a88b0', 'swirlHi': '#ffffff'},
}
OUT = {'fire': '#1a1010', 'forest': '#16120c', 'wind': '#2a3a52'}
S = math.sin

def debris(t, kind):
    return {f'deb{i}': (8 * S(t + i) if kind == 'fire' else 0, (2 if kind == 'wind' else 1.2) * S(t * 1.3 + i * 1.7), 1.5 * S(t + i * 2.3)) for i in range(8)}

def crown(t, kind):
    if kind == 'fire': return {'crown': (2 * S(t * 3), 0, 0, 1 + 0.06 * S(t * 4), 1 + 0.14 * S(t * 5))}
    if kind == 'wind': return {'crown': (6 * S(t * 2),)}
    return {'crown': (2 * S(t),)}

def idle(kind, n=4):
    out = []
    for i in range(n):
        t = i / n * math.pi * 2
        p = {'torso': (0, 0, round(S(t) * 0.7)), 'head': (2 * S(t + 0.5),), 'armL': (3 * S(t),), 'armR': (-3 * S(t),), 'foreL': (2 * S(t + 0.4),), 'foreR': (-2 * S(t + 0.4),)}
        if kind == 'wind': p['vortex'] = (5 * S(t * 2),)
        p.update(debris(t, kind)); p.update(crown(t, kind))
        out.append(p)
    return out

def walk(kind, n=6):
    out = []
    for i in range(n):
        f = i / n * math.pi * 2
        p = {'torso': (2 * S(f), 0, -round(abs(S(f)) * 1.5)), 'head': (-2 * S(f),), 'armL': (14 * S(f),), 'armR': (14 * S(f),), 'foreL': (-6 * S(f),), 'foreR': (-6 * S(f),)}
        if kind != 'wind': p.update({'legL': (16 * S(f), 0, -max(0, S(f)) * 2), 'legR': (-16 * S(f), 0, -max(0, -S(f)) * 2)})
        else: p['vortex'] = (8 * S(f * 2),)
        p.update(debris(f, kind)); p.update(crown(f, kind))
        out.append(p)
    return out

def punch(kind, side):
    sgn = 1 if side == 'R' else -1
    seq = [(25, 30, -4), (-75, -10, 6), (-82, -4, 6), (-30, 10, 2)]   # (어깨, 팔꿈치, 몸 기울기)
    out = []
    for i, (sh, el, lean) in enumerate(seq):
        t = i / 4 * math.pi * 2
        p = {'torso': (lean * sgn, 0, 0), 'head': (-lean * 0.5 * sgn,), f'arm{side}': (sh * sgn,), f'fore{side}': (el * sgn,),
             f'arm{"L" if side == "R" else "R"}': (-12 * sgn if i in (1, 2) else 6 * sgn,), f'fore{"L" if side == "R" else "R"}': (10 * sgn,)}
        if kind != 'wind': p.update({'legL': (-6 * sgn if i in (1, 2) else 0,), 'legR': (6 * sgn if i in (1, 2) else 0,)})
        p.update(debris(t, kind)); p.update(crown(t, kind))
        out.append(p)
    return out

if __name__ == '__main__':
    out = sys.argv[1]
    meta = {}
    for kind in ('fire', 'forest', 'wind'):
        m = Model(W, H, build(kind), RAMPS[kind], OUT[kind], FLATS[kind], offset=(10, 0))
        anims = [('idle', idle(kind)), ('walk', walk(kind)), ('punchR', punch(kind, 'R')), ('punchL', punch(kind, 'L'))]
        _, mt = sheet(m, anims, f'{out}/king_{kind}.png')
        meta[kind] = mt
    json.dump({'w': W, 'h': H, 'anims': meta['fire']}, open(out + '/kings.json', 'w'))
    print(meta['fire'])
