"""참고 그림(art/source/ref_heroes_8.png · 8종족을 크게 늘려 그린 도트)에서 진짜 도트를 따낸다.
  1) 4×2 칸으로 나눠 캐릭터마다 자른다 (검은 배경)
  2) 캐릭터마다 픽셀 격자(한 도트 ≈ 12px)의 크기 · 시작점을 찾는다: 칸 안의 색이 가장 고르게 되는 것
  3) 칸마다 가운데 쪽 색의 중앙값을 그 도트의 색으로 · 배경(검정)은 투명
  4) 종족 전체를 한 팔레트로 묶고(번진 중간색 정리), 짙은 외곽선 1px
결과: tools/sprites/hero_ref/{종족}.png (1:1) · art/preview_hero_ref.png (8배 미리 보기)
    python3 tools/hero_ref.py
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art', 'source', 'ref_heroes_8.png')
OUTD = os.path.join(HERE, 'sprites', 'hero_ref')
ORDER = [['knight', 'elf', 'orc', 'dragon'], ['assassin', 'dino', 'wizard', 'undead']]
OUTLINE = (24, 18, 26)


def grid_fit(a, p):
    """a: H×W×3. 격자 크기 p 근처 · 시작점을 바꿔 가며 칸 안의 색 흩어짐이 가장 작은 것"""
    best = None
    for pp in np.arange(p - 0.6, p + 0.61, 0.1):
        for ox in np.arange(0, pp, pp / 6):
            for oy in np.arange(0, pp, pp / 6):
                xs = np.arange(ox + pp / 2, a.shape[1], pp).astype(int)
                ys = np.arange(oy + pp / 2, a.shape[0], pp).astype(int)
                # 칸 가운데와 그 둘레 (가운데에서 p/4) 색 차이
                q = int(pp / 4)
                xs2 = np.clip(xs + q, 0, a.shape[1] - 1); ys2 = np.clip(ys + q, 0, a.shape[0] - 1)
                c = a[np.ix_(ys, xs)]; n = a[np.ix_(ys2, xs2)]
                err = np.abs(c - n).sum()
                if best is None or err < best[0]: best = (err, pp, ox, oy)
    return best[1:]


def sample(a, pp, ox, oy):
    xs = np.arange(ox, a.shape[1] - pp / 2, pp); ys = np.arange(oy, a.shape[0] - pp / 2, pp)
    out = np.zeros((len(ys), len(xs), 4), np.uint8)
    r = max(1, int(pp * 0.28))
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            cy, cx = int(y + pp / 2), int(x + pp / 2)
            blk = a[max(0, cy - r):cy + r + 1, max(0, cx - r):cx + r + 1].reshape(-1, 3)
            col = np.median(blk, 0)
            if col.sum() < 70: continue  # 검은 배경
            out[j, i, :3] = col; out[j, i, 3] = 255
    return out


def trim(px):
    ys, xs = np.where(px[:, :, 3] > 0)
    return px[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def outline(px):
    h, w = px.shape[:2]
    out = np.zeros((h + 2, w + 2, 4), np.uint8); out[1:-1, 1:-1] = px
    a = out[:, :, 3] > 0
    ring = np.zeros_like(a)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ring |= np.roll(np.roll(a, dy, 0), dx, 1)
    ring &= ~a
    out[ring] = (*OUTLINE, 255)
    # 아주 어두운 가장자리 색은 외곽선 색으로 맞춘다
    dark = a & (out[:, :, :3].sum(2) < 110)
    out[dark] = (*OUTLINE, 255)
    return out


def despeck(px, keep=6):
    """몸에서 떨어진 작은 점(도트 6개 미만 덩어리)을 지운다"""
    a = px[:, :, 3] > 0; h, w = a.shape; seen = np.zeros_like(a)
    for y in range(h):
        for x in range(w):
            if not a[y, x] or seen[y, x]: continue
            st, comp = [(y, x)], []; seen[y, x] = True
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
            if len(comp) < keep:
                for cy, cx in comp: px[cy, cx, 3] = 0
    return trim(px)


def quantize(imgs, colors=40):
    """여러 그림을 한 팔레트로"""
    strip = np.concatenate([im.reshape(-1, 4) for im in imgs])
    opaque = strip[strip[:, 3] > 0][:, :3]
    pal_img = Image.fromarray(opaque.reshape(1, -1, 3)).quantize(colors, method=Image.Quantize.MEDIANCUT)
    out = []
    for im in imgs:
        rgb = Image.fromarray(np.ascontiguousarray(im[:, :, :3])).quantize(palette=pal_img, dither=Image.Dither.NONE).convert('RGB')
        q = np.dstack([np.asarray(rgb), im[:, :, 3]])
        out.append(q)
    return out


if __name__ == '__main__':
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    res = {}
    for r, row in enumerate(ORDER):
        for c, rid in enumerate(row):
            cell = a[r * H // 2:(r + 1) * H // 2, c * W // 4:(c + 1) * W // 4]
            m = cell.sum(2) > 70
            ys, xs = np.where(m)
            crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            pp, ox, oy = grid_fit(crop, 12.0)
            px = trim(sample(crop, pp, ox, oy))
            res[rid] = px
            print(f'{rid:9s} 격자 {pp:.2f}px · 도트 {px.shape[1]}×{px.shape[0]}')
    q = [despeck(quantize([im], 16)[0]) for im in res.values()]  # 캐릭터마다 16색 (한 팔레트로 묶으면 초록이 회색으로 뭉개졌다)
    os.makedirs(OUTD, exist_ok=True)
    for (rid, _), im in zip(res.items(), q):
        Image.fromarray(outline(im)).save(os.path.join(OUTD, rid + '.png'))
    # 미리 보기: 8배 · 발을 맞춰 나란히
    ims = {rid: Image.open(os.path.join(OUTD, rid + '.png')) for rid in res}
    S, mw, mh = 8, max(i.width for i in ims.values()), max(i.height for i in ims.values())
    prev = Image.new('RGBA', ((mw + 3) * 8 * S, (mh + 2) * S), (58, 84, 58, 255))
    for k, (rid, im) in enumerate(ims.items()):
        prev.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), ((k * (mw + 3) + (mw - im.width) // 2) * S, (mh - im.height + 1) * S))
    prev.save(os.path.join(HERE, '..', 'art', 'preview_hero_ref.png')); print('미리 보기: art/preview_hero_ref.png')
