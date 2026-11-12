// 렌더러 — 세계가 낸 사건(world.events)을 이펙트 · 소리 · 글로 바꾼다
// Renderer.prototype 에 그대로 붙는다 (render/renderer.js 끝). 메서드 안의 this 는 Renderer

import { opts } from '../settings.js';
import { TILE } from '../sim/mapgen.js';
import { GOODS, FISH, ARTIFACTS } from '../data/goods.js';
import { SANCTUMS } from '../data/sanctums.js';
import { G } from '../data/maps/overworld.js';
import { renderMap } from './tiles.js';
import { ECHOES } from '../data/monsters.js';
import { ELEM } from '../data/skills.js';
import { PAL } from './skillanim.js';
import { STORY_ITEMS } from '../data/story.js';
import { sfx, tone } from '../audio.js';
import { towerEvent } from './towerfx.js';
import { CLASS_MAGIC, WORD_NAME, sentenceLine, WORD_COLOR, fmt } from './renderer.js';

const TIER_EV = new Set(['skillAoe', 'skillCone', 'skillLine', 'skillSingle', 'skillDash', 'meleeStep', 'skillFx', 'slam', 'land']); // 등급에 맞춰 다듬는 사건

export const EventMethods = {
  consume(w) {
    let pend = null; // 등급 다듬기: 사건 하나가 만든 이펙트를 다음 사건으로 넘어가기 전에 등급에 맞춘다
    for (const ev of w.events) {
      if (pend) { this.tierPolish(w, pend); pend = null; }
      if (ev.tier != null && TIER_EV.has(ev.t)) pend = { ev, parts: this.parts.length, fx: this.fx.length, al: this.anims.list.length, ag: this.anims.ground.length, px: this.anims.px.list.length, shake: this.shake, hitstop: this.hitstop, flash: this.flash };
      if (this.lifeEvent(w, ev)) continue;
      if (w.climb && towerEvent(this, w, ev)) continue; // 탑 51~100층 장치 · 보스 등장
      switch (ev.t) {
        case 'dmg':
          if (ev.who === 'p') {
            this.texts.push({ x: ev.x, y: ev.y, text: fmt(ev.v), color: '#ff6060', t: 0.9, vy: -26, vx: 0, size: 2, pop: 0.12 });
            this.hurtFlash = 0.35; sfx('hurt', { vol: 0.8 });
            break;
          }
          { // 같은 적에게 짧은 사이에 들어온 피해는 숫자 하나로 합친다 (숫자가 겹쳐 지저분하지 않게) · 치명타는 따로 크게
            const same = ev.id != null && this.texts.find((q) => q.tid === ev.id && !!q.crit === !!ev.crit && q.t > 0.35); // 0.4초 안의 같은 적 피해는 하나로 (치명타는 치명타끼리)
            if (opts.dmgNum === 'off' || (opts.dmgNum === 'crit' && !ev.crit)) { /* 설정: 피해 숫자 숨김 */ }
            else if (same) { same.val += ev.v; same.text = fmt(same.val); same.t = 0.75; same.pop = 0.07; if (ev.heavy) same.heavy = true; }
            else this.texts.push({ tid: ev.id, val: ev.v, x: ev.x + (Math.random() - 0.5) * 6, y: ev.y, text: fmt(ev.v), color: ev.color, t: 0.75, crit: ev.crit, heavy: ev.heavy, small: ev.small, vy: -34, vx: (Math.random() - 0.5) * 24, pop: ev.crit || ev.heavy ? 0.14 : 0.07 });
          }
          if (ev.id != null) { this.squash.set(ev.id, 0.14); this.hpShow.set(ev.id, (this.world?.t ?? 0) + 3); }
          if (ev.src === 'attack' || ev.src === 'skill') this.hitstop = Math.max(this.hitstop, ev.crit ? 0.07 : ev.heavy ? 0.055 : 0.035); // 히트스톱: 맞힌 순간 아주 잠깐 멈춘다
          if (!ev.small && ev.src !== 'dot' && ev.src !== 'linked') this.hitPop(ev.x, ev.y + 6, ev.color === '#ffffff' ? '#fff2c0' : ev.color, ev.crit ? 2 : ev.heavy || ev.src === 'aoe' || ev.src === 'skill' ? 1 : 0);
          if (ev.src === 'attack') {
            this.sparkBurst(ev.x, ev.y + 8, ev.crit ? '#ffe060' : '#ffffff', ev.crit ? 10 : 5);
            this.fx.push({ k: 'glow', x: ev.x, y: ev.y + 4, r: ev.crit || ev.heavy ? 22 : 14, color: ev.crit ? '#ffe060' : '#fff4e0', t: 0.12, max: 0.12 });
            this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 8, r: ev.crit || ev.heavy ? 12 : 8, color: ev.crit ? '#ffe060' : ev.color, t: 0.12, max: 0.12 });
            sfx(ev.armored ? 'hitArmor' : ev.crit || ev.heavy ? 'hitHeavy' : 'hit', { vol: 0.75 });
          } else if (ev.src === 'aoe' || ev.src === 'reaction') sfx('hit', { vol: 0.4, rate: 1.2 });
          break;
        case 'text':
          this.texts.push({ x: ev.x, y: ev.y, text: ev.text, color: ev.color, t: 1.1, vy: -16, vx: 0, label: true });
          if (ev.text === '빙결') sfx('freeze', { vol: 0.6 });
          break;
        case 'dodgeFx': { // 회피: 큰 「회피!」 + 맞을 쪽 반대로 비켜서는 흐린 잔영
          this.texts.push({ x: ev.x, y: ev.y - 20, text: '회피!', color: '#bfffe0', t: 0.9, vy: -18, vx: 0, label: true, size: 2, pop: 0.15 });
          const sd = ev.x >= ev.fx ? 1 : -1;
          this.fx.push({ k: 'line', x1: ev.x - sd * 8, y1: ev.y - 6, x2: ev.x + sd * 6, y2: ev.y - 6, t: 0.25, max: 0.25 });
          this.dodgeLean = { t: 0.18, sd };
          sfx('dash', { vol: 0.35, rate: 1.4 });
          break;
        }
        case 'reaction':
          this.texts.push({ x: ev.x, y: ev.y, text: ev.text + '!', color: ev.color, t: 1.4, vy: -12, vx: 0, label: true, size: 2, pop: 0.2 });
          if (ev.r) this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 20, r: ev.r, color: ev.color, t: 0.45, max: 0.45, w: 3 });
          this.burst(ev.x, ev.y + 20, ev.color, 22, 130);
          this.shake = Math.max(this.shake, 3); sfx('reaction', { vol: 0.5 });
          break;
        case 'ring': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: ev.color, t: 0.3, max: 0.3, w: 2 }); break;
        case 'swing': {
          this.fx.push({ k: 'slash', ...ev, t: ev.dur + 0.1, max: ev.dur + 0.1 });
          const col = ev.heavy ? '#ffd050' : ev.type === 'mag' ? '#c9a8ff' : '#e8f0ff';
          for (let i = 0; i < (ev.heavy ? 12 : 6); i++) {
            const a = ev.ang + (Math.random() - 0.5) * (ev.arc || 1.5), rr = ev.range * (0.7 + Math.random() * 0.4);
            this.parts.push({ x: ev.x + Math.cos(a) * rr, y: ev.y - 6 + Math.sin(a) * rr, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: 0.25, max: 0.25, color: col, g: 0, line: true });
          }
          if (ev.heavy) { this.shake = Math.max(this.shake, 2); this.burst(ev.x + Math.cos(ev.ang) * 18, ev.y + Math.sin(ev.ang) * 18, '#c8b898', 8, 60); }
          if (ev.enchant) this.enchantTrail(ev);
          sfx(ev.whip ? 'swing' : ev.heavy ? 'heavySwing' : 'swing', { vol: 0.55, rate: ev.whip ? 1.5 : ev.fist ? 1.7 : 1 });
          break;
        }
        case 'shoot': sfx(ev.type === 'mag' ? 'cast' : 'shoot', { vol: 0.4, rate: ev.type === 'mag' ? 1.6 : 1.3 }); break;
        case 'spin': {
          const pl = this.world?.player, own = !!pl && Math.hypot(ev.x - pl.x, ev.y - pl.y) < 40; // 내가 도는 베기: 칼 잔상이 그린다
          if (own) this.trailStyle = { col: ev.heavy ? '#ffd870' : ev.type === 'mag' ? '#c9a8ff' : '#dcecff', reach: ev.r || 40, until: (this.world?.t || 0) + 0.45 };
          this.fx.push({ k: 'spin', ...ev, own, a0: ev.ang ?? Math.random() * 6.28, dir: ev.dir || (Math.random() < 0.5 ? 1 : -1), t: 0.3, max: 0.3 });
          // 발밑 흙먼지가 바깥으로 튄다
          for (let i = 0; i < (ev.heavy ? 12 : 7); i++) { const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 60; this.parts.push({ x: ev.x + Math.cos(a) * 4, y: ev.y + 2 + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.45, t: 0.5, max: 0.5, color: '#d8ccb4', g: -8, steam: true }); }
          this.shake = Math.max(this.shake, ev.heavy ? 4 : 2.5); sfx('heavySwing', { vol: 0.7, rate: 0.9 + Math.random() * 0.2 });
          break;
        }
        case 'nova': this.fx.push({ k: 'nova', ...ev, t: 0.4, max: 0.4 }); this.burst(ev.x, ev.y, '#c9a8ff', 30, 160); this.shake = 4; sfx('skill', { vol: 0.6 }); sfx('reaction', { vol: 0.4, rate: 1.4 }); break;
        case 'volley': sfx('skill', { vol: 0.5 }); sfx('shoot', { vol: 0.6 }); break;
        case 'afterimage': this.fx.push({ k: 'line', ...ev, t: 0.3, max: 0.3 }); break;
        case 'meleeStep': { // 근접 스킬의 내딛기: 박찬 자리에 흙이 차이고 몸의 잔상이 따라온다 (등급만큼 늘어난다: tierPolish)
          const dx = ev.x2 - ev.x1, dy = ev.y2 - ev.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
          this.fx.push({ k: 'ghost', x: ev.x1 + dx * 0.35, y: ev.y1 + dy * 0.35, t: 0.16, max: 0.22, dir: dx > 0 ? 1 : -1 });
          for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x1 - ux * 2, y: ev.y1 + 4, vx: -ux * (26 + Math.random() * 30) + (Math.random() - 0.5) * 16, vy: -uy * 14 - 8 - Math.random() * 12, t: 0.4, max: 0.4, color: '#a89880', g: 60, puff: true, size: 2 });
          this.shake = Math.max(this.shake, 1.5); sfx('dash', { vol: 0.35, rate: 1.3 });
          break;
        }
        case 'dash': { // 구르기: 박차는 발밑에서 흙이 뒤로 차이고, 지나간 길에 미끄러진 자국이 남았다가 메워진다
          const l = Math.hypot(ev.dx || 0, ev.dy || 0) || 1, ux = (ev.dx || 0) / l, uy = (ev.dy || 0) / l;
          for (let i = 0; i < 6; i++) this.parts.push({ x: ev.x - ux * 3, y: ev.y + 4, vx: -ux * (30 + Math.random() * 40) + (Math.random() - 0.5) * 20, vy: -uy * 20 - 10 - Math.random() * 15, t: 0.5, max: 0.5, color: '#a89880', g: 60, puff: true, size: 2.5 });
          for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x, y: ev.y + 3, vx: -ux * (40 + Math.random() * 50), vy: -30 - Math.random() * 30, t: 0.4, max: 0.4, color: '#7a6448', g: 380, chunk: true, floor: ev.y + 4 });
          this.anims.curSkid = { type: 'skid', pts: [{ x: ev.x, y: ev.y + 4 }], ux, uy, t: 0, max: 1.1 }; this.anims.ground.push(this.anims.curSkid);
          sfx('dash', { vol: 0.6 }); break;
        }
        case 'skyFall': { if (ev.enemy) this.skyFallMark = { x: ev.x, y: ev.y }; for (let i = 0; i < 6; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 10, y: ev.y + 2, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, t: 0.5, max: 0.5, color: '#9a8a72', g: 200 }); sfx('dash', { vol: 0.5, rate: 0.6 }); break; } // 하늘로 떨어짐: 가장자리 흙이 같이 떨어진다
        case 'death': {
          // 쓰러진다: 몸이 옆으로 넘어가 땅에 엎어지고(먼지) · 잠깐 누워 있다가 · 흙 속으로 가라앉는다 (반투명으로 흐려지지 않는다)
          const skyF = this.skyFallMark && Math.hypot(this.skyFallMark.x - ev.x, this.skyFallMark.y - ev.y) < 4; if (skyF) this.skyFallMark = null; // 하늘로 떨어진 몬스터: 넘어지지 않고 구름 아래로
          if (ev.defId) { const mx = skyF ? 1.1 : ev.big ? 2.4 : 1.8; this.corpses.push({ defId: ev.defId, x: ev.x, y: ev.y, dir: ev.dir || 1, big: !!ev.big, t: mx, max: mx, landed: false, sky: skyF }); }
          else this.burst(ev.x, ev.y - 6, ev.color, ev.big ? 30 : 10, ev.big ? 140 : 80);
          if (ev.big) this.shake = 8;
          sfx('death', { vol: ev.big ? 1 : 0.6, rate: ev.big ? 0.7 : 1 });
          break;
        }
        case 'echo':
          this.texts.push({ x: ev.x, y: ev.y - 18, text: '+' + ECHOES[ev.id].name, color: ECHOES[ev.id].color, t: 1.5, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, ECHOES[ev.id].color, 10, 50);
          sfx('echo', { vol: 0.6 });
          break;
        case 'pickup': this.sparkBurst(ev.x, ev.y - 4, '#ffcf3a', 3); sfx('coin', { vol: 0.35, rate: 1.2 }); break;
        case 'shake': this.shake = Math.max(this.shake, ev.v); break;
        case 'telegraph': this.fx.push({ k: 'tele', ...ev, t: 0.6, max: 0.6 }); break;
        case 'windup': this.alerts.set(ev.id, 0.4); break;
        case 'strike': this.fx.push({ k: 'claw', ...ev, t: 0.16, max: 0.16 }); this.lunge.set(ev.id, { t: 0.14, ang: ev.ang }); break;
        case 'banner': this.banner = { text: ev.text, sub: ev.sub, t: ev.sub ? 3.5 : 2.5, color: ev.color }; sfx('levelup', { vol: 0.6 }); break;
        case 'hitstop': this.hitstop = Math.max(this.hitstop, ev.v); break;
        case 'deflect': sfx('hitArmor', { vol: 0.35, rate: 1.6 }); this.texts.push({ x: ev.x, y: ev.y - 8, text: '쳐냄', color: '#e8e0c8', t: 0.6, vy: -20, vx: 0, label: true }); break; // 근접이 적 탄을 쳐냈다
        case 'bossHeal': { // 보스 회복: 몸이 초록빛으로 번쩍 · 초록 빛알이 솟는다 · 체력바에 되찾은 몫 (회복 의식은 크게)
          this.healFx.set(ev.id, { t: ev.big ? 1.2 : 0.6, max: ev.big ? 1.2 : 0.6, from: ev.from, to: ev.to });
          const n = ev.big ? 34 : 5, rr = ev.big ? 44 : 22;
          for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * rr; this.parts.push({ x: ev.x + Math.cos(a) * r, y: ev.y - 6 - Math.random() * 40, vx: Math.cos(a) * 8, vy: -30 - Math.random() * 40, t: 0.9 + Math.random() * 0.5, max: 1.4, color: Math.random() < 0.5 ? '#7be38a' : '#d8ffc0', g: -10, size: ev.big && Math.random() < 0.4 ? 3 : 2 }); }
          if (ev.big) { this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 20, r: 60, color: '#7be38a', t: 0.6, max: 0.6 }); sfx('levelup', { vol: 0.4, rate: 1.6 }); }
          break;
        }
        case 'alert': this.alerts.set(ev.id, -0.7); break;
        case 'spark': this.sparkBurst(ev.x, ev.y, ev.color, 4); break;
        case 'chest': this.chestOpen.set(`${ev.x},${ev.y}`, 0); this.burst(ev.x, ev.y - 6, ev.rich ? '#d8a8ff' : '#ffe08a', 30, 120); this.shake = 2; sfx('chest', { vol: 0.7 }); sfx('coin', { vol: 0.6 }); break;
        case 'crackHit': this.burst(ev.x, ev.y, '#a89880', 6, 60); this.shake = Math.max(this.shake, 1.5); sfx('crack', { vol: 0.6 }); break;
        case 'region':
          if (ev.vista && ev.first) break; // 전망대는 따로 연출
          this.banner = { text: ev.name, sub: [ev.lv ? `권장 Lv ${ev.lv[0]}~${ev.lv[1]}` : '', ev.first ? '새 장소 발견 · 도감 +2' : ''].filter(Boolean).join(' · '), t: ev.first ? 3 : 2.2, color: '#e8dcc0' };
          if (ev.first) sfx('levelup', { vol: 0.4, rate: 1.2 });
          break;
        case 'vista': this.vista = { t: 0, name: ev.name }; sfx('levelup', { vol: 0.5, rate: 0.6 }); break;
        case 'codexStage':
          this.note(ev.stage >= 3 ? `도감 · ${ev.name} 완성!` : `도감 · ${ev.name} ${ev.stage}단계 (다음: ${ev.next}마리)`, ev.stage >= 3 ? '#ffe080' : '#c8e8ff');
          this.texts.push({ x: ev.x, y: ev.y - 20, text: ev.stage >= 3 ? '도감 완성' : `도감 ${ev.stage}단계`, color: '#c8e8ff', t: 1.4, vy: -12, vx: 0, label: true });
          sfx('echo', { vol: 0.5, rate: 0.8 });
          break;
        case 'shardGet': {
          const S = SANCTUMS[ev.race];
          this.note(`${S.relic} 조각 (${S.name})`, S.color);
          this.texts.push({ x: ev.x, y: ev.y - 18, text: `+${S.relic} 조각`, color: S.color, t: 1.4, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, S.color, 10, 50);
          sfx('echo', { vol: 0.5, rate: 1.3 });
          break;
        }
        case 'storyItem': {
          const it = STORY_ITEMS[ev.id];
          this.note(`${it.name}${it.max > 1 ? ` ${Math.min(ev.n, it.max)}/${it.max}` : ''}`, it.color);
          this.texts.push({ x: ev.x, y: ev.y - 18, text: '+' + it.name, color: it.color, t: 1.6, vy: -12, vx: 0, label: true });
          this.burst(ev.x, ev.y, it.color, 14, 60);
          if (ev.n === 1 && !this.seenItem?.[ev.id]) { (this.seenItem ||= {})[ev.id] = 1; this.calmBanner({ text: it.name, sub: it.desc, t: 3.5, color: it.color }); }
          sfx('lore', { vol: 0.5 });
          break;
        }
        case 'barrierOpen': this.burst(ev.x, ev.y, ev.look === 'thorn' ? '#6a9a3a' : ev.look === 'bars' ? '#a8885a' : '#8a7a6a', 40, 120); this.shake = 4; sfx('crack', { vol: 0.9, rate: 0.8 }); break;
        case 'locked': sfx('error', { vol: 0.3 }); break;
        case 'aura': this.rimFlash = { color: '#ffd84a', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, 46, '#ffd84a', 26); this.burst(ev.x, ev.y - 6, '#ffd84a', 30, 120); sfx('reaction', { vol: 0.6, rate: 1.3 }); this.shake = 3; break;
        case 'rage': this.rimFlash = { color: '#ff4030', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, 46, '#ff4030', 26); this.burst(ev.x, ev.y - 6, '#ff4030', 30, 120); sfx('hitHeavy', { vol: 0.7, rate: 0.7 }); this.shake = 4; break;
        case 'skill': sfx('skill', { vol: 0.55 }); break;
        case 'slam': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#ffe8a0', t: 0.45, max: 0.45, w: 5 }); this.burst(ev.x, ev.y, '#c8b898', 40, 150); this.shake = 7; sfx('hitHeavy', { vol: 1, rate: 0.6 }); break;
        case 'meteor': this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c9a8ff', t: 0.6, max: 0.6, w: 6 }); this.burst(ev.x, ev.y, '#c9a8ff', 60, 200); this.burst(ev.x, ev.y, '#ffffff', 20, 120); sfx('reaction', { vol: 1, rate: 0.7 }); break;
        case 'telegraphCircle': this.fx.push({ k: ev.inner ? 'tdonut' : 'tcircle', x: ev.x, y: ev.y, r: ev.r, inner: ev.inner, t: ev.dur, max: ev.dur, follow: ev.follow }); break;
        case 'noMana':
          if ((this.noManaT || 0) < w.t) { this.noManaT = w.t + 1; this.texts.push({ x: ev.x, y: ev.y - 22, text: '마력 부족', color: '#7aa8ff', t: 0.9, vy: -14, vx: 0, label: true }); sfx('error', { vol: 0.3 }); }
          break;
        case 'fuse': this.alerts.set(ev.id, 0.55); sfx('windup', { vol: 0.6, rate: 1.6 }); break;
        case 'emerge': this.burst(ev.x, ev.y + 2, '#8a7a5a', 18, 90); sfx('crack', { vol: 0.5, rate: 1.3 }); break;
        case 'summon': if (!this.anims.px.add('spawn/summon-rise', ev.x, ev.y + 3, { scale: 0.8, max: 1.6 })) this.burst(ev.x, ev.y, '#c45cff', 12, 60); break; // 소환: 땅이 갈라지며 기어 나온다 (pixelfx)
        case 'parryFx': this.anims.px.add('impacts/parry', ev.x, ev.y, { scale: 0.8, floor: 0, max: 0.6 }); sfx('hitHeavy', { vol: 0.5, rate: 1.6 }); break;
        case 'camp': this.burst(ev.x, ev.y - 4, '#ffd88a', 16, 60); sfx('levelup', { vol: 0.4 }); break;
        case 'skillFx': this.skillFx(ev); break;
        case 'soulGet': {
          const pl = w.player;
          for (let i = 0; i < 10; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 8, y: ev.y - 6, vx: (pl.x - ev.x) * 1.6 + (Math.random() - 0.5) * 40, vy: (pl.y - ev.y) * 1.6 - 40, t: 0.6, max: 0.6, color: '#7ae8ff', g: 60 });
          this.texts.push({ x: ev.x, y: ev.y - 20, text: `영혼 ${ev.n}/10`, color: '#7ae8ff', t: 0.9, vy: -14, vx: 0, label: true });
          sfx('echo', { vol: 0.35, rate: 1.4 });
          break;
        }
        case 'tauntLink': this.fx.push({ k: 'link', ...ev, color: ev.color || '#c45cff', t: 0.5, max: 0.5 }); break;
        case 'allyHurt': this.sparkBurst(ev.x, ev.y - 6, '#7ae8ff', 3); break;
        case 'mountOn': sfx('dash', { vol: 0.6, rate: 0.7 }); this.burst(ev.x, ev.y + 2, '#9a8e7e', 10, 50); this.texts.push({ x: ev.x, y: ev.y - 30, text: '랩터에 올라탔다 · V로 내린다', color: '#9fe8b0', t: 1.4, vy: -10, vx: 0, label: true }); break;
        case 'mountOff': sfx('step', { vol: 0.5 }); this.burst(ev.x, ev.y + 2, '#9a8e7e', 6, 40); break;
        case 'raptorLeap': sfx('dash', { vol: 0.7, rate: 0.85 }); for (let i = 0; i < 8; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y + 4, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20, t: 0.5, max: 0.5, color: '#9a8e7e', g: 80, dust: true, v: (Math.random() * 4) | 0 }); break;
        case 'lockOn': sfx('open', { vol: 0.25, rate: 1.8 }); break; // 자동 조준 표적은 그리지 않는다 (네 모서리 꺾쇠가 바닥의 노란 화살표처럼 보였다)
        case 'fall': this.fx.push({ k: 'fall', x: ev.x, y: ev.y, r: ev.r, kind: ev.kind, t: ev.dur, max: ev.dur }); break;
        case 'lineTele': this.fx.push({ k: 'lineTele', ...ev, t: ev.dur, max: ev.dur }); break;
        case 'skillFall': this.anims.onFall(ev); break;
        case 'skillLine': { const split = this.anims.onLine(ev); // 땅 가르기는 바닥에 갈라짐만 (위에 빛줄기 · 반짝이를 얹지 않는다)
          const col = ev.fx === 'spikes' ? '#c8f0ff' : ev.fx === 'skyfall' ? '#fff0b0' : ev.fx === 'arrowBeam' ? '#e8ffd0' : ELEM[ev.elem]?.color || '#ffffff';
          if (!split) {
            this.fx.push({ k: 'line', ...ev, color: col, t: ev.ult ? 0.6 : 0.45, max: ev.ult ? 0.6 : 0.45 });
            const n = Math.floor(Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1) / 14);
            for (let i = 0; i <= n; i++) this.burst(ev.x1 + (ev.x2 - ev.x1) * i / n, ev.y1 + (ev.y2 - ev.y1) * i / n, col, ev.ult ? 6 : 3, ev.ult ? 140 : 90);
          }
          this.shake = Math.max(this.shake, ev.ult ? 12 : 5); this.hitstop = Math.max(this.hitstop, ev.ult ? 0.14 : 0.05);
          if (ev.ult && !split) this.flash = { color: '255,250,220', t: 0.25, max: 0.25 };
          sfx(ev.fx === 'spikes' ? 'freeze' : 'hitHeavy', { vol: 1, rate: ev.ult ? 0.5 : 0.8 });
          break;
        }
        case 'shatter': this.burst(ev.x, ev.y - 6, '#e0f8ff', 18, 160); this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: 16, color: '#e0f8ff', t: 0.35, max: 0.35, seed: Math.random() * 100 }); sfx('freeze', { vol: 0.7, rate: 1.4 }); break;
        case 'doomMark': this.texts.push({ x: w.enemies.find((e) => e.id === ev.id)?.x || 0, y: (w.enemies.find((e) => e.id === ev.id)?.y || 0) - 26, text: '낙인', color: '#c45cff', t: 1.2, vy: -8, vx: 0, label: true, size: 2 }); break;
        case 'zoneFx': if (ev.kind === 'smoke') { for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 10, t: 1.2, max: 1.2, color: '#d0d2dc', g: -4, steam: true }); } sfx('dash', { vol: 0.6, rate: 0.5 }); break; }
          if (ev.kind === 'trap' || ev.kind === 'bait') { this.burst(ev.x, ev.y, ev.kind === 'trap' ? '#8a7a5a' : '#c8504a', 8, 40); sfx('step', { vol: 0.5, rate: 0.8 }); break; }
          this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r * 1.1, color: ev.kind === 'slow' ? '#b98aff' : ev.kind === 'frost' ? '#c8f0ff' : ev.kind === 'trap' ? '#9be15d' : ev.kind === 'arrows' ? '#ffe080' : '#ff8a3a', t: 0.4, max: 0.4, w: 3 }); break;
        case 'arrowDrop': this.fx.push({ k: 'arrowDrop', x: ev.x, y: ev.y, t: 0.18, max: 0.18 }); if (Math.random() < 0.3) sfx('shoot', { vol: 0.25, rate: 1.6 }); break;
        case 'skillDash': {
          const col = ELEM[ev.elem]?.color || '#ffffff';
          this.fx.push({ k: 'trail', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, color: col, t: 0.3, max: 0.3, w: 10 });
          for (let i = 1; i <= 3; i++) { const u = i / 4; this.fx.push({ k: 'ghost', x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, t: 0.12 + u * 0.14, max: 0.26, dir: ev.x2 > ev.x1 ? 1 : -1 }); }
          for (let i = 0; i < 5; i++) this.parts.push({ x: ev.x1 + (Math.random() - 0.5) * 6, y: ev.y1 + 2, vx: (ev.x1 - ev.x2) * 0.4 + (Math.random() - 0.5) * 20, vy: -6, t: 0.45, max: 0.45, color: '#c8bca8', g: -4, steam: true });
          this.shake = Math.max(this.shake, 2); sfx('dash', { vol: 0.7 }); sfx('swing', { vol: 0.5, rate: 0.8 });
          break;
        }
        case 'blink': { // 순간이동: 떠나는 자리에서 몸이 도트 조각으로 흩어져 오르고 · 도착하는 자리로 조각이 빨려 들어 다시 모인다 (잔상 · 반투명 없음)
          for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 40; this.parts.push({ x: ev.x1 + (Math.random() - 0.5) * 8, y: ev.y1 - 4 - Math.random() * 14, vx: Math.cos(a) * sp, vy: -20 - Math.random() * 40, t: 0.35 + Math.random() * 0.2, max: 0.55, color: i % 3 ? '#2a2238' : '#c8a8ff', g: -20 }); }
          for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 10, T = 0.22 + Math.random() * 0.06; this.parts.push({ x: ev.x2 + Math.cos(a) * r, y: ev.y2 - 8 + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r / T, vy: -Math.sin(a) * r * 0.7 / T, t: T, max: T, color: i % 3 ? '#c8a8ff' : '#ffffff', g: 0, glow: true, size: 1 }); }
          this.parts.push({ x: ev.x2, y: ev.y2 + 3, vx: 0, vy: -4, t: 0.4, max: 0.4, color: '#b0a0c0', g: 0, puff: true, size: 3 });
          sfx('dash', { vol: 0.6, rate: 1.4 });
          break;
        }
        case 'danceDash': { // 그림자 춤: 적 사이를 달려 지나가며 벤다 (지나간 길에 잔상)
          const ddx = ev.x2 - ev.x1, ddy = ev.y2 - ev.y1, dl = Math.hypot(ddx, ddy) || 1, ux = ddx / dl, uy = ddy / dl;
          for (let i = 1; i <= 5; i++) { const u = i / 6; this.fx.push({ k: 'ghost', x: ev.x1 + ddx * u, y: ev.y1 + ddy * u, t: 0.16 + u * 0.18, max: 0.34, tint: 'brightness(0.35) sepia(1) hue-rotate(220deg) saturate(3)', dir: ev.x2 > ev.x1 ? 1 : -1 }); }
          // 지나간 길: 긴 선 대신 짧은 바람 줄기 몇 가닥 · 발밑에 이는 그림자 먼지
          for (let i = 0; i < 10; i++) { const u = Math.random(), off = (Math.random() - 0.5) * 10; this.parts.push({ x: ev.x1 + ddx * u - uy * off, y: ev.y1 - 6 + ddy * u + ux * off * 0.6, vx: ux * 160, vy: uy * 160, t: 0.1 + Math.random() * 0.12, max: 0.22, color: i % 3 ? '#9a80d8' : '#e8e0ff', g: 0, line: true }); }
          for (let i = 0; i < 4; i++) this.parts.push({ x: ev.x1 + (Math.random() - 0.5) * 6, y: ev.y1 + 2, vx: -ux * 30 + (Math.random() - 0.5) * 20, vy: -uy * 15 - 5, t: 0.5, max: 0.5, color: '#4a3a5a', g: -4, steam: true });
          sfx('dash', { vol: 0.55, rate: 1.6 });
          break;
        }
        case 'danceCut': { // 지나가며 긋는 초승달 칼자국 두 줄
          this.fx.push({ k: 'cut', x: ev.x, y: ev.y - 8, ang: ev.ang, t: 0.28, max: 0.28 });
          this.sparkBurst(ev.x, ev.y - 8, '#c8b0ff', 8); this.sparkBurst(ev.x, ev.y - 8, '#ffffff', 4);
          this.shake = Math.max(this.shake, 3); this.hitstop = Math.max(this.hitstop, 0.04);
          sfx('swing', { vol: 0.7, rate: 1.5 }); sfx('hit', { vol: 0.6, rate: 1.3 });
          break;
        }
        case 'skillAoe': if (ev.fx === 'ink') { this.inkSplash(ev.x, ev.y, ev.r, 3.2); this.shake = Math.max(this.shake, 3); sfx('reaction', { vol: 0.5, rate: 0.7 }); break; } this.aoeFx(ev); break;
        case 'pipeRise': this.fx.push({ k: 'pipes', ...ev, t: ev.dur || 0.9, max: ev.dur || 0.9 }); sfx('hitArmor', { vol: 0.5, rate: 0.6 }); break; // 황금 관이 줄 따라 솟는다 (증기 거신)
        case 'bossBit': this.fx.push({ k: 'bit', x: ev.x, y: ev.y, kind: ev.kind, r: ev.r, rot: ev.rot, t: 1 / 55, max: 1 / 55 }); break; // 날아다니는 톱니 · 책 · 바퀴 (한 틱 그림)
        case 'waveFx': this.fx.push({ k: 'wave', ...ev, t: 0.09, max: 0.09 }); break; // 퍼지는 물결 (빈 틈은 비워 그린다)
        case 'inkBind': this.inkSplash(ev.x, ev.y, (ev.r || 6) + 10, ev.dur + 0.2, true); break; // 묶인 적의 발밑: 먹물 웅덩이
        case 'inkBurst': this.inkSplash(ev.x, ev.y, (ev.r || 6) + 22, 0.7); this.sparkBurst(ev.x, ev.y - 6, '#c8a8ff', 8); sfx('hitArmor', { vol: 0.5, rate: 0.8 }); break;
        case 'skillCone': this.anims.onCone(ev); if (ev.fx === 'spellBlade') { // 근접 무기로 쓴 마법: 그 속성 빛의 초승달이 앞을 휩쓴다
            const col = ELEM[ev.elem]?.color || '#c9a8ff';
            this.fx.push({ k: 'spellBlade', x: ev.x, y: ev.y, ang: ev.ang, r: ev.range, angle: ev.angle, col, t: 0.26, max: 0.26 });
            for (let i = 0; i < 6; i++) { const a = ev.ang + (Math.random() - 0.5) * ev.angle, d = ev.range * (0.45 + Math.random() * 0.55); this.parts.push({ x: ev.x + Math.cos(a) * d, y: ev.y - 6 + Math.sin(a) * d * 0.62, vx: Math.cos(a) * 30, vy: Math.sin(a) * 16 - 8, t: 0.3, max: 0.3, color: col, g: -20, glow: true, size: 1 }); }
            if (ev.elem === 'fire') for (let i = 0; i < 6; i++) { const a = ev.ang + (Math.random() - 0.5) * ev.angle, d = ev.range * (0.5 + Math.random() * 0.5); this.parts.push({ x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d * 0.62, vx: 0, vy: -30, t: 0.4, max: 0.4, g: -20, flame: true, size: 1, color: '#ffffff' }); }
            this.shake = Math.max(this.shake, 2); sfx('reaction', { vol: 0.45, rate: 1.5 });
          } else if (ev.fx === 'sweep') { this.fx.push({ k: 'spin', x: ev.x, y: ev.y, r: ev.range, type: 'phys', t: 0.25, max: 0.25 }); this.shake = Math.max(this.shake, 4); sfx('heavySwing', { vol: 0.9 }); }
          if (ev.fx !== 'breath' && ev.fx !== 'spellBlade') this.fx.push({ k: 'cone', ...ev, color: ELEM[ev.elem]?.color || (ev.fx === 'claws' ? '#ffffff' : '#ffb066'), t: 0.22, max: 0.22 });
          if (ev.fx === 'claws') { this.fx.push({ k: 'claws', x: ev.x, y: ev.y, ang: ev.ang + (Math.random() - 0.5) * 0.6, r: ev.range, t: 0.18, max: 0.18 }); sfx('swing', { vol: 0.5, rate: 1.4 }); }
          else if (ev.fx === 'breath') this.flameStream(ev);
          else { this.shake = Math.max(this.shake, 4); sfx('hitHeavy', { vol: 0.8, rate: 0.7 }); }
          break;
        case 'skillSingle': {
          const col = ELEM[ev.elem]?.color || '#ffffff';
          if (ev.fx === 'stab') { this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 2, r: 12, color: '#b89aff', t: 0.15, max: 0.15 }); this.sparkBurst(ev.x, ev.y - 6, '#b89aff', 8); sfx('swing', { vol: 0.5, rate: 1.6 }); break; }
          if (ev.fx === 'slashX') { this.fx.push({ k: 'slashX', x: ev.x, y: ev.y - 6, color: '#b89aff', t: 0.35, max: 0.35 }); this.burst(ev.x, ev.y - 6, '#8a6aff', 30, 160); }
          else if (ev.fx === 'bite') { this.fx.push({ k: 'bite2', x: ev.x, y: ev.y - 6, t: 0.3, max: 0.3 }); this.burst(ev.x, ev.y - 6, '#e0445a', 24, 130); }
          else { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 30, color: col, t: 0.35, max: 0.35, w: 4 }); this.burst(ev.x, ev.y - 4, '#c8b898', 24, 140); }
          this.shake = Math.max(this.shake, ev.big ? 7 : 4); this.hitstop = Math.max(this.hitstop, ev.big ? 0.1 : 0.05);
          sfx('hitHeavy', { vol: 1, rate: ev.big ? 0.6 : 0.85 });
          break;
        }
        case 'bolt': this.fx.push({ k: 'bolt', pts: ev.pts, color: ev.color, t: 0.22, max: 0.22, seed: Math.random() * 1000 }); for (const pt of ev.pts.slice(1)) this.sparkBurst(pt.x, pt.y, ev.color, 5); sfx('cast', { vol: 0.5, rate: 2 }); break; for (const pt of ev.pts.slice(1)) this.anims.px.add('lightning/zap-hit', pt.x, pt.y, { scale: 0.6, floor: 0, max: 0.5 });
        case 'cast': this.castGather = { color: ELEM[ev.elem]?.color || CLASS_MAGIC[w.b.cls] || '#9ab8ff', t: ev.dur, max: ev.dur }; sfx('cast', { vol: 0.4, rate: 0.8 }); break; // 시전: 발밑 고리 대신 손끝으로 원소가 모여든다
        case 'parryStance': this.fx.push({ k: 'parryStance', t: ev.dur, max: ev.dur }); sfx('open', { vol: 0.5 }); break;
        case 'parry': this.rimFlash = { color: '#fff6c0', t: 0.4, max: 0.4 }; this.shockwave(ev.x, ev.y, 40, '#fff6c0', 24); this.burst(ev.x, ev.y - 6, '#fff6c0', 30, 160); this.texts.push({ x: ev.x, y: ev.y - 26, text: '받아치기!', color: '#ffe080', t: 1, vy: -14, vx: 0, label: true, size: 2 }); this.shake = 5; sfx('hitArmor', { vol: 1 }); sfx('reaction', { vol: 0.5, rate: 1.5 }); break;
        case 'buff': this.rimFlash = { color: ev.color || '#ffffff', t: 0.35, max: 0.35 * 1.8 }; for (let i = 0; i < 7; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y, vx: 0, vy: -30 - Math.random() * 25, t: 0.55, max: 0.55, color: ev.color, g: -8 }); sfx('echo', { vol: 0.5 }); break;
        case 'elemShift': this.fx.push({ k: 'ring', x: ev.x, y: ev.y - 6, r: 24, color: ELEM[ev.elem].color, t: 0.4, max: 0.4, w: 3 }); this.burst(ev.x, ev.y - 6, ELEM[ev.elem].color, 16, 80); this.texts.push({ x: ev.x, y: ev.y - 24, text: `${ELEM[ev.elem].name}${ev.weak ? ' · 약점!' : ''}`, color: ELEM[ev.elem].color, t: 1, vy: -12, vx: 0, label: true }); sfx('open', { vol: 0.5, rate: 1.2 }); break;
        case 'beamFx': { if (ev.wall && Math.random() < 0.6) { this.sparkBurst(ev.x2, ev.y2, '#ffe0a0', 4); if (Math.random() < 0.4) this.parts.push({ x: ev.x2, y: ev.y2, vx: (Math.random() - 0.5) * 20, vy: -12, t: 0.5, max: 0.5, color: '#8a8070', g: -2, puff: true, size: 2 }); } // 광선이 벽에 부딪힌 자리
          { const b = ev.from != null && w.enemies.find((o) => o.id === ev.from); if (b && b._top != null) { const h = b._vis || b.y - b._top; ev.x1 = b.x; ev.y1 = b.y + 4 - h * 0.6; ev.y2 -= 8; ev.feet = b.y; } } // 보스 광선은 몸(가슴께)에서 나간다 · 끝은 맞는 사람 몸 높이
          const len = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1), rot = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1), bs = Math.max(0.25, len / 183), c = Math.cos(rot), sn = Math.sin(rot); // 그림 속 광선은 기준점에서 (15, -24) 떨어진 손에서 나가 183칸 간다 → 시작점 · 끝점에 딱 맞게 옮기고 늘인다
          if (!this.anims.px.add('arcane/arcane-beam', ev.x1 - (15 * c + 24 * sn) * bs, ev.y1 - (15 * sn - 24 * c) * bs, { rot, scale: bs, sortY: ev.feet != null ? Math.max(ev.feet, ev.y2) + 1 : undefined, /* 보스 광선은 보스 몸 앞에 */ palette: PAL[ev.elem] || PAL.dark, floor: 0, max: 0.16 })) this.fx.push({ k: 'beam', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0.3, max: 0.3 }); if (!ev.quiet && !(this.beamSfxT > w.t - 0.25)) { this.beamSfxT = w.t; sfx('dash', { vol: 0.5, rate: 1.6 }); } break; } // 광선: pixelfx 빔 (실이 꼬이며 맥박치는 빛줄기)
        case 'seaSight': this.banner = { text: ev.id === 'pirates' ? '수평선에 검은 돛이 보인다' : ev.id === 'serpent' ? '물결 사이로 커다란 등지느러미가…' : ev.id === 'castaway' ? '저 멀리 뗏목이 떠 있다' : '저 멀리 상선이 보인다', sub: '점점 다가온다', t: 3, color: ev.id === 'pirates' ? '#ff9a7a' : '#bfe8ff' }; break;
        case 'graspArm': this.fx.push({ k: 'arm', x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0.55, max: 0.55 }); sfx('dash', { vol: 0.5, rate: 0.6 }); break;
        case 'summonFx': { const col = ev.elem ? ELEM[ev.elem].color : ev.kind === 'clone' ? '#8a6aff' : ev.kind === 'skeleton' ? '#e8e0d0' : '#c45cff';
          if (ev.big && !ev.out) { this.fx.push({ k: 'pillar', x: ev.x, y: ev.y, r: 50, color: col, t: 0.8, max: 0.8 }); for (let i = 0; i < 3; i++) this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 30 + i * 20, color: col, t: 0.5 + i * 0.1, max: 0.5 + i * 0.1, w: 4 }); this.burst(ev.x, ev.y, col, 50, 160); this.shake = 8; } this.burst(ev.x, ev.y, col, ev.out ? 8 : 18, 70); if (!ev.out) { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: 16, color: col, t: 0.35, max: 0.35, w: 2 }); sfx('echo', { vol: 0.35, rate: 1.3 }); } break; }
        case 'allyHit': this.sparkBurst(ev.x, ev.y - 4, ev.kind === 'clone' ? '#b89aff' : '#c45cff', 4); break;
        case 'noRes':
          if ((this.noResT || 0) < w.t) { this.noResT = w.t + 0.8; this.texts.push({ x: ev.x, y: ev.y - 22, text: ev.text || `${ev.name} 부족`, color: '#ff8a80', t: 0.9, vy: -14, vx: 0, label: true }); sfx('step', { vol: 0.3 }); }
          break;
        case 'focus': this.sparkBurst(ev.x, ev.y - 22, ev.n >= 3 ? '#fff2a0' : '#bfffd0', 3 + ev.n); if (ev.n >= 3) sfx('open', { vol: 0.35, rate: 1.8 }); break;
        case 'chargeStart': sfx('windup', { vol: 0.5, rate: 0.8 }); break;
        case 'chargeLvl': this.rimFlash = { color: ev.lvl >= 3 ? '#fff2a0' : '#ffcf5a', t: 0.3, max: 0.3 }; this.shockwave(ev.x, ev.y, 14 + ev.lvl * 6, '#ffe080', 8 + ev.lvl * 4); sfx('open', { vol: 0.4, rate: 1 + ev.lvl * 0.25 }); if (ev.lvl >= 3) this.shake = Math.max(this.shake, 2); break;
        case 'rushStart': sfx('dash', { vol: 0.7, rate: 0.7 }); this.burst(ev.x, ev.y + 3, '#a89880', 12, 70); break;
        case 'steamPuff': for (let i = 0; i < 8; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y - 2, vx: (Math.random() - 0.5) * 16, vy: -18 - Math.random() * 22, t: 0.9, max: 0.9, color: Math.random() < 0.5 ? '#e8eef2' : '#c4ccd4', g: -8, big: true }); break; // 얼린 용암에서 김
        case 'rushDust': this.parts.push({ x: ev.x - ev.dx * 6, y: ev.y + 3, vx: -ev.dx * 40 + (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, t: 0.5, max: 0.5, color: '#a89880', g: 30 }); this.shake = Math.max(this.shake, 1.2); if (Math.random() < 0.5) sfx('step', { vol: 0.35, rate: 0.6 }); break;
        case 'soarUp': this.burst(ev.x, ev.y + 2, '#ffb066', 18, 90); this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 3, r: 22, color: '#ffcf8a', t: 0.35, max: 0.35, w: 3 }); sfx('dash', { vol: 0.7, rate: 0.6 }); break;
        case 'land': this.fx.push({ k: 'ring', x: ev.x, y: ev.y + 3, r: ev.big ? 40 : 24, color: '#e8d8b8', t: 0.4, max: 0.4, w: 4 }); this.burst(ev.x, ev.y + 3, '#a89880', ev.big ? 26 : 12, 140); this.shake = Math.max(this.shake, ev.big ? 7 : 3); this.hitstop = Math.max(this.hitstop, 0.05); sfx('hitHeavy', { vol: 0.9, rate: 0.6 }); break;
        case 'rewind': this.fx.push({ k: 'path', pts: ev.pts, t: 0.6, max: 0.6 }); for (const [x, y] of [[ev.x1, ev.y1], [ev.x2, ev.y2]]) { this.fx.push({ k: 'glow', x, y: y - 8, r: 26, color: '#b98aff', t: 0.5, max: 0.5 }); this.burst(x, y - 6, '#b98aff', 16, 80); } this.flash = { color: '185,138,255', t: 0.2, max: 0.2 }; sfx('reaction', { vol: 0.6, rate: 1.6 }); break;
        case 'echoMark': this.fx.push({ k: 'echo', x: ev.x, y: ev.y, r: ev.r, t: ev.dur, max: ev.dur }); break;
        case 'stealthOn': for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 1, max: 1, color: Math.random() < 0.5 ? '#3a3450' : '#5a5478', g: -8 }); } sfx('dash', { vol: 0.5, rate: 0.6 }); break;
        case 'stealthOff': this.sparkBurst(ev.x, ev.y - 8, '#b89aff', 8); break;
        case 'spiritIn': { const col = ELEM[ev.elem].color; this.rimFlash = { color: col, t: 0.5, max: 0.5 }; for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: ev.x + Math.cos(a) * 26, y: ev.y - 8 + Math.sin(a) * 16, vx: -Math.cos(a) * 80, vy: -Math.sin(a) * 50, t: 0.35, max: 0.35, color: col, g: 0, glow: true }); } this.texts.push({ x: ev.x, y: ev.y - 30, text: `${ELEM[ev.elem].name} 정령 ×${ev.n}`, color: col, t: 0.9, vy: -12, vx: 0, label: true }); sfx('echo', { vol: 0.5, rate: 1.2 }); break; }
        case 'spiritOut': this.burst(ev.x, ev.y - 10, ELEM[ev.elem].color, 8, 50); break;
        case 'wordAdd': { const pl = w.player, wd = ev.words[ev.words.length - 1]; this.texts.push({ x: pl.x, y: pl.y - 34, text: WORD_NAME[wd], color: WORD_COLOR[wd], t: 0.8, vy: -14, vx: 0, label: true, size: 2, pop: 0.12 }); sfx('open', { vol: 0.35, rate: 1.4 }); break; }
        case 'sentence': { // 용의 말: 허공에 세 글자를 한 획씩 쓰고 → 하나로 합쳐 → 목표에 날아가 땅에 새긴다
          const same = ev.words.every((x) => x === ev.words[0]);
          this.ultName = { text: `「 ${sentenceLine(ev.words)} 」`, sub: ev.words.map((x) => WORD_NAME[x]).join(' · ') + (same ? ' · 완전한 문장' : ''), color: same ? '#ffe08a' : WORD_COLOR[ev.words[0]], t: 1.6, max: 1.6 };
          this.rimFlash = { color: WORD_COLOR[ev.words[0]] || '#ff9a4a', t: 0.9, max: 0.9 };
          this.fx.push({ k: 'glyphs', words: ev.words, same, x: ev.x, y: ev.y, tx: ev.tx ?? ev.x, ty: ev.ty ?? ev.y, t: 1.9, max: 1.9 });
          this.hitstop = Math.max(this.hitstop, 0.05);
          ev.words.forEach((wd, i) => tone(392 * Math.pow(2, [0, 4, 7][i] / 12), { dur: 0.26, type: 'triangle', vol: 0.12, when: i * 0.15 }));
          tone(196, { dur: 0.5, type: 'sawtooth', vol: 0.06, when: 0.62 }); tone(98, { dur: 0.6, type: 'triangle', vol: 0.1, when: 0.68 });
          sfx('levelup', { vol: 0.5, rate: 0.9 });
          break;
        }
        case 'block': this.sparkBurst(ev.x, ev.y, '#e8f0ff', ev.small ? 4 : 10); this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 8, r: ev.small ? 7 : 12, color: '#c8d8ff', t: 0.12, max: 0.12 }); sfx('hitArmor', { vol: ev.small ? 0.5 : 0.9 }); if (!ev.small) this.texts.push({ x: ev.x, y: ev.y - 14, text: '막음', color: '#c8d8ff', t: 0.7, vy: -14, vx: 0, label: true }); break;
        case 'bump': this.burst(ev.x, ev.y - 4, '#e8d8b8', 8, 90); sfx('hitHeavy', { vol: 0.6, rate: 0.8 }); break;
        case 'collide': this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 4, r: 16, color: '#ffe8a0', t: 0.18, max: 0.18 }); this.burst(ev.x, ev.y - 6, ev.wall ? '#a89880' : '#ffe8a0', 16, 130); this.texts.push({ x: ev.x, y: ev.y - 20, text: ev.wall ? '쾅!' : '충돌!', color: '#ffe080', t: 0.8, vy: -16, vx: 0, label: true, size: 2, pop: 0.15 }); this.shake = Math.max(this.shake, 5); this.hitstop = Math.max(this.hitstop, 0.06); sfx('hitHeavy', { vol: 1, rate: 0.7 }); sfx('crack', { vol: 0.5 }); break;
        case 'heavySwing': sfx('heavySwing', { vol: 1, rate: 0.6 }); this.burst(ev.x, ev.y + 3, '#9a8a76', 10, 90); break;
        case 'kingPunch': {
          const col = ev.spirit === 'fire' ? '#ff7a26' : ev.spirit === 'wind' ? '#e8f6ff' : '#9ae070';
          this.fx.push({ k: 'impact', x: ev.x, y: ev.y + 2, r: 16, color: col, t: 0.16, max: 0.16 });
          this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 8, r: 30, color: col, t: 0.25, max: 0.25 });
          if (ev.spirit === 'wind') { this.shockwave(ev.x, ev.y, 40, '#e8f6ff', 26); for (let i = 0; i < 10; i++) { const a = Math.atan2(ev.y - ev.fy, ev.x - ev.fx) + (Math.random() - 0.5) * 0.8; this.parts.push({ x: ev.x, y: ev.y - 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 160, t: 0.3, max: 0.3, color: '#ffffff', g: 0, line: true }); } }
          else if (ev.spirit === 'fire') this.burst(ev.x, ev.y - 6, '#ff7a26', 26, 150);
          else this.burst(ev.x, ev.y - 6, '#9ae070', 18, 110);
          this.shake = Math.max(this.shake, 4); this.hitstop = Math.max(this.hitstop, 0.04);
          sfx('hitHeavy', { vol: 0.9, rate: ev.spirit === 'wind' ? 0.9 : 0.7 });
          break;
        }
        case 'silence': {
          this.rimFlash = { color: '#d8c8ff', t: 0.8, max: 0.8 }; this.shockwave(ev.x, ev.y, ev.r * 0.6, '#d8c8ff', 60);
          this.flash = { color: '200,190,255', t: 0.25, max: 0.25 }; this.shake = Math.max(this.shake, 6);
          this.ultName = { text: '「침묵」', color: '#d8c8ff', t: 1.2, max: 1.2 };
          sfx('reaction', { vol: 0.8, rate: 0.5 });
          break;
        }
        case 'crackBreak': this.burst(ev.x, ev.y, '#a89880', 30, 130); this.shake = 5; if (w.map.outdoor) this.repaint(w, ev.tile); else this.mapCanvas = renderMap(w); sfx('crack', { vol: 1, rate: 0.7 }); break;
        case 'groundChange': this.repaint(w, ev.k); if (w.map.ground[ev.k] === G.ICE) { const x = (ev.k % w.tw) * TILE + 8, y = Math.floor(ev.k / w.tw) * TILE + 8; this.burst(x, y, '#d8f4ff', 3, 30); } break;
        case 'treeBurn': this.burst(ev.x, ev.y - 20, '#ff9a3a', 24, 90); sfx('reaction', { vol: 0.3, rate: 0.8 }); break;
      }
    }
    if (pend) this.tierPolish(w, pend);
    w.events.length = 0;
    if (w.revealed.length) this.applyReveal(false);
  },

  // ───── 스킬 연출 등급 (각인 1~5등급) ─────
  // 1 · 2등급은 수수하게: 불티를 덜고 흔들림 · 멈춤을 줄인다. 3등급은 그대로. 4 · 5등급은 화려하게: 불티가 늘고, 땅이 반응한다
  // (바닥에 금 · 그을음이 남고, 돌 조각이 튀어 떨어지고, 물에서는 물보라가 인다 — 허공에 뜬 빛이 아니라 맵에 닿는 것들)
  tierPolish(w, m) {
    const ev = m.ev, T = ev.tier, P = this.parts, A = this.anims;
    if (T === 3) return;
    if (T < 3) {
      const keep = T === 1 ? 0.35 : 0.6;
      const born = P.splice(m.parts); for (const q of born) if (Math.random() < keep) P.push(q);
      for (let i = this.fx.length - 1; i >= m.fx; i--) { const k = this.fx[i].k; if (k === 'glow' || k === 'trail' || (k === 'ghost' && T === 1) || (k === 'ring' && i > m.fx)) this.fx.splice(i, 1); }
      this.shake = Math.max(m.shake, Math.min(this.shake, T === 1 ? 1.5 : 3));
      this.hitstop = Math.max(m.hitstop, Math.min(this.hitstop, T === 1 ? 0.02 : 0.035));
      this.flash = m.flash;
      for (let i = m.px; i < A.px.list.length; i++) A.px.list[i].scale *= T === 1 ? 0.72 : 0.86;
      return;
    }
    const hi = T >= 5, n1 = P.length;
    for (let i = m.parts; i < n1; i++) if (hi || i % 2 === 0) { const q = P[i], s = 1.25 + Math.random() * 0.5; P.push({ ...q, vx: q.vx * s, vy: q.vy * s, t: q.t * 1.3, max: q.max * 1.3 }); }
    if (this.shake > m.shake) this.shake = Math.min(16, this.shake * (hi ? 1.6 : 1.3));
    if (this.hitstop > m.hitstop) this.hitstop = Math.min(0.14, this.hitstop + (hi ? 0.035 : 0.015));
    for (let i = m.px; i < A.px.list.length; i++) A.px.list[i].scale *= hi ? 1.22 : 1.1;
    const el = ev.elem, col = ELEM[el]?.color && el !== 'phys' ? ELEM[el].color : '#ffd890';
    const land = (x, y) => (w.wallAt(x, y) ? 0 : w.isWaterAt(x, y) ? 2 : w.solid(x, y) ? 0 : 1); // 0 벽 · 허공 · 1 땅 · 2 물
    // 맵에 닿는 것: 돌 조각이 튀어 땅에 떨어진다 (벽 쪽으로는 안 튄다) · 물이면 물보라
    const scatter = (x, y, r, n) => {
      const pieces = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = r * (0.4 + Math.random() * 0.8), x1 = x + Math.cos(a) * d, y1 = y + Math.sin(a) * d * 0.6, k = land(x1, y1);
        if (k === 1) pieces.push({ x0: x, y0: y - 3, x1, y1, h: 12 + Math.random() * (hi ? 30 : 18), fly: 0.25 + Math.random() * 0.2, s: 1.5 + Math.random() * (hi ? 2.5 : 1.5), rot: Math.random() * 6 });
        else if (k === 2) for (let j = 0; j < 4; j++) P.push({ x: x1 + (Math.random() - 0.5) * 6, y: y1, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 50, t: 0.45, max: 0.45, color: j % 2 ? '#d8f0ff' : '#8ac8f0', g: 260, floor: y1 + 1, size: 1 });
      }
      if (pieces.length) this.fx.push({ k: 'debris', pieces, cold: el !== 'fire', t: hi ? 2.6 : 1.8, max: hi ? 2.6 : 1.8 });
    };
    if (ev.t === 'skillAoe' && ev.r >= 20 && ev.fx !== 'taunt' && ev.fx !== 'provoke' && ev.fx !== 'absorb' && ev.fx !== 'spread') {
      if (land(ev.x, ev.y) === 1) {
        if (A.ground.length === m.ag) A.add('cracks', { x: ev.x, y: ev.y, r: ev.r * (hi ? 1.15 : 0.85), col, max: hi ? 2.4 : 1.6 });
        if (el === 'fire' || hi) this.fx.push({ k: 'scorch', x: ev.x, y: ev.y, r: ev.r * 0.6, t: hi ? 4 : 2.5, max: hi ? 4 : 2.5 });
      }
      scatter(ev.x, ev.y, ev.r, hi ? 12 : 6);
      if (hi && !this.flash) this.flash = { color: '255,240,215', t: 0.14, max: 0.14 };
    } else if (ev.t === 'skillCone') {
      const cx = ev.x + Math.cos(ev.ang) * ev.range * 0.7, cy = ev.y + Math.sin(ev.ang) * ev.range * 0.7;
      scatter(cx, cy, ev.range * 0.5, hi ? 7 : 4);
      if (hi && land(cx, cy) === 1) A.add('cracks', { x: cx, y: cy, r: ev.range * 0.55, col, max: 1.6 });
    } else if (ev.t === 'skillLine') {
      const n = hi ? 5 : 3; for (let i = 1; i <= n; i++) { const u = i / (n + 1); scatter(ev.x1 + (ev.x2 - ev.x1) * u, ev.y1 + (ev.y2 - ev.y1) * u, (ev.w || 24) * 0.9, 3); }
    } else if (ev.t === 'skillSingle') {
      scatter(ev.x, ev.y + 2, hi ? 26 : 18, hi ? 6 : 3);
    } else if (ev.t === 'skillDash' || ev.t === 'meleeStep') { // 높은 등급의 돌진: 잔상이 더 길게 이어지고, 멈춘 자리에 미끄러진 자국과 흙
      const dx = ev.x2 - ev.x1, dy = ev.y2 - ev.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, g2 = hi ? 4 : 2;
      for (let i = 0; i < g2; i++) { const u = (i + 0.5) / g2; this.fx.push({ k: 'ghost', x: ev.x1 + dx * u, y: ev.y1 + dy * u, t: 0.16 + u * 0.2, max: 0.36, dir: dx > 0 ? 1 : -1 }); }
      if (L > 14 && land(ev.x2, ev.y2) === 1) { const pts = []; for (let d = Math.min(L, hi ? 26 : 16); d >= 0; d -= 4) pts.push({ x: ev.x2 - ux * d, y: ev.y2 - uy * d + 4 }); A.ground.push({ type: 'skid', pts, ux, uy, t: 0, max: 1.2 }); }
      for (let i = 0; i < (hi ? 8 : 4); i++) P.push({ x: ev.x2, y: ev.y2 + 3, vx: ux * (30 + Math.random() * 50) + (Math.random() - 0.5) * 24, vy: -24 - Math.random() * 30, t: 0.4, max: 0.4, color: '#7a6448', g: 380, chunk: true, floor: ev.y2 + 4 });
    }
  },

  aoeFxFull(ev) {
    const col = ELEM[ev.elem]?.color || '#ffe8a0';
    const fx = ev.fx;
    this.juice(ev.x, ev.y, col, ev.ult ? 'ult' : ev.fromProj ? 'pop' : 'skill', ev.r || 30);
    // 무기 기술은 연출 하나만: 무기 계열 연출이 있으면 그것, 없으면 무기 종류 표식 하나 (등급 표식 · 겹친 고리 · 두 번째 표식은 쌓지 않는다)
    if (ev.wcat && !ev.ult && !this.anims.onAoe(ev)) { this.weaponSig({ ...ev, rar: 0 }); sfx('hitHeavy', { vol: 0.5 }); return; }
    if (ev.wcat && !ev.ult) { sfx('reaction', { vol: 0.6 }); return; }
    if (this.anims.onAoe(ev)) { // pixelfx가 그렸다: 소리 · 흔들림만
      const f2 = ev.fx; sfx(f2 === 'ice' || f2 === 'shatter' || f2 === 'zero' ? 'freeze' : f2 === 'quake' || f2 === 'smash' ? 'hitHeavy' : 'reaction', { vol: ev.ult ? 0.9 : 0.6, rate: ev.ult ? 0.7 : 1 });
      if (ev.ult) this.shake = Math.max(this.shake, 10);
      return;
    }
    if (ev.rar >= 1) this.rarityFx(ev, col);
    if (ev.ult) { this.flash = { color: '255,240,210', t: 0.22, max: 0.22 }; this.shake = Math.max(this.shake, 12); this.hitstop = Math.max(this.hitstop, 0.12); }
    if (fx === 'arcane' || fx === 'implode' || fx === 'holy' || fx === 'corpse' || fx === 'doom' || fx === 'shatter' || fx === 'zero' || fx === 'timestop') {
      const c2 = fx === 'holy' ? '#fff0a0' : fx === 'corpse' || fx === 'doom' ? '#c45cff' : fx === 'shatter' || fx === 'zero' ? '#c8f0ff' : '#b98aff';
      for (let i = 0; i < 3; i++) this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r * (0.6 + i * 0.25), color: i === 1 ? '#ffffff' : c2, t: 0.35 + i * 0.1, max: 0.35 + i * 0.1, w: 5 - i });
      if (fx === 'implode' || fx === 'timestop' || fx === 'zero') this.fx.push({ k: 'implode', x: ev.x, y: ev.y, r: ev.r, color: c2, t: 0.4, max: 0.4 });
      if (fx === 'shatter' || fx === 'zero') this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: ev.r, color: '#e0f8ff', t: 0.7, max: 0.7, seed: Math.random() * 100 });
      if (fx === 'timestop') this.flash = { color: '185,138,255', t: 0.5, max: 0.5 };
      this.burst(ev.x, ev.y, c2, 40, 190); this.burst(ev.x, ev.y, '#ffffff', 14, 120);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.07);
      sfx(fx === 'shatter' || fx === 'zero' ? 'freeze' : 'reaction', { vol: 0.9, rate: 0.75 });
      return;
    }
    if (ev.r && fx !== 'taunt' && fx !== 'provoke' && fx !== 'absorb') this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 4, r: ev.r * 1.1, color: col, t: 0.3, max: 0.3 });
    if (fx === 'provoke') { this.rimFlash = { color: '#ffd84a', t: 0.6, max: 0.6 }; this.shockwave(ev.x, ev.y, ev.r * 0.8, '#ffd84a', 40); this.shake = Math.max(this.shake, 3); sfx('hitHeavy', { vol: 0.7, rate: 0.5 }); return; }
    if (fx === 'spread') { this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c45cff', t: 0.4, max: 0.4, w: 2 }); this.burst(ev.x, ev.y - 6, '#c45cff', 14, 90); sfx('reaction', { vol: 0.4, rate: 0.9 }); return; }
    if (fx === 'absorb') { for (const e of this.world.enemies) if (!e.dead && Math.hypot(e.x - ev.x, e.y - ev.y) < ev.r + e.r) for (let i = 0; i < 3; i++) this.parts.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 8, vx: (ev.x - e.x) * 2.2, vy: (ev.y - 8 - e.y) * 2.2, t: 0.45, max: 0.45, color: '#9bffb0', g: 0, glow: true }); this.fx.push({ k: 'rune', x: ev.x, y: ev.y + 3, r: ev.r * 0.6, color: '#9bffb0', t: 0.3, max: 0.3 }); return; }
    if (fx === 'taunt') { this.fx.push({ k: 'ring', x: ev.x, y: ev.y - 6, r: 34, color: '#c45cff', t: 0.5, max: 0.5, w: 3 }); this.texts.push({ x: ev.x, y: ev.y - 26, text: '!', color: '#ff5a7a', t: 0.8, vy: -10, vx: 0, label: true, size: 2 }); sfx('hitHeavy', { vol: 0.4, rate: 0.6 }); return; }
    if (fx === 'gravity') { this.fx.push({ k: 'gravity', x: ev.x, y: ev.y, r: ev.r, t: 0.5, max: 0.5 }); sfx('cast', { vol: 0.7, rate: 0.5 }); return; }
    if (fx === 'vines' || fx === 'bones' || fx === 'trap') {
      this.fx.push({ k: 'vines', x: ev.x, y: ev.y, r: ev.r, color: fx === 'bones' ? '#e8e0d0' : fx === 'trap' ? '#9be15d' : '#5fbf4a', t: 2, max: 2, seed: Math.random() * 100 });
      this.burst(ev.x, ev.y, fx === 'bones' ? '#e8e0d0' : '#7be38a', 24, 110);
      sfx('crack', { vol: 0.7, rate: 1.3 }); return;
    }
    if (fx === 'smoke') { for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 60; this.parts.push({ x: ev.x, y: ev.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, t: 1.4, max: 1.4, color: Math.random() < 0.5 ? '#6a6a7a' : '#9a9aaa', g: -6, big: true }); } sfx('dash', { vol: 0.6, rate: 0.7 }); return; }
    if (fx === 'slam' || fx === 'blood') {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: fx === 'blood' ? '#e0445a' : '#ffe8b0', t: 0.35, max: 0.35, w: 5 });
      if (fx === 'slam') this.fx.push({ k: 'cracks', x: ev.x, y: ev.y, r: ev.r, t: 0.6, max: 0.6, seed: Math.random() * 100 });
      this.burst(ev.x, ev.y, fx === 'blood' ? '#c02030' : '#c8b898', 28, 150);
      this.shake = Math.max(this.shake, 5); sfx('hitHeavy', { vol: 0.9, rate: 0.7 }); return;
    }
    if (fx === 'pillar' || fx === 'meteor') {
      if (fx === 'pillar') this.fx.push({ k: 'pillar', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.5, max: 0.5 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.55, max: 0.55, w: 6 });
      this.burst(ev.x, ev.y, col, 50, 200); this.burst(ev.x, ev.y, '#ffffff', 16, 120);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.08);
      sfx('reaction', { vol: 0.9, rate: 0.7 });
    } else if (fx === 'rage') { this.rageBlast(ev.x, ev.y, ev.r); return;
    } else if (fx === 'quake' || fx === 'smash') {
      this.fx.push({ k: 'cracks', x: ev.x, y: ev.y, r: ev.r, t: 0.8, max: 0.8, seed: Math.random() * 100 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#e8d8b8', t: 0.4, max: 0.4, w: 5 });
      this.burst(ev.x, ev.y, '#a89880', 40, 170);
      this.shake = Math.max(this.shake, 8); sfx('hitHeavy', { vol: 1, rate: 0.5 });
    } else if (fx === 'crystal' || fx === 'ice') {
      this.fx.push({ k: 'shards', x: ev.x, y: ev.y, r: ev.r, color: fx === 'crystal' ? '#c8f0ff' : col, t: 0.5, max: 0.5, seed: Math.random() * 100 });
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: '#c8f0ff', t: 0.4, max: 0.4, w: 3 });
      sfx('freeze', { vol: 0.8 });
    } else if (fx === 'burst' || fx === 'pop' || fx === 'rocks') {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.35, max: 0.35, w: 4 });
      this.burst(ev.x, ev.y, fx === 'rocks' ? '#a89880' : col, 26, 140);
      sfx(fx === 'rocks' ? 'crack' : 'reaction', { vol: 0.6, rate: 1.2 });
    } else if (fx === 'roar') {
      // 시전자 연출에서 처리
    } else if (fx === 'spin') {
      this.sparkBurst(ev.x, ev.y - 4, '#ffffff', 6);
    } else {
      this.fx.push({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, color: col, t: 0.4, max: 0.4, w: 4 });
      this.burst(ev.x, ev.y, col, 24, 120);
      sfx('reaction', { vol: 0.5, rate: 1.1 });
    }
  },

  lifeEvent(w, ev) {
    const P = (o) => this.parts.push(o), rnd = Math.random;
    switch (ev.t) {
      case 'trainStart': // 수련장으로 옮겨 왔다: 화면을 바로 옮기고 잠깐 어둡게
        this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2; this.fade = Math.max(this.fade, 0.7);
        this.banner = { text: SANCTUMS[ev.race] ? `수련 · ${w.training?.kind === 'damage' ? '허수아비에 피해 넣기' : w.training?.kind === 'waves' ? '수련 상대 쓰러뜨리기' : '과녁 맞히기'}` : '수련', sub: '곧 시작한다 · 수련장(말뚝 안)을 벗어나면 끝난다', t: 1.8, color: SANCTUMS[ev.race]?.color || '#ffe8a8' };
        sfx('open', { vol: 0.6 }); return true;
      case 'trainGo': this.ultName = { text: '시작!', color: '#ffe8a8', t: 0.9, max: 0.9 }; sfx('levelup', { vol: 0.45, rate: 1.4 }); return true;
      case 'trainPop': for (let i = 0; i < 8; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x + Math.cos(an) * 6, y: ev.y + 2, vx: Math.cos(an) * 24, vy: Math.sin(an) * 12 - 6, t: 0.5, max: 0.5, color: '#c8bca8', g: -4, steam: true }); } return true;
      case 'trainVanish': for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - rnd() * 20, vx: (rnd() - 0.5) * 20, vy: -10, t: 0.6, max: 0.6, color: '#3a2e48', g: -6, steam: true }); return true;
      case 'trainHit': { // 과녁마다 다르게 부서진다
        const look = ev.look, c = look === 'rune' ? '#c8b0ff' : look === 'shadow' ? '#5a4a7a' : look === 'brazier' ? '#ffb040' : '#e8d8a0';
        for (let i = 0; i < 12; i++) { const an = rnd() * Math.PI * 2, sp = 40 + rnd() * 80; P({ x: ev.x, y: ev.y - 14, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 40, t: 0.45, max: 0.45, color: i % 3 ? c : '#ffffff', g: look === 'rune' || look === 'shadow' ? 0 : 220, glow: look === 'rune' || look === 'brazier', size: 1.2 }); }
        if (look === 'brazier') for (let i = 0; i < 14; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 18, vx: (rnd() - 0.5) * 20, vy: -60 - rnd() * 60, t: 0.6, max: 0.6, g: -20, flame: true, size: 1, color: '#ffffff' });
        if (look === 'shadow') for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - rnd() * 22, vx: (rnd() - 0.5) * 16, vy: -14, t: 0.7, max: 0.7, color: '#2a2038', g: -6, steam: true });
        this.texts.push({ x: ev.x, y: ev.y - 30, text: String(ev.n), color: '#ffe8a8', t: 0.6, vy: -24, vx: 0, label: true, size: 2, pop: 0.12 });
        sfx(look === 'brazier' ? 'reaction' : look === 'rune' ? 'freeze' : 'hit', { vol: 0.6, rate: 1.3 }); return true;
      }
      case 'trainMiss': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y - 12, vx: (rnd() - 0.5) * 30, vy: -20, t: 0.4, max: 0.4, color: '#ff8a7a', g: 60 }); sfx('error', { vol: 0.4 }); return true;
      case 'trainBones': for (let i = 0; i < 10; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * 50, vy: Math.sin(an) * 30 - 40, t: 0.4, max: 0.4, color: i % 2 ? '#e8e0c8' : '#a8a090', g: 260 }); } this.texts.push({ x: ev.x, y: ev.y - 26, text: '뼈 무더기: 한 번 더!', color: '#e8e0c8', t: 1, vy: -14, vx: 0, label: true }); sfx('hitArmor', { vol: 0.5, rate: 1.4 }); return true;
      case 'trainRise': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 12, y: ev.y + 2, vx: (rnd() - 0.5) * 20, vy: -12, t: 0.6, max: 0.6, color: '#8a8070', g: -4, dust: true, v: (rnd() * 4) | 0 }); this.texts.push({ x: ev.x, y: ev.y - 26, text: '다시 일어섰다', color: '#c8b8ff', t: 0.9, vy: -14, vx: 0, label: true }); sfx('death', { vol: 0.4, rate: 1.5 }); return true;
      case 'trainGuard': sfx('hitArmor', { vol: 0.35, rate: 1.2 }); for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 14, y: ev.y - 16, vx: 0, vy: -20, t: 0.4, max: 0.4, color: '#bfe0ff', g: 0, glow: true, size: 1 }); return true;
      case 'trainLight': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 16, vx: (rnd() - 0.5) * 16, vy: -50 - rnd() * 40, t: 0.5, max: 0.5, g: -20, flame: true, size: 1, color: '#ffffff' }); sfx('reaction', { vol: 0.45, rate: 1.4 }); return true;
      case 'trainOut': for (let i = 0; i < 5; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y - 16, vx: (rnd() - 0.5) * 8, vy: -14, t: 0.8, max: 0.8, color: '#6a6060', g: -4, steam: true }); sfx('close', { vol: 0.3, rate: 0.7 }); return true;
      case 'trainEnd': for (let i = 0; i < (ev.ok ? 30 : 10); i++) { const an = rnd() * Math.PI * 2, sp = 40 + rnd() * 100; P({ x: ev.x, y: ev.y - 12, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 50, t: 0.8, max: 0.8, color: ev.ok ? (rnd() < 0.5 ? '#ffe080' : '#ffffff') : '#a8a0b0', g: 80, glow: ev.ok, size: 1.2 }); } return true;
      case 'questFind': for (let i = 0; i < 20; i++) { const an = rnd() * Math.PI * 2, sp = 30 + rnd() * 60; P({ x: ev.x, y: ev.y - 10, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 40, t: 0.8, max: 0.8, color: rnd() < 0.5 ? ev.color : '#ffffff', g: 40, glow: true, size: 1.2 }); } sfx('lore', { vol: 0.5 }); return true;
      case 'npcTalk': sfx('open', { vol: 0.25, rate: 1.6 }); return true;
      case 'wpOpen': // 포탈이 깨어난다: 기둥의 문양에 빛이 차오르고 빛 알갱이가 솟는다
        for (let i = 0; i < 28; i++) { const s2 = rnd() < 0.5 ? -1 : 1; P({ x: ev.x + s2 * 13 + (rnd() - 0.5) * 6, y: ev.y + 4 - rnd() * 26, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 40, t: 0.9, max: 0.9, color: rnd() < 0.5 ? '#bfefff' : '#ffffff', g: -10, glow: true, size: 1.2 }); }
        this.fx.push({ k: 'glow', x: ev.x, y: ev.y - 10, r: 34, color: '#8ad8ff', t: 0.8, max: 0.8 });
        this.shake = Math.max(this.shake, 2); sfx('levelup', { vol: 0.5, rate: 1.25 }); return true;
      case 'wpLeave': for (let i = 0; i < 22; i++) { const an = rnd() * Math.PI * 2; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * 40, vy: Math.sin(an) * 30 - 30, t: 0.6, max: 0.6, color: rnd() < 0.5 ? '#8ad8ff' : '#ffffff', g: -20, glow: true, size: 1.2 }); } return true;
      case 'wpArrive': // 건너왔다: 화면을 그 자리로 옮기고 잠깐 어두웠다 밝아진다
        this.cam.x = w.player.x - this.VW / 2; this.cam.y = w.player.y - this.VH / 2; this.fade = Math.max(this.fade, 1.1);
        for (let i = 0; i < 24; i++) { const an = rnd() * Math.PI * 2, sp = 20 + rnd() * 50; P({ x: ev.x, y: ev.y - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 20, t: 0.8, max: 0.8, color: rnd() < 0.5 ? '#8ad8ff' : '#e8faff', g: -10, glow: true, size: 1.2 }); }
        sfx('reaction', { vol: 0.6, rate: 1.6 }); sfx('dash', { vol: 0.5, rate: 0.8 }); return true;
      case 'toolSwing': sfx(ev.kind === 'axe' ? 'heavySwing' : 'swing', { vol: 0.35, rate: 0.9 }); return true;
      case 'gatherHit': {
        const ore = { coal: '#4a4650', copper: '#f0a060', iron: '#e0e8f4', silver: '#ffffff', gold: '#ffe070', crystal: '#d8c8ff', obsidian: '#8a7aaa' }[ev.type];
        const plant = ['herb', 'berry', 'mushroom', 'frostLily', 'fireBloom'].includes(ev.type);
        for (let i = 0; i < (plant ? 8 : 10); i++) { const an = -Math.PI * rnd(); P({ x: ev.x, y: ev.y, vx: Math.cos(an) * (30 + rnd() * 50), vy: Math.sin(an) * (40 + rnd() * 50), t: 0.45, max: 0.45, color: plant ? (rnd() < 0.5 ? '#5aa848' : '#3e7a2a') : rnd() < 0.6 ? '#8a8680' : '#5a5650', g: 220 }); }
        if (ore) for (let i = 0; i < 5; i++) P({ x: ev.x, y: ev.y - 2, vx: (rnd() - 0.5) * 120, vy: -40 - rnd() * 60, t: 0.3, max: 0.3, color: ore, g: 200, glow: true, size: 1 });
        if (!plant) { this.shake = Math.max(this.shake, 1.2); sfx(ev.type === 'crystal' ? 'freeze' : 'crack', { vol: 0.6, rate: 0.9 + rnd() * 0.2 }); } else sfx('dash', { vol: 0.4, rate: 1.3 });
        return true;
      }
      case 'nodeBreak': this.burst(ev.x, ev.y, '#8a8680', 18, 90); this.shake = Math.max(this.shake, 2.2); sfx('hitHeavy', { vol: 0.5, rate: 0.8 }); return true;
      case 'chopHit': for (let i = 0; i < 7; i++) P({ x: ev.x + (rnd() - 0.5) * 6, y: ev.y, vx: (rnd() - 0.5) * 90, vy: -30 - rnd() * 50, t: 0.5, max: 0.5, color: rnd() < 0.5 ? '#c8a070' : '#8a6038', g: 200 }); for (let i = 0; i < 4; i++) P({ x: ev.x + (rnd() - 0.5) * 22, y: ev.y - 26 - rnd() * 10, vx: (rnd() - 0.5) * 30, vy: 10 + rnd() * 20, t: 1.2, max: 1.2, color: rnd() < 0.5 ? '#5a9a3a' : '#86c454', g: 30 }); this.shake = Math.max(this.shake, 1); sfx('hurt', { vol: 0.55, rate: 1.1 + rnd() * 0.2 }); return true;
      case 'treeFall': for (let i = 0; i < 26; i++) P({ x: ev.x + (rnd() - 0.5) * 30, y: ev.y + (rnd() - 0.5) * 20, vx: (rnd() - 0.5) * 70, vy: -20 + rnd() * 40, t: 1.4, max: 1.4, color: ev.burnt ? '#3a3028' : rnd() < 0.5 ? '#5a9a3a' : '#86c454', g: 40, big: rnd() < 0.3 }); this.shake = Math.max(this.shake, 3); sfx('hitHeavy', { vol: 0.6, rate: 0.6 }); return true;
      case 'treeGrow': this.sparkBurst(ev.x, ev.y - 10, '#9be15d', 6); return true;
      case 'digDone': for (let i = 0; i < 16; i++) { const an = -Math.PI * rnd(); P({ x: ev.x, y: ev.y, vx: Math.cos(an) * (30 + rnd() * 60), vy: Math.sin(an) * (40 + rnd() * 60), t: 0.55, max: 0.55, color: rnd() < 0.5 ? '#7a5a38' : '#5a3e24', g: 240, big: rnd() < 0.3 }); } sfx('step', { vol: 0.7, rate: 0.7 }); sfx('drop', { vol: 0.4 }); return true;
      case 'goodGet': this.goodNote(ev.id, ev.n); sfx('echo', { vol: 0.25, rate: 1.5 + rnd() * 0.3 }); return true;
      case 'artifact': { const a = ARTIFACTS[ev.id]; this.banner = { text: `유물 발견 · ${a.name}`, sub: a.text, t: 4.5, color: '#ffd88a' }; this.burst(ev.x, ev.y, '#ffd88a', 24, 80); this.note(`유물 도감 · ${a.name}`, '#ffd88a'); sfx('lore', { vol: 0.6 }); sfx('levelup', { vol: 0.4 }); return true; }
      case 'fishCast': sfx('swing', { vol: 0.5, rate: 0.8 }); return true;
      case 'fishSplash': for (let i = 0; i < 8; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 40, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: '#bfe8ff', g: 200 }); sfx('drop', { vol: 0.35, rate: 1.4 }); return true;
      case 'fishNibble': for (let i = 0; i < 3; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 20, vy: -15, t: 0.3, max: 0.3, color: '#e8f8ff', g: 120 }); return true;
      case 'fishBite': for (let i = 0; i < 12; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 70, vy: -40 - rnd() * 40, t: 0.5, max: 0.5, color: '#bfe8ff', g: 220 }); sfx('reaction', { vol: 0.35, rate: 1.8 }); return true;
      case 'fishHook': this.shake = Math.max(this.shake, 1.5); sfx('hit', { vol: 0.5 }); this.rhythmFx = []; this.banner = { text: '걸렸다!', sub: '박이 원에 닿을 때 G · Space · 클릭', t: 1.4, color: '#9ad8ff' }; return true;
      case 'beatTick': this.beatPulse = 1; tone(ev.count ? 1320 : 880, { dur: 0.05, type: 'sine', vol: ev.count ? 0.16 : 0.07 }); return true;
      case 'beatHit': {
        const scale = [0, 2, 4, 7, 9, 12, 9, 7, 4, 7, 9, 12, 14, 16, 12, 9], semi = scale[ev.idx % scale.length], fq = 523.25 * Math.pow(2, semi / 12);
        tone(fq, { dur: 0.22, type: 'triangle', vol: 0.2 });
        if (ev.grade === 'perfect') tone(fq * 2, { dur: 0.12, type: 'sine', vol: 0.08, when: 0.02 });
        (this.rhythmFx ||= []).push({ text: ev.grade === 'perfect' ? '완벽!' : '좋아', color: ev.grade === 'perfect' ? '#ffe070' : '#ffffff', t: 0.6 });
        for (let i = 0; i < (ev.grade === 'perfect' ? 6 : 3); i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 50, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: '#bfe8ff', g: 200 });
        return true;
      }
      case 'beatMiss': tone(140, { dur: 0.18, type: 'square', vol: 0.06 }); (this.rhythmFx ||= []).push({ text: '놓침', color: '#a8a8b8', t: 0.6 }); this.missShake = 0.3; this.shake = Math.max(this.shake, 1.2); return true;
      case 'fishEnd': {
        if (!ev.ok || !ev.id) return true;
        const f = FISH[ev.id], name = GOODS[ev.id]?.name || (ev.id === 'bottleLetter' ? '유리병 편지' : ev.id);
        this.caught = { id: ev.id, t: 2.2 };
        this.texts.push({ x: ev.x, y: ev.y - 40, text: f ? `${name} ${ev.size}cm!` : `${name}!`, color: f?.legend ? '#ffd040' : '#e8f8ff', t: 2, vy: -8, vx: 0, label: true });
        if (ev.first) { this.banner = { text: `새 물고기 · ${name}`, sub: `${ev.size}cm · 물고기 도감에 남겼다${f.legend ? ' · 전설의 물고기!' : ''}${ev.allPerfect ? ' · 완벽한 박자!' : ''}`, t: 3.4, color: f.legend ? '#ffd040' : '#9ad8ff' }; sfx('levelup', { vol: 0.5 }); }
        else if (ev.allPerfect) this.banner = { text: '완벽한 박자!', sub: `${name} ${ev.size}cm: 박자를 다 맞추면 더 큰 물고기가 잡힌다`, t: 2.4, color: '#ffe070' };
        else if (ev.record) this.note(`${name} 최대 크기 경신 · ${ev.size}cm`, '#9ad8ff');
        for (const [k, fq] of [[0, 523.25], [1, 659.25], [2, 783.99], [3, 1046.5]]) tone(fq, { dur: 0.18, type: 'triangle', vol: 0.12, when: k * 0.07 });
        if (GOODS[ev.id]) this.goodNote(ev.id, 1);
        for (let i = 0; i < 14; i++) P({ x: ev.x, y: ev.y - 20, vx: (rnd() - 0.5) * 80, vy: -50 - rnd() * 40, t: 0.6, max: 0.6, color: '#bfe8ff', g: 220 });
        sfx('coin', { vol: 0.5 }); return true;
      }
      case 'farmTill': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y, vx: (rnd() - 0.5) * 50, vy: -30 - rnd() * 30, t: 0.4, max: 0.4, color: rnd() < 0.5 ? '#7a5a38' : '#5a3e24', g: 220 }); sfx('step', { vol: 0.5, rate: 0.8 }); return true;
      case 'farmPlant': this.sparkBurst(ev.x, ev.y - 2, '#9be15d', 5); sfx('drop', { vol: 0.35, rate: 1.2 }); return true;
      case 'farmWater': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 6, vx: (rnd() - 0.5) * 20, vy: 10 + rnd() * 20, t: 0.4, max: 0.4, color: '#8ad0f0', g: 120 }); sfx('drop', { vol: 0.3, rate: 1.6 }); return true;
      case 'farmHarvest': this.burst(ev.x, ev.y - 4, '#9be15d', 12, 60); sfx('coin', { vol: 0.4, rate: 1.2 }); return true;
      case 'potion': { // 물약: 병에서 올라오는 붉은 거품 몇 개
        for (let i = 0; i < 6; i++) this.parts.push({ x: ev.x + (Math.random() - 0.5) * 8, y: ev.y - 4, vx: (Math.random() - 0.5) * 8, vy: -24 - Math.random() * 14, t: 0.6, max: 0.6, color: ev.color || '#e04a4a', g: -6, bubble: true });
        sfx('echo', { vol: 0.4, rate: 1.5 });
        return true;
      }
      case 'eat': {
        const nm = GOODS[ev.id]?.name || '';
        this.texts.push({ x: ev.x, y: ev.y - 30, text: `+${ev.heal}`, color: '#8af08a', t: 1.1, vy: -18, vx: 0, size: 2, pop: 0.12 });
        if (ev.eff) this.texts.push({ x: ev.x, y: ev.y - 44, text: ev.eff, color: ev.color || '#ffe8a8', t: 1.4, vy: -10, vx: 0, label: true });
        this.note(`${nm} · 체력 +${ev.heal}${ev.eff ? ' · ' + ev.eff : ''}`, ev.color || '#8af08a');
        for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y - 10 - rnd() * 10, vx: (rnd() - 0.5) * 20, vy: -20 - rnd() * 25, t: 0.7, max: 0.7, color: i % 2 ? '#8af08a' : ev.color || '#ffffff', g: -10, glow: true, size: 1 });
        tone(660, { dur: 0.08, type: 'triangle', vol: 0.1 }); tone(880, { dur: 0.1, type: 'triangle', vol: 0.1, when: 0.07 });
        return true;
      }
      case 'enchant': { // 무기에 속성이 깃든다: 손 둘레로 그 속성 알갱이가 빨려 든다
        const col = ELEM[ev.elem].color;
        this.rimFlash = { color: col, t: 0.4, max: 0.4 };
        for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, r = 18 + rnd() * 10; P({ x: ev.x + Math.cos(a) * r, y: ev.y - 8 + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 2, t: 0.3, max: 0.3, color: col, g: 0, glow: true, size: 1 }); }
        sfx(ev.elem === 'ice' ? 'freeze' : ev.elem === 'lightning' ? 'cast' : 'skill', { vol: 0.5, rate: 1.3 });
        return true;
      }
      case 'waterBreath': for (let i = 0; i < 16; i++) P({ x: ev.x + (rnd() - 0.5) * 16, y: ev.y - rnd() * 8, vx: (rnd() - 0.5) * 10, vy: -30 - rnd() * 30, t: 1, max: 1, color: '#bfe8ff', g: -10, bubble: true }); sfx('drop', { vol: 0.5, rate: 0.8 }); return true;
      case 'splash': for (let i = 0; i < (ev.big ? 22 : 10); i++) P({ x: ev.x + (rnd() - 0.5) * 10, y: ev.y, vx: (rnd() - 0.5) * 70, vy: -50 - rnd() * 60, t: 0.6, max: 0.6, color: rnd() < 0.5 ? '#e8f8ff' : '#8ad0f0', g: 260 }); sfx('drop', { vol: ev.big ? 0.8 : 0.45, rate: ev.big ? 0.6 : 1.1 }); return true;
      case 'boatOn': case 'boatOff': for (let i = 0; i < 8; i++) P({ x: ev.x + (rnd() - 0.5) * 16, y: ev.y + 4, vx: (rnd() - 0.5) * 40, vy: -20 - rnd() * 20, t: 0.4, max: 0.4, color: '#e8f8ff', g: 200 }); sfx('step', { vol: 0.5, rate: 0.7 }); return true;
      case 'hopStart': for (let i = 0; i < 6; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y + 4, vx: (rnd() - 0.5) * 30, vy: -8 - rnd() * 10, t: 0.4, max: 0.4, color: '#a89880', g: 20, big: true }); sfx('dash', { vol: 0.4, rate: 1.3 }); return true;
      case 'thud': { // 착지: 양옆으로 퍼지는 흙먼지 · 튀는 돌 부스러기 · 화면 흔들림
        const n = ev.big ? 22 : 12;
        for (let i = 0; i < n; i++) { const s = rnd() < 0.5 ? -1 : 1; P({ x: ev.x + s * rnd() * 6, y: ev.y + 4, vx: s * (40 + rnd() * 70), vy: -6 - rnd() * 14, t: 0.55, max: 0.55, color: rnd() < 0.5 ? '#a89880' : '#8a7a66', g: 30, big: true }); }
        for (let i = 0; i < (ev.big ? 8 : 4); i++) P({ x: ev.x, y: ev.y + 2, vx: (rnd() - 0.5) * 90, vy: -60 - rnd() * 50, t: 0.5, max: 0.5, color: '#6a5e50', g: 320 });
        this.shake = Math.max(this.shake, ev.big ? 6 : 2.5); if (ev.big) this.hitstop = Math.max(this.hitstop, 0.05);
        sfx('hitHeavy', { vol: ev.big ? 0.8 : 0.45, rate: ev.big ? 0.5 : 0.75 }); sfx('step', { vol: 0.6, rate: 0.6 });
        return true;
      }
      case 'emberPop': for (let i = 0; i < 10; i++) P({ x: ev.x + (rnd() - 0.5) * 8, y: ev.y, vx: (rnd() - 0.5) * 60, vy: -30 - rnd() * 40, t: 0.45, max: 0.45, g: -20, flame: true, size: 1.2, color: '#ffffff' }); sfx('hit', { vol: 0.3, rate: 0.7 }); return true;
      case 'linkPulse': { // 고통이 사슬을 타고 건너간다
        for (let i = 0; i < 6; i++) { const u = i / 5; P({ x: ev.x1 + (ev.x2 - ev.x1) * u, y: ev.y1 + (ev.y2 - ev.y1) * u, vx: (rnd() - 0.5) * 10, vy: -6, t: 0.25 + u * 0.1, max: 0.35, color: '#e0a8ff', g: 0, glow: true, size: 1 }); }
        return true;
      }
      case 'linkBreak': for (let i = 0; i < 8; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 80, vy: -20 - rnd() * 40, t: 0.4, max: 0.4, color: '#b88ad8', g: 200 }); sfx('crack', { vol: 0.35, rate: 1.6 }); return true;
      case 'reel': sfx('dash', { vol: 0.5, rate: 0.7 }); return true;
      case 'whipCrack': for (let i = 0; i < 6; i++) P({ x: ev.x, y: ev.y, vx: (rnd() - 0.5) * 120, vy: (rnd() - 0.5) * 120, t: 0.14, max: 0.14, color: '#fff4d8', g: 0, line: true }); sfx('hitArmor', { vol: 0.35, rate: 1.8 }); return true;
    }
    return false;
  },

};
