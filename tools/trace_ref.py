# 받은 도트 그림(AI가 크게 키운 것)의 칸을 그대로 따서 게임용 작은 그림으로.
# 칸 크기가 조금씩 달라서, 색이 실제로 바뀌는 세로줄 · 가로줄(경계)을 찾아 그 사이를 한 칸으로 본다.
#   python3 tools/trace_ref.py <받은 그림> <나가는 png> [칸 크기 어림값 px] [비교 그림 png]
import sys
import numpy as np
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
P = float(sys.argv[3]) if len(sys.argv) > 3 else 0
cmp_out = sys.argv[4] if len(sys.argv) > 4 else None
img = Image.open(src).convert('RGB')
a = np.array(img).astype(int)
H, W = a.shape[:2]

# 배경: 가장자리와 이어진 배경색 칸
bg = a[:6, :6].reshape(-1, 3).mean(axis=0)
near = np.abs(a - bg).max(axis=2) <= 10
seen = np.zeros_like(near); q = deque([(0, 0), (0, W - 1), (H - 1, 0), (H - 1, W - 1)])
for p in q: seen[p] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = y + dy, x + dx
        if 0 <= yy < H and 0 <= xx < W and not seen[yy, xx] and near[yy, xx]: seen[yy, xx] = True; q.append((yy, xx))
fg = ~seen
ys, xs = np.where(fg); X0, X1, Y0, Y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def period(g):
    g = g - g.mean()
    return max(range(12, 60), key=lambda p: np.dot(g[:-p], g[p:]))


def bounds(prof, lo, hi, p):
    """칸 경계를 한꺼번에 정한다: 칸 하나는 p의 0.8~1.2배, 경계마다 그 자리의 색 변화 세기를 더한 값이 가장 크게 (동적 계획법)."""
    sm = np.convolve(prof, [1, 2, 1], 'same').astype(float); sm /= sm[lo:hi].max() or 1
    smin, smax = int(p * 0.8), int(np.ceil(p * 1.2))
    n = hi - lo + 1
    best = np.full(n, -1e18); prev = np.full(n, -1, int); best[0] = 0
    for i in range(1, n):
        for s in range(smin, smax + 1):
            j = i - s
            if j < 0: break
            v = best[j] + sm[lo + i] - 0.02  # 칸이 많아지는 것을 살짝 막는다
            if v > best[i]: best[i], prev[i] = v, j
    end = max(range(n - smin, n), key=lambda i: best[i])  # 끝은 가장자리 근처 아무 곳
    out = [end]
    while prev[out[-1]] >= 0: out.append(prev[out[-1]])
    return sorted(lo + v for v in out)


gx = np.abs(np.diff(a, axis=1)).sum(axis=2) * fg[:, 1:]
gy = np.abs(np.diff(a, axis=0)).sum(axis=2) * fg[1:, :]
px_x, px_y = gx.sum(axis=0), gy.sum(axis=1)
p = P or (period(px_x[X0:X1]) + period(px_y[Y0:Y1])) / 2
bx = bounds(np.append(px_x, 0), X0, X1, p)
by = bounds(np.append(px_y, 0), Y0, Y1, p)
nx, ny = len(bx) - 1, len(by) - 1
print('칸 크기 어림', round(p, 1), '→', nx, 'x', ny)

out = Image.new('RGBA', (nx, ny), (0, 0, 0, 0)); po = out.load()
for j in range(ny):
    for i in range(nx):
        xa, xb, ya, yb = bx[i], bx[i + 1], by[j], by[j + 1]
        mx, my = max(1, (xb - xa) // 4), max(1, (yb - ya) // 4)
        sub = a[ya + my:yb - my, xa + mx:xb - mx].reshape(-1, 3); alive = fg[ya + my:yb - my, xa + mx:xb - mx].reshape(-1)
        if len(alive) == 0 or alive.mean() < 0.5: continue
        c = np.median(sub[alive], axis=0)
        po[i, j] = (int(c[0]), int(c[1]), int(c[2]), 255)
out.save(dst)

if cmp_out:  # 원본(같은 크기로 줄인 것)과 딴 그림을 나란히
    s = 12
    big = out.resize((nx * s, ny * s), Image.NEAREST)
    ref = img.crop((X0, Y0, X1, Y1)).resize((nx * s, ny * s), Image.LANCZOS).convert('RGBA')
    sheet = Image.new('RGBA', (nx * s * 2 + 20, ny * s), (70, 70, 80, 255))
    sheet.alpha_composite(ref, (0, 0)); sheet.alpha_composite(big, (nx * s + 20, 0)); sheet.save(cmp_out)
