# 사람 도트 생성기: 0x72 캐릭터와 같은 크기 · 큰 머리 · 짙은 외곽선. pixelrig(뼈대 도트)로 부위를 그리고 동작마다 관절만 바꿔 새로 찍는다.
# 한 사람 = 서기(4) · 달리기(4) · 일하기(4) 세 줄. 모두 people.png 한 장에 모으고 people.json 에 줄 번호를 적는다.
# 색만 바꾼 재활용 그림을 쓰지 않으려고, 마을 사람 · 성지 주민 · 우두머리 · 관리 · 상인 · 선원을 하나하나 다르게 설계한다.
import math, sys, json
from PIL import Image
from pixelrig import Model, Part, Shape

W, H = 26, 32
CX = 13          # 몸 가운데 x
FOOT = 31        # 발바닥 y


def shade(h, k):
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    if k >= 0: r, g, b = (int(c + (255 - c) * k) for c in (r, g, b))
    else: r, g, b = (int(c * (1 + k)) for c in (r, g, b))
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def ramp(h):
    return [shade(h, 0.22), h, shade(h, -0.22), shade(h, -0.48)]


SKIN = {'fair': '#f8d0a8', 'tan': '#d8a070', 'dark': '#9a6440', 'elf': '#f4dcc0', 'orc': '#7aa04a', 'lizard': '#6aa04a', 'undead': '#a8b0b8', 'dragon': '#f8c8a0', 'bone': '#e8e0cc', 'grey': '#b8b0a8'}


