// 짐승 · 몬스터의 몸 기술: 각인 스킬을 닮았지만 그 몸에 맞게 — 멧돼지는 박치기로 밀어붙이고, 곰은 일어섰다 내려찍는다
// 모든 기술: 예고(빨간 선 · 원) → 준비 동작(e.pose) → 공격 → 빈틈(회복 동작). 빈틈에 반격하라는 뜻이다
// world.enemyMove가 start를, 기술 중에는 tick을 부른다. e.pose는 렌더러가 몸을 움직이는 데 쓴다 ({ k, t, max })
const DT = 1 / 60; // world.js와 같은 틱

const pose = (e, k, dur) => { e.pose = { k, t: dur, max: dur }; };
const ang = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
// 내가 맞았을 때만 몸 효과(밀려남 · 묶임 · 느려짐)를 건다
function hitP(w, e, dmg, opt = {}) {
  const p = w.player; let landed = false;
  for (const t of w.coTargets()) {
    if (opt.r != null && Math.hypot(t.x - opt.x, t.y - opt.y) > opt.r + (t.r || 5)) continue;
    if (t !== p) { w.enemyArea(e, t.x, t.y, 2, dmg, e.def.type, opt.status); continue; }
    w.hurtPlayer(dmg, e.def.type, e, { status: opt.status ?? e.def.status, fromX: opt.fx ?? e.x, fromY: opt.fy ?? e.y });
    if (!w.hurtLanded) continue;
    landed = true;
    if (opt.knock) w.knockPlayer(opt.fx ?? e.x, opt.fy ?? e.y, opt.knock, { wallStun: opt.wallStun, ang: opt.kang });
    if (opt.root) w.ccPlayer({ root: opt.root });
    if (opt.slow) w.ccPlayer({ slow: opt.slow });
    if (opt.stun) w.ccPlayer({ stun: opt.stun });
  }
  return landed;
}

export const BEAST_NAMES = { headbutt: '박치기', maul: '내려찍기', web: '거미줄', howl: '울부짖음', pounce: '덮치기', tailSweep: '꼬리 휘두르기', burrow: '땅굴 기습', stomp: '발 구르기' };

// 언제 쓸 수 있나 (거리)
export const BEAST_CAN = (e, dist, melee) => ({
  headbutt: dist > 36 && dist < 220, maul: dist < melee + 26, web: dist > 40 && dist < 200, howl: true, pounce: dist > 34 && dist < 150,
  tailSweep: dist < melee + 22, burrow: dist > 50 && dist < 220, stomp: dist < 90,
});

