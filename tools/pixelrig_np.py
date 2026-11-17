# pixelrig(뼈대 도트)의 numpy 렌더러: 같은 Model · Part · Shape 를 받아 같은 규칙(4단 명암 · 결 · 접촉 그늘 · 외곽선)으로
# 훨씬 빠르게 찍는다. 보스(100px 안팎 × 수십 장면)처럼 큰 그림에 쓴다.
import math
import numpy as np
from pixelrig import mat_mul, mat_inv, joint


def _hash_np(x, y, s):
    n = (x.astype(np.int64) * 374761393 + y.astype(np.int64) * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def _poly_hit(x, y, pts):
    inside = np.zeros(x.shape, bool)
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        cond = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi)
        inside ^= cond
        j = i
    return inside


def _seg_dist(px, py, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy or 1e-9
    t = np.clip(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1)
    return np.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def shape_hit(s, x, y):
    k, a = s.kind, s.args
    if k == 'poly': return _poly_hit(x, y, a[0])
    if k == 'ellipse':
        cx, cy, rx, ry = a
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
    if k == 'line': return _seg_dist(x, y, a[0], a[1]) <= a[2] / 2
    if k == 'capsule': return _seg_dist(x, y, a[0], a[1]) <= a[2]
    return np.zeros(x.shape, bool)


def render(model, pose, hide=(), contact='back'):
    """pose: 부위 이름 → (각도, dx, dy[, sx, sy]). contact: 'back' = 앞 부위에 가려진 뒤 부위 가장자리를 어둡게."""
    M = {}

    def world(p):
        if p.name in M: return M[p.name]
        v = pose.get(p.name, (0,))
        ang = v[0]; dx = v[1] if len(v) > 1 else 0; dy = v[2] if len(v) > 2 else 0
        sx = v[3] if len(v) > 3 else 1; sy = v[4] if len(v) > 4 else 1
        m = joint(p.pivot[0], p.pivot[1], ang, dx, dy, sx, sy)
        if p.parent: m = mat_mul(world(model.by[p.parent]), m)
        else:
            root = [[1, 0, model.offset[0]], [0, 1, model.offset[1]], [0, 0, 1]]
            if model.gscale: gx, gy, ax, ay = model.gscale; root = mat_mul(root, [[gx, 0, ax - ax * gx], [0, gy, ay - ay * gy], [0, 0, 1]])
            m = mat_mul(root, m)
        M[p.name] = m
        return m

    W, H = model.w, model.h
    order = sorted([p for p in model.parts if p.name not in hide], key=lambda p: -p.z)
    Y, X = np.mgrid[0:H, 0:W]
    X = X.astype(np.float64) + 0.5; Y = Y.astype(np.float64) + 0.5
    col = np.zeros((H, W, 4), np.uint8)
    pid = np.full((H, W), -1, np.int32)
    free = np.ones((H, W), bool)
    for idx, p in enumerate(order):
        iv = mat_inv(world(p))
        lx = iv[0][0] * X + iv[0][1] * Y + iv[0][2]
        ly = iv[1][0] * X + iv[1][1] * Y + iv[1][2]
        hits = [shape_hit(s, lx, ly) for s in p.shapes]
        anyhit = np.zeros((H, W), bool)
        for h in hits: anyhit |= h
        take = anyhit & free
        if not take.any(): continue
        # 맨 위 도형(목록 뒤쪽이 앞) 고르기
        top = np.full((H, W), -1, np.int32)
        for si in range(len(p.shapes) - 1, -1, -1):
            top[(top < 0) & hits[si]] = si
        out = np.zeros((H, W, 4), np.uint8)
        # 명암용 inside 검사 (키가 같은 도형 · 결이 있는(flat 아닌) 도형 모두)
        def inside(key, ox, oy):
            m = np.zeros((H, W), bool)
            for s in p.shapes:
                if s.key == key or not s.flat: m |= shape_hit(s, lx + ox, ly + oy)
            return m
        for si, s in enumerate(p.shapes):
            sel = take & (top == si)
            if not sel.any(): continue
            if s.flat:
                out[sel] = model.flats[s.key]; continue
            ramp = np.array(model.ramps[s.key], np.uint8)
            lvl = np.ones((H, W), np.int32)
            if s.shade:
                up = inside(s.key, 0, -1.15); dn = inside(s.key, 0, 1.4); rt = inside(s.key, 1.3, 0.6)
                lvl[~up] = 0
                lvl[up & (~dn | ~rt)] = 2
            if p.tex:
                n = _hash_np(np.floor(lx / 2), np.floor(ly / 2), sum(map(ord, p.name)))
                mid = lvl == 1
                lvl[mid & (n < p.tex)] = 2
                lvl[mid & (n > 1 - p.tex * 0.5)] = 0
            out[sel] = ramp[lvl[sel]]
        col[take] = out[take]
        pid[take] = idx
        free &= ~take
    # 접촉 그늘: 뒤 부위가 앞 부위와 맞닿은 픽셀은 가장 어두운 색 (두 부위 다 sep 일 때)
    zs = np.array([p.z for p in order] + [1e9])
    seps = np.array([bool(p.sep) for p in order] + [False])
    darkest = []
    for p in order:
        r = None
        for s in p.shapes:
            if not s.flat: r = model.ramps[s.key][3]; break
        darkest.append(r or (0, 0, 0, 0))
    darkest = np.array(darkest + [(0, 0, 0, 0)], np.uint8)
    dark = np.zeros((H, W), bool)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb = np.full((H, W), -1, np.int32)
        ys, ye = max(0, dy), H + min(0, dy); xs, xe = max(0, dx), W + min(0, dx)
        nb[ys:ye, xs:xe] = pid[ys - dy:ye - dy, xs - dx:xe - dx]
        ok = (pid >= 0) & (nb >= 0) & (nb != pid)
        me, ot = np.where(pid >= 0, pid, len(order)), np.where(nb >= 0, nb, len(order))
        if contact == 'back': cond = ok & (zs[ot] > zs[me]) & seps[me] & seps[ot]  # 이웃이 더 앞 → 나(뒤)를 어둡게
        else: cond = ok & (zs[ot] < zs[me]) & seps[me] & seps[ot]
        dark |= cond
    if dark.any():
        idxs = np.where(pid >= 0, pid, len(order))
        col[dark] = darkest[idxs[dark]]
    # 외곽선
    alpha = col[..., 3] > 0
    edge = np.zeros((H, W), bool)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.zeros((H, W), bool)
        ys, ye = max(0, dy), H + min(0, dy); xs, xe = max(0, dx), W + min(0, dx)
        sh[ys:ye, xs:xe] = alpha[ys - dy:ye - dy, xs - dx:xe - dx]
        edge |= sh
    edge &= ~alpha
    col[edge] = model.outline
    return col


def joints(model, pose, names):
    """자세에서 부위 피벗의 화면 좌표 (디버그 · 효과 자리용)"""
    M = {}

    def world(p):
        if p.name in M: return M[p.name]
        v = pose.get(p.name, (0,))
        ang = v[0]; dx = v[1] if len(v) > 1 else 0; dy = v[2] if len(v) > 2 else 0
        sx = v[3] if len(v) > 3 else 1; sy = v[4] if len(v) > 4 else 1
        m = joint(p.pivot[0], p.pivot[1], ang, dx, dy, sx, sy)
        if p.parent: m = mat_mul(world(model.by[p.parent]), m)
        else: m = mat_mul([[1, 0, model.offset[0]], [0, 1, model.offset[1]], [0, 0, 1]], m)
        M[p.name] = m
        return m
    out = {}
    for n in names:
        p = model.by[n]; m = world(p)
        out[n] = (m[0][0] * p.pivot[0] + m[0][1] * p.pivot[1] + m[0][2], m[1][0] * p.pivot[0] + m[1][1] * p.pivot[1] + m[1][2])
    return out


def reduce_colors_np(frames, n, outline):
    """모든 장면을 한 팔레트 n색으로 (외곽선 · 투명은 그대로). frames: (H,W,4) uint8 목록"""
    from PIL import Image
    allpix = np.concatenate([f.reshape(-1, 4) for f in frames])
    keep = (allpix[:, 3] > 0) & ~((allpix[:, 0] == outline[0]) & (allpix[:, 1] == outline[1]) & (allpix[:, 2] == outline[2]))
    pix = allpix[keep][:, :3]
    if not len(pix): return frames
    strip = Image.fromarray(pix.reshape(1, -1, 3), 'RGB')
    pal = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for f in frames:
        q = np.array(Image.fromarray(f[..., :3], 'RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
        m = (f[..., 3] > 0) & ~((f[..., 0] == outline[0]) & (f[..., 1] == outline[1]) & (f[..., 2] == outline[2]))
        o = f.copy(); o[m, :3] = q[m]
        out.append(o)
    return out