def build(spec):
    """spec → (Model, 동작 함수들). 좌표는 오른쪽을 보는 몸 기준."""
    body = spec.get('body', 'normal')
    k = {'normal': 1.0, 'stout': 1.0, 'tall': 1.0, 'child': 0.74, 'elder': 0.96}[body]
    # 키 · 몸통 크기
    headY = {'normal': 11.5, 'stout': 13, 'tall': 10, 'child': 11.5, 'elder': 12.2}[body]
    torsoTop = {'normal': 16, 'stout': 17.2, 'tall': 15, 'child': 16, 'elder': 16.6}[body]
    hip = {'normal': 24, 'stout': 25, 'tall': 23.6, 'child': 24, 'elder': 24.2}[body]
    halfW = {'normal': 4.1, 'stout': 5.4, 'tall': 3.8, 'child': 4.0, 'elder': 4.0}[body]
    hr = (4.7, 4.3)

    def S(x, y):  # 아이는 발 기준으로 줄인다
        return (CX + (x - CX) * k, FOOT - (FOOT - y) * k)

    def L(*pts): return [S(*p) for p in pts]

    race = spec.get('race', 'human')
    skin = SKIN.get(spec.get('skin', 'fair'), spec.get('skin', '#f8d0a8'))
    if race in ('orc', 'lizard', 'undead', 'skeleton', 'dragon'): skin = SKIN.get(spec.get('skin'), skin) if spec.get('skin') else SKIN[{'orc': 'orc', 'lizard': 'lizard', 'undead': 'undead', 'skeleton': 'bone', 'dragon': 'dragon'}[race]]
    cloth = spec.get('cloth', '#4a6a9a')
    trim = spec.get('trim', shade(cloth, 0.35))
    pants = spec.get('pants', shade(cloth, -0.35))
    boots = spec.get('boots', '#4a3428')
    hair = spec.get('hair', '#6a4428')
    outfit = spec.get('outfit', 'tunic')
    hx, hy = CX + 0.6, headY

    ramps = {
        'skin': ramp(skin), 'cloth': ramp(cloth), 'pants': ramp(pants), 'boot': ramp(boots), 'hair': ramp(hair),
        'metal': ramp(spec.get('metal', '#a8b0c0')), 'gold': ramp('#e8b840'), 'cape': ramp(spec.get('cape', '#8a2a2a')),
        'hat': ramp(spec.get('hatc', cloth)), 'wood': ramp('#8a5a32'), 'iron': ramp('#7a8090'), 'leather': ramp('#7a5034'),
        'apron': ramp(spec.get('apronc', '#c8b090')), 'paper': ramp('#f0e6cc'), 'book': ramp(spec.get('bookc', '#7a2a2a')),
        'straw': ramp('#e0c070'), 'feather': ramp(spec.get('featherc', '#e85030')), 'scale': ramp(spec.get('scalec', skin)),
        'horn': ramp('#f0e0c0'), 'bone': ramp('#e8e0cc'), 'gem': ramp(spec.get('gem', '#3a8ad8')), 'vest': ramp(spec.get('vestc', shade(cloth, -0.3))),
        'inner': ramp(spec.get('inner', '#e8e0d0')), 'glow': ramp(spec.get('glowc', '#9fe0ff')),
    }
    flats = {'eye': spec.get('eyec', '#2a1a14'), 'eyeW': '#ffffff', 'mouth': '#a85a40', 'trimF': trim, 'belt': spec.get('beltc', '#5a3a22'), 'buckle': '#e8c040',
             'brow': shade(hair, -0.3), 'beard': hair, 'socket': '#1a1420', 'tusk': '#f4f0e0', 'stitch': shade(cloth, -0.5), 'redgem': '#e83a3a', 'bluegem': '#3a9ae8', 'greengem': '#3ac85a',
             'cheek': shade(skin, -0.12), 'paper': '#f0e6cc', 'pupilGlow': spec.get('glowEye', '#7af0ff')}
    parts = []

    # ── 망토 (몸 뒤) ──
    if spec.get('cape'):
        parts.append(Part('cape', 'torso', S(CX, torsoTop + 0.5), 0.3, [Shape('poly', 'cape', L((CX - halfW - 0.4, torsoTop + 0.6), (CX + halfW - 0.6, torsoTop + 0.6), (CX + halfW - 1.5, FOOT - 1.2), (CX - halfW - 3.2, FOOT - 0.6)))]))
    if spec.get('sack'):  # 등에 멘 금화 자루
        parts.append(Part('sack', 'torso', S(CX - halfW, torsoTop + 2), 0.35, [Shape('ellipse', 'leather', *S(CX - halfW - 2.2, torsoTop + 4.6), 4.2 * k, 4.8 * k), Shape('line', 'belt', S(CX - halfW - 3.6, torsoTop + 0.4), S(CX - halfW - 0.4, torsoTop - 0.4), 1.2 * k, flat=True),
                                                                          Shape('ellipse', 'buckle', *S(CX - halfW - 3.4, torsoTop + 0.2), 1.0 * k, 0.8 * k, flat=True), Shape('ellipse', 'buckle', *S(CX - halfW - 1.4, torsoTop - 0.4), 0.9 * k, 0.7 * k, flat=True)]))
    # ── 뒤 팔 ──
    shX = halfW - 0.6
    sleeve = 'metal' if outfit == 'armor' else 'cloth'
    if race == 'skeleton': sleeve = 'bone'
    armR = 1.25 if body != 'stout' else 1.45
    armLen = 5.2 if body != 'tall' else 5.6
    parts.append(Part('armF', 'torso', S(CX - shX, torsoTop + 1.2), 0.8, [
        Shape('capsule', sleeve, S(CX - shX, torsoTop + 1.2), S(CX - shX - 0.4, torsoTop + armLen), armR * k),
        Shape('ellipse', 'skin' if race != 'skeleton' else 'bone', *S(CX - shX - 0.4, torsoTop + armLen + 1.0), 1.15 * k, 1.05 * k)]))
    # ── 다리 ──
    legR = 1.45 if body != 'stout' else 1.7
    legShape = 'metal' if outfit == 'armor' else ('bone' if race == 'skeleton' else 'pants')
    for nm, lx, z in (('legF', CX - 1.9, 1.0), ('legN', CX + 1.9, 1.2)):
        parts.append(Part(nm, 'torso', S(lx, hip), z, [Shape('capsule', legShape, S(lx, hip), S(lx, FOOT - 2.6), legR * k), Shape('ellipse', 'boot', *S(lx + 0.5, FOOT - 1.4), 2.0 * k, 1.25 * k)], sep=False))
    # ── 꼬리 (도마뱀 · 용인) ──
    if race in ('lizard', 'dragon'):
        tc = 'scale' if race == 'lizard' else 'hair'
        parts.append(Part('tail', 'torso', S(CX - halfW + 1, hip - 1), 0.9, [Shape('capsule', tc, S(CX - halfW + 1, hip - 1), S(CX - halfW - 4, hip + 1.5), 1.5 * k), Shape('capsule', tc, S(CX - halfW - 4, hip + 1.5), S(CX - halfW - 6.5, hip - 1.5), 1.0 * k)], sep=False))
    # ── 몸통 (옷) ──
    t_sh = []
    long = outfit in ('robe', 'dress', 'coat')
    hem = FOOT - 1.8 if outfit in ('robe', 'dress') else (FOOT - 4.2 if outfit == 'coat' else hip + 0.8)
    flare = 1.6 if outfit == 'dress' else (1.0 if outfit == 'robe' else 0.4)
    torsoKey = 'metal' if outfit == 'armor' else ('bone' if race == 'skeleton' else 'cloth')
    if race == 'skeleton' and outfit == 'bare':
        t_sh += [Shape('poly', 'bone', L((CX - 2.6, torsoTop), (CX + 2.6, torsoTop), (CX + 2, hip - 1), (CX - 2, hip - 1)))]
        for i in range(3): t_sh.append(Shape('line', 'socket', S(CX - 2.4, torsoTop + 1.6 + i * 2), S(CX + 2.4, torsoTop + 1.6 + i * 2), 0.6 * k, flat=True))
        t_sh.append(Shape('line', 'bone', S(CX, torsoTop), S(CX, hip + 0.5), 1.2 * k))
    else:
        t_sh.append(Shape('poly', torsoKey, L((CX - halfW, torsoTop), (CX + halfW, torsoTop), (CX + halfW + 0.4 + flare, hem), (CX - halfW - 0.4 - flare, hem))))
    if outfit == 'armor':
        t_sh += [Shape('ellipse', 'metal', *S(CX - halfW + 0.4, torsoTop + 0.8), 2.0 * k, 1.5 * k), Shape('ellipse', 'metal', *S(CX + halfW - 0.4, torsoTop + 0.8), 2.0 * k, 1.5 * k),
                 Shape('line', 'trimF', S(CX + 0.6, torsoTop + 1.5), S(CX + 0.6, hip - 1), 0.7 * k, flat=True)]
        if spec.get('tabard'): t_sh.append(Shape('poly', 'cloth', L((CX - 2.2, torsoTop + 1.8), (CX + 2.8, torsoTop + 1.8), (CX + 2.6, hem + 1.2), (CX - 2.0, hem + 1.2))))
    if outfit == 'apron': t_sh.append(Shape('poly', 'apron', L((CX - 2.4, torsoTop + 1.2), (CX + 3.2, torsoTop + 1.2), (CX + 3.6, hip + 2.6), (CX - 2.6, hip + 2.6))))
    if outfit == 'vest': t_sh.append(Shape('poly', 'vest', L((CX - halfW, torsoTop), (CX - 0.2, torsoTop), (CX - 0.4, hip - 0.6), (CX - halfW - 0.2, hip - 0.6))))
    if outfit == 'coat':
        t_sh.append(Shape('poly', 'inner', L((CX + 0.6, torsoTop + 0.6), (CX + 2.4, torsoTop + 0.6), (CX + 2.0, hip - 0.4), (CX + 0.6, hip - 0.4))))
    if outfit in ('robe', 'dress', 'coat', 'tunic', 'noble', 'vest', 'apron'):
        t_sh.append(Shape('line', 'belt', S(CX - halfW - 0.2, hip - 1.2), S(CX + halfW + 0.2, hip - 1.2), 0.9 * k, flat=True))
        t_sh.append(Shape('ellipse', 'buckle', *S(CX + 1.2, hip - 1.2), 0.6 * k, 0.5 * k, flat=True))
    if outfit == 'noble':
        t_sh += [Shape('ellipse', 'cloth', *S(CX - halfW + 0.3, torsoTop + 0.7), 1.8 * k, 1.4 * k), Shape('ellipse', 'cloth', *S(CX + halfW - 0.3, torsoTop + 0.7), 1.8 * k, 1.4 * k),
                 Shape('line', 'trimF', S(CX - 2.6, torsoTop + 0.6), S(CX + 3.2, hip - 1.6), 0.9 * k, flat=True)]
    if outfit == 'rags':
        for i in range(3): t_sh.append(Shape('line', 'stitch', S(CX - 3 + i * 2.4, hip + 0.4), S(CX - 2.4 + i * 2.4, hip + 1.6), 0.6 * k, flat=True))
    if spec.get('collar'): t_sh.append(Shape('poly', 'trimF', L((CX - 2.4, torsoTop), (CX + 3.0, torsoTop), (CX + 0.4, torsoTop + 2.2)), flat=True))
    if spec.get('sash'): t_sh.append(Shape('line', 'trimF', S(CX - halfW + 0.6, torsoTop + 0.6), S(CX + halfW - 0.4, hip - 1.4), 1.1 * k, flat=True))
    if spec.get('emblem'): t_sh.append(Shape('ellipse', spec['emblem'], *S(CX + 1, torsoTop + 3.2), 1.0 * k, 1.0 * k, flat=True))
    parts.append(Part('torso', None, S(CX, hip), 2, t_sh))

    # ── 머리 ──
    h_sh = []
    if race == 'skeleton':
        h_sh += [Shape('ellipse', 'bone', *S(hx, hy), hr[0] * k, hr[1] * k), Shape('ellipse', 'socket', *S(hx - 0.8, hy + 0.3), 1.1 * k, 1.3 * k, flat=True), Shape('ellipse', 'socket', *S(hx + 2.2, hy + 0.3), 1.0 * k, 1.3 * k, flat=True),
                 Shape('line', 'socket', S(hx, hy + 3), S(hx + 2.4, hy + 3), 0.6 * k, flat=True)]
        if spec.get('glowEye'): h_sh += [Shape('ellipse', 'pupilGlow', *S(hx - 0.7, hy + 0.4), 0.45 * k, 0.5 * k, flat=True), Shape('ellipse', 'pupilGlow', *S(hx + 2.3, hy + 0.4), 0.45 * k, 0.5 * k, flat=True)]
    else:
        if race == 'lizard':
            h_sh += [Shape('ellipse', 'skin', *S(hx - 0.6, hy), 4.3 * k, 4.0 * k), Shape('ellipse', 'skin', *S(hx + 3.2, hy + 1.5), 3.0 * k, 2.2 * k)]  # 주둥이
            h_sh += [Shape('line', 'scale', S(hx - 3, hy - 3.4), S(hx + 1, hy - 4), 1.0 * k)]
        else:
            h_sh.append(Shape('ellipse', 'skin', *S(hx, hy), hr[0] * k, hr[1] * k))
        if spec.get('ears') == 'goblin':  # 고블린 · 꼬마 마귀: 뒤로 길게 뻗은 큰 귀
            h_sh.append(Shape('poly', 'skin', L((hx - 3.4, hy - 1.0), (hx - 9.4, hy - 2.6), (hx - 8.0, hy - 0.6), (hx - 3.6, hy + 2.0))))
        if race == 'elf' or spec.get('ears') == 'elf':
            h_sh.append(Shape('poly', 'skin', L((hx - 3.6, hy - 0.2), (hx - 7.4, hy - 3.4), (hx - 4.0, hy + 1.6))))
        ex1, ex2, ey = hx - 1.3, hx + 2.3, hy + 0.5
        if race == 'lizard': ex1, ex2, ey = hx - 1.0, hx + 1.8, hy - 0.6
        eyeW = 1.0 if body != 'child' else 1.15
        if spec.get('closedEyes'):
            h_sh += [Shape('line', 'eye', S(ex1 - 0.5, ey), S(ex1 + 0.6, ey), 0.6 * k, flat=True), Shape('line', 'eye', S(ex2 - 0.5, ey), S(ex2 + 0.6, ey), 0.6 * k, flat=True)]
        else:
            h_sh += [Shape('ellipse', 'eyeW', *S(ex1, ey), 0.95 * k * eyeW, 1.3 * k, flat=True), Shape('ellipse', 'eyeW', *S(ex2, ey), 0.95 * k * eyeW, 1.3 * k, flat=True),
                     Shape('ellipse', 'eye', *S(ex1 + 0.3, ey + 0.3), 0.55 * k * eyeW, 0.9 * k, flat=True), Shape('ellipse', 'eye', *S(ex2 + 0.3, ey + 0.3), 0.55 * k * eyeW, 0.9 * k, flat=True)]
        if race == 'undead': h_sh += [Shape('ellipse', 'socket', *S(ex1, ey + 1.4), 1.0 * k, 0.4 * k, flat=True), Shape('ellipse', 'socket', *S(ex2, ey + 1.4), 1.0 * k, 0.4 * k, flat=True)]
        if spec.get('blush'): h_sh += [Shape('ellipse', 'cheek', *S(hx - 2.2, hy + 2.2), 0.9 * k, 0.5 * k, flat=True), Shape('ellipse', 'cheek', *S(hx + 3.4, hy + 2.2), 0.8 * k, 0.5 * k, flat=True)]
        if race != 'lizard': h_sh.append(Shape('line', 'mouth', S(hx + 0.9, hy + 3.1), S(hx + 2.0, hy + 3.1), 0.6 * k, flat=True))
        if race == 'orc': h_sh += [Shape('poly', 'tusk', L((hx + 0.6, hy + 3.4), (hx + 0.9, hy + 1.8), (hx + 1.4, hy + 3.4)), flat=True), Shape('poly', 'tusk', L((hx + 2.4, hy + 3.4), (hx + 2.7, hy + 1.9), (hx + 3.2, hy + 3.4)), flat=True)]
        if spec.get('brows'): h_sh += [Shape('line', 'brow', S(ex1 - 0.9, ey - 1.9), S(ex1 + 0.8, ey - 1.5), 0.6 * k, flat=True), Shape('line', 'brow', S(ex2 - 0.7, ey - 1.5), S(ex2 + 1.0, ey - 1.9), 0.6 * k, flat=True)]
    parts.append(Part('head', 'torso', S(CX, torsoTop), 3, h_sh))

    # ── 머리카락 · 수염 ──
    hs = spec.get('hairStyle', 'short')
    hair_sh = []
    top = lambda: [Shape('poly', 'hair', L((hx - 4.9, hy + 0.6), (hx - 4.6, hy - 2.6), (hx - 2.6, hy - 4.6), (hx + 0.6, hy - 5.0), (hx + 3.6, hy - 4.0), (hx + 4.9, hy - 1.6), (hx + 4.4, hy - 0.8), (hx + 2.2, hy - 2.2), (hx - 0.6, hy - 1.8), (hx - 2.4, hy - 0.4), (hx - 3.2, hy + 1.6)))]
    if race in ('skeleton', 'lizard') or hs == 'bald': pass
    elif hs == 'short': hair_sh += top()
    elif hs == 'spiky': hair_sh += top() + [Shape('poly', 'hair', L((hx - 4, hy - 3), (hx - 3.4, hy - 7), (hx - 1.6, hy - 4.6), (hx + 0.2, hy - 7.4), (hx + 1.6, hy - 4.6), (hx + 3.8, hy - 6.6), (hx + 3.8, hy - 3.4)))]
    elif hs == 'long': hair_sh += top() + [Shape('poly', 'hair', L((hx - 4.9, hy - 1), (hx - 2.4, hy - 0.6), (hx - 2.0, hy + 6.8), (hx - 5.6, hy + 7.4), (hx - 5.6, hy + 2)))]
    elif hs == 'bun': hair_sh += top() + [Shape('ellipse', 'hair', *S(hx - 3.0, hy - 4.4), 2.0 * k, 1.8 * k)]
    elif hs == 'pony': hair_sh += top() + [Shape('capsule', 'hair', S(hx - 4.2, hy - 2), S(hx - 6.6, hy + 4), 1.3 * k)]
    elif hs == 'braids': hair_sh += top() + [Shape('capsule', 'hair', S(hx - 3.8, hy), S(hx - 4.6, hy + 7), 1.0 * k), Shape('ellipse', 'trimF', *S(hx - 4.6, hy + 7.4), 0.8 * k, 0.6 * k, flat=True)]
    elif hs == 'mohawk': hair_sh += [Shape('poly', 'hair', L((hx - 4, hy - 2), (hx - 2, hy - 6.6), (hx + 1, hy - 6.2), (hx + 2.4, hy - 4.2), (hx - 1.4, hy - 3.4)))]
    elif hs == 'wild': hair_sh += top() + [Shape('ellipse', 'hair', *S(hx - 2.2, hy - 3.6), 3.8 * k, 2.6 * k), Shape('poly', 'hair', L((hx - 5.2, hy - 1), (hx - 2.8, hy), (hx - 3.6, hy + 4.4), (hx - 6, hy + 3)))]
    if spec.get('beard'):
        b = spec['beard']
        if b == 'full': hair_sh.append(Shape('poly', 'hair', L((hx - 1.6, hy + 1.6), (hx + 4.2, hy + 1.0), (hx + 4.4, hy + 3.6), (hx + 2.6, hy + 6.8), (hx + 0.2, hy + 7.4), (hx - 1.2, hy + 4.4))))
        elif b == 'long': hair_sh.append(Shape('poly', 'hair', L((hx - 1.6, hy + 1.6), (hx + 4.2, hy + 1.0), (hx + 4.6, hy + 4), (hx + 2.8, hy + 9.6), (hx + 1.2, hy + 10.2), (hx - 1.0, hy + 5))))
        elif b == 'stache': hair_sh.append(Shape('poly', 'hair', L((hx - 0.4, hy + 2.4), (hx + 3.6, hy + 2.0), (hx + 4.0, hy + 3.2), (hx + 1.4, hy + 3.0), (hx - 0.2, hy + 3.4))))
        if b in ('full', 'long'): hair_sh.append(Shape('line', 'mouth', S(hx + 0.9, hy + 3.1), S(hx + 2.2, hy + 3.1), 0.6 * k, flat=True))
    if hair_sh: parts.append(Part('hair', 'head', S(CX, torsoTop), 3.2, hair_sh, sep=False))

    # ── 모자 · 머리 장식 ──
    hat = spec.get('hat')
    hat_sh = []
    if hat == 'crown':
        hat_sh += [Shape('poly', 'gold', L((hx - 3.6, hy - 2.8), (hx + 3.8, hy - 2.8), (hx + 4.0, hy - 7.0), (hx + 2.4, hy - 4.8), (hx + 0.2, hy - 7.6), (hx - 2.0, hy - 4.8), (hx - 3.8, hy - 7.0))),
                   Shape('ellipse', 'redgem', *S(hx + 0.2, hy - 3.8), 0.7 * k, 0.6 * k, flat=True), Shape('ellipse', 'bluegem', *S(hx - 2.4, hy - 3.6), 0.45 * k, 0.45 * k, flat=True)]
    elif hat == 'tiara':
        hat_sh += [Shape('line', 'metal', S(hx - 4.2, hy - 2.8), S(hx + 4.2, hy - 3.2), 0.9 * k), Shape('poly', 'metal', L((hx - 0.8, hy - 3.2), (hx + 0.4, hy - 6.0), (hx + 1.6, hy - 3.2))), Shape('ellipse', 'greengem', *S(hx + 0.4, hy - 4.0), 0.55 * k, 0.6 * k, flat=True)]
    elif hat == 'circlet':
        hat_sh += [Shape('line', 'gold', S(hx - 4.3, hy - 2.4), S(hx + 4.3, hy - 2.8), 0.8 * k), Shape('ellipse', spec.get('circletGem', 'bluegem'), *S(hx + 1.4, hy - 2.8), 0.55 * k, 0.55 * k, flat=True)]
    elif hat == 'hood':
        hat_sh += [Shape('poly', 'hat', L((hx - 5.6, hy + 4.6), (hx - 5.8, hy - 2.4), (hx - 3.4, hy - 5.6), (hx + 0.6, hy - 6.0), (hx + 4.4, hy - 4.2), (hx + 5.4, hy - 1.4), (hx + 3.6, hy - 1.4), (hx + 1.4, hy - 2.4), (hx - 1.8, hy - 1.0), (hx - 2.6, hy + 2.6), (hx - 1.6, hy + 5.6)))]
    elif hat == 'helm':
        hat_sh += [Shape('poly', 'metal', L((hx - 5.0, hy + 2.6), (hx - 5.0, hy - 2.6), (hx - 2.8, hy - 5.2), (hx + 1.0, hy - 5.6), (hx + 4.4, hy - 3.6), (hx + 5.2, hy - 0.8), (hx + 4.6, hy - 0.8), (hx + 4.6, hy + 0.6), (hx - 1.6, hy + 0.2), (hx - 2.2, hy + 3.2))),
                   Shape('line', 'trimF', S(hx - 0.2, hy - 5.4), S(hx - 1.6, hy - 0.4), 0.7 * k, flat=True)]
        if spec.get('plume'): hat_sh.append(Shape('poly', 'feather', L((hx - 1.4, hy - 5.2), (hx - 5.6, hy - 8.4), (hx - 6.6, hy - 5.2), (hx - 3.6, hy - 4.0))))
    elif hat == 'fullhelm':
        hat_sh += [Shape('ellipse', 'metal', *S(hx, hy - 0.2), 5.0 * k, 4.8 * k), Shape('line', 'socket', S(hx - 0.4, hy + 0.2), S(hx + 4.4, hy + 0.2), 0.8 * k, flat=True), Shape('line', 'trimF', S(hx, hy - 4.8), S(hx, hy + 4.2), 0.6 * k, flat=True)]
        if spec.get('plume'): hat_sh.append(Shape('poly', 'feather', L((hx - 1.4, hy - 4.6), (hx - 5.6, hy - 8.4), (hx - 6.6, hy - 5.2), (hx - 3.6, hy - 3.4))))
    elif hat == 'wizard':
        hat_sh += [Shape('poly', 'hat', L((hx - 5.6, hy - 2.2), (hx + 6.0, hy - 2.6), (hx + 3.6, hy - 4.0), (hx + 1.2, hy - 10.6), (hx - 2.6, hy - 12.2), (hx - 1.6, hy - 9.0), (hx - 3.0, hy - 3.8))),
                   Shape('line', 'trimF', S(hx - 3.2, hy - 3.2), S(hx + 3.8, hy - 3.6), 0.9 * k, flat=True)]
        if spec.get('stars'): hat_sh.append(Shape('ellipse', 'buckle', *S(hx - 0.2, hy - 7.0), 0.6 * k, 0.6 * k, flat=True))
    elif hat == 'straw':
        hat_sh += [Shape('ellipse', 'straw', *S(hx, hy - 2.6), 6.6 * k, 1.5 * k), Shape('ellipse', 'straw', *S(hx - 0.2, hy - 4.2), 3.6 * k, 2.2 * k), Shape('line', 'trimF', S(hx - 3.6, hy - 3.0), S(hx + 3.4, hy - 3.0), 0.7 * k, flat=True)]
    elif hat == 'cap':
        hat_sh += [Shape('ellipse', 'hat', *S(hx - 0.4, hy - 3.2), 4.6 * k, 2.4 * k), Shape('poly', 'hat', L((hx + 2, hy - 2.4), (hx + 6.4, hy - 2.0), (hx + 6.0, hy - 1.2), (hx + 2, hy - 1.4)))]
    elif hat == 'bandana':
        hat_sh += [Shape('poly', 'hat', L((hx - 4.8, hy - 1), (hx - 4.0, hy - 4.2), (hx + 1, hy - 5.2), (hx + 4.6, hy - 3.2), (hx + 4.8, hy - 1.8), (hx - 2, hy - 1.6))), Shape('poly', 'hat', L((hx - 4.6, hy - 1.6), (hx - 7.4, hy + 0.4), (hx - 6.6, hy + 1.8), (hx - 4.2, hy)))]
    elif hat == 'tricorn':
        hat_sh += [Shape('poly', 'hat', L((hx - 6.4, hy - 2.4), (hx - 2.6, hy - 3.6), (hx + 0.4, hy - 7.6), (hx + 3.4, hy - 3.6), (hx + 6.8, hy - 2.6), (hx + 2.4, hy - 1.4), (hx - 2.6, hy - 1.4))), Shape('line', 'trimF', S(hx - 5, hy - 2.4), S(hx + 5.4, hy - 2.6), 0.6 * k, flat=True)]
        if spec.get('plume'): hat_sh.append(Shape('poly', 'feather', L((hx - 0.8, hy - 6.8), (hx - 5.6, hy - 9.4), (hx - 4.6, hy - 6.4))))
    elif hat == 'turban':
        hat_sh += [Shape('ellipse', 'hat', *S(hx - 0.2, hy - 3.6), 5.0 * k, 2.9 * k), Shape('line', 'trimF', S(hx - 4.4, hy - 2.8), S(hx + 4.2, hy - 4.6), 0.8 * k, flat=True), Shape('ellipse', 'redgem', *S(hx + 2.4, hy - 3.6), 0.7 * k, 0.8 * k, flat=True)]
    elif hat == 'feathers':
        for dx, c in ((-2.6, 'feather'), (0, 'gold'), (2.6, 'gem')): hat_sh.append(Shape('poly', c, L((hx + dx - 1.2, hy - 3.2), (hx + dx + 0.4, hy - 9.6), (hx + dx + 1.4, hy - 3.2))))
        hat_sh.append(Shape('line', 'leather', S(hx - 4.4, hy - 2.6), S(hx + 4.4, hy - 2.8), 1.0 * k))
    elif hat == 'horns':
        hat_sh += [Shape('poly', 'horn', L((hx - 2.6, hy - 3.2), (hx - 6.6, hy - 8.4), (hx - 4.8, hy - 4.0))), Shape('poly', 'horn', L((hx + 2.6, hy - 3.6), (hx + 5.4, hy - 9.0), (hx + 4.4, hy - 3.4)))]
        if spec.get('helmBand'): hat_sh.append(Shape('line', 'iron', S(hx - 4.6, hy - 2.6), S(hx + 4.6, hy - 3.0), 1.1 * k))
    elif hat == 'mask':
        hat_sh += [Shape('poly', 'metal', L((hx - 2.6, hy - 0.6), (hx + 5.0, hy - 0.8), (hx + 5.0, hy + 2.4), (hx + 1.4, hy + 3.4), (hx - 2.4, hy + 2.0))), Shape('line', 'pupilGlow', S(hx - 0.6, hy + 0.6), S(hx + 0.6, hy + 0.6), 0.6 * k, flat=True), Shape('line', 'pupilGlow', S(hx + 2.2, hy + 0.6), S(hx + 3.4, hy + 0.6), 0.6 * k, flat=True)]
    elif hat == 'chef':
        hat_sh += [Shape('ellipse', 'inner', *S(hx - 0.2, hy - 5.4), 3.6 * k, 2.6 * k), Shape('line', 'inner', S(hx - 3.6, hy - 2.8), S(hx + 3.6, hy - 2.8), 1.6 * k)]
    elif hat == 'tophat':
        hat_sh += [Shape('ellipse', 'hat', *S(hx, hy - 2.6), 5.4 * k, 1.2 * k), Shape('poly', 'hat', L((hx - 3.0, hy - 2.8), (hx + 3.2, hy - 2.8), (hx + 3.0, hy - 9.4), (hx - 2.8, hy - 9.4))), Shape('line', 'trimF', S(hx - 3, hy - 4), S(hx + 3.1, hy - 4), 0.9 * k, flat=True)]
    elif hat == 'dragonHorns':
        hat_sh += [Shape('poly', 'horn', L((hx - 2.2, hy - 3.6), (hx - 3.4, hy - 7.6), (hx - 1.4, hy - 6.2), (hx - 0.6, hy - 3.6))), Shape('poly', 'horn', L((hx + 2.0, hy - 3.8), (hx + 3.0, hy - 7.8), (hx + 4.2, hy - 6.4), (hx + 3.4, hy - 3.6)))]
    if hat_sh: parts.append(Part('hat', 'head', S(CX, torsoTop), 3.4, hat_sh, sep=False))
    # 용인: 뿔은 늘 있다 (왕관 위에도)
    if race == 'dragon' and hat != 'dragonHorns':
        parts.append(Part('dhorn', 'head', S(CX, torsoTop), 3.3, [Shape('poly', 'horn', L((hx - 2.2, hy - 3.6), (hx - 3.4, hy - 7.6), (hx - 1.4, hy - 6.2), (hx - 0.6, hy - 3.6))), Shape('poly', 'horn', L((hx + 2.0, hy - 3.8), (hx + 3.0, hy - 7.8), (hx + 4.2, hy - 6.4), (hx + 3.4, hy - 3.6)))], sep=False))

    # ── 앞 팔 + 손에 든 것 ──
    hand = S(CX + shX + 0.4, torsoTop + armLen + 1.0)
    a_sh = [Shape('capsule', sleeve, S(CX + shX, torsoTop + 1.2), S(CX + shX + 0.4, torsoTop + armLen), armR * k), Shape('ellipse', 'skin' if race != 'skeleton' else 'bone', *hand, 1.15 * k, 1.05 * k)]
    parts.append(Part('armN', 'torso', S(CX + shX, torsoTop + 1.2), 3.6, a_sh))
    item = spec.get('item')
    i_sh = []
    hxh, hyh = hand
    def IL(*pts): return [(hxh + x * k, hyh + y * k) for x, y in pts]
    def IP(x, y): return (hxh + x * k, hyh + y * k)
    if item == 'hammer': i_sh += [Shape('line', 'wood', IP(0, -1.2), IP(0, 6), 1.0 * k), Shape('poly', 'iron', IL((-2.4, 6.0), (2.6, 6.0), (2.6, 8.4), (-2.4, 8.4)))]
    elif item == 'staff': i_sh += [Shape('line', 'wood', IP(0, 6.5), IP(0, -11), 1.1 * k), Shape('ellipse', 'glow', *IP(0, -12.2), 1.6 * k, 1.6 * k)]
    elif item == 'crook': i_sh += [Shape('line', 'wood', IP(0, 6.5), IP(0, -10), 1.0 * k), Shape('capsule', 'wood', IP(0, -10), IP(2.2, -11.6), 0.6 * k), Shape('capsule', 'wood', IP(2.2, -11.6), IP(3.0, -9.6), 0.6 * k)]
    elif item == 'scepter': i_sh += [Shape('line', 'gold', IP(0, 2), IP(0, -7), 0.9 * k), Shape('ellipse', 'gem', *IP(0, -8), 1.2 * k, 1.2 * k)]
    elif item == 'sword': i_sh += [Shape('line', 'metal', IP(0, -0.8), IP(0, -11), 1.2 * k), Shape('line', 'gold', IP(-1.8, -0.6), IP(1.8, -0.6), 0.8 * k), Shape('line', 'leather', IP(0, -0.4), IP(0, 1.8), 0.8 * k)]
    elif item == 'spear': i_sh += [Shape('line', 'wood', IP(0, 6.5), IP(0, -11), 0.9 * k), Shape('poly', 'metal', IL((-1.0, -11), (0, -14.4), (1.0, -11)))]
    elif item == 'book': i_sh += [Shape('poly', 'book', IL((-1.6, -2.8), (2.8, -2.8), (2.8, 1.0), (-1.6, 1.0))), Shape('line', 'paper', IP(2.6, -2.6), IP(2.6, 0.8), 0.5 * k)]
    elif item == 'scroll': i_sh += [Shape('capsule', 'paper', IP(-1, -2.4), IP(-1, 1.4), 1.0 * k), Shape('ellipse', 'leather', *IP(-1, -2.6), 1.0 * k, 0.5 * k)]
    elif item == 'ledger': i_sh += [Shape('poly', 'leather', IL((-2.0, -2.6), (2.6, -2.6), (2.6, 1.2), (-2.0, 1.2))), Shape('line', 'gold', IP(-1.6, -1.0), IP(2.2, -1.0), 0.5 * k)]
    elif item == 'broom': i_sh += [Shape('line', 'wood', IP(0, -9), IP(0, 4), 0.8 * k), Shape('poly', 'straw', IL((-1.6, 4), (1.6, 4), (2.4, 7.4), (-2.4, 7.4)))]
    elif item == 'pitchfork': i_sh += [Shape('line', 'wood', IP(0, 6), IP(0, -9), 0.8 * k), Shape('line', 'iron', IP(-1.6, -9), IP(1.6, -9), 0.7 * k)] + [Shape('line', 'iron', IP(dx, -9), IP(dx, -12), 0.6 * k) for dx in (-1.6, 0, 1.6)]
    elif item == 'lantern': i_sh += [Shape('line', 'iron', IP(0, 0), IP(0, 2), 0.5 * k), Shape('poly', 'iron', IL((-1.6, 2), (1.6, 2), (1.6, 5.4), (-1.6, 5.4))), Shape('ellipse', 'glow', *IP(0, 3.7), 1.0 * k, 1.2 * k)]
    elif item == 'bow': i_sh += [Shape('capsule', 'wood', IP(0.8, -7), IP(2.2, 0), 0.6 * k), Shape('capsule', 'wood', IP(2.2, 0), IP(0.8, 7), 0.6 * k), Shape('line', 'paper', IP(0.4, -6.8), IP(0.4, 6.8), 0.3 * k, flat=True)]
    elif item == 'mug': i_sh += [Shape('poly', 'wood', IL((-1.0, -2.6), (2.0, -2.6), (2.0, 1.0), (-1.0, 1.0))), Shape('ellipse', 'inner', *IP(0.5, -2.8), 1.5 * k, 0.6 * k)]
    elif item == 'quill': i_sh += [Shape('line', 'paper', IP(0, 0.8), IP(1.6, -4.6), 0.8 * k)]
    elif item == 'shovel': i_sh += [Shape('line', 'wood', IP(0, -8), IP(0, 4), 0.8 * k), Shape('poly', 'iron', IL((-1.6, 4), (1.6, 4), (1.2, 7.6), (-1.2, 7.6)))]
    elif item == 'axe': i_sh += [Shape('line', 'wood', IP(0, -1.6), IP(0, 8), 1.0 * k), Shape('poly', 'iron', IL((0.4, 8), (3.8, 9.6), (3.8, 4.4), (0.4, 6)))]
    elif item == 'tongs': i_sh += [Shape('line', 'iron', IP(0, 0), IP(3.0, 5.2), 0.6 * k), Shape('line', 'iron', IP(0.6, -0.2), IP(3.8, 4.6), 0.6 * k), Shape('ellipse', 'glow', *IP(3.6, 5.6), 1.0 * k, 0.8 * k)]
    elif item == 'gavel': i_sh += [Shape('line', 'wood', IP(0, -1), IP(0, 4.6), 0.7 * k), Shape('poly', 'wood', IL((-1.8, 4.4), (1.8, 4.4), (1.8, 6.6), (-1.8, 6.6)))]
    elif item == 'dagger': i_sh += [Shape('line', 'metal', IP(0, -0.6), IP(0, -5.6), 0.9 * k), Shape('line', 'leather', IP(0, -0.4), IP(0, 1.2), 0.7 * k)]
    elif item == 'flask': i_sh += [Shape('ellipse', 'glow', *IP(0.4, -1.0), 1.6 * k, 1.8 * k), Shape('line', 'inner', IP(0.4, -2.6), IP(0.4, -4.0), 0.8 * k)]
    elif item == 'drumstick': i_sh += [Shape('line', 'wood', IP(0, -0.8), IP(1.4, 5), 0.8 * k), Shape('ellipse', 'leather', *IP(1.5, 5.4), 0.9 * k, 0.9 * k)]
    elif item == 'cane': i_sh += [Shape('line', 'wood', IP(0.6, -1), IP(1.4, 8.6), 0.9 * k), Shape('capsule', 'wood', IP(0.6, -1), IP(-1.4, -1.6), 0.6 * k)]
    elif item == 'map': i_sh += [Shape('poly', 'paper', IL((-2.2, -2.8), (3.2, -2.4), (3.0, 1.2), (-2.4, 0.8))), Shape('line', 'stitch', IP(-1, -1), IP(2, -0.4), 0.4 * k, flat=True)]
    elif item == 'pipe': i_sh += [Shape('line', 'wood', IP(-0.4, -1.2), IP(2.6, -3.0), 0.6 * k), Shape('ellipse', 'wood', *IP(2.8, -3.4), 0.8 * k, 0.9 * k)]
    elif item == 'rod': i_sh += [Shape('line', 'wood', IP(0, 3), IP(6, -10), 0.6 * k)]
    elif item == 'basket': i_sh += [Shape('poly', 'straw', IL((-2.2, 0.4), (2.6, 0.4), (2.0, 3.6), (-1.6, 3.6))), Shape('ellipse', 'redgem', *IP(0, 0), 0.8 * k, 0.6 * k, flat=True), Shape('ellipse', 'greengem', *IP(1.4, -0.2), 0.7 * k, 0.6 * k, flat=True)]
    elif item == 'shield': i_sh += [Shape('poly', 'metal', IL((-2.6, -3.4), (2.4, -3.4), (2.4, 1.6), (-0.1, 4.0), (-2.6, 1.6))), Shape('line', 'trimF', IP(-0.1, -3), IP(-0.1, 3.4), 0.7 * k, flat=True)]
    if i_sh: parts.append(Part('item', 'armN', hand, 3.7 if item not in ('book', 'ledger', 'scroll', 'map', 'basket') else 3.65, i_sh, sep=False))

    model = Model(W, H, parts, ramps, spec.get('outline', '#140e12'), flats)
    return model, item


