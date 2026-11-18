# 불 용인족: 0x72 캐릭터 크기의 작은 사람 모습. 붉은 삐죽 머리 · 작은 뿔 · 불꽃 꼬리 · 검붉은 옷. 동작: 서기 · 달리기 · 비상(날개)
from sprites import meta_path, build_manifest
import math, sys, json
from pixelrig import Model, Part, Shape, sheet

W, H = 34, 28
O = 7  # 좌우 여백 (꼬리 · 펼친 날개)

def P(x, y): return (x + O, y)

parts = [
    Part('wingF', 'torso', P(12, 15), 0.5, [Shape('poly', 'wingfar', [P(12, 15.5), P(17, 9), P(22, 3.5), P(24.5, 8.5), P(22, 10.5), P(24, 13.5), P(19, 14.5), P(15, 17)]),
                                            Shape('line', 'bonefar', P(12, 15.5), P(22, 3.5), 0.9, flat=True), Shape('line', 'bonefar', P(17, 9), P(24, 13.5), 0.7, flat=True)]),
    Part('legL', 'torso', P(8, 22), 1, [Shape('capsule', 'pants', P(8, 22), P(8, 25.2), 1.4), Shape('ellipse', 'boot', *P(7.8, 26.2), 1.9, 1.1)], sep=False),
    Part('legR', 'torso', P(12, 22), 1.2, [Shape('capsule', 'pants', P(12, 22), P(12, 25.2), 1.4), Shape('ellipse', 'boot', *P(12.4, 26.2), 1.9, 1.1)], sep=False),
    Part('tail1', 'torso', P(7, 21), 1.5, [Shape('capsule', 'hair', P(6.8, 21.4), P(3.6, 23.2), 1.3)], sep=False),
    Part('tail2', 'tail1', P(3.6, 23.2), 1.6, [Shape('capsule', 'hair', P(3.6, 23.2), P(1.8, 20.6), 1.05),
                                              Shape('poly', 'flame', [P(1.6, 21), P(0.4, 17), P(2.1, 18.6), P(3, 17.2), P(2.8, 20.4)])], sep=False),
    Part('wingN', 'torso', P(8, 15), 1.8, [Shape('poly', 'wing', [P(8, 15.5), P(3, 9), P(-2, 3.5), P(-4.5, 8.5), P(-2, 10.5), P(-4, 13.5), P(1, 14.5), P(5, 17)]),
                                           Shape('line', 'bone', P(8, 15.5), P(-2, 3.5), 0.9, flat=True), Shape('line', 'bone', P(3, 9), P(-4, 13.5), 0.7, flat=True)]),
    Part('torso', None, P(10, 22), 2, [
        Shape('poly', 'tunic', [P(6, 15.4), P(14, 15.4), P(14.6, 21), P(13.2, 23), P(6.8, 23), P(5.4, 21)]),
        Shape('capsule', 'tunic', P(5.7, 16.6), P(5.1, 19.8), 1.15), Shape('capsule', 'tunic', P(14.3, 16.6), P(14.9, 19.8), 1.15),
        Shape('ellipse', 'skin', *P(5.1, 20.5), 1.0, 0.95), Shape('ellipse', 'skin', *P(14.9, 20.5), 1.0, 0.95),
        Shape('line', 'trim', P(11.2, 16), P(11.2, 20), 0.8, flat=True), Shape('line', 'belt', P(6, 20.6), P(14.2, 20.6), 0.9, flat=True),
        Shape('ellipse', 'buckle', *P(11.2, 20.6), 0.6, 0.5, flat=True), Shape('poly', 'trim', [P(8, 15.4), P(12.4, 15.4), P(10.2, 17.2)], flat=True)]),
    Part('head', 'torso', P(10, 15), 3, [
        Shape('ellipse', 'skin', *P(10.6, 11), 5.2, 4.6),
        ]),  # 입은 그리지 않는다 (0x72 캐릭터처럼 눈만 · 눈을 아래로 내리며 겹치지 않게)
    Part('hair', 'head', P(10, 9), 3.2, [
        Shape('poly', 'hair', [P(5, 12.5), P(3.6, 9), P(4.6, 7), P(3.6, 4.8), P(6.6, 5.4), P(7.2, 2.6), P(9.6, 4.2), P(11.6, 2.2), P(12.8, 4.8), P(15.8, 4.2), P(15, 6.8), P(16.4, 8.8), P(15, 9.6), P(14, 8), P(11.4, 8.6), P(9.2, 8), P(7.2, 9.8), P(6.6, 13.2)]),
        Shape('poly', 'hair', [P(5, 9), P(3.6, 14.2), P(6.6, 12.4)])], sep=False),
    Part('horns', 'hair', P(10, 5), 3.3, [Shape('poly', 'horn', [P(7, 5.2), P(6.2, 1.2), P(7.8, 2), P(8.6, 5)]), Shape('poly', 'horn', [P(12.4, 4.6), P(13.4, 0.6), P(14.6, 1.6), P(13.8, 5)])], sep=False),
]
ramps = {
    'hair': ['#ff8a5a', '#e8402a', '#a8231a', '#6a1410'], 'skin': ['#fde0c0', '#f8c8a0', '#e0a47c', '#b07850'],
    'tunic': ['#5a4048', '#3a2a30', '#251a20', '#140c10'], 'pants': ['#6a4430', '#4a2e22', '#301c14', '#1c100a'],
    'boot': ['#4a3028', '#2e1c16', '#1e120e', '#100806'], 'horn': ['#fff4d8', '#f0d8a8', '#c8a878', '#8a6a48'],
    'flame': ['#fff2a0', '#ffc040', '#ff6a1a', '#b02a0a'], 'wing': ['#ff8a4a', '#e0482a', '#a82a1a', '#6a1410'],
    'wingfar': ['#c8482a', '#a8341e', '#7c2214', '#561208'],
}
flats = {'eye': '#ffb020', 'eyeW': '#3a1a10', 'mouth': '#a85a40', 'trim': '#c8302a', 'belt': '#7a4a2a', 'buckle': '#ffd060', 'bone': '#6a1410', 'bonefar': '#4a0e0a'}
EYE_X, EYE_Y = 8.6, 10.6  # 기준: 달리기 그림의 눈 자리 (2026-11-18 사용자 확정)
GSCALE = (0.74, 0.74, 10 + O, 27.4)  # 다른 종족(0x72 캐릭터 · 키 약 20px)과 비율을 맞춘다: 발밑을 기준으로 몸 전체를 줄인다 (2026-11-18)
model = Model(W, H, parts, ramps, '#1c1012', flats, gscale=GSCALE)
model.stamps = [{'part': 'head', 'x': P(EYE_X, 0)[0], 'y': EYE_Y, 'w': 1, 'h': 2, 'gap': 2, 'color': '#2a120c'}]  # 눈: 가로 1 · 세로 2 도트 한 쌍 · 사이 2도트 · 다른 종족처럼 발끝에서 11~12도트 위 (2026-11-18)
S = math.sin

