"""보스 동작에 사이 그림을 넣는다: 앞뒤 장면 사이의 움직임(광류)을 재서, 앞 장면을 반쯤 옮긴 그림을 사이에 끼운다.
색은 원래 두 장면에 있던 색으로만 맞춘다 (도트 느낌 그대로 · 섞어서 흐리게 하지 않는다).

  python3 tools/boss_tween.py          # bosses.png · tools/sprites/bosses.json 을 고쳐 쓰고 sprites.json 을 다시 만든다

- 되풀이 동작(서기 · 걷기 · 맞음): n장 → 2n장 (마지막 → 처음 사이에도)
- 한 번 동작(공격 · 기술 · 쓰러짐): n장 → 2n-1장
- 한 장뿐인 동작은 그대로
- 이미 넣은 보스(meta 'tween')는 건너뛴다. cut_bosses.py build · cut_boss_sheets.py --write 를 다시 돌렸으면 이것도 다시 돌린다
- 게임(render/renderer.js bossFrame)은 넣은 뒤의 장수에 맞춰 넘기는 빠르기를 정한다
필요: Pillow · numpy · opencv-python-headless
"""
import json, os
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, '..', 'public', 'assets', 'custom', 'bosses.png')
LOOP = {'idle', 'run', 'hit'}


def flow(a, b):
    ga = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY); gb = cv2.cvtColor(b[..., :3], cv2.COLOR_RGB2GRAY)
    ga[a[..., 3] < 40] = 0; gb[b[..., 3] < 40] = 0
    return cv2.calcOpticalFlowFarneback(gb, ga, None, 0.5, 3, 9, 5, 5, 1.1, 0)  # 가운데 → 앞 장면으로 가는 흐름


def tween(a, b, pal):
    f = flow(a, b)
    h, w = f.shape[:2]; gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    m = cv2.remap(a, (gx + f[..., 0] * 0.5).astype(np.float32), (gy + f[..., 1] * 0.5).astype(np.float32), cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    flat = m.reshape(-1, 4).astype(int); p = pal.astype(int)
    idx = ((flat[:, None, :3] - p[None, :, :3]) ** 2).sum(-1).argmin(1)  # 원래 색으로만
    out = p[idx]; out[flat[:, 3] < 100] = 0
    return out.reshape(m.shape).astype(np.uint8)


def main():
    import sys; sys.path.insert(0, HERE)
    from sprites import meta_path, build_manifest
    mf = meta_path('bosses'); meta = json.load(open(mf, encoding='utf-8'))
    src = np.array(Image.open(SHEET).convert('RGBA'))
    plan = {}  # 보스 → 동작 → 새 장면들
    for pre, m in meta.items():
        W, H, y0 = m['w'], m['h'], m['y0']
        rows = {}
        for k, a in m['anims'].items():
            y = y0 + a['row'] * H
            fr = [src[y:y + H, i * W:(i + 1) * W].copy() for i in range(a['n'])]
            if m.get('tween') or len(fr) < 2: rows[k] = fr; continue
            pal = np.unique(np.concatenate([f.reshape(-1, 4) for f in fr]), axis=0); pal = pal[pal[:, 3] > 200]
            out = []
            for i in range(len(fr)):
                out.append(fr[i])
                if k in LOOP or i < len(fr) - 1: out.append(tween(fr[i], fr[(i + 1) % len(fr)], pal))
            rows[k] = out
        plan[pre] = rows
    width = max(len(fr) * meta[pre]['w'] for pre, rows in plan.items() for fr in rows.values())
    sheet = np.zeros((src.shape[0], max(width, src.shape[1]), 4), np.uint8)
    n_new = 0
    for pre, rows in plan.items():
        m = meta[pre]; W, H, y0 = m['w'], m['h'], m['y0']
        for k, fr in rows.items():
            y = y0 + m['anims'][k]['row'] * H
            for i, f in enumerate(fr): sheet[y:y + H, i * W:(i + 1) * W] = f
            if not m.get('tween'): n_new += len(fr) - m['anims'][k]['n']
            m['anims'][k]['n'] = len(fr)
        m['tween'] = 1
    Image.fromarray(sheet).save(SHEET, optimize=True)
    json.dump(meta, open(mf, 'w', encoding='utf-8'), ensure_ascii=False)
    build_manifest()
    print(f'bosses.png {sheet.shape[1]}x{sheet.shape[0]} · 사이 그림 {n_new}장')


if __name__ == '__main__':
    main()