def anims(spec, item):
    sn = math.sin
    body = spec.get('body', 'normal')
    hunch = 6 if body == 'elder' else 0
    long = spec.get('outfit') in ('robe', 'dress')
    idle, run, work = [], [], []
    for i in range(4):
        f = i / 4 * math.pi * 2
        idle.append({'torso': (hunch, 0, [0, 0, 1, 1][i]), 'head': (2 * sn(f) - hunch * 0.6,), 'armF': (4 * sn(f),), 'armN': (-4 * sn(f) + (-25 if item in ('book', 'ledger', 'scroll', 'map', 'mug', 'basket') else 0),),
                     'cape': (2 * sn(f),), 'tail': (8 * sn(f),), 'hair': (1.5 * sn(f + 1),)})
        legA = 20 if long else 32
        run.append({'torso': (6 + hunch, 0, -round(abs(sn(f)))), 'legF': (legA * sn(f),), 'legN': (-legA * sn(f),), 'armF': (-34 * sn(f),), 'armN': (34 * sn(f) + (-20 if item in ('book', 'ledger', 'scroll', 'map', 'mug', 'basket') else 0),),
                    'cape': (14 + 6 * sn(f),), 'tail': (-14 + 8 * sn(f),), 'hair': (-3,)})
        if item in ('hammer', 'axe', 'pitchfork', 'shovel', 'gavel', 'drumstick', 'tongs', 'sword'):
            sw = [-150, -120, -20, -40][i] if item not in ('sword', 'pitchfork', 'shovel') else [-110, -70, 30, 10][i]
            work.append({'torso': (hunch + [-3, -2, 6, 3][i], 0, [0, 0, 1, 0][i]), 'armN': (sw,), 'armF': ([10, 6, -10, -4][i],), 'head': ([-4, -2, 4, 2][i],)})
        elif item in ('book', 'ledger', 'scroll', 'quill', 'map'):
            work.append({'torso': (hunch + 2, 0, 0), 'head': (8 + 2 * sn(f),), 'armN': (-30 + 6 * sn(f),), 'armF': (-10,)})
        elif item in ('staff', 'scepter', 'crook', 'spear', 'lantern', 'flask'):
            work.append({'torso': (hunch - 2, 0, -[0, 1, 1, 0][i]), 'armN': ([-40, -95, -100, -50][i],), 'head': (-4,), 'armF': ([0, -20, -20, 0][i],)})
        else:  # 손짓하며 말하기
            work.append({'torso': (hunch, 0, [0, 0, 1, 0][i]), 'armN': ([-20, -60, -40, -10][i],), 'head': ([0, 4, 2, 0][i],), 'armF': (6 * sn(f),)})
    return [('idle', idle), ('run', run), ('work', work)]


