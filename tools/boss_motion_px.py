# 보스 도트 한 장으로 플레이어(0x72)처럼 단순한 모션을 만든다: 그림을 조각내 돌리지 않고, 몸 · 창 · 다리를 칸 단위로만 옮긴다.
#   서기: 몸이 한 칸 내려앉았다 올라온다 / 걷기: 발을 한 칸씩 번갈아 들고 든 장면에서만 몸이 한 칸 뜬다
#   공격: 창을 들어 올렸다가 내리찍으며 몸이 내려앉는다 / 기술(포효): 창을 높이 들고 몸이 떤다
#   맞음: 뒤로 밀리며 움츠린다 / 쓰러짐: 무릎 꿇고 창을 떨어뜨린 뒤 옆으로 눕는다 (눕기는 90도 돌림이라 도트가 그대로)
#   python3 tools/boss_motion_px.py <몸 그림> <창 그림(같은 크기)> <나가는 시트 png> <다리 시작 줄> <왼발 x0-x1> <오른발 x0-x1> [미리보기 gif]
#   몸 · 창은 tools/chief_layers.py 가 정확히 나눈 두 장 (창이 빠진 자리는 이미 메워져 있다)
import sys
from PIL import Image
src, src_sp, dst, leg = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
LX = tuple(map(int, sys.argv[5].split('-'))); RX = tuple(map(int, sys.argv[6].split('-')))
gif = sys.argv[7] if len(sys.argv) > 7 and not sys.argv[7].startswith('--') else None
im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()
SPI = Image.open(src_sp).convert('RGBA'); spx = SPI.load()
K, T = (34, 34, 34, 255), (0, 0, 0, 0)
G, GD, B = (99, 177, 77, 255), (72, 132, 58, 255), (87, 54, 45, 255)
TOPM = 5             # 위 여백 (몸이 뜨고 창을 드는 칸)
FW = max(w, h) + 8   # 한 장 가로 (눕는 장면이 들어가게)
FH = h + TOPM
OX = FW // 2 - 22  # 얼굴 가운데(몸 그림 22칸)가 한 장의 가운데 오게 (게임은 그림 아래 가운데를 발밑에 놓는다)
inleg = {(x, y) for y in range(leg, h) for r in (LX, RX) for x in range(r[0], r[1] + 1)}  # 원래 다리 자리는 지우고 새로 그린다
def is_green(p): return p[1] > 140 and p[0] < 130
# 창 (도끼 머리 · 장대 · 붉은 술): 왼쪽 끝. 쥔 팔(초록)은 몸에 남긴다
spear = {(x, y) for y in range(h) for x in range(w) if spx[x, y][3]}

SPEAR = Image.new('RGBA', (w, h), T)
for (x, y) in spear: SPEAR.putpixel((x, y), spx[x, y])
SPEAR = SPEAR.crop(SPEAR.getbbox())


def frame(bob=0, up=0, L=0, R=0, sx=0, sp=(0, 0), lie=False, drop=False):
    """bob: 다리 위 몸 내려앉음 · up: 몸 전체 뜸(음수면 주저앉음) · L/R: 발 들림 · sx: 좌우로 밀림 · sp: 창 옮김 · drop: 창을 땅에 떨굼"""
    o = Image.new('RGBA', (FW, FH), T); po = o.load()
    def put(x, y, c):
        x += OX + sx
        if 0 <= x < FW and 0 <= y < FH: po[x, y] = c
    ground = FH - 1
    for y in range(h):  # 몸 (망토 · 허리천 포함)
        for x in range(w):
            if px[x, y][3] and (x, y) not in inleg:
                put(x, y + TOPM - up + (bob if y < leg else 0), px[x, y])
    hip = leg + TOPM - up + bob
    for (x0, x1), rise in ((LX, L), (RX, R)):  # 다리: 짙은 선 | 초록 3칸 | 짙은 선, 신발 갈색, 밑 선. 몸이 주저앉으면 짧아진다(무릎 꿇기)
        foot = ground - rise
        for y in range(hip, foot + 1):
            c_in = B if y == foot - 1 else K if y == foot else None
            for x in range(x0, x1 + 1):
                put(x, y, K if x in (x0, x1) or c_in is K else (c_in or (GD if x == x0 + 1 else G)))
    if drop:  # 떨군 창: 옆으로 눕혀 땅에 놓는다 (몸 앞쪽 아래)
        lay = SPEAR.rotate(90, expand=True)
        tgt = Image.new('RGBA', (FW, FH), T); tgt.alpha_composite(lay, (max(0, OX - 6), FH - lay.height))
    else:
        for (x, y) in spear:  # 창은 한 덩어리로
            yy = y + TOPM - up + sp[1]
            if yy <= ground: put(x + sp[0], yy, spx[x, y])
    if lie:  # 옆으로 쓰러짐: 몸만 시계 방향으로 눕혀 땅에 붙인다 (90도라 도트가 그대로)
        body = o.crop(o.getbbox()).rotate(-90, expand=True)
        o = Image.new('RGBA', (FW, FH), T); o.alpha_composite(body, (FW - body.width - 1, FH - body.height))
    if drop: tgt.alpha_composite(o); o = tgt  # 창은 몸 뒤(아래)에
    return o


