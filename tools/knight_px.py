"""기사 도트 (점 하나하나를 정해서 찍는다): 몸 · 팔 · 손 · 검 · 칼 궤적까지 프레임마다 그린다.
빛은 오른쪽 위. 외곽선은 짙은 색 1px. 칸 40×36 · 발은 맨 아래 줄 · 몸 가운데는 x=15.
    python3 tools/knight_px.py   → art/preview_knight_px.png (8배)
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 40, 36
C = {
    'O': '#18121a',
    'W': '#fbf6fa', 'L': '#dcd0dc', 'M': '#ac9bb2', 'D': '#6f5e7e', 'P': '#43375a',   # 은빛 강철 (빛 → 그늘)
    'B': '#8597f2', 'b': '#5466d4', 'n': '#2e3384',                                    # 파란 깃털 · 목도리
    's': '#f6dccf', 'S': '#d9a99c', 'e': '#18121a',                                    # 얼굴 · 눈
    'g': '#f4c65c', 'G': '#a9742c', 'k': '#2c2639', 'K': '#4a4160',                     # 금 · 장화
    'X': '#ffffff', 'x': '#c8e4ff', 'y': '#8fb8ec',                                    # 칼 궤적 (흰 · 하늘 · 파랑)
}


class Canvas:
    def __init__(self): self.p = [[None] * W for _ in range(H)]
    def set(self, x, y, c):
        if 0 <= x < W and 0 <= y < H: self.p[y][x] = c
    def grid(self, rows, x0, y0):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in '. ': self.set(x0 + i, y0 + j, ch)
    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            for dx in range(w):
                for dy in range(w): self.set(x + dx - w // 2, y + dy - w // 2, c)
    def outline(self):
        """칠한 것 바깥 둘레에 외곽선 (이미 외곽선이 있는 곳은 그대로)"""
        src = [r[:] for r in self.p]
        for y in range(H):
            for x in range(W):
                if src[y][x]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < W and 0 <= Y < H and src[Y][X] and src[Y][X] != 'O': self.p[y][x] = 'O'; break
    def image(self):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
        for y in range(H):
            for x in range(W):
                c = self.p[y][x]
                if c: px[x, y] = tuple(int(C[c][k:k + 2], 16) for k in (1, 3, 5)) + (255,)
        return im


# ───── 머리 (17×17): 둥근 투구 · 앞이 트인 얼굴 · 세로로 긴 두 눈 · 귀 덮개 · 뒤로 휘는 깃털 ─────
HEAD = [
    '.........OOOO....',
    '......OOOBBBbO...',
    '....OOBBBbbbnO...',
    '..OOBbbbnnOOOOO..',
    '.OBbbnnOOMLLLWWO.',
    'ObbnnOOMLLLLLWWWO',
    'OnnOOMMLLLLLLLWWO',
    '.OOOMMMLLLLLLLLLO',
    '...ODMMLLLLLLLLLO',
    '...ODMMLOOOOOOOLO',
    '...ODMDOssssssOLO',
    '...OPDDOsesssesO.',
    '...OPDDOsesssesO.',
    '...OPDDOsesssesO.',
    '....OPDOSssssSOO.',
    '....OOPOOSSSSOO..',
    '......OOOOOOOO...',
]
# 몸통 (11×7): 은빛 가슴판(오른쪽 위가 밝다) · 금 허리띠 · 허리 갑옷
TORSO = [
    '.OOOOOOOOO.',
    'OMMLLLWWLMO',
    'ODMLLLWLLMO',
    'ODMMLLLLMDO',
    'OGgggGgggGO',
    'ODMMDOMMDDO',
    '.OOOO.OOOO.',
]
# 목도리: 목에 감기는 부분 (13×3)
SCARF = [
    '.OOOOOOOOOOO.',
    'ObBBBBBBBBbnO',
    '.OnbbbbbbbnO.',
]
# 목도리 끝: 등 뒤로 길게 늘어진다 (오른쪽 위가 목에 붙는다)
TAIL = {
    'hang': ['...OO', '..ObO', '..ObO', '.ObnO', '.ObnO', 'ObbnO', 'OBbO.', 'OBnO.', 'OOO..'],
    'blow': ['.....OO', '...OObO', '..ObbnO', '.OBbnO.', 'OBbnO..', 'OBnO...', 'OOO....'],
    'fly':  ['.........OO', '......OOObO', '...OOBBbbnO', '.OOBbbbnnO.', 'OBbbnnOOO..', '.OOOO......'],
}


def legs(cv, x, y, back, front):
    """다리 둘: (발 앞뒤 칸, 들림). 허벅지 → 정강이 → 장화 (장화 앞코는 앞쪽으로)"""
    for (fx, lift), dark in ((back, True), (front, False)):
        hx = x + (1 if dark else 5)
        top, bot = y, 33 - lift
        for j in range(bot - top + 1):
            yy = top + j; xx = hx + round(fx * j / max(1, bot - top))
            fill = ('D', 'P') if dark else ('L', 'M')
            cv.set(xx, yy, 'O'); cv.set(xx + 1, yy, fill[0]); cv.set(xx + 2, yy, fill[1]); cv.set(xx + 3, yy, 'O')
        bx = hx + fx
        cv.grid(['OkkkO', 'OKkkkO', 'OOOOOO'], bx, 33 - lift)


def arm(cv, sx, sy, ex, ey, hx, hy):
    """앞팔: 어깨 → 팔꿈치 → 손. 3칸 굵기 갑옷 · 외곽선은 나중에 한 번에"""
    cv.line(sx, sy, ex, ey, 'D', 2); cv.line(sx + 1, sy - 1, ex + 1, ey - 1, 'M', 1)   # 위팔 (2칸 · 윗면에 빛)
    cv.line(ex, ey, hx, hy, 'M', 2); cv.line(ex + 1, ey - 1, hx + 1, hy - 1, 'L', 1)   # 아래팔
    cv.grid(['WL', 'LM'], hx, hy - 1)  # 장갑 낀 주먹


def sword(cv, hx, hy, dx, dy, n=13):
    """검: 손(hx, hy)에서 (dx, dy) 방향으로. 자루 · 금 손잡이 막이 · 2칸 칼날(빛 쪽이 밝다) · 끝은 가늘게"""
    import math
    l = math.hypot(dx, dy); ux, uy = dx / l, dy / l; px_, py_ = -uy, ux
    cv.set(round(hx - ux), round(hy - uy), 'G')  # 자루 끝 (주먹 뒤)
    for k in (-2, -1, 1, 2):  # 손잡이 막이 (주먹 바로 앞 · 칼과 직각)
        cv.set(round(hx + ux * 2 + px_ * k), round(hy + uy * 2 + py_ * k), 'g' if abs(k) == 1 else 'G')
    for i in range(2, n):
        x, y = hx + ux * i, hy + uy * i
        cv.set(round(x), round(y), 'W' if i < n - 1 else 'L')
        if i < n - 2: cv.set(round(x + px_), round(y + py_), 'L' if i % 3 else 'M')


def smear(cv, cx, cy, r, a0, a1, thick=3):
    """칼 궤적: 중심(cx, cy) 반지름 r 인 초승달 (a0 → a1, 끝으로 갈수록 가늘고 흐리다)"""
    import math
    steps = int(abs(a1 - a0) * r * 1.6) + 1
    for i in range(steps + 1):
        t = i / steps; a = a0 + (a1 - a0) * t
        w = max(1, round(thick * (0.35 + 0.65 * t)))  # 앞(칼이 지금 있는 쪽)이 두껍다
        for k in range(w):
            rr = r - k
            cv.set(round(cx + math.cos(a) * rr), round(cy + math.sin(a) * rr), 'X' if k == 0 and t > 0.3 else 'x' if k < 2 else 'y')


def knight(pose):
    cv = Canvas()
    dx, dy, hd = pose.get('dx', 0), pose.get('dy', 0), pose.get('hd', 0)
    tx, ty = 10 + dx, 22 + dy                 # 몸통 왼쪽 위
    if pose.get('smear_back'): smear(cv, *pose['smear_back'])
    if pose.get('sword_back'): sword(cv, *pose['sword_back'])
    cv.grid(TAIL[pose.get('tail', 'hang')], tx - len(TAIL[pose.get('tail', 'hang')][0]) + 2, ty)
    legs(cv, tx, ty + 6, *pose['legs'])
    cv.grid(['OO', 'DO', 'DO', 'OO'], tx - 1, ty + 2)  # 등 뒤 팔 (조금 보인다)
    cv.grid(TORSO, tx, ty)
    cv.grid(HEAD, tx - 4 + hd, ty - 16 + pose.get('hdy', 0))
    cv.grid(SCARF, tx - 1, ty - 1)
    sh = (tx + 8, ty + 2)                     # 앞팔 어깨
    if pose.get('arm'):
        (ex, ey), (hx, hy) = pose['arm']
        arm(cv, sh[0], sh[1], sh[0] + ex, sh[1] + ey, sh[0] + hx, sh[1] + hy)
        if pose.get('sword'): sword(cv, sh[0] + hx, sh[1] + hy, *pose['sword'])
    if pose.get('smear'): s = pose['smear']; smear(cv, sh[0] + s[0], sh[1] + s[1], *s[2:])
    cv.outline()
    return cv.image()


STAND = ((-1, 0), (1, 0))
FRAMES = [
    # 서기: 칼을 앞으로 낮게 들고 칼끝은 앞 위
    ('서기', dict(legs=STAND, arm=((2, 3), (4, 5)), sword=(3, -2, 12))),
    # 1 치켜듦: 몸을 낮추고 뒤로 비틀며, 칼을 머리 위 뒤쪽으로 높이 든다
    ('치켜듦', dict(legs=((-3, 0), (2, 0)), dx=-1, dy=1, hd=-1, tail='blow', arm=((2, -4), (4, -9)), sword=(-2, -3, 13))),
    # 2 내려치기 시작: 몸을 앞으로 던지며 칼이 머리 위를 지나 앞으로
    ('내려치기', dict(legs=((-3, 0), (3, 0)), dx=0, hd=1, tail='blow', arm=((4, -4), (8, -7)), sword=(3, -2, 13), smear=(1, 1, 13, -2.0, -0.9, 3))),
    # 3 맞는 순간: 깊이 디디고 팔을 앞으로 쭉 뻗어 칼이 앞 아래로 · 큰 초승달 궤적
    ('맞는 순간', dict(legs=((-5, 0), (4, 0)), dx=1, dy=2, hd=2, tail='fly', arm=((5, 1), (10, 4)), sword=(3, 2, 13), smear=(3, 1, 15, -1.55, 0.55, 4))),
    # 4 따라가기: 칼끝이 아래로 지나가고 궤적은 옅어진다
    ('따라가기', dict(legs=((-5, 0), (4, 0)), dx=1, dy=2, hd=1, tail='fly', arm=((4, 3), (7, 7)), sword=(2, 3, 12), smear=(3, 1, 14, 0.0, 1.0, 2))),
    # 5 돌아오기
    ('돌아오기', dict(legs=((-2, 0), (2, 0)), dy=1, tail='blow', arm=((3, 3), (5, 5)), sword=(3, -1, 12))),
]

if __name__ == '__main__':
    S, gap = 8, 2
    ims = [knight(p) for _, p in FRAMES]
    out = Image.new('RGBA', (len(ims) * (W + gap) * S, (H + 2) * S), (58, 84, 58, 255))
    for i, im in enumerate(ims): out.alpha_composite(im.resize((W * S, H * S), Image.NEAREST), (i * (W + gap) * S, S))
    p = os.path.join(HERE, '..', 'art', 'preview_knight_px.png'); out.save(p); print('미리 보기:', p)