# ═══════ 사람들 ═══════
# body: normal · stout · tall · child · elder / race: human · elf · orc · lizard · undead · skeleton · dragon / outfit: tunic · robe · dress · armor · apron · coat · vest · noble · rags
P = {}
def person(id, **kw): P[id] = kw

# ── 바람결 마을 ──
person('altar', race='human', outfit='robe', cloth='#4a2a6a', trim='#c8a0ff', hair='#e8e0f0', hairStyle='long', hat='circlet', circletGem='bluegem', item='staff', glowc='#c8a0ff', skin='fair')          # 각인사 루네
person('library', race='elf', outfit='robe', cloth='#2e5a3a', trim='#e8d890', hair='#c8a060', hairStyle='bun', item='book', bookc='#3a6a8a')                                                             # 사서 에일
person('board', race='human', outfit='vest', cloth='#c8b890', vestc='#5a3a22', hair='#4a3020', hairStyle='short', beard='stache', item='ledger', brows=True)                                               # 의뢰인 마르코
person('shop', race='human', body='stout', outfit='apron', cloth='#7a4a3a', apronc='#3a3430', hair='#2a2420', hairStyle='bald', beard='full', item='hammer', brows=True, skin='tan', boots='#2a2018')       # 대장장이 브론
person('store', race='human', outfit='apron', cloth='#5a8a5a', apronc='#e8dcc0', hair='#8a5a2a', hairStyle='short', item='mug', blush=True)                                                               # 잡화점 주인 토비
person('trainer', race='human', body='tall', outfit='armor', metal='#8a94a8', cloth='#a8402a', tabard=True, hair='#3a2a20', hairStyle='short', beard='stache', item='sword', brows=True, skin='tan')      # 교관 가르
person('merchant', race='human', outfit='coat', cloth='#6a3a8a', inner='#e8c060', hair='#2a2a30', hairStyle='short', hat='tophat', hatc='#3a2a4a', item='basket', beard='stache')                         # 떠돌이 상인 오반
person('pino', race='elf', body='child', outfit='tunic', cloth='#c87a3a', pants='#5a4a3a', hair='#e8a040', hairStyle='spiky', hat='cap', hatc='#3a6a8a', item='map', blush=True)                         # 지도 제작자 피노
person('farmer', race='human', outfit='tunic', cloth='#8a9a5a', pants='#5a4a3a', hair='#7a5a30', hairStyle='short', hat='straw', item='pitchfork', skin='tan')                                           # 농부
person('farmer2', race='human', outfit='dress', cloth='#c87a6a', hair='#a8603a', hairStyle='braids', hat='straw', item='basket', blush=True)                                                             # 농부 아낙
person('innkeeper', race='human', body='stout', outfit='apron', cloth='#8a5a3a', apronc='#f0e6d0', hair='#c8783a', hairStyle='bun', item='mug', blush=True)
person('smith', race='human', body='stout', outfit='apron', cloth='#5a4a4a', apronc='#4a3428', hair='#3a2820', hairStyle='short', beard='full', item='tongs', skin='tan', brows=True)
person('rumorer', race='human', outfit='rags', cloth='#6a6058', hair='#5a4a3a', hairStyle='wild', hat='hood', hatc='#4a4038', item='pipe', brows=True)
# ── 항구 · 배 ──
person('portMaster', race='human', body='stout', outfit='coat', cloth='#2a4a7a', inner='#e8e0d0', hair='#e8e8e0', hairStyle='short', beard='full', hat='cap', hatc='#1a2a4a', item='map')              # 항구지기 오렌
person('shipCaptainE', race='human', outfit='coat', cloth='#3a5a4a', inner='#c8a060', hair='#2a1a14', hairStyle='pony', hat='tricorn', hatc='#2a2420', item='sword', beard='stache', skin='tan')        # 선장 하겔
person('shipCaptain', race='human', body='tall', outfit='coat', cloth='#1a2a5a', inner='#e8e0d0', hair='#8a8a90', hairStyle='short', beard='long', hat='tricorn', hatc='#141a30', plume=True, featherc='#e8e8f0', item='map')
person('sailor', race='human', outfit='vest', cloth='#e8e8f0', vestc='#2a4a8a', pants='#3a4a6a', hair='#c89040', hairStyle='short', hat='bandana', hatc='#c83a3a', item='rod', skin='tan')
person('trader', race='human', outfit='dress', cloth='#c8783a', trim='#ffe08a', hair='#3a2418', hairStyle='bun', item='ledger', blush=True)
person('infoMerchant', race='human', outfit='coat', cloth='#5a4a6a', inner='#a89070', hair='#8a8a8a', hairStyle='short', hat='hood', hatc='#3a3048', item='scroll', brows=True)
# ── 녹트 하벤 ──
person('broker', race='human', outfit='coat', cloth='#2a2430', inner='#5a2a3a', hair='#1a1418', hairStyle='short', hat='hood', hatc='#1e1a26', item='dagger', brows=True)
person('fence', race='human', body='stout', outfit='vest', cloth='#6a5a3a', vestc='#3a4a2a', hair='#3a3020', hairStyle='bald', beard='stache', item='basket', skin='tan')
person('forger', race='human', body='elder', outfit='robe', cloth='#4a3a2a', hair='#c8c0b0', hairStyle='short', hat='circlet', circletGem='redgem', item='quill', brows=True)
person('healer', race='elf', outfit='robe', cloth='#e8e8e0', trim='#5aa86a', hair='#6a8a5a', hairStyle='long', item='flask', glowc='#7ae87a', emblem='greengem')
person('pitBoss', race='orc', body='stout', outfit='vest', cloth='#6a3a2a', vestc='#3a2418', hair='#1a1a14', hairStyle='mohawk', item='axe', brows=True)
person('rebel', race='human', outfit='tunic', cloth='#3a3a44', pants='#2a2a30', hair='#4a3a2a', hairStyle='short', hat='bandana', hatc='#5a2a3a', item='sword', brows=True, cape='#2a2228')
person('rebel2', race='elf', outfit='tunic', cloth='#2e2a3a', pants='#1e1a26', hair='#c8c0d0', hairStyle='pony', hat='hood', hatc='#2a2434', item='bow')
person('kaila', race='human', body='tall', outfit='armor', metal='#5a5a6a', cloth='#4a2a5a', tabard=True, hair='#8a2a2a', hairStyle='long', item='sword', cape='#2a1a30', brows=True)                  # 녹타리스의 수장 카일라
person('quartermaster', race='human', body='stout', outfit='vest', cloth='#5a5040', vestc='#3a2a3a', hair='#6a4a2a', hairStyle='short', beard='full', item='ledger', hat='bandana', hatc='#4a2a3a')
person('spymaster', race='elf', outfit='coat', cloth='#1e1e28', inner='#3a2a4a', hair='#2a2a3a', hairStyle='short', hat='mask', item='dagger')
# ── 아우렐리온 · 왕도 ──
person('recruiter', race='human', outfit='armor', metal='#c8b070', cloth='#2a4a9a', tabard=True, emblem='buckle', hair='#6a4a2a', hairStyle='short', beard='stache', item='scroll', hat='helm', plume=True, featherc='#3a6ae8')
person('king', race='human', body='elder', outfit='noble', cloth='#8a1a2a', trim='#ffd76a', hair='#e8e8e8', hairStyle='long', beard='long', hat='crown', item='scepter', cape='#6a1420', collar=True)  # 국왕 에드릭
person('taxChief', race='human', body='stout', outfit='noble', cloth='#5a4a1a', trim='#e8c040', hair='#5a4a3a', hairStyle='bald', beard='stache', item='ledger', collar=True)                       # 세리장
person('treasurer', race='human', outfit='robe', cloth='#2a5a4a', trim='#e8c040', hair='#8a8a8a', hairStyle='short', hat='tophat', hatc='#1a3a2a', item='scroll', collar=True, brows=True)         # 재무대신
person('knightCommander', race='human', body='tall', outfit='armor', metal='#d8dce8', cloth='#2a4a9a', tabard=True, emblem='buckle', hair='#c8a060', hairStyle='short', beard='full', hat='helm', plume=True, featherc='#e83a3a', item='sword', cape='#2a3a7a')
person('royalMage', race='human', body='elder', outfit='robe', cloth='#2a2a7a', trim='#ffd76a', hair='#e8e8f0', hairStyle='long', beard='long', hat='wizard', hatc='#1a1a5a', stars=True, item='staff', glowc='#9fd8ff')
person('royalGuard', race='human', outfit='armor', metal='#a8b0c0', cloth='#2a4a9a', tabard=True, hat='fullhelm', plume=True, featherc='#3a6ae8', item='spear')
# ── 황금 돛 연맹 · 섬 ──
person('guildMaster', race='human', outfit='dress', cloth='#e8b840', trim='#8a2a3a', hair='#2a1a14', hairStyle='bun', hat='circlet', circletGem='redgem', item='ledger', collar=True)
person('auctioneer', race='human', body='stout', outfit='noble', cloth='#6a2a3a', trim='#ffd76a', hair='#8a6a4a', hairStyle='short', hat='tophat', hatc='#2a1a1e', item='gavel', beard='stache')
person('shipwright', race='human', body='stout', outfit='apron', cloth='#7a8a9a', apronc='#6a4a2a', hair='#c8c0b0', hairStyle='short', beard='full', item='hammer', hat='cap', hatc='#5a4a3a')
person('mercCaptain', race='human', body='tall', outfit='armor', metal='#e8eef8', cloth='#5a7a9a', hair='#e8e8f0', hairStyle='long', beard='full', hat='helm', item='axe', cape='#e8eef8')
person('sultanHost', race='human', outfit='robe', cloth='#e8d8a8', trim='#c8402a', hair='#1a1a14', hairStyle='short', hat='turban', hatc='#e8e0d0', beard='full', item='scepter', skin='dark')
person('caravanMaster', race='human', outfit='coat', cloth='#c8a070', inner='#8a3a2a', hair='#2a2018', hairStyle='short', hat='turban', hatc='#3a6a8a', beard='stache', item='crook', skin='dark')
person('spiceSeller', race='human', outfit='dress', cloth='#c84a3a', trim='#ffd060', hair='#1a1410', hairStyle='long', hat='bandana', hatc='#e8a040', item='basket', skin='dark')
person('pirateQueen', race='human', body='tall', outfit='coat', cloth='#8a1a1a', inner='#e8e0d0', hair='#c83a2a', hairStyle='wild', hat='tricorn', hatc='#1a1414', plume=True, featherc='#e8e8e8', item='sword')
person('bountyHunter', race='human', outfit='vest', cloth='#6a5a4a', vestc='#3a2a1a', hair='#4a3a2a', hairStyle='short', hat='tophat', hatc='#3a2a1a', beard='stache', item='dagger', cape='#3a2a1e')
person('cultist', race='human', outfit='robe', cloth='#1a1420', trim='#7a4ab8', hat='hood', hatc='#14101a', item='lantern', glowc='#7a4ab8', closedEyes=True)
person('ferryman', race='human', body='elder', outfit='rags', cloth='#5a5a62', hair='#d8d8d8', hairStyle='wild', hat='hood', hatc='#4a4a52', item='lantern')
# ── 성지 시설 ──
person('dinoTamer', race='lizard', outfit='vest', cloth='#c8a070', vestc='#6a4a2a', scalec='#5a9a4a', item='crook', featherc='#e8a030')
person('dragonElder', race='dragon', body='elder', outfit='robe', cloth='#6a1a14', trim='#ffb040', hair='#e8e0d8', hairStyle='long', beard='long', item='staff', glowc='#ffb040')
# ── 성지 수호자 · 우두머리 · 주민 ──
person('keep_wizard', race='human', outfit='robe', cloth='#5a2a9a', trim='#ffd76a', hair='#e8d8f0', hairStyle='long', hat='wizard', hatc='#3a1a7a', item='staff', glowc='#c8a0ff')
person('keep_elf', race='elf', outfit='dress', cloth='#3a8a4a', trim='#e8f0c0', hair='#e8e090', hairStyle='long', item='crook')
person('keep_knight', race='human', body='tall', outfit='armor', metal='#b8c0d0', cloth='#2a4a9a', tabard=True, hair='#8a8a8a', hairStyle='short', beard='stache', hat='helm', item='spear', brows=True)
person('keep_orc', race='orc', outfit='robe', cloth='#6a4a2a', trim='#c8a060', hair='#2a2a20', hairStyle='bald', hat='feathers', featherc='#e8503a', item='staff', glowc='#ff9a3a')
person('keep_undead', race='undead', body='elder', outfit='robe', cloth='#2a1a3a', trim='#9a7ab8', hair='#c8c8d0', hairStyle='long', item='lantern', glowc='#c45cff')
person('keep_assassin', race='human', outfit='coat', cloth='#1e1a28', inner='#5a2a3a', hat='hood', hatc='#2a2434', item='dagger', closedEyes=False)
person('keep_dino', race='lizard', body='elder', outfit='robe', cloth='#6a8a3a', trim='#e8c060', scalec='#4a8a3a', item='cane', hat='feathers')
person('keep_dragon', race='dragon', outfit='armor', metal='#8a3a2a', cloth='#e8a040', hair='#e8402a', hairStyle='spiky', item='spear')
person('lead_wizard', race='human', body='elder', outfit='robe', cloth='#3a1a7a', trim='#ffd76a', hair='#f0f0f8', hairStyle='long', beard='long', hat='wizard', hatc='#2a1a6a', stars=True, item='staff', cape='#4a2a9a', glowc='#c9a8ff')
person('lead_elf', race='elf', body='tall', outfit='dress', cloth='#2e7a3a', trim='#e8f8d0', hair='#f0e8b0', hairStyle='long', hat='tiara', item='staff', cape='#2e7a3a', glowc='#bfffc8')
person('lead_knight', race='human', outfit='dress', cloth='#e8e0f0', trim='#2a4a9a', hair='#e8c070', hairStyle='long', hat='crown', item='scepter', cape='#2a4a9a', blush=True)          # 왕녀 아델하이트 (갑옷이 아니라 드레스)
person('lead_orc', race='orc', body='tall', outfit='armor', metal='#6a6a72', cloth='#8a2a1a', tabard=True, hair='#1a1a14', hairStyle='mohawk', hat='horns', helmBand=True, item='axe', cape='#8a2a1a', brows=True)
person('lead_undead', race='skeleton', body='tall', outfit='noble', cloth='#3a1a4a', trim='#c8a040', hat='crown', item='scepter', cape='#3a1a4a', glowEye='#c45cff', gem='#c45cff')
person('lead_assassin', race='human', outfit='coat', cloth='#14101c', inner='#3a1a2a', hair='#e8e0f0', hairStyle='long', hat='mask', item='dagger', cape='#1a1424')
person('lead_dino', race='lizard', body='tall', outfit='vest', cloth='#c8a070', vestc='#5a7a2a', scalec='#4a8a3a', hat='feathers', item='spear', cape='#5a7a2a')
person('lead_dragon', race='dragon', body='tall', outfit='noble', cloth='#8a1a10', trim='#ffd76a', hair='#ff5a2a', hairStyle='wild', hat='crown', item='scepter', cape='#8a1a10', gem='#ff6a2a')
# 마탑 주민
person('res_wizard_0', race='human', outfit='robe', cloth='#6a4ab8', trim='#e8d8ff', hair='#c87a3a', hairStyle='pony', hat='wizard', hatc='#5a3aa8', blush=True)
person('res_wizard_1', race='human', outfit='robe', cloth='#3a6aa8', trim='#e8d8ff', hair='#3a2a20', hairStyle='short', hat='wizard', hatc='#2a5a98')
person('res_wizard_2', race='human', outfit='robe', cloth='#8a3a5a', trim='#ffe0a0', hair='#e8d080', hairStyle='bun')
person('res_wizard_3', race='human', body='elder', outfit='robe', cloth='#2a3a6a', trim='#c8d8ff', hair='#d0d0d8', hairStyle='short', beard='long', hat='wizard', hatc='#1a2a5a', stars=True)
# 세계수 주민
person('res_elf_0', race='elf', outfit='tunic', cloth='#4a7a3a', pants='#5a4a30', hair='#e8d090', hairStyle='short', cape='#3a5a2a')
person('res_elf_1', race='elf', outfit='tunic', cloth='#5a8a4a', pants='#4a3a2a', hair='#c86a3a', hairStyle='pony')
person('res_elf_2', race='elf', outfit='robe', cloth='#8aa04a', trim='#e8f0a0', hair='#7ab86a', hairStyle='long')
person('res_elf_3', race='elf', body='child', outfit='dress', cloth='#e88aa0', hair='#f0e0a0', hairStyle='braids', blush=True)
# 왕성 주민
person('res_knight_0', race='human', outfit='armor', metal='#a8b0c0', cloth='#2a4a9a', tabard=True, hair='#4a3020', hairStyle='short', brows=True)
person('res_knight_1', race='human', outfit='armor', metal='#b8bcc8', cloth='#8a2a3a', tabard=True, hair='#c87a3a', hairStyle='pony')
person('res_knight_2', race='human', body='child', outfit='apron', cloth='#8a7a5a', apronc='#5a4a3a', hair='#e8c070', hairStyle='short', blush=True)          # 종자 핀
person('res_knight_3', race='human', outfit='armor', metal='#9aa0b0', cloth='#2a4a9a', hat='helm', hair='#2a2a2a', hairStyle='short', beard='stache')
# 투기장 주민
person('res_orc_0', race='orc', outfit='vest', cloth='#6a4a2a', vestc='#3a2a1a', hairStyle='mohawk', hair='#2a1a10', brows=True)
person('res_orc_1', race='orc', outfit='vest', cloth='#5a3a3a', vestc='#2a1a1a', hat='mask', hair='#1a1a14', hairStyle='bald', skin='#6a8a3a')
person('res_orc_2', race='orc', body='stout', outfit='robe', cloth='#7a5a3a', trim='#c8402a', hat='feathers', featherc='#c8402a', hairStyle='bald')
person('res_orc_3', race='orc', outfit='tunic', cloth='#6a5a3a', pants='#4a3a2a', hat='bandana', hatc='#8a2a1a', hairStyle='short', hair='#2a1a10', cape='#5a4a2a')
# 납골당 주민
person('res_undead_0', race='skeleton', outfit='rags', cloth='#4a4a52', hat='hood', hatc='#3a3a42')
person('res_undead_1', race='undead', outfit='robe', cloth='#3a2a4a', trim='#c8a060', hair='#c8c8d0', hairStyle='long')
person('res_undead_2', race='skeleton', outfit='armor', metal='#7a7068', cloth='#4a3a5a', hat='helm', metal2='#7a7068')
person('res_undead_3', race='undead', body='child', outfit='rags', cloth='#8a90a8', hair='#d8e0f0', hairStyle='short', closedEyes=False)
# 그림자 길드 주민
person('res_assassin_0', race='human', outfit='tunic', cloth='#2a2434', pants='#1e1a26', hat='hood', hatc='#3a3248', hair='#2a1a1a', hairStyle='short')
person('res_assassin_1', race='elf', outfit='tunic', cloth='#3a2a2a', pants='#1e1a1a', hat='bandana', hatc='#5a1a2a', hair='#c8c0c8', hairStyle='pony')
person('res_assassin_2', race='human', body='stout', outfit='vest', cloth='#4a4038', vestc='#2a2420', hair='#4a3a2a', hairStyle='wild', item='pipe')
person('res_assassin_3', race='human', body='tall', outfit='coat', cloth='#1a1820', inner='#3a2a3a', hat='hood', hatc='#14121a')
# 거대 둥지 주민
person('res_dino_0', race='lizard', outfit='dress', cloth='#c8a070', trim='#5a8a3a', scalec='#7ab84a', hat='feathers')
person('res_dino_1', race='lizard', outfit='vest', cloth='#8a6a4a', vestc='#4a3a2a', scalec='#4a8a5a')
person('res_dino_2', race='lizard', outfit='vest', cloth='#6a8a4a', vestc='#3a4a2a', scalec='#8a9a3a')
person('res_dino_3', race='lizard', body='child', outfit='tunic', cloth='#c8a070', pants='#8a6a4a', scalec='#9ad06a')
# 용의 둥지 주민
person('res_dragon_0', race='dragon', body='stout', outfit='apron', cloth='#6a3a2a', apronc='#3a2a20', hair='#e8402a', hairStyle='short', beard='full')
person('res_dragon_1', race='dragon', outfit='robe', cloth='#c84a2a', trim='#ffd060', hair='#ff8a3a', hairStyle='long', closedEyes=True)
person('res_dragon_2', race='dragon', outfit='dress', cloth='#e88a5a', trim='#ffe0a0', hair='#c8302a', hairStyle='bun', blush=True)
person('res_dragon_3', race='dragon', body='child', outfit='tunic', cloth='#e8a040', pants='#8a3a2a', hair='#ff6a2a', hairStyle='spiky', blush=True)
# 벌어지는 일 · 길손
person('wagonDriver', race='human', outfit='vest', cloth='#c8b890', vestc='#6a4a2a', hair='#4a3a2a', hairStyle='short', hat='straw', item='crook', skin='tan')
person('taxman', race='human', outfit='noble', cloth='#4a3a6a', trim='#e8c040', hair='#3a2a20', hairStyle='short', hat='tophat', hatc='#2a1a3a', item='ledger')
person('peasantKid', race='human', body='child', outfit='rags', cloth='#a89070', hair='#8a5a2a', hairStyle='short', blush=True)

