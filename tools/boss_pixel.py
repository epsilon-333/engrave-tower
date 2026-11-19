# 보스를 플레이어(0x72)와 같은 귀여운 도트로 새로 그린다: 큰 머리 · 작고 통통한 몸 · 짧은 다리 · 부위마다 짙은 외곽선.
# 지금은 가면 족장(b_climbChief) 기본 그림 하나만 (동작은 나중에 새로 정한다). 오른쪽을 본다.
#   python3 tools/boss_pixel.py public/assets/custom
import sys
from PIL import Image, ImageDraw

W, H = 72, 72
FOOT = 56
K = (34, 34, 34, 255)
def C(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
SKIN, SKIN_D = C('#6ab02e'), C('#46801f')
VEST, VEST_D = C('#9a5a30'), C('#6a3a1e')
BONE, BONE_D = C('#f6eed8'), C('#cfc2a0')
HOLE = C('#1a1018')
CAPE, CAPE_D = C('#d03a2c'), C('#98221c')
FEATH = [C('#2fc0b4'), C('#f09a30'), C('#fad448')]
WOOD, WOOD_D = C('#a06a3a'), C('#6a4222')
STEEL = C('#b4bac4')
CHEEK = C('#8ad04a')


def layer(fn):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fn(ImageDraw.Draw(im))
    px = im.load(); out = im.copy(); po = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3]: po[x, y] = K; break
    return out


def R(d, x0, y0, x1, y1, c): d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=c)  # x1 · y1 은 포함하지 않는다


def chief():
    """보내 주신 그림처럼 정면: 흰 깃털 머리장식(붉은 끝) · 해골 띠 · 초록 얼굴 · 엄니 · 이빨 목걸이 · 돌도끼 장대 · 붉은 망토"""
    import math
    cx, fy = 36, 66
    P = []
    # 망토 (몸 뒤)
    P.append(lambda d: (R(d, cx - 17, fy - 26, cx + 17, fy - 2, CAPE_D), R(d, cx - 13, fy - 24, cx + 13, fy - 2, CAPE)))
    # 장대 + 돌도끼 머리 + 붉은 술 (왼쪽)
    def axe(d):
        R(d, cx - 22, fy - 40, cx - 19, fy, WOOD); R(d, cx - 22, fy - 40, cx - 21, fy, WOOD_D)
        R(d, cx - 27, fy - 52, cx - 17, fy - 41, STEEL); R(d, cx - 27, fy - 52, cx - 23, fy - 41, C('#8e949e')); R(d, cx - 25, fy - 55, cx - 20, fy - 52, STEEL)
        R(d, cx - 26, fy - 38, cx - 22, fy - 30, CAPE)
    P.append(axe)
    # 다리: 짧은 초록 + 갈색 신발
    for sx in (-8, 3):
        P.append(lambda d, sx=sx: (R(d, cx + sx, fy - 9, cx + sx + 5, fy - 4, SKIN_D), R(d, cx + sx - 1, fy - 4, cx + sx + 6, fy, WOOD_D)))
    # 몸통 (작고 통통) · 허리띠 · 붉은 허리천
    def body(d):
        R(d, cx - 10, fy - 21, cx + 10, fy - 9, SKIN); R(d, cx - 10, fy - 21, cx - 7, fy - 9, SKIN_D)
        R(d, cx - 10, fy - 13, cx + 10, fy - 10, WOOD_D); R(d, cx - 4, fy - 10, cx + 4, fy - 3, CAPE_D)
    P.append(body)
    # 팔: 왼팔은 장대를 쥐고 오른팔은 내린다
    P.append(lambda d: R(d, cx - 20, fy - 20, cx - 9, fy - 15, SKIN))
    P.append(lambda d: R(d, cx + 10, fy - 20, cx + 15, fy - 10, SKIN_D))
    # 이빨 목걸이
    def neck(d):
        R(d, cx - 9, fy - 22, cx + 9, fy - 20, WOOD)
        for i in range(4): R(d, cx - 8 + i * 5, fy - 21, cx - 6 + i * 5, fy - 15, BONE)
    P.append(neck)
    # 깃털 머리장식 (머리 뒤 · 위 · 옆으로 부채꼴)
    hx, hy = cx, fy - 40
    def feathers(d):
        for ang in (-98, -72, -46, -20, 6, 32, 58, 84):
            a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); nx, ny = -uy, ux
            def at(t, w): return (hx + ux * t + nx * w, hy + uy * t + ny * w)
            d.polygon([at(9, -2), at(19, -2), at(19, 2), at(9, 2)], fill=BONE)
            d.polygon([at(19, -2), at(25, -1), at(25, 1), at(19, 2)], fill=CAPE)
    P.append(feathers)
    # 머리: 초록 · 화난 눈 · 엄니 · 뾰족 귀
    def head(d):
        R(d, hx - 13, hy - 2, hx + 13, hy + 18, SKIN); R(d, hx - 13, hy - 2, hx - 10, hy + 18, SKIN_D)
        d.polygon([(hx - 13, hy + 4), (hx - 20, hy + 1), (hx - 13, hy + 10)], fill=SKIN); d.polygon([(hx + 13, hy + 4), (hx + 20, hy + 1), (hx + 13, hy + 10)], fill=SKIN)
        R(d, hx - 9, hy + 7, hx - 5, hy + 11, HOLE); R(d, hx + 5, hy + 7, hx + 9, hy + 11, HOLE)  # 눈
        d.line([(hx - 10, hy + 4), (hx - 4, hy + 6)], fill=HOLE, width=1); d.line([(hx + 10, hy + 4), (hx + 4, hy + 6)], fill=HOLE, width=1)  # 화난 눈썹
        R(d, hx + 3, hy + 12, hx + 9, hy + 19, BONE)  # 엄니
    P.append(head)
    # 갈색 띠 + 해골 장식 (이마)
    def band(d):
        R(d, hx - 14, hy - 4, hx + 14, hy + 1, C('#7a4a2e')); R(d, hx - 14, hy - 4, hx + 14, hy - 3, WOOD_D)
        R(d, hx - 4, hy - 7, hx + 5, hy + 3, BONE); R(d, hx - 3, hy - 4, hx - 1, hy - 1, HOLE); R(d, hx + 2, hy - 4, hx + 4, hy - 1, HOLE); R(d, hx - 1, hy + 1, hx + 2, hy + 3, HOLE)
    P.append(band)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for f in P: out.alpha_composite(layer(f))
    return out


if __name__ == '__main__':
    out = sys.argv[1]
    im = chief(); im = im.crop(im.getbbox()); im.save(out + '/boss_climbChief_px.png')
    big = im.resize((im.width * 8, im.height * 8), Image.NEAREST)
    bg = Image.new('RGBA', big.size, (70, 70, 80, 255)); bg.alpha_composite(big); bg.save(out + '/boss_climbChief_px_x6.png')
    print(im.size)
