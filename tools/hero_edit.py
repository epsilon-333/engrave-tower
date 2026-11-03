"""참고 그림에서 따낸 도트(tools/sprites/hero_ref/*.png)를 종족답게 고친다 → tools/sprites/hero_final/*.png
  공룡 수인: 파랑 → 초록 비늘 · 공룡 머리 탈(위턱 이빨 아래로 얼굴) · 등 가시 · 뒤로 늘어진 천 → 꼬리
  오크: 피부를 진한 초록으로 · 엄니 · 뾰족 귀 · 굵은 눈썹
  언데드: 해골 얼굴(눈구멍 속 보라 불빛 · 콧구멍 · 이빨) · 갈비뼈 · 너덜너덜한 망토 끝
  나머지 다섯은 그대로 옮긴다.
    python3 tools/hero_edit.py   → art/preview_hero_final.png (원본 · 고친 것)
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, DST = os.path.join(HERE, 'sprites', 'hero_ref'), os.path.join(HERE, 'sprites', 'hero_final')
ORDER = ['knight', 'elf', 'orc', 'dragon', 'assassin', 'dino', 'wizard', 'undead']
O = (24, 18, 26, 255)
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def grid(im, g, x0, y0, pal, clear=False):
    """g: 글자 격자 · '.' 는 건드리지 않음 · '_' 는 지움"""
    px = im.load()
    for j, row in enumerate(g):
        for i, ch in enumerate(row):
            X, Y = x0 + i, y0 + j
            if not (0 <= X < im.width and 0 <= Y < im.height): continue
            if ch == '.': continue
            px[X, Y] = (0, 0, 0, 0) if ch == '_' else pal[ch]


def recolor(im, mapping, y1=None):
    px = im.load()
    for y in range(im.height if y1 is None else y1):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and '#%02x%02x%02x' % p[:3] in mapping: px[x, y] = hx(mapping['#%02x%02x%02x' % p[:3]])


def clear_rows(im, y0, y1, x0=0, x1=None):
    px = im.load()
    for y in range(y0, y1):
        for x in range(x0, x1 if x1 is not None else im.width): px[x, y] = (0, 0, 0, 0)


def pad_top(im, n):
    out = Image.new('RGBA', (im.width, im.height + n), (0, 0, 0, 0)); out.paste(im, (0, n)); return out


def fix_outline(im):
    """투명과 닿은 바깥 칸에 외곽선을 다시 두른다 (새로 그린 곳 둘레)"""
    w, h = im.size; src = im.copy().load(); px = im.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] and src[x + dx, y + dy][:3] != O[:3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[x, y] = O
    return im


# ───── 공룡 수인 ─────
DINO_COL = {  # 파랑 → 초록 비늘 (밝기 순서는 그대로)
    '#758dd6': '#6cbf5e', '#869edc': '#86d070', '#5868bb': '#4a9a4c', '#4a4e8f': '#3b7a44', '#3c3766': '#2c5a3a',
    '#96a7d8': '#a6e08a', '#7579b4': '#5aa452', '#8594cf': '#7cc866', '#28254d': '#1e3a2c', '#adb3d5': '#c8eaa8', '#e7dbdf': '#f2e2b0',
}
DP = {'O': O, 'G': hx('#6cbf5e'), 'H': hx('#a6e08a'), 'D': hx('#3b7a44'), 'd': hx('#24503a'), 's': hx('#f3a548'), 'S': hx('#c46a2c'),
      'T': hx('#fff4dc'), 'k': hx('#f4dccc'), 'K': hx('#d8b4a8'), 'e': hx('#1a1420'), 'w': hx('#ffffff'), 'y': hx('#f2e2b0')}
DINO_HEAD = [  # 18×16 · 오른쪽을 보는 공룡 머리 탈 · 위턱 이빨 아래로 아이 얼굴
    '.....O.O..........',
    '....OsOsO.O.......',
    '...OsSOsSOsO......',
    '..OGGGGGGGGGOO....',
    '.OGGHHHGGGGGGGOO..',
    '.OGHHGGGGGGGOwOGO.',
    'OGGGGGDGGGGGOeOGGO',
    'OGGDDGGGGGGGGGGGGGO',
    'OGDdDGGGGGGGGGGGGGO',
    'OGGGGTOTOTOTOTOTOO.',
    'OGGGOkkkkkkkkkkO...',
    'OGGOkkekkkkekkkO...',
    'OGDOkkekkkkekkKO...',
    '.ODOkkkkkkkkkKO....',
    '.ODDOyTOTOTOTyO....',
    '..OOOOOOOOOOOO.....',
]


def make_dino(im):
    recolor(im, DINO_COL)
    im = pad_top(im, 2)
    clear_rows(im, 0, 15)
    grid(im, DINO_HEAD, 5, 0, DP)
    # 꼬리(왼쪽 아래로 늘어진 부분) 윗선을 따라 가시 세 개
    px = im.load()
    for x in (1, 3, 5):
        for y in range(18, im.height):
            if px[x, y][3]:
                if px[x, y][:3] == O[:3] and y + 1 < im.height and px[x, y + 1][3]: px[x, y] = DP['s']; px[x, y - 1] = O if y > 0 else px[x, y - 1]
                break
    return fix_outline(im)


# ───── 오크 ─────
ORC_COL = {'#a79f81': '#7fae4a', '#aba785': '#8fc058', '#8a866d': '#5f8a3a', '#cabcae': '#b4d87a', '#775f66': '#5a3f3a', '#665659': '#4c3532'}
OP = {'O': O, 'g': hx('#8fc058'), 'G': hx('#5f8a3a'), 'T': hx('#fff4dc'), 'e': hx('#1a1420'), 'b': hx('#2e2420'), 'r': hx('#e04a3a')}


def make_orc(im):
    recolor(im, ORC_COL, 15)  # 머리 · 목만 (갑옷 색은 그대로)
    # 얼굴(9~13줄, 10~20칸)을 깨끗이: 굵은 눈썹 · 눈 · 엄니
    face = [
        'gggggggggg',
        'bbbgggbbbg',
        'geegggeegg',
        'geegggeegg',
        'gggggggggg',
        'gTggggggTg',
        'OTgggggTOO',
    ]
    grid(im, face, 11, 8, OP)
    grid(im, ['OO..', 'OgO.', 'OggO'], 7, 8, OP)     # 왼쪽 귀
    grid(im, ['..OO', '.OgO', 'OggO'], 20, 8, OP)    # 오른쪽 귀
    return fix_outline(im)


# ───── 언데드 ─────
UP = {'O': O, 'B': hx('#e8dcd0'), 'b': hx('#b8a898'), 'e': hx('#120c18'), 'v': hx('#c27aff'), 'V': hx('#f0d0ff'), 'r': hx('#d0c4b8')}


def make_undead(im):
    skull = [
        'BBBBBBBBB',
        'BeeeBbeeeB',
        'BeVeBbeVeB',
        'BeeebBeeeB',
        'BBBBeBBBBB',
        'BeBeBeBeBb',
        '.bBbBbBbb.',
    ]
    grid(im, skull, 11, 7, UP)
    # 갈비뼈 (가슴 15~17줄)
    for y in (15, 17):
        grid(im, ['rOrOrOr'], 10, y, UP)
    # 망토 끝을 너덜너덜하게
    px = im.load()
    for x, y in ((1, 25), (3, 26), (0, 23), (5, 26), (2, 24)):
        if 0 <= x < im.width and 0 <= y < im.height: px[x, y] = (0, 0, 0, 0)
    return fix_outline(im)


EDITS = {'dino': make_dino, 'orc': make_orc, 'undead': make_undead}

if __name__ == '__main__':
    os.makedirs(DST, exist_ok=True)
    before, after = {}, {}
    for rid in ORDER:
        im = Image.open(os.path.join(SRC, rid + '.png')).convert('RGBA')
        before[rid] = im.copy()
        im = EDITS[rid](im) if rid in EDITS else im
        im.save(os.path.join(DST, rid + '.png')); after[rid] = im
    S = 8; mw = max(i.width for i in after.values()) + 3; mh = max(i.height for i in list(after.values()) + list(before.values())) + 2
    prev = Image.new('RGBA', (mw * 8 * S, mh * 2 * S), (58, 84, 58, 255))
    for r, d in enumerate((before, after)):
        for k, rid in enumerate(ORDER):
            im = d[rid]; prev.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), ((k * mw + (mw - im.width) // 2) * S, (r * mh + mh - 1 - im.height) * S))
    prev.save(os.path.join(HERE, '..', 'art', 'preview_hero_final.png')); print('미리 보기: art/preview_hero_final.png')