def idle(n=4):
    return [{'torso': (0, 0, [0, 0, 1, 1][i]), 'head': (0, 0, [0, 0, 0, 0][i]), 'hair': (2 * S(i / n * 6.28),), 'tail1': (6 * S(i / n * 6.28),), 'tail2': (10 * S(i / n * 6.28 + 1),), '_hide': ('wingN', 'wingF'), '_sdx': 1} for i in range(n)]  # _sdx: 눈 한 칸 오른쪽 (사용자 확정)

def run(n=4):
    out = []
    for i in range(n):
        f = i / n * math.pi * 2
        out.append({'torso': (3, 0, -round(abs(S(f)))), 'legL': (30 * S(f),), 'legR': (-30 * S(f),), 'hair': (0,), 'tail1': (-10 + 8 * S(f),), 'tail2': (-12 + 10 * S(f + 1),), '_hide': ('wingN', 'wingF'), '_sdx': 1})
    return out

def soar(n=4):
    seq = [30, 8, -26, -6]
    return [{'torso': (0, 0, -1), 'wingN': (a,), 'wingF': (-a * 0.8,), 'legL': (12,), 'legR': (-8,), 'hair': (-3,), 'tail1': (14,), 'tail2': (12 * S(i),), '_sdx': 1} for i, a in enumerate(seq)]

if __name__ == '__main__':
    out = sys.argv[1]
    anims = [('idle', idle()), ('run', run()), ('soar', soar())]
    _, meta = sheet(model, anims, out + '/dragonkin.png')
    json.dump({'w': W, 'h': H, 'anims': meta}, open(meta_path('dragonkin'), 'w'))
    build_manifest(out)
    print(meta)
