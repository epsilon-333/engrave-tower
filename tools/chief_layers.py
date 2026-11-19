# 가면 족장: 딴 그림(33x35)을 몸 · 창 두 장으로 정확히 나눈다 (같은 크기 · 같은 자리라 겹치면 원래 그림).
#   창: 도끼 머리 · 장대 · 붉은 술과 그 테두리만. 망토 칸은 몸에 남긴다.
#   창이 가리던 머리 왼쪽은 오른쪽 깃털을 거울로 비춰 메운다 (창을 들거나 떨궈도 머리가 비지 않게).
#   python3 tools/chief_layers.py <딴 그림 33x35> <몸 png> <창 png>
import sys
from PIL import Image
src, out_body, out_spear = sys.argv[1:4]
im = Image.open(src).convert('RGBA'); w, h = im.size; px = im.load()
for x in (17, 18, 23, 24): px[x, 17] = px[x, 16]   # 눈 세로 한 칸
px[21, 25] = px[22, 25]                            # 가운데 뼈 뾰족
K, T = (34, 34, 34, 255), (0, 0, 0, 0)
spear = set()
for y in range(h):
    for x in range(w):
        if not px[x, y][3]: continue
        if (y <= 13 and x <= 6) or (x == 7 and 11 <= y <= 13): spear.add((x, y))          # 도끼 머리 + 테두리
        elif 14 <= y <= 22 and x <= 7: spear.add((x, y))                                # 장대 윗부분 · 붉은 술
        elif y == 23 and x == 7: spear.add((x, y))
        elif 26 <= y <= 30 and x in (7, 8): spear.add((x, y))                           # 손 아래 장대 (오른쪽 테두리는 망토 선)
        elif y >= 31 and x in (8, 9) or (y == 34 and x in (8, 9)): spear.add((x, y))
        elif y >= 31 and x <= 7: spear.add((x, y)); px[x, y] = T  # 장대 밑동 왼쪽에 떨어진 망토 조각: 지운다
body = Image.new('RGBA', (w, h), T); sp = Image.new('RGBA', (w, h), T)
for y in range(h):
    for x in range(w):
        if px[x, y][3]: (sp if (x, y) in spear else body).putpixel((x, y), px[x, y])
# 머리 왼쪽 깃털 메우기: 얼굴 가운데를 축으로 오른쪽 머리장식을 비춰, 빈 칸에만 넣는다
bp = body.load()
face = [x for x in range(w) if bp[x, 18][3] and bp[x, 18][1] > 140 and bp[x, 18][0] < 130]
cx2 = min(face) + max(face)  # 축의 두 배
orig = body.copy(); op = orig.load()
green = lambda c: c[3] and c[1] > 140 and c[0] < 130
def mirror_edge(rows, ext_only):
    """줄마다 왼쪽 테두리를 오른쪽 테두리의 거울 자리에 맞춘다 (빈 곳은 비춰 채우고, ext_only가 아니면 튀어나온 모서리는 깎는다). 초록(얼굴 · 팔)은 건드리지 않는다"""
    live = [y for y in rows if any(op[x, y][3] for x in range(w))]
    ls = [min(x for x in range(w) if op[x, y][3]) for y in live]; rs = [max(x for x in range(w) if op[x, y][3]) for y in live]
    S = min(ls) + max(rs) - 1
    for y, r in zip(live, rs):
        want = S - r
        for x in range(w):
            if 2 * x >= S: break
            d = op[x, y]
            if green(d): continue
            if x < want:
                if not ext_only: bp[x, y] = T
            elif not d[3] or x < want + 2:  # 새 테두리 바로 안쪽 두 칸은 오른쪽 바깥 그림(깃털 끝)으로
                c = op[S - x, y] if 0 <= S - x < w else T
                if c[3] and not green(c): bp[x, y] = c


mirror_edge(range(2, 22), False)   # 머리장식: 오른쪽처럼 둥글게
mirror_edge(range(28, h), True)    # 망토: 바깥으로만 늘림


# 깃털 왼쪽 아래(8~13줄, 얼굴 위): 바깥 칸을 오른쪽 같은 줄처럼 빨간 깃털 색으로
RED, RED_D = (180, 70, 73, 255), (150, 56, 62, 255)
for y, n in zip(range(8, 14), (3, 3, 4, 3, 3, 2)):
    xs = [x for x in range(w) if bp[x, y][3] and sum(bp[x, y][:3]) >= 150 and not green(bp[x, y])]
    if not xs: continue
    x0 = min(xs)
    for x in range(x0, x0 + n):
        if bp[x, y][3] and not green(bp[x, y]): bp[x, y] = RED if (x - x0) < n - 1 else RED_D


# 머리장식 맨 위: 칸마다 맨 윗칸 높이를 보고, 같은 높이로 3칸 넘게 이어진 평평한 끝 → 양 끝을 한 칸 깎고 가운데를 한 칸 올려 뾰족하게
tops = [min([y for y in range(h) if bp[x, y][3]] or [None]) if any(bp[x, y][3] for y in range(h)) else None for x in range(w)]
x = 0
while x < w:
    t = tops[x]
    if t is None or t > 12: x += 1; continue
    a = x
    while x < w and tops[x] == t: x += 1
    b = x - 1
    if b - a + 1 >= 3:
        if b - a + 1 >= 4:
            for e in (a, b): bp[e, t] = T
        for m in sorted({(a + b) // 2, (a + b + 1) // 2}):
            bp[m, t - 1] = bp[m, t]; bp[m, t] = bp[m, t + 1]  # 윗선은 한 칸 위로, 그 자리는 깃털 색
# 몸과 떨어져 떠 있는 조각은 지운다 (가장 큰 덩어리만 남김)
seen, comps = set(), []
for y0 in range(h):
    for x0 in range(w):
        if (x0, y0) in seen or not bp[x0, y0][3]: continue
        st, comp = [(x0, y0)], []
        seen.add((x0, y0))
        while st:
            x1, y1 = st.pop(); comp.append((x1, y1))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x1 + dx, y1 + dy)
                    if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and bp[q][3]: seen.add(q); st.append(q)
        comps.append(comp)
for comp in sorted(comps, key=len)[:-1]:
    for q in comp: bp[q] = T


def outline(img):  # 우리 그림체: 바깥 한 칸 짙은 선 (이미 짙은 가장자리는 그 색으로 맞춘다)
    W2, H2 = img.width + 2, img.height + 2
    o = Image.new('RGBA', (W2, H2), T); o.alpha_composite(img, (1, 1)); p = o.load()
    srcp = {(x, y): p[x, y] for x in range(W2) for y in range(H2)}
    inb = lambda x, y: 0 <= x < W2 and 0 <= y < H2
    dark = lambda c: c[3] and sum(c[:3]) < 150
    N = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for (x, y), c in srcp.items():
        if c[3]:
            if dark(c) and any((not inb(x + dx, y + dy)) or not srcp[(x + dx, y + dy)][3] for dx, dy in N): p[x, y] = K
        elif any(inb(x + dx, y + dy) and srcp[(x + dx, y + dy)][3] and not dark(srcp[(x + dx, y + dy)]) for dx, dy in N): p[x, y] = K
    return o


outline(body).save(out_body); outline(sp).save(out_spear)
print('ok', w + 2, h + 2)