ANIMS = [
    ('idle', 220, [dict(), dict(), dict(bob=1), dict(bob=1)]),
    ('run', 140, [dict(up=1, R=1), dict(), dict(up=1, L=1), dict()]),
    ('attack', 120, [dict(up=1, sp=(0, -3)), dict(up=1, sp=(0, -4)), dict(bob=1, sp=(0, 2)), dict(bob=1, sp=(0, 2)), dict(sp=(0, 1))]),  # 들어 올림 → 내리찍기 → 되돌림
    ('skill', 130, [dict(up=1, sp=(0, -3)), dict(up=1, sp=(0, -4), sx=1), dict(up=1, sp=(0, -4), sx=-1), dict(up=1, sp=(0, -4))]),  # 포효: 창을 높이 들고 몸이 떤다
    ('hit', 110, [dict(sx=-2, bob=1), dict(sx=-1)]),
    ('death', 260, [dict(sx=-1, bob=1), dict(bob=2, drop=True), dict(bob=4, drop=True), dict(bob=4, drop=True, lie=True)]),
]
rows = [(name, dur, [frame(**f) for f in fr]) for name, dur, fr in ANIMS]
cols = max(len(fr) for _, _, fr in rows)
sheet = Image.new('RGBA', (FW * cols, FH * len(rows)), T)
for r, (_, _, fr) in enumerate(rows):
    for c, f in enumerate(fr): sheet.alpha_composite(f, (c * FW, r * FH))
sheet.save(dst)
if '--game' in sys.argv:  # 게임 목록에 넣는다: 같은 이름(b_climbChief)의 옛 보스 시트 그림을 대신한다 (tools/sprites.py · boss_pixel)
    import json, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from sprites import meta_path, build_manifest
    json.dump({'b_climbChief': {'img': os.path.basename(dst), 'w': FW, 'h': FH, 'y0': 0, 'anims': {name: {'row': r, 'n': len(fr)} for r, (name, _, fr) in enumerate(rows)}}}, open(meta_path('boss_pixel'), 'w'))
    build_manifest(os.path.dirname(os.path.abspath(dst)))
print('frame', FW, 'x', FH, {name: len(fr) for name, _, fr in rows})
if gif:
    s = 6; seq = []
    for name, dur, fr in rows:
        rep = {'idle': 2, 'run': 4, 'attack': 2, 'skill': 2, 'hit': 3, 'death': 1}[name]
        for _ in range(rep):
            for i, f in enumerate(fr):
                bg = Image.new('RGBA', (FW * s, FH * s), (60, 60, 72, 255)); bg.alpha_composite(f.resize((FW * s, FH * s), Image.NEAREST))
                seq.append((bg.convert('RGB'), dur * (5 if name == 'death' and i == len(fr) - 1 else 1)))
    seq[0][0].save(gif, save_all=True, append_images=[f for f, _ in seq[1:]], duration=[d for _, d in seq], loop=0)