export const BEAST = {
  // 박치기: 고개를 숙이고 뒷발로 땅을 긁다가(0.75초) 일직선으로 들이받는다. 맞으면 멀리 날아가고 벽에 부딪히면 잠깐 기절.
  // 빗나가 벽을 들이받으면 멧돼지가 1.2초 어지럽다 (반격할 때)
  headbutt: {
    start(w, e, p) {
      const a = ang(e, p); e.mv = { k: 'headbutt', ph: 'wind', t: 0.75, ang: a, run: 0 };
      pose(e, 'crouch', 0.75); e.windT = 0.75; e.windMax = 0.75;
      w.emit({ t: 'lineTele', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 200, y2: e.y + Math.sin(a) * 200, dur: 0.75, color: '#ff3a3a', w: e.r * 2 });
      w.emit({ t: 'beastWind', id: e.id, k: 'paw', x: e.x, y: e.y, ang: a });
    },
    tick(w, e, mv, p) {
      if (mv.ph === 'wind') { if (mv.t > 0) { e.dir = Math.cos(mv.ang) < 0 ? -1 : 1; return true; } mv.ph = 'rush'; mv.t = 0.55; pose(e, 'lunge', 0.55); return true; }
      if (mv.ph === 'rush') {
        const sp = e.def.speed * 7 * DT, nx = e.x + Math.cos(mv.ang) * sp, ny = e.y + Math.sin(mv.ang) * sp;
        if (w.blocked(nx, ny, e.r)) { // 벽을 들이받았다: 스스로 어지럽다
          w.emit({ t: 'collide', x: e.x + Math.cos(mv.ang) * e.r, y: e.y + Math.sin(mv.ang) * e.r, wall: true });
          mv.ph = 'dizzy'; mv.t = 1.2; pose(e, 'dizzy', 1.2); w.emit({ t: 'text', x: e.x, y: e.y - 26, text: '어지럽다!', color: '#ffe080' }); return true;
        }
        e.x = nx; e.y = ny; e.moving = true;
        if (!mv.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + (p.r || 5) + 4) {
          mv.hit = true;
          if (hitP(w, e, e.atk * 1.5, { knock: 120, wallStun: 0.8, kang: mv.ang })) w.emit({ t: 'collide', x: p.x, y: p.y });
          mv.ph = 'recover'; mv.t = 0.5; pose(e, 'recover', 0.5); return true;
        }
        if (mv.t > 0) return true;
        mv.ph = 'recover'; mv.t = 0.5; pose(e, 'recover', 0.5); return true;
      }
      if (mv.t > 0) return true; // 어지러움 · 회복: 움직이지 않는다 (빈틈)
      e.mv = null; e.atkCd = 0.6; return true;
    },
  },
  // 내려찍기: 뒷발로 일어서서(0.65초) 앞을 내려찍는다. 맞으면 밀려나고 1.2초 느려진다. 찍은 뒤 0.6초 숨을 고른다
  maul: {
    start(w, e, p) {
      const a = ang(e, p), fx = e.x + Math.cos(a) * (e.r + 14), fy = e.y + Math.sin(a) * (e.r + 14);
      e.mv = { k: 'maul', ph: 'wind', t: 0.65, ang: a, x: fx, y: fy }; pose(e, 'rear', 0.65); e.windT = 0.65; e.windMax = 0.65;
      w.emit({ t: 'telegraphCircle', x: fx, y: fy, r: 30, dur: 0.65 });
    },
    tick(w, e, mv) {
      if (mv.ph === 'wind') {
        if (mv.t > 0) return true;
        hitP(w, e, e.atk * 1.6, { x: mv.x, y: mv.y, r: 30, knock: 70, slow: 1.2, fx: e.x, fy: e.y });
        w.emit({ t: 'skillAoe', x: mv.x, y: mv.y, r: 30, fx: 'smash', lite: true }); w.emit({ t: 'shake', v: 4 });
        mv.ph = 'recover'; mv.t = 0.6; pose(e, 'slam', 0.6); return true;
      }
      if (mv.t > 0) return true;
      e.mv = null; e.atkCd = 0.8; return true;
    },
  },
  // 거미줄: 몸을 낮추고 실을 뱉는다. 맞으면 1.2초 못 움직인다 (구르면 피한다)
  web: {
    start(w, e, p) { e.mv = { k: 'web', t: 0.45, ang: ang(e, p) }; pose(e, 'spit', 0.6); e.windT = 0.45; e.windMax = 0.45; w.emit({ t: 'windup', id: e.id }); },
    tick(w, e, mv) {
      if (mv.t > 0) return true;
      w.projs.push({ owner: 'e', src: e, x: e.x, y: e.y - 4, vx: Math.cos(mv.ang) * 170, vy: Math.sin(mv.ang) * 170, life: 1.4, dmg: e.atk * 0.5, type: 'phys', color: '#f0f0e8', kind: 'web', cc: { root: 1.2, say: '거미줄에 걸렸다' }, big: true });
      e.mv = null; e.atkCd = 0.6; return true;
    },
  },
  // 울부짖음: 고개를 들고 운다. 둘레 140의 무리가 5초 동안 빨라지고(+30%) 세진다(+15%) — 우두머리부터 쓰러뜨리자
  howl: {
    start(w, e) { e.mv = { k: 'howl', t: 0.6 }; pose(e, 'howl', 0.9); e.windT = 0.6; e.windMax = 0.6; },
    tick(w, e, mv) {
      if (mv.t > 0) return true;
      w.emit({ t: 'ring', x: e.x, y: e.y, r: 140, color: '#ffb070' }); w.emit({ t: 'text', x: e.x, y: e.y - 30, text: '아우우—', color: '#ffb070' });
      for (const o of w.enemies) if (!o.dead && !o.howlT && Math.hypot(o.x - e.x, o.y - e.y) < 140) {
        o.howlT = 5; o.speedMul = (o.speedMul || 1) * 1.3; o.atk *= 1.15; if (o.state !== 'chase') w.aggro(o);
        w.delayed.push({ t: 5, run: () => { o.howlT = 0; o.speedMul /= 1.3; o.atk /= 1.15; } });
      }
      e.mv = null; return false;
    },
  },
  // 덮치기: 웅크렸다가 뛰어올라 내 자리로 떨어진다. 깔리면 0.8초 못 움직이고 물어뜯긴다(출혈). 떨어진 뒤 0.5초 빈틈
  pounce: {
    start(w, e, p) {
      e.mv = { k: 'pounce', ph: 'wind', t: 0.4, x0: e.x, y0: e.y, x: p.x, y: p.y }; pose(e, 'crouch', 0.4); e.windT = 0.4; e.windMax = 0.4;
      w.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 22, dur: 0.95 });
    },
    tick(w, e, mv) {
      if (mv.ph === 'wind') { if (mv.t > 0) return true; mv.ph = 'air'; mv.t = mv.max = 0.55; pose(e, 'leap', 0.55); return true; }
      if (mv.ph === 'air') {
        const k = 1 - Math.max(0, mv.t) / mv.max, nx = mv.x0 + (mv.x - mv.x0) * k, ny = mv.y0 + (mv.y - mv.y0) * k;
        if (!w.blocked(nx, ny, e.r)) { e.x = nx; e.y = ny; } e.moving = true; e.jumpH = Math.sin(k * Math.PI) * 20;
        if (mv.t > 0) return true;
        e.jumpH = 0;
        if (hitP(w, e, e.atk * 1.2, { x: e.x, y: e.y, r: 22, root: 0.8, status: 'bleed' })) w.emit({ t: 'text', x: e.x, y: e.y - 30, text: '깔렸다!', color: '#ff8a5a' });
        w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 20, fx: 'claws', lite: true }); w.emit({ t: 'shake', v: 2.5 });
        mv.ph = 'recover'; mv.t = 0.5; pose(e, 'recover', 0.5); return true;
      }
      if (mv.t > 0) return true;
      e.mv = null; e.atkCd = 0.5; return true;
    },
  },
  // 꼬리 휘두르기: 몸을 비틀었다가(0.5초) 꼬리로 둘레를 한 바퀴 쓴다. 맞으면 옆으로 날아간다
  tailSweep: {
    start(w, e) { e.mv = { k: 'tailSweep', t: 0.5 }; pose(e, 'coil', 0.5); e.windT = 0.5; e.windMax = 0.5; w.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: e.r + 24, dur: 0.5 }); },
    tick(w, e, mv, p) {
      if (mv.ph !== 'recover') {
        if (mv.t > 0) return true;
        const side = ang(e, p) + Math.PI / 2 * (e.dir || 1);
        hitP(w, e, e.atk * 1.2, { x: e.x, y: e.y, r: e.r + 24, knock: 80, kang: side });
        w.emit({ t: 'spin', x: e.x, y: e.y, r: e.r + 24, heavy: true }); w.emit({ t: 'shake', v: 2 });
        mv.ph = 'recover'; mv.t = 0.45; pose(e, 'recover', 0.45); return true;
      }
      if (mv.t > 0) return true;
      e.mv = null; e.atkCd = 0.7; return true;
    },
  },
  // 땅굴 기습: 땅속으로 파고들어(0.5초) 내 발밑을 따라온다. 솟기 0.8초 전에 흙이 들썩인다(예고). 솟아오르면 위로 튕겨 0.5초 기절
  burrow: {
    start(w, e) { e.mv = { k: 'burrow', ph: 'dig', t: 0.5 }; pose(e, 'burrow', 0.5); w.emit({ t: 'burst', x: e.x, y: e.y, color: '#a89880' }); },
    tick(w, e, mv, p) {
      if (mv.ph === 'dig') { if (mv.t > 0) return true; mv.ph = 'under'; mv.t = 1.1; e.under = true; return true; }
      if (mv.ph === 'under') {
        if (mv.t > 0.8) { const a = ang(e, p), sp = e.def.speed * 2.2 * DT; if (!w.blocked(e.x + Math.cos(a) * sp, e.y + Math.sin(a) * sp, e.r)) { e.x += Math.cos(a) * sp; e.y += Math.sin(a) * sp; } return true; }
        if (!mv.marked) { mv.marked = true; mv.x = p.x; mv.y = p.y; w.emit({ t: 'telegraphCircle', x: p.x, y: p.y, r: 26, dur: 0.8 }); w.emit({ t: 'text', x: p.x, y: p.y - 22, text: '땅이 들썩인다!', color: '#e8c890' }); }
        if (mv.t > 0) return true;
        e.under = false; if (!w.blocked(mv.x, mv.y, e.r)) { e.x = mv.x; e.y = mv.y; }
        hitP(w, e, e.atk * 1.5, { x: e.x, y: e.y, r: 26, stun: 0.5 });
        w.emit({ t: 'emerge', x: e.x, y: e.y, id: e.id }); w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 26, fx: 'rocks', lite: true }); w.emit({ t: 'shake', v: 3 });
        mv.ph = 'recover'; mv.t = 0.7; pose(e, 'recover', 0.7); return true;
      }
      if (mv.t > 0) return true;
      e.mv = null; e.atkCd = 0.6; return true;
    },
  },
  // 발 구르기: 크게 일어섰다가(0.8초) 땅을 구른다. 둘레 80이 바깥으로 밀려난다
  stomp: {
    start(w, e) { e.mv = { k: 'stomp', t: 0.8 }; pose(e, 'rear', 0.8); e.windT = 0.8; e.windMax = 0.8; w.emit({ t: 'telegraphCircle', x: e.x, y: e.y, r: 80, dur: 0.8 }); },
    tick(w, e, mv) {
      if (mv.ph !== 'recover') {
        if (mv.t > 0) return true;
        hitP(w, e, e.atk * 1.3, { x: e.x, y: e.y, r: 80, knock: 90 });
        w.emit({ t: 'skillAoe', x: e.x, y: e.y, r: 80, fx: 'quake', lite: true }); w.emit({ t: 'ring', x: e.x, y: e.y, r: 80, color: '#c8a070' }); w.emit({ t: 'shake', v: 5 });
        mv.ph = 'recover'; mv.t = 0.7; pose(e, 'slam', 0.7); return true;
      }
      if (mv.t > 0) return true;
      e.mv = null; e.atkCd = 0.8; return true;
    },
  },
};

