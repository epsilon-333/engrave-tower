# 용 걷기 · 달리기: 한 장의 그림에 뼈대를 넣어 온몸을 움직인다
# 몸통(오르내림 · 앞뒤 흔들림) · 머리(끄덕임) · 꼬리(늦게 따라 흔들림) · 날개(살짝 들썩) · 두 다리(엉덩이 축 회전, 발은 땅에)
# 부위 경계는 무게를 부드럽게 섞어 찢어지지 않게 하고, 다리가 비켜나 드러난 빈자리는 주변 색으로 채운다
import numpy as np, cv2
from PIL import Image

BODY, HEAD, TAIL, WING, NEAR, FAR = range(6)
LAYER = {FAR: 0, BODY: 1, HEAD: 1, TAIL: 1, WING: 1, NEAR: 2}   # 먼 다리 → 몸 → 가까운 다리 순서로 그린다


def labels(H, W):
    # 기준 그림(대기 첫 프레임, 오른쪽을 봄) 위의 부위 나누기
    y, x = np.mgrid[0:H, 0:W].astype(float)
    lab = np.full((H, W), BODY)
    lab[(y < 66) & (x < 72)] = WING
    lab[(x >= 72) & (x <= 84) & (y >= 22) & (y <= 52)] = WING          # 몸 너머 날개
    lab[(x >= 86) & (y < 50)] = HEAD
    lab[(x < 64) & (y >= 63)] = TAIL
    lab[(x >= 90) & (y >= 82)] = FAR
    near = ((((x - 77) / 14) ** 2 + ((y - 82) / 15) ** 2) <= 1) & (y >= 67) | ((y >= 88) & (x >= 63) & (x <= 85))
    lab[near] = NEAR
    return lab


def rot(px, py, cx, cy, a):
    c, s = np.cos(a), np.sin(a)
    dx, dy = px - cx, py - cy
    return cx + dx * c - dy * s, cy + dx * s + dy * c


def walk_cycle(cell, n, A=0.32, bob=1.6, lean=0.0, lift=3.0, tail=0.12, nod=0.05, flap=0.07):
    a = np.array(cell.convert('RGBA'))
    H, W = a.shape[:2]
    lab = labels(H, W)
    rows = np.nonzero(a[..., 3].any(axis=1))[0]
    ground = rows.max()
    # 부위별 무게 (가장자리 4px 정도에서 부드럽게 섞임)
    wts = []
    for k in range(6):
        m = (lab == k).astype(np.float32)
        wts.append(cv2.GaussianBlur(m, (0, 0), 1.8))
    wts = np.stack(wts)
    wts /= np.maximum(1e-6, wts.sum(0))
    SS = 3
    oy, ox = np.mgrid[0:H * SS, 0:W * SS].astype(float)
    sx, sy = (ox + 0.5) / SS, (oy + 0.5) / SS                 # 세분 샘플 위치 (원본 좌표)
    ix, iy = np.minimum(W - 1, sx.astype(int)), np.minimum(H - 1, sy.astype(int))
    vis = a[iy, ix, 3] > 0
    W6 = wts[:, iy, ix]
    layer = np.vectorize(LAYER.get)(lab[iy, ix])
    frames, feet = [], []
    for i in range(n):
        ph = i / n * np.pi * 2
        down = bob * np.sin(ph) ** 2                          # 두 발이 벌어져 디딜 때 몸이 가장 낮다
        pitch = lean + 0.025 * np.sin(2 * ph)
        HX, HY = 85.0, 74.0                                    # 몸통 회전 중심 (엉덩이)

        def body(px, py):
            qx, qy = rot(px, py, HX, HY, pitch)
            return qx, qy + down
        T = [None] * 6
        T[BODY] = body(sx, sy)
        hx, hy = rot(sx, sy, 90, 50, nod * np.sin(2 * ph - 0.7))   # 머리는 걸음보다 조금 늦게 끄덕인다
        T[HEAD] = body(hx, hy)
        kt = np.clip((66 - sx) / 30, 0, 1)                    # 꼬리 끝으로 갈수록 크게
        tx, ty = rot(sx, sy, 66, 80, tail * kt * np.sin(2 * ph - 1.3))
        T[TAIL] = body(tx, ty)
        wx, wy = rot(sx, sy, 72, 46, flap * np.sin(2 * ph + 0.5))
        T[WING] = body(wx, wy)
        for k, hip, sgn in ((NEAR, (78.0, 70.0), 1), (FAR, (97.0, 76.0), -1)):
            sw = np.sin(ph) * sgn                              # 발의 앞뒤 (-1 뒤 ~ 1 앞)
            fwd = np.cos(ph) * sgn > 0                         # 앞으로 옮기는 다리만 든다
            up = lift * np.cos(ph) ** 2 if fwd else 0.0
            lx, ly = rot(sx, sy, hip[0], hip[1], -A * sw)      # 엉덩이를 축으로 다리 회전
            t = np.clip((sy - hip[1]) / max(1, ground - hip[1]), 0, 1)
            bx, by = body(np.full_like(sx, hip[0]), np.full_like(sy, hip[1]))
            # 다리 윗부분은 몸을 따라가고, 발은 땅에 남는다 (무릎이 굽는 느낌)
            T[k] = (lx + (bx - hip[0]) * (1 - t), ly + (by - hip[1]) * (1 - t) - up * t)
        DX = sum(W6[k] * T[k][0] for k in range(6))
        DY = sum(W6[k] * T[k][1] for k in range(6))
        out = np.zeros_like(a)
        for L in (0, 1, 2):
            m = vis & (layer == L)
            X = np.floor(DX[m]).astype(int); Y = np.floor(DY[m]).astype(int)
            ok = (X >= 0) & (X < W) & (Y >= 0) & (Y < H)
            out[Y[ok], X[ok]] = a[iy[m][ok], ix[m][ok]]
        # 다리가 비켜나 드러난 몸 안쪽 빈자리를 주변 색으로 메운다
        al = (out[..., 3] > 0).astype(np.uint8)
        closed = cv2.morphologyEx(al, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        hole = ((closed > 0) & (al == 0) & (a[..., 3] > 0) & (np.arange(H)[:, None] < ground - 5)).astype(np.uint8)   # 원래 몸이 있던 자리만 (바닥 · 발 사이는 비워 둔다)
        if hole.any():
            rgb = cv2.inpaint(np.ascontiguousarray(out[..., :3]), hole, 3, cv2.INPAINT_TELEA)
            out[hole > 0, :3] = rgb[hole > 0]
            out[hole > 0, 3] = 255
        frames.append(Image.fromarray(out, 'RGBA'))
        # 발이 앞뒤로 움직인 거리 (화면에서 미끄러지지 않게 재생 속도를 맞추는 데 쓴다)
        feet.append(float(np.sin(A) * (ground - 70)))
    return frames, max(feet)
