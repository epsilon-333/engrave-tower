# 불 용인족: 0x72 도마뱀(CC0)과 같은 네모진 그림체. 붉은 비늘 · 금빛 배 · 뿔 두 개 · 불꽃 꼬리 (날개 없음). 동작: 서기 · 달리기 · 비상(뛰어오름)
import os, sys, json
from PIL import Image, ImageDraw
from sprites import meta_path, build_manifest

W, H = 34, 28
OX = 9  # 도마뱀 그림(16칸)을 놓는 왼쪽 여백: 왼쪽엔 날개 · 꼬리 불꽃이 나온다
K = (34, 34, 34, 255)
X72 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', '0x72')
_sheet = Image.open(os.path.join(X72, 'sheet.png')).convert('RGBA')
_tl = {l.split()[0]: list(map(int, l.split()[1:5])) for l in open(os.path.join(X72, 'tile_list.txt'), encoding='utf-8') if len(l.split()) >= 5}


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
def dark(h, k):
    return '#%02x%02x%02x' % tuple(int(int(h[i:i + 2], 16) * (1 - k)) for i in (1, 3, 5))


def frame(kind, i, scale='#d8442a', cloth='#6a3a2a', belly='#f6c262', wing=None, up=0, wings='fold', flame=True):
    """kind: idle · run (도마뱀 4칸) · soar (달리기 그림 + 날개 펼침). 16칸 도마뱀을 34 x 28 칸 가운데에 놓는다."""
    wing = wing or dark(scale, 0.12)
    nm = f"lizard_m_{'run' if kind == 'soar' else kind}_anim_f{i % 4}"
    x, y, w, h = _tl[nm]
    liz = _sheet.crop((x, y, x + w, y + h)); px = liz.load()
    swap = {rgb('#4ba747'): rgb(scale), rgb('#3d734f'): rgb(dark(scale, 0.3)), rgb('#d3bfa9'): rgb(belly), rgb('#775c55'): rgb(cloth), rgb('#483b3a'): rgb(dark(cloth, 0.4)), rgb('#314152'): rgb(dark(scale, 0.45))}
    for yy in range(h):
        for xx in range(w):
            if px[xx, yy][3] and px[xx, yy] in swap: px[xx, yy] = swap[px[xx, yy]]
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    top = next(yy for yy in range(h) if px[8, yy][3]) - up  # 정수리
    d = ImageDraw.Draw(out)
    out.alpha_composite(liz, (OX, -up))
    o = out.load()
    bone, bone_d = (248, 224, 160, 255), (200, 170, 110, 255)
    for hx in (OX + 4, OX + 9):  # 뿔 두 개: 정수리 위로 세 칸씩
        o[hx, top - 3] = K
        for r in (-2, -1):
            o[hx, top + r] = bone; o[hx - 1, top + r] = K; o[hx + 1, top + r] = K
        o[hx, top - 1] = bone_d
    if flame:  # 꼬리: 비늘색 꼬리 끝에 불꽃 (프레임마다 일렁인다)
        pat = (['.o....', 'oyo.kk', 'oyosss', '.okkkk'], ['..o...', '.oyo.k', 'oyosss', '.okkkk'])[i % 2]
        col = {'o': (255, 150, 40, 255), 'y': (255, 232, 100, 255), 'k': K, 's': rgb(scale)}
        for j, row in enumerate(pat):
            for k, ch in enumerate(row):
                if ch != '.': o[OX - 3 + k, H - 9 - up + j] = col[ch]
    return out


def sheet_frames(**kw):
    return {'idle': [frame('idle', i, **kw) for i in range(4)], 'run': [frame('run', i, **kw) for i in range(4)],
            'soar': [frame('soar', i, up=2, **kw) for i in range(4)]}


if __name__ == '__main__':
    out = sys.argv[1]
    fr = sheet_frames()
    img = Image.new('RGBA', (4 * W, 3 * H), (0, 0, 0, 0))
    meta = {}
    for r, name in enumerate(('idle', 'run', 'soar')):
        for c, im in enumerate(fr[name]): img.alpha_composite(im, (c * W, r * H))
        meta[name] = {'row': r, 'n': 4}
    img.save(out + '/dragonkin.png')
    json.dump({'w': W, 'h': H, 'anims': meta}, open(meta_path('dragonkin'), 'w'))
    build_manifest(out)
    print(meta)