// 몬스터마다 몸에 맞는 기술 (이미 있는 기술 목록 앞에 붙인다)
export const BEAST_KIT = {
  chargeBoar: ['headbutt', 'headbutt'], boarRunner: ['headbutt', 'combo'], bigBeetle: ['headbutt', 'stomp'], ironBeetle: ['headbutt', 'leap'],
  yeti: ['maul', 'pounce'], swampTroll: ['maul', 'combo'], magmaGolem: ['maul', 'stomp'], iceGolem: ['maul', 'stomp'], rockGolem: ['stomp', 'maul'], ruinSentinel: ['stomp', 'combo'], ghoul: ['pounce', 'combo'],
  poisonSpider: ['web', 'pounce'], glassSpider: ['web', 'leap'], caveLurker: ['pounce', 'web'],
  hyena: ['howl', 'pounce'], iceWolf: ['howl', 'pounce', 'combo'], frostWolf: ['pounce', 'combo'], raptor: ['pounce', 'combo'], raptorAlpha: ['howl', 'pounce', 'headbutt', 'tailSweep'], shadowPanther: ['pounce', 'blink'],
  desertScorpion: ['tailSweep', 'spiral'], sandScorpion: ['tailSweep', 'combo'], lizardWarrior: ['tailSweep', 'combo', 'leap'], lavaLizard: ['tailSweep', 'pool'], salamander: ['tailSweep', 'combo'], coralCrab: ['maul', 'tailSweep'],
  sandWorm: ['burrow', 'combo'], mudLurker: ['burrow'], snowLurker: ['burrow', 'pounce'], seaSerpent: ['tailSweep', 'burrow'],
};
