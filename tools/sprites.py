"""도트 그림 시트 목록: 그림 만드는 도구(people.py · creatures.py · raptor.py · dragonkin.py · cut_sheet.py)는
그림(.png)을 public/assets/custom/ 에, 칸 정보(.json)를 tools/sprites/ 에 쓰고, 마지막에 build_manifest()로
게임이 읽는 목록 하나(public/assets/custom/sprites.json)를 다시 만든다.

sprites.json 형식 (모든 시트가 같은 형식):
  {"sheets": [{"img": "people.png", "prefix": "p_altar", "w": 26, "h": 32, "y0": 0, "anims": {"idle": {"row": 0, "n": 4}}}, ...],
   "meta": {"true_dragon": {...}, "king": {"fire": {...}, ...}}}
  프레임 이름 = {prefix}_{anim}_anim_f{i}, 자리 = (i*w, y0 + row*h)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
META = os.path.join(HERE, 'sprites')
OUT = os.path.join(HERE, '..', 'public', 'assets', 'custom')

def meta_path(name):
    os.makedirs(META, exist_ok=True)
    return os.path.join(META, name + '.json')

def _load(name):
    p = meta_path(name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None

def build_manifest(out=OUT):
    sheets, meta = [], {}
    def add(img, prefix, m, y0=0):
        sheets.append({'img': img, 'prefix': prefix, 'w': m['w'], 'h': m['h'], 'y0': y0, 'anims': m['anims']})
    dk = _load('dragonkin')
    if dk: add('dragonkin.png', 'dragonkin', dk)
    pp = _load('people')
    if pp:
        for cid, c in pp['chars'].items(): add('people.png', 'p_' + cid, {'w': pp['w'], 'h': pp['h'], 'anims': c['anims']})
    rp = _load('raptors')
    if rp:
        for key, prefix in (('raptor', 'raptor_beast'), ('raptor_alpha', 'raptor_alpha'), ('raptor_mount', 'raptor_mount')):
            if key in rp: add(key + '.png', prefix, rp[key])
    cr = _load('creatures')
    if cr:
        for cid, c in cr.items(): add('creatures.png', 'c_' + cid, c, c.get('y0', 0))
    hr = _load('heroes')  # 플레이어 종족 (tools/heroes.py)
    if hr:
        for rid, c in hr.items(): add('heroes.png', 'h_' + rid, c, c.get('y0', 0))
    sm = _load('sheet_meta')
    if sm:
        if 'dragon_fire' in sm: add('dragon_fire.png', 'true_dragon', sm['dragon_fire']); meta['true_dragon'] = sm['dragon_fire']
        king = {}
        for k in ('fire', 'wind', 'forest'):
            if 'king_' + k in sm: add(f'king_{k}.png', 'king_' + k, sm['king_' + k]); king[k] = sm['king_' + k]
        if king: meta['king'] = king
    json.dump({'sheets': sheets, 'meta': meta}, open(os.path.join(out, 'sprites.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('sprites.json:', len(sheets), 'sheets')

if __name__ == '__main__':
    build_manifest(sys.argv[1] if len(sys.argv) > 1 else OUT)
