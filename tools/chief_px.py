# 가면 족장 도트: 장면마다 한 칸씩 손으로 찍은 그림 (자동 변환 없음)
# 색 12가지 (+ 투명 '.') — 원본 시트(art/source/sheet_chief_motion.webp)에서 고른 색
#   python tools/chief_px.py [미리보기.png]
import sys
from PIL import Image

PAL = {
    'K': (30, 22, 26),     # 외곽선 · 눈
    'R': (204, 64, 60),    # 깃털 빨강
    'r': (128, 38, 46),    # 짙은 빨강 (망토 · 깃털 그늘)
    'W': (250, 232, 206),  # 깃털 · 해골 크림
    'w': (206, 178, 146),  # 크림 그늘
    'B': (96, 54, 44),     # 머리띠 · 허리띠 짙은 갈색
    'b': (156, 100, 62),   # 창대 나무
    'G': (104, 196, 72),   # 피부 초록
    'g': (60, 132, 52),    # 피부 그늘
    'S': (222, 218, 226),  # 창날 밝은 쇠
    's': (146, 140, 156),  # 창날 그늘
    'h': (66, 40, 40),     # 머리카락 · 가면 그늘
}

FRAMES = {}

# 선 자세 (오른쪽을 본다 · 창은 왼손에 곧게 세운다) 32 × 28
FRAMES['stand'] = '''
.................KK...KK.........
............KK..KRRK.KWWK.KK.....
...........KRRK.KRWWKKWRRKKRRK...
....KK....KRRWWKKRWWKWWRRKRRRK...
...KSSK...KRRWWKRRWWRWWRRRWRRK...
..KSSSSK.KRRRWWRRWWWWWRRRWWRRRK..
..KSsSSK.KRRWWWWWWWWWWWWWWRRRRK..
...KSsK.KRRWWWhhhhhhhWWWWWWWRRRK.
....KbK.KRWWhBBBBBBBBWWWWWBBWRRK.
...KRbRKKRWhBBBBBBBBWKWKWBBBWRK..
..KRRbRRKKKBBBBBBBBBWWWWWBBBBWK..
.KRRRbRRRKKhGGGGGGGGKWKWKGGGGKK..
.KRRRbRRK.KGGGGGGGGGGGGGGGGGGGK..
..KKKbKK..KGGGGGGGKKGGGGKKGGGGK..
.....bK...KgGGGGGGKKGGGGKKGGGGK..
....KbK...KgGGGGGGKKGGGGKKGGGGK..
....KbK...KggGGGGGGGGGGGGGGGGGK..
....KbK....KggGGGGGGGGGGwwGGGK...
...KrbK.....KKggGGGGGGGGGGGKK....
..KrrbKK...KRRKKKKKKKKKKKKKK.....
..KrrbGGK.KRRrKWKWKWKWKWKGGK.....
.KrrrbGGGKKRrrKwWWWWWWWWKGGgK....
.KrrrbKGGGKKrrBBBBBBBBBBKKgK.....
KrrrrbK.KKKKrrBBbBBBBbBBK.KK.....
KrrrKbK....KKrrKGGGKKGGGK........
.KKK.bK.....KKKKGGgKKGGgK........
.....bK.........KBBBKKBBBK.......
.....KK.........KKKKKKKKKK.......
'''


def grid(txt):
    rows = [r for r in txt.strip('\n').split('\n')]
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]


def image(txt):
    g = grid(txt); im = Image.new('RGBA', (len(g[0]), len(g)), (0, 0, 0, 0)); px = im.load()
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c != '.': px[x, y] = PAL[c] + (255,)
    return im


if __name__ == '__main__' and len(sys.argv) > 1:
    out = sys.argv[1]; s = 12; ims = [image(t) for t in FRAMES.values()]
    W = sum(i.width + 2 for i in ims); H = max(i.height for i in ims)
    sheet = Image.new('RGBA', (W * s, H * s), (60, 60, 72, 255)); x = 0
    for i in ims: sheet.alpha_composite(i.resize((i.width * s, i.height * s), Image.NEAREST), (x * s, 0)); x += i.width + 2
    sheet.save(out)
