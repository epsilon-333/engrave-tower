"""플레이어 종족 도트 (손으로 찍는 격자 그림): 0x72 캐릭터처럼 큰 머리 · 짧은 몸 · 1px 짙은 외곽선 · 재질마다 2~3단.
칸 16×28 (0x72 캐릭터와 같은 크기 · 발은 맨 아래 줄). 동작: 서기 4 · 달리기 4 · 공격 3 · 구르기 4 · 맞음 1.
프레임마다 몸 전체 자세(웅크림 · 기울기 · 다리 · 망토 · 깃털)를 다시 찍는다.
    python3 tools/heroes.py            → public/assets/custom/heroes.png · tools/sprites/heroes.json · sprites.json
    python3 tools/heroes.py --preview  → art/preview_heroes.png (8배 · 0x72 원래 그림과 나란히)
"""
import json, os, sys
from PIL import Image
from sprites import meta_path, build_manifest

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'assets', 'custom')
W, H = 16, 28

# ───── 기사 ─────
KNIGHT = {
    'O': '#1c1824',  # 외곽선
    'a': '#f4f8ff', 'b': '#9fc2e8', 'c': '#5f82b8', 'd': '#3b4f86',  # 투구 · 갑옷 (빛 · 밝음 · 중간 · 그늘) 푸른 강철
    'k': '#1a1830', 'E': '#fff3b0',  # 눈구멍 · 눈빛
    'r': '#ff8a4a', 'R': '#e04a3a', 'q': '#ffd27a',  # 깃털
    'm': '#d8453f', 'M': '#8e2a3a',  # 망토
    'g': '#ffd35a', 'G': '#c48a2a',  # 금 문장 · 띠
    'l': '#4d5f8c', 'L': '#2e3552',  # 다리 · 장화
}
# 투구(머리): 11×10, 비스듬히 오른쪽을 본다 (눈구멍과 눈이 오른쪽으로 치우친다)
HEAD = [
    '...OOOOO...',
    '..ObbbaaO..',
    '.ObbbbbaaO.',
    'OcbbbbbbaaO',
    'OcbbbbbbbbO',
    'OccOkkkkkkO',
    'OccOkEkkEkO',
    'OdccbbbbbbO',
    '.OdccccccO.',
    '..OOOOOOO..',
]
HEAD_BLINK = HEAD[:6] + ['OccOkkkkkkO'] + HEAD[7:]
HEAD_HIT = HEAD[:5] + ['OccOEkkkEkO', 'OccOkEkEkkO'] + HEAD[7:]  # 맞음: 눈이 X 모양
PLUME = [  # 뒤(왼쪽)로 흐르는 깃털 · 프레임마다 흔들린다
    ['..qrrR.', '.rrRR..', 'rRR....'],
    ['..qrrR.', '.rrRR..', '.rR....'],
    ['...qrR.', '..rrRR.', '.rRR...'],
]
# 몸: 9×6 (가슴 금 문장 · 띠 · 앞쪽 손)
BODY = [
    '.OOOOOOO.',
    'OdcbbbbaO',
    'OdcbgbbbO',
    'OdcggGbbO',
    'OGGGGGGGO',
    '.OdcccbO.',
]
CAPE = [  # 몸 뒤(왼쪽)에 늘어진 망토 · 달리면 휘날린다
    ['Om', 'OmM', 'OmM', 'OMM'],
    ['Om', 'OmmM', 'OmmM', 'OMM.'],
    ['OmM', 'OmmMM', 'OmmM.', 'OMM..'],
]
LEGS = {  # 두 다리 (장화는 짙게)
    'stand': ['.OlO.OlO', '.OlO.OlO', 'OLLOOLLO'],
    'stepA': ['OlO...OlO', 'OLLO..OlO', '.OO..OLLO'],
    'stepB': ['..OlOOlO', '..OlOLLO', '.OLLO.OO'],
    'crouch': ['OlOOlOO', 'OLLOLLO'],
}


def blank(): return [[None] * W for _ in range(H)]


def put(cv, grid, x, y, pal, flip=False):
    for j, row in enumerate(grid):
        if flip: row = row[::-1]
        for i, ch in enumerate(row):
            if ch == '.' or ch == ' ': continue
            X, Y = x + i, y + j
            if 0 <= X < W and 0 <= Y < H: cv[Y][X] = pal[ch]


