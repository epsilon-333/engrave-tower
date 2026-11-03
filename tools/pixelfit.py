"""그림체 맞추기: 사용자 시트에서 잘라 낸 큰 그림(용 · 정령왕)을 게임의 다른 도트와 같은 규칙으로 다시 찍는다.
  1) 픽셀 격자: 게임에 그려질 크기(scale)로 한 번에 줄여 1:1 픽셀로 (그릴 때 어중간한 배율로 늘리고 줄이지 않게)
  2) 반투명 정리: 반쯤 투명한 가장자리는 버리거나 채운다 (경계가 또렷하게)
  3) 색 줄이기: 시트 전체를 한 팔레트(기본 28색)로 묶는다 — 재질은 남고 번진 중간색만 사라진다
  4) 외곽선: 다른 캐릭터와 같은 짙은 색 1픽셀
사용: python3 tools/pixelfit.py king_fire [색 수=28] [--preview 경로]
     입력 public/assets/custom/{이름}.png + tools/sprites/sheet_meta.json → 같은 파일에 덮어쓰고 meta의 scale을 1로
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CUSTOM = os.path.join(HERE, '..', 'public', 'assets', 'custom')
OUTLINE = (20, 14, 18, 255)  # creatures.py · people.py 와 같은 외곽선 색

def fit_frame(fr, scale, pal_img=None, colors=28):
    w, h = fr.size
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    # 색은 미리 곱한 알파로 줄인다 (투명한 배경색이 가장자리에 번지지 않게)
    small = fr.resize((nw, nh), Image.BOX)
    px = small.load()
    for y in range(nh):
        for x in range(nw):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    return small

def outline(im):
    w, h = im.size; src = im.load(); out = im.copy(); o = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] and src[x + dx, y + dy] != OUTLINE for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = OUTLINE
    return out

def quantize_sheet(frames, colors):
    # 시트 전체 불투명 픽셀로 팔레트 하나를 만든다
    tot = sum(f.size[0] * f.size[1] for f in frames)
    strip = Image.new('RGBA', (tot, 1))
    sp = strip.load(); i = 0
    for f in frames:
        for p in (f.get_flattened_data() if hasattr(f, 'get_flattened_data') else f.getdata()):
            if p[3]: sp[i, 0] = p; i += 1
    pal = strip.crop((0, 0, max(1, i), 1)).convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for f in frames:
        rgb = f.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
        q = Image.new('RGBA', f.size, (0, 0, 0, 0)); qp = q.load(); rp = rgb.load(); fp = f.load()
        for y in range(f.size[1]):
            for x in range(f.size[0]):
                if fp[x, y][3]: qp[x, y] = rp[x, y] + (255,)
        out.append(q)
    return out

def run(name, colors=28, write=True):
    metaf = os.path.join(HERE, 'sprites', 'sheet_meta.json')
    allm = json.load(open(metaf, encoding='utf-8'))
    m = allm[name]; scale = m.get('scale', 1)
    sheet = Image.open(os.path.join(CUSTOM, name + '.png')).convert('RGBA')
    W, H = m['w'], m['h']
    keys, frames = [], []
    for anim, a in m['anims'].items():
        for i in range(a['n']):
            keys.append((anim, a['row'], i)); frames.append(fit_frame(sheet.crop((i * W, a['row'] * H, (i + 1) * W, (a['row'] + 1) * H)), scale))
    frames = [outline(f) for f in quantize_sheet(frames, colors)]
    nw, nh = frames[0].size
    rows = max(a['row'] for a in m['anims'].values()) + 1; cols = max(a['n'] for a in m['anims'].values())
    out = Image.new('RGBA', (cols * nw, rows * nh), (0, 0, 0, 0))
    for (anim, row, i), f in zip(keys, frames): out.paste(f, (i * nw, row * nh))
    if write:
        out.save(os.path.join(CUSTOM, name + '.png'))
        m['w'], m['h'], m['scale'], m['fit'] = nw, nh, 1, colors
        if 'stride' in m: m['stride'] = {k: round(v * scale, 2) for k, v in m['stride'].items()}  # 보폭도 게임 크기로 (그릴 때 scale을 곱하던 것)
        json.dump(allm, open(metaf, 'w', encoding='utf-8'), ensure_ascii=False)
        from sprites import build_manifest; build_manifest()
    return out, (nw, nh), (W, H, scale)

if __name__ == '__main__':
    argv = sys.argv[1:]; prev = None
    if '--preview' in argv: k = argv.index('--preview'); prev = argv[k + 1]; argv = argv[:k] + argv[k + 2:]
    args = argv
    name = args[0]; colors = int(args[1]) if len(args) > 1 else 28
    out, size, orig = run(name, colors, write=not prev)
    if prev: out.save(prev)
    print(name, '→', size, '(원래', orig, ')')
