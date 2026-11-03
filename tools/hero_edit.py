"""참고 그림에서 따낸 도트(tools/sprites/hero_ref/*.png)를 종족답게 고친다 → tools/sprites/hero_final/*.png
원칙: 원래 그림의 얼굴 위치 · 모양 · 명암은 그대로. 색은 「색조만 돌려」 명암 단계를 살리고, 새로 찍는 점은 그 캐릭터가 이미 쓰는 색으로.
  공룡 수인: 파랑 → 초록(파충류 얼굴 · 비늘) · 입과 작은 이빨 · 앞으로 나온 주둥이 · 머리 가시 끝 주황 · 꼬리 가시
  오크: 올리브 피부(얼굴 · 손)를 조금 더 초록으로 · 엄니 · 뾰족 귀
  언데드: 눈구멍 속 보라 불빛 · 이빨
    python3 tools/hero_edit.py   → art/preview_hero_final.png (윗줄 원래 · 아랫줄 고친 것)
"""
import colorsys, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, DST = os.path.join(HERE, 'sprites', 'hero_ref'), os.path.join(HERE, 'sprites', 'hero_final')
ORDER = ['knight', 'elf', 'orc', 'dragon', 'assassin', 'dino', 'wizard', 'undead']
O = (24, 18, 26, 255)


def hsv(p): return colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
def rgb(h, s, v): r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v))); return (round(r * 255), round(g * 255), round(b * 255), 255)


def hue_shift(im, lo, hi, to, sat=1.0, val=1.0, min_s=0.12, box=None):
    """색조가 lo~hi(도) 인 점을 to(도) 쪽으로 · 같은 비율로 (명암 단계 그대로)"""
    px = im.load(); x0, y0, x1, y1 = box or (0, 0, im.width, im.height)
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = px[x, y]
            if not p[3]: continue
            h, s, v = hsv(p)
            if s < min_s or not (lo <= h * 360 <= hi): continue
            px[x, y] = rgb(to / 360 + (h * 360 - (lo + hi) / 2) / 360 * 0.5, s * sat, v * val)


def colors_of(im):
    px = im.load(); out = set()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and px[x, y][:3] != O[:3]: out.add(px[x, y][:3])
    return sorted(out, key=lambda c: sum(c))


def near(cols, want):
    """그 캐릭터가 쓰는 색 중 want 와 가장 가까운 것"""
    return min(cols, key=lambda c: sum((a - b) ** 2 for a, b in zip(c, want))) + (255,)


def put(im, pts, col):
    px = im.load()
    for x, y in pts:
        if 0 <= x < im.width and 0 <= y < im.height: px[x, y] = col


def fix_outline(im):
    """투명과 닿은 바깥 칸에 외곽선 (새로 붙인 점 둘레)"""
    w, h = im.size; src = im.copy().load(); px = im.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] and src[x + dx, y + dy][:3] != O[:3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[x, y] = O
    return im


def make_dino(im):
    hue_shift(im, 200, 260, 112, sat=0.95)  # 파랑 → 초록 (얼굴 · 머리 가시 · 꼬리)
    cols = colors_of(im)
    light, mid, dark = near(cols, (175, 230, 150)), near(cols, (110, 190, 100)), near(cols, (40, 90, 60))
    cream = near(cols, (245, 240, 225))
    put(im, [(24, 10), (24, 11), (24, 12)], mid)  # 주둥이가 앞으로 한 칸
    put(im, [(24, 9)], O); put(im, [(25, 10), (25, 11), (25, 12)], O); put(im, [(24, 13)], O)
    px = im.load()
    for y in range(12, 17):  # 사람 같던 흰 턱 → 연한 노란 배 색 (파충류의 아래턱)
        for x in range(13, 23):
            p = px[x, y]
            if p[3]:
                h, s2, v = hsv(p)
                if v > 0.8 and s2 < 0.2: px[x, y] = (232, 232, 168, 255) if v > 0.9 else (196, 200, 132, 255)
    put(im, [(17, 13), (19, 13), (21, 13)], (255, 250, 236, 255)); put(im, [(18, 13), (20, 13)], O)  # 입: 작은 이빨
    orange, orange2 = (243, 165, 72, 255), (200, 106, 44, 255)
    px = im.load()
    for x in range(im.width):  # 머리 위 가시 끝(맨 위 칠한 점) → 주황
        for y in range(0, 6):
            if px[x, y][3] and px[x, y][:3] != O[:3]: px[x, y] = orange if (x + y) % 2 else orange2; break
    for x in (1, 3, 5):  # 꼬리 윗선 가시
        for y in range(18, im.height):
            if px[x, y][3]:
                if px[x, y][:3] == O[:3] and y + 1 < im.height and px[x, y + 1][3]: px[x, y] = orange
                break
    return fix_outline(im)


def make_orc(im):
    hue_shift(im, 35, 75, 90, sat=1.7, min_s=0.08)  # 올리브 피부(얼굴 · 손) → 조금 더 초록, 같은 비율로
    cols = colors_of(im)
    tusk = (242, 234, 210, 255); skin = near(cols, (150, 175, 95)); skin2 = near(cols, (110, 135, 70))  # 엄니는 상아색 (초록으로 돌린 색 중에서 고르면 피부와 같아져 안 보였다)
    # 아래턱에서 솟아 바깥으로 휘는 큰 엄니 (2칸 굵기 · 4줄 높이 · 안쪽 밝게 · 바깥 그늘 · 외곽선)
    t1, t2 = tusk, (196, 184, 150, 255)
    L = {(12, 17): t1, (13, 17): t1, (11, 16): t2, (12, 16): t1, (11, 15): t2, (12, 15): t1, (11, 14): t1, (11, 13): t1}
    for (x, y), c in L.items(): put(im, [(x, y)], c); put(im, [(23 - x + 7, y)], t2 if c == t1 else t1)  # 오른쪽은 거울로 (가운데 15.5)
    put(im, [(10, 13), (10, 14), (10, 15), (10, 16), (11, 12), (12, 13), (12, 14), (11, 17), (12, 18), (13, 18)], O)
    put(im, [(30 - x, y) for x, y in [(10, 13), (10, 14), (10, 15), (10, 16), (11, 12), (12, 13), (12, 14), (11, 17), (12, 18), (13, 18)]], O)
    put(im, [(7, 11), (6, 10), (7, 10)], skin2); put(im, [(8, 11)], skin)  # 왼쪽 뾰족 귀 (뒤로)
    return fix_outline(im)


def make_undead(im):
    px = im.load(); cols = colors_of(im)
    glow, glow2 = (196, 122, 255, 255), (240, 208, 255, 255)
    # 눈구멍(얼굴 가운데의 검은 세로 줄) 안에 보라 불빛
    eyes = [(x, y) for y in range(8, 14) for x in range(11, 21) if px[x, y][3] and px[x, y][:3] == O[:3]]
    for x in sorted({e[0] for e in eyes}):
        col = [e for e in eyes if e[0] == x]
        if len(col) >= 2: px[x, col[len(col) // 2][1]] = glow; px[x, col[len(col) // 2][1] - 1] = glow2
    bone = near(cols, (225, 215, 220))
    put(im, [(14, 15), (16, 15), (18, 15)], bone); put(im, [(15, 15), (17, 15)], O)  # 이빨
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