def knight_frame(kind, i):
    """kind: idle · run · attack · roll · hit"""
    cv, P = blank(), KNIGHT
    foot = H - 1
    if kind == 'roll':  # 구르기: 투구를 품고 공처럼 말린다 (네 각도로 굴러간다)
        ball = [
            ['...OOOOO...', '..ObbbaaO..', '.ObbbbbaaO.', 'OcbbOkEkbaO', 'OcmmmMbbbbO', 'OmmmMMgbbcO', 'OdMMMgGbccO', '.OdccccccO.', '..OOOOOOO..'],
            ['...OOOOO...', '..OccbbbO..', '.OdcMMmbbO.', 'OdcMMmmbbbO', 'OdcgMmmbbaO', 'OdcGgmbkEaO', 'OdccbbbkaaO', '.OdcbbbaaO.', '..OOOOOOO..'],
            ['...OOOOO...', '..OccccdO..', '.ObbGgMccdO', 'ObbbgMMmccO', 'ObbbbMmmmcO', 'OabkEkbmmcO', 'OaabbbbbccO', '.OaabbbccO.', '..OOOOOOO..'],
            ['...OOOOO...', '..OaabbcO..', '.OaakEbccdO', 'OabbbbmcgdO', 'ObbbbmmMGdO', 'ObbbmmMMcdO', 'OcbbmMMccdO', '.OccccccdO.', '..OOOOOOO..'],
        ][i]
        put(cv, ball, 2, foot - 8 - (1 if i in (1, 2) else 0), P)
        return cv
    crouch = (kind == 'attack' and i == 0) or kind == 'hit'
    if kind == 'idle': bob, lean = [0, 0, 1, 1][i], 0
    elif kind == 'run': bob, lean = [1, 0, 1, 0][i], 1
    elif kind == 'attack': bob, lean = [1, 0, 0][i], [-1, 2, 1][i]  # 움츠렸다 → 앞으로 크게 뻗고 → 돌아온다
    else: bob, lean = 1, -1
    legs = LEGS['crouch'] if crouch else [LEGS['stepA'], LEGS['stand'], LEGS['stepB'], LEGS['stand']][i] if kind == 'run' else LEGS['stepA'] if kind == 'attack' and i == 1 else LEGS['stand']
    ly = foot - len(legs) + 1
    put(cv, legs, 3, ly, P)
    by = ly - 5 + bob  # 몸통 (다리 윗줄과 겹친다)
    cape = CAPE[2 if kind == 'run' or (kind == 'attack' and i == 1) else 1 if kind == 'attack' else 0]
    for j, row in enumerate(cape):
        put(cv, [row], 4 - len(row) + 1 + min(lean, 0), by + 1 + j, P)
    put(cv, BODY, 4 + max(-1, min(1, lean)), by, P)
    hx, hy = 2 + lean, by - 9
    head = HEAD_HIT if kind == 'hit' else HEAD_BLINK if kind == 'idle' and i == 3 else HEAD
    put(cv, head, hx, hy, P)
    pl = PLUME[2] if kind == 'hit' else PLUME[(i + (1 if kind == 'run' else 0)) % 3]
    put(cv, pl, hx + 1, hy - 3, P)
    return cv


RACES = {'knight': (knight_frame, KNIGHT)}
ANIMS = [('idle', 4), ('run', 4), ('attack', 3), ('roll', 4), ('hit', 1)]


def to_img(cv):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
    for y in range(H):
        for x in range(W):
            c = cv[y][x]
            if c: px[x, y] = tuple(int(c[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
    return im


def build():
    cols = max(n for _, n in ANIMS)
    sheet = Image.new('RGBA', (cols * W, len(RACES) * len(ANIMS) * H), (0, 0, 0, 0))
    meta = {}
    for ri, (rid, (fn, _)) in enumerate(RACES.items()):
        y0 = ri * len(ANIMS) * H
        for row, (kind, n) in enumerate(ANIMS):
            for i in range(n): sheet.paste(to_img(fn(kind, i)), (i * W, y0 + row * H))
        meta[rid] = {'w': W, 'h': H, 'y0': y0, 'anims': {k: {'row': r, 'n': n} for r, (k, n) in enumerate(ANIMS)}}
    return sheet, meta


if __name__ == '__main__':
    sheet, meta = build()
    if '--preview' in sys.argv:
        src = Image.open(os.path.join(OUT, '..', '0x72', 'sheet.png')).convert('RGBA')
        orig = [src.crop((128 + 16 * i, 100, 144 + 16 * i, 128)) for i in range(4)] + [src.crop((192 + 16 * i, 100, 208 + 16 * i, 128)) for i in range(4)]
        S, gap = 8, 4
        rows = [('0x72', orig)] + [(k, [sheet.crop((i * W, r * H, (i + 1) * W, (r + 1) * H)) for i in range(n)]) for r, (k, n) in enumerate(ANIMS)]
        out = Image.new('RGBA', ((W + gap) * 8 * S, len(rows) * (H + gap) * S), (58, 84, 58, 255))
        for r, (_, fr) in enumerate(rows):
            for i, f in enumerate(fr):
                out.alpha_composite(f.resize((W * S, H * S), Image.NEAREST), (i * (W + gap) * S, r * (H + gap) * S))
        p = os.path.join(HERE, '..', 'art', 'preview_heroes.png'); out.save(p); print('미리 보기:', p)
    else:
        sheet.save(os.path.join(OUT, 'heroes.png'))
        json.dump(meta, open(meta_path('heroes'), 'w', encoding='utf-8'), ensure_ascii=False)
        build_manifest()