# ── 사람 모양 몬스터 (색만 바꾼 그림 대신) ──
person('m_bandit', race='human', outfit='rags', cloth='#5a5048', hat='bandana', hatc='#3a3a40', hair='#2a2018', hairStyle='short', beard='stache', item='dagger', brows=True, skin='tan')
person('m_darkArcher', race='elf', outfit='tunic', cloth='#2a1e34', pants='#1a1424', hat='hood', hatc='#22182c', item='bow', eyec='#c060ff')
person('m_forestArcher', race='elf', outfit='tunic', cloth='#4a5a2a', pants='#3a3020', hat='hood', hatc='#3a4a22', item='bow', hair='#6a4a2a', hairStyle='short')
person('m_iceArcher', race='elf', outfit='tunic', cloth='#9ac8e8', pants='#5a7a9a', hair='#e8f4ff', hairStyle='long', item='bow', cape='#c8e8ff')
person('m_necroAcolyte', race='undead', outfit='robe', cloth='#3a4a2a', trim='#9ac85a', hat='hood', hatc='#2a3a1e', item='staff', glowc='#9ae85a')
person('m_bogWitch', race='human', body='elder', outfit='robe', cloth='#4a5a2a', trim='#8a6a3a', hair='#6a6a5a', hairStyle='wild', hat='wizard', hatc='#3a4a1e', item='staff', glowc='#9ae85a', skin='#a8b888')
person('m_frostWitch', race='elf', body='tall', outfit='dress', cloth='#9ad8f8', trim='#ffffff', hair='#e8f8ff', hairStyle='long', hat='tiara', item='staff', glowc='#c8f0ff', cape='#6ab8e8', skin='#d8f0ff')
person('m_lizardWarrior', race='lizard', outfit='armor', metal='#8a7a5a', cloth='#6a3a2a', scalec='#4a7a3a', item='spear', hat='helm')
person('m_lavaLizard', race='lizard', outfit='vest', cloth='#3a2a2a', vestc='#1a1414', scalec='#c8481a', item='axe')
person('m_rockThrower', race='human', body='stout', outfit='vest', cloth='#7a6a5a', vestc='#4a3a2a', hair='#4a4038', hairStyle='bald', beard='full', skin='#a89888', item='hammer')
person('m_fallenKnight', race='undead', body='tall', outfit='armor', metal='#4a4a5a', cloth='#3a1a2a', tabard=True, hat='fullhelm', item='sword', cape='#2a1420', glowEye='#ff4a4a')
person('m_wraithKnight', race='skeleton', body='tall', outfit='armor', metal='#7a9ab8', cloth='#2a3a5a', hat='helm', item='sword', glowEye='#7ad8ff', cape='#2a3a5a')
person('m_wraith', race='undead', outfit='robe', cloth='#c8d0e0', trim='#8a9ab8', hat='hood', hatc='#a8b0c8', closedEyes=True)
person('m_cultist', race='human', outfit='robe', cloth='#2a1a3a', trim='#9a6ae8', hat='hood', hatc='#1e1430', item='dagger', closedEyes=True)
person('m_raidQueen', race='elf', body='tall', outfit='dress', cloth='#c8e8ff', trim='#5ab8f8', hair='#ffffff', hairStyle='long', hat='crown', item='scepter', cape='#5ab8f8', skin='#e0f4ff', gem='#7ad8ff')
person('m_orcRaider', race='orc', outfit='armor', metal='#6a5a4a', cloth='#5a2a1a', hat='helm', item='axe', brows=True)
# ── 왕도 아우렐리온 ──
person('cap_gate', race='human', body='tall', outfit='armor', metal='#c8ccd8', cloth='#2a4a9a', tabard=True, hat='helm', plume=True, featherc='#ffd76a', item='spear', beard='stache', hair='#5a3a22', brows=True)          # 성문 대장 로웰
person('cap_jailer', race='human', body='stout', outfit='vest', cloth='#4a4a52', vestc='#2a2a30', hair='#3a3028', hairStyle='bald', beard='full', item='lantern', brows=True, skin='tan')                                  # 간수장 그롬
person('cap_herald', race='human', outfit='noble', cloth='#2a4a9a', trim='#ffd76a', hair='#c8a060', hairStyle='short', hat='cap', hatc='#8a1a2a', item='scroll', collar=True)                                            # 전령 피에르
person('cap_exec', race='human', body='stout', outfit='vest', cloth='#2a2024', vestc='#140e12', hat='hood', hatc='#140e12', item='axe', skin='#c89070')                                              # 집행인
person('cap_prisoner', race='human', outfit='rags', cloth='#8a8070', hair='#3a2a1a', hairStyle='wild', beard='full', skin='tan', closedEyes=True)                                                                      # 끌려온 죄수
person('cap_prisonerYard', race='elf', outfit='rags', cloth='#7a7a6a', hair='#a8a090', hairStyle='long', brows=True)                                                                                                  # 감옥 마당의 죄수
person('cap_trader', race='human', body='stout', outfit='coat', cloth='#6a2a4a', inner='#e8d8b0', hair='#2a1a14', hairStyle='short', beard='stache', hat='tophat', hatc='#3a1a2a', item='ledger')                         # 왕도 교역상 마틸드
person('cap_baker', race='human', body='stout', outfit='apron', cloth='#c8a070', apronc='#f4ecd8', hair='#e8c070', hairStyle='bun', hat='chef', item='basket', blush=True)                                               # 빵집 안나
person('cap_armorer', race='dragon', outfit='apron', cloth='#5a4a3a', apronc='#3a2a1e', hair='#8a2a1a', hairStyle='short', item='hammer', brows=True)                                                                  # 갑옷 장인 도르크
person('cap_fruit', race='human', body='elder', outfit='dress', cloth='#6a8a3a', trim='#e8c040', hair='#d8d0c8', hairStyle='bun', hat='straw', item='basket')                                                           # 과일 장수 할머니
person('cap_cloth', race='elf', outfit='dress', cloth='#a83a6a', trim='#f4d8e8', hair='#2a1a3a', hairStyle='long', item='scroll')                                                                                     # 옷감 장수 리엔
person('cap_fish', race='lizard', outfit='apron', cloth='#3a6a7a', apronc='#c8d8d8', scalec='#5a8a7a', item='dagger')                                                                                                # 생선 장수 실라
person('cap_noble1', race='human', outfit='dress', cloth='#e8c8e8', trim='#ffffff', hair='#ffd88a', hairStyle='braids', hat='tiara', item='book', blush=True)                                                           # 귀족 아가씨 셀레스트
person('cap_noble2', race='human', outfit='noble', cloth='#3a2a6a', trim='#ffd76a', hair='#1a1418', hairStyle='short', beard='stache', hat='tophat', hatc='#1a1418', item='cane', cape='#2a1a4a')                         # 귀족 바르텔
person('cap_maid', race='human', outfit='apron', cloth='#2a2a3a', apronc='#ffffff', hair='#6a3a22', hairStyle='bun', item='broom')                                                                                    # 저택 하녀
person('cap_beggar', race='human', body='elder', outfit='rags', cloth='#6a6052', hair='#8a8a80', hairStyle='wild', beard='long', item='cane')                                                                           # 거지 노인
person('cap_folk1', race='human', outfit='tunic', cloth='#8a5a3a', pants='#4a3a2a', hair='#3a2a1a', hairStyle='short', item='mug', skin='tan')
person('cap_folk2', race='human', outfit='dress', cloth='#3a6a9a', trim='#e8e0d0', hair='#a8582a', hairStyle='pony', item='basket')
person('cap_folk3', race='orc', outfit='vest', cloth='#6a6a5a', vestc='#3a3a2a', hairStyle='mohawk', hair='#1a1a14', item='axe')
person('cap_folk4', race='human', body='elder', outfit='coat', cloth='#5a5a4a', inner='#a89878', hair='#c8c8c0', hairStyle='bald', beard='full', item='pipe')
person('cap_folk5', race='elf', outfit='tunic', cloth='#4a7a5a', pants='#3a4a3a', hair='#e8d8a8', hairStyle='pony', item='book')
person('cap_kid', race='human', body='child', outfit='tunic', cloth='#c84a3a', pants='#4a3a5a', hair='#3a2a1a', hairStyle='spiky', blush=True)

