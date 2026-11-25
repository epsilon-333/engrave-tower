# 스킬 장면 붙이기: python3 tools/fxsheet.py <fxshots 폴더> [한 장에 몇 스킬=16] [이름 앞붙임=sheet]
# 한 줄 = 스킬 하나(0.15 · 0.4 · 0.7 · 1.0 · 1.4초), 반 크기로 줄여 여러 스킬을 한 장에
import json, sys
from PIL import Image, ImageDraw
d = sys.argv[1]; per = int(sys.argv[2]) if len(sys.argv) > 2 else 16; pre = sys.argv[3] if len(sys.argv) > 3 else 'sheet'
rep = json.load(open(f'{d}/report.json')); import os
if os.environ.get('CAT'): rep = [r for r in rep if r['cat'] == os.environ['CAT']]
T = ['0.15', '0.4', '0.7', '1', '1.4']
W, H, LW = 192, 120, 0
for i in range(0, len(rep), per):
    chunk = rep[i:i + per]
    img = Image.new('RGB', (W * 5, (H + 14) * len(chunk)), (20, 20, 24)); dr = ImageDraw.Draw(img)
    for j, r in enumerate(chunk):
        y = j * (H + 14)
        dr.text((4, y + 1), f"{r['eid']} / {r['sk']}{'' if r['fired'] else '  [NOT FIRED]'}", fill=(255, 230, 120))
        for k, t in enumerate(T):
            try: im = Image.open(f"{d}/{r['eid']}_{t}.png").resize((W, H))
            except Exception: continue
            img.paste(im, (k * W, y + 14))
    img.save(f'{d}/{pre}_{i // per:02d}.png'); print(f'{d}/{pre}_{i // per:02d}.png')
