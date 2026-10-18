# 뼈대 도트 생성기
# 부위(파트)를 기본 자세의 좌표로 그려 두고, 프레임마다 관절 각도만 바꿔 1배 해상도에서 픽셀을 새로 찍는다.
# 그림을 돌려서 생기는 깨진 픽셀이 없고, 부위마다 명암(위 밝게 · 아래 어둡게) · 비늘 결 · 외곽선 · 접촉 그늘을 자동으로 넣는다.
import math
from PIL import Image


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def _hash(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535


def in_poly(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(px, py, a, b):
    (x1, y1), (x2, y2) = a, b
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy or 1e-9
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


class Shape:
    # kind: poly(pts) · ellipse(cx, cy, rx, ry) · line(a, b, w) · capsule(a, b, r)
    def __init__(self, kind, key, *args, flat=False, shade=True):
        self.kind, self.key, self.args, self.flat, self.shade = kind, key, args, flat, shade

    def hit(self, x, y):
        k, a = self.kind, self.args
        if k == 'poly': return in_poly(x, y, a[0])
        if k == 'ellipse':
            cx, cy, rx, ry = a
            return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
        if k == 'line': return seg_dist(x, y, a[0], a[1]) <= a[2] / 2
        if k == 'capsule': return seg_dist(x, y, a[0], a[1]) <= a[2]
        return False


class Part:
    def __init__(self, name, parent, pivot, z, shapes, sep=True, tex=0.0):
        self.name, self.parent, self.pivot, self.z, self.shapes, self.sep, self.tex = name, parent, pivot, z, shapes, sep, tex


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def mat_inv(m):
    a, b, c = m[0]; d, e, f = m[1]
    det = a * e - b * d
    return [[e / det, -b / det, (b * f - c * e) / det], [-d / det, a / det, (c * d - a * f) / det], [0, 0, 1]]


def joint(px, py, ang, dx=0, dy=0, sx=1, sy=1):
    r = math.radians(ang); c, s = math.cos(r), math.sin(r)
    # 피벗으로 옮김 → 회전·크기 → 다시 제자리 + 이동
    T1 = [[1, 0, -px], [0, 1, -py], [0, 0, 1]]
    S = [[sx, 0, 0], [0, sy, 0], [0, 0, 1]]
    R = [[c, -s, 0], [s, c, 0], [0, 0, 1]]
    T2 = [[1, 0, px + dx], [0, 1, py + dy], [0, 0, 1]]
    return mat_mul(T2, mat_mul(R, mat_mul(S, T1)))


class Model:
    def __init__(self, w, h, parts, ramps, outline, flats=None, offset=(0, 0)):
        self.w, self.h, self.parts, self.ramps, self.outline = w, h, parts, ramps, hexc(outline)
        self.offset = offset
        self.flats = {k: hexc(v) for k, v in (flats or {}).items()}
        self.by = {p.name: p for p in parts}
        self.ramps = {k: [hexc(c) for c in v] for k, v in ramps.items()}

    def render(self, pose, hide=()):
        # pose: 부위 이름 → (각도, dx, dy[, sx, sy])
        M = {}
        def world(p):
            if p.name in M: return M[p.name]
            v = pose.get(p.name, (0,))
            ang = v[0]; dx = v[1] if len(v) > 1 else 0; dy = v[2] if len(v) > 2 else 0
            sx = v[3] if len(v) > 3 else 1; sy = v[4] if len(v) > 4 else 1
            m = joint(p.pivot[0], p.pivot[1], ang, dx, dy, sx, sy)
            if p.parent: m = mat_mul(world(self.by[p.parent]), m)
            else: m = mat_mul([[1, 0, self.offset[0]], [0, 1, self.offset[1]], [0, 0, 1]], m)
            M[p.name] = m
            return m
        order = sorted([p for p in self.parts if p.name not in hide], key=lambda p: -p.z)
        inv = [(p, mat_inv(world(p))) for p in order]
        W, H = self.w, self.h
        col = [[None] * W for _ in range(H)]
        pid = [[-1] * W for _ in range(H)]
        zz = {p.name: p.z for p in self.parts}
        for y in range(H):
            for x in range(W):
                X, Y = x + 0.5, y + 0.5
                for idx, (p, iv) in enumerate(inv):
                    lx = iv[0][0] * X + iv[0][1] * Y + iv[0][2]
                    ly = iv[1][0] * X + iv[1][1] * Y + iv[1][2]
                    hit = None
                    for s in reversed(p.shapes):
                        if s.hit(lx, ly): hit = s; break
                    if not hit: continue
                    if hit.flat: c = self.flats[hit.key]
                    else:
                        ramp = self.ramps[hit.key]
                        inside = lambda a, b: any(s2.hit(a, b) for s2 in p.shapes if s2.key == hit.key or not s2.flat)
                        lvl = 1
                        if hit.shade:
                            if not inside(lx, ly - 1.15): lvl = 0
                            elif not inside(lx, ly + 1.4): lvl = 2
                            elif not inside(lx + 1.3, ly + 0.6): lvl = 2
                        if p.tex and lvl == 1:
                            n = _hash(int(math.floor(lx / 2)), int(math.floor(ly / 2)), sum(map(ord, p.name)))
                            if n < p.tex: lvl = 2
                            elif n > 1 - p.tex * 0.5: lvl = 0
                        c = ramp[lvl]
                    col[y][x] = c; pid[y][x] = idx
                    break
        img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        px = img.load()
        for y in range(H):
            for x in range(W):
                c = col[y][x]
                if c is None: continue
                # 접촉 그늘: 앞 부위와 맞닿은 뒤 부위 픽셀은 가장 어두운 색
                me = inv[pid[y][x]][0]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and pid[yy][xx] >= 0 and pid[yy][xx] != pid[y][x]:
                        other = inv[pid[yy][xx]][0]
                        if other.z < me.z and me.sep and other.sep:
                            ramp = None
                            for s in me.shapes:
                                if not s.flat: ramp = self.ramps[s.key]; break
                            if ramp: c = ramp[3]
                            break
                px[x, y] = c
        # 바깥 외곽선
        out = img.copy(); po = out.load()
        for y in range(H):
            for x in range(W):
                if px[x, y][3]: continue
                if any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    po[x, y] = self.outline
        return out


def sheet(model, anims, path):
    # anims: [(이름, [pose, ...])] → 행마다 한 동작
    cols = max(len(fr) for _, fr in anims)
    img = Image.new('RGBA', (cols * model.w, len(anims) * model.h), (0, 0, 0, 0))
    meta = {}
    for r, (name, frames) in enumerate(anims):
        for c, pose in enumerate(frames):
            hide = pose.pop('_hide', ())
            img.alpha_composite(model.render(pose, hide), (c * model.w, r * model.h))
        meta[name] = {'row': r, 'n': len(frames)}
    img.save(path)
    return img, meta