# 사람 모양 몬스터 (예전엔 다른 몬스터 그림에 색만 바꿔 썼다)
person('m_goblinShaman', race='human', body='child', skin='#7ab04a', ears='goblin', outfit='robe', cloth='#6a4a2a', trim='#c8b070', hairStyle='bald', hat='feathers', featherc='#e85030', item='staff', glowc='#9be15d', brows=True)
person('m_chortShaman', race='human', body='child', skin='#c8483a', ears='goblin', outfit='rags', cloth='#3a2a2a', hairStyle='bald', hat='horns', item='staff', glowc='#ff9a3a', eyec='#ffd040')
person('m_iceShaman', race='human', body='child', skin='#8ab0c8', ears='goblin', outfit='robe', cloth='#c8d8e8', trim='#6aa8d8', hairStyle='bald', hat='hood', hatc='#e8eef8', item='staff', glowc='#bfeaff')
person('m_treasureGoblin', race='human', body='child', skin='#8ab040', ears='goblin', outfit='vest', cloth='#7a5a2a', vestc='#c8a040', hairStyle='bald', hat='cap', hatc='#c8a040', sack=True, item='basket', blush=True)
person('m_ghoul', race='undead', body='elder', outfit='rags', cloth='#4a4a3a', skin='#8a9a7a', hair='#3a3a2a', hairStyle='wild', eyec='#c8ff6a')
person('m_boneGuard', race='skeleton', body='tall', outfit='bare', metal='#8a8a7a', cloth='#4a3a2a', hat='helm', plume=True, featherc='#8a2a2a', item='shield', glowEye='#ffb04a')
person('m_boneArcher', race='skeleton', outfit='bare', hat='hood', hatc='#4a3a2a', item='bow', glowEye='#ff6a3a')
person('m_orcWarlord', race='orc', body='stout', outfit='armor', metal='#5a5a6a', cloth='#6a1a1a', hat='horns', helmBand=True, cape='#6a1a1a', item='axe', brows=True)
person('m_shieldDemon', race='human', body='stout', skin='#b83a3a', outfit='armor', metal='#3a2a3a', cloth='#5a1a1a', hairStyle='bald', hat='horns', item='shield', eyec='#ffd040', brows=True)
person('m_dragonGuard', race='dragon', body='tall', outfit='armor', metal='#3a6a8a', cloth='#2a3a5a', tabard=True, hair='#3a6a8a', hairStyle='short', item='spear', skin='#f0c090')
person('m_graveKeeper', race='undead', body='stout', outfit='coat', cloth='#3a3446', inner='#6a6a7a', hat='hood', hatc='#2a2436', skin='#9a8aa8', item='shovel')

# ── 섬 사람 (섬마다 다른 얼굴) ──
person('goldHarbor', race='human', outfit='coat', cloth='#e8c040', inner='#2a4a7a', hair='#2a1a14', hairStyle='pony', hat='tricorn', hatc='#2a4a7a', item='map', skin='tan')
person('goldTrader', race='human', outfit='noble', cloth='#2a6a5a', trim='#e8c040', hair='#c8a060', hairStyle='short', item='ledger', beard='stache')
person('goldShop', race='elf', outfit='dress', cloth='#6a3a8a', trim='#e8c040', hair='#e8d8b0', hairStyle='bun', item='basket')
person('frostHarbor', race='human', body='stout', outfit='coat', cloth='#e8eef8', inner='#5a7a9a', hair='#e8e8e8', hairStyle='short', beard='full', hat='cap', hatc='#5a7a9a', item='lantern')
person('frostTrader', race='human', outfit='coat', cloth='#5a7a9a', inner='#e8eef8', hair='#d8c8a0', hairStyle='braids', hat='cap', hatc='#e8eef8', item='ledger', blush=True)
person('sandHarbor', race='human', body='tall', outfit='robe', cloth='#e8e0c8', trim='#3a6a8a', hair='#1a1410', hairStyle='short', hat='turban', hatc='#3a6a8a', beard='stache', item='scroll', skin='dark')
person('skullHarbor', race='human', body='stout', outfit='rags', cloth='#5a4a3a', hair='#2a2018', hairStyle='bald', beard='full', hat='bandana', hatc='#1a1a1a', item='hammer', skin='tan')


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:] or None
    ids = [i for i in P if not only or i in only]
    rows = []
    meta = {'w': W, 'h': H, 'chars': {}}
    for cid in ids:
        model, item = build(P[cid])
        an = anims(P[cid], item)
        base = len(rows)
        meta['chars'][cid] = {'anims': {name: {'row': base + r, 'n': len(fr)} for r, (name, fr) in enumerate(an)}}
        for name, frames in an:
            rows.append([model.render(dict(pose)) for pose in frames])
    img = Image.new('RGBA', (4 * W, len(rows) * H), (0, 0, 0, 0))
    for r, fr in enumerate(rows):
        for c, im in enumerate(fr): img.alpha_composite(im, (c * W, r * H))
    img.save(out + '/people.png')
    json.dump(meta, open(out + '/people.json', 'w'), ensure_ascii=False)
    print(len(ids), 'people', img.size)
