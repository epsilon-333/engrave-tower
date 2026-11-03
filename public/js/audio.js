// 효과음 (Kenney CC0) + 지역별 앰비언트 배경음 (WebAudio 합성)
const SFX = {
  swing: ['knifeSlice.ogg', 'knifeSlice2.ogg', 'drawKnife2.ogg'],
  heavySwing: ['chop.ogg'],
  shoot: ['drawKnife1.ogg'],
  hit: ['impactPunch_medium_000.ogg', 'impactPunch_medium_001.ogg', 'impactPunch_medium_002.ogg'],
  hitHeavy: ['impactPunch_heavy_000.ogg', 'impactPunch_heavy_001.ogg', 'impactPunch_heavy_002.ogg'],
  hitArmor: ['impactPlate_light_000.ogg', 'impactPlate_light_001.ogg'],
  death: ['impactSoft_heavy_000.ogg', 'impactSoft_heavy_001.ogg', 'impactSoft_heavy_002.ogg'],
  hurt: ['impactWood_heavy_000.ogg'],
  coin: ['handleCoins.ogg', 'handleCoins2.ogg'],
  echo: ['glass_001.ogg', 'glass_002.ogg', 'glass_003.ogg'],
  chest: ['doorOpen_1.ogg'],
  crack: ['impactMining_000.ogg', 'impactMining_001.ogg'],
  dash: ['cloth1.ogg', 'cloth2.ogg', 'cloth3.ogg'],
  step: ['footstep00.ogg', 'footstep01.ogg', 'footstep02.ogg', 'footstep03.ogg', 'footstep04.ogg'],
  reaction: ['impactBell_heavy_000.ogg'],
  freeze: ['impactGlass_medium_000.ogg'],
  windup: ['impactGeneric_light_000.ogg'],
  levelup: ['confirmation_002.ogg'],
  open: ['open_001.ogg'], close: ['close_001.ogg'], click: ['click_002.ogg'], error: ['error_004.ogg'],
  lore: ['bookOpen.ogg'], select: ['select_002.ogg'], drop: ['drop_002.ogg'],
};

let ctx = null, master = null, sfxGain = null, musicGain = null, meter = null;
// 지금 나오는 소리의 크기 { rms, peak } (0~1) — 시험에서 곡이 조용하거나 찢어지지 않는지 본다
export function audioLevel() { if (!meter) return null; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let s = 0, pk = 0; for (const v of a) { s += v * v; pk = Math.max(pk, Math.abs(v)); } return { rms: Math.sqrt(s / a.length), peak: pk }; }
const buffers = new Map();
let vol = { sfx: 0.7, music: 0.35 };
try { Object.assign(vol, JSON.parse(localStorage.getItem('et-vol') || '{}')); } catch { /* 무시 */ }

export function getVolume() { return vol; }
export function setVolume(k, v) {
  vol[k] = v;
  try { localStorage.setItem('et-vol', JSON.stringify(vol)); } catch { /* 무시 */ }
  if (sfxGain) sfxGain.gain.value = vol.sfx;
  if (musicGain) musicGain.gain.value = vol.music;
}

// 브라우저 정책상 첫 입력 후에 시작
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new AudioContext();
  master = ctx.createGain(); master.connect(ctx.destination);
  meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter); // 소리 크기 재기 (시험용)
  sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = vol.music; musicGain.connect(master);
  const files = new Set(Object.values(SFX).flat());
  for (const f of files) {
    fetch('assets/sfx/' + f).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => buffers.set(f, b)).catch(() => {});
  }
  if (pendingMusic) startMusic(pendingMusic);
}

// 합성 효과음: 시전(차오르는 소리) · 스킬(휘익) — 예전엔 창 열기 · 닫기 소리를 썼다
const SYNTH = {
  cast: (t, v, rate) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(320 * rate, t); o.frequency.exponentialRampToValueAtTime(980 * rate, t + 0.28); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.36); whoosh(t, 0.3, 0.05 * v, 3000, 7000); },
  skill: (t, v, rate) => { whoosh(t, 0.22, 0.22 * v, 600 * rate, 3200 * rate); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220 * rate, t); o.frequency.exponentialRampToValueAtTime(90 * rate, t + 0.18); g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.22); },
};
function whoosh(t, dur, vol, f0, f1) {
  const len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur + 0.02);
}
const lastPlay = new Map();
export function sfx(name, { vol: v = 1, rate = 1, jitter = 0.08 } = {}) {
  if (ctx && SYNTH[name]) { const now = ctx.currentTime; if ((lastPlay.get(name) || 0) > now - 0.05) return; lastPlay.set(name, now); SYNTH[name](now, v, rate * (1 + (Math.random() * 2 - 1) * jitter)); return; }
  if (!ctx || !SFX[name]) return;
  const now = ctx.currentTime;
  if ((lastPlay.get(name) || 0) > now - 0.03) return; // 같은 소리 폭주 방지
  lastPlay.set(name, now);
  const list = SFX[name];
  const buf = buffers.get(list[Math.floor(Math.random() * list.length)]);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
  const gn = ctx.createGain(); gn.gain.value = v;
  src.connect(gn); gn.connect(sfxGain);
  src.start();
}

// 짧은 음 하나 (리듬 낚시: 똑딱 · 맞힐 때마다 한 음씩 멜로디)
export function tone(freq, { dur = 0.16, type = 'triangle', vol = 0.22, when = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when, o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(vol, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn); gn.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.03);
}

// ───── 배경음: 작은 시퀀서 (코드 진행 · 베이스 · 아르페지오 · 선율 · 드럼) ─────
// 곡마다 진행(4~8마디)과 선율(2마디 동기를 A A B A로)을 씨앗으로 정해 두고 되풀이한다 — 매번 같은 곡이 나온다
// 음계 도수: 0부터. prog = 마디마다 코드의 뿌리 도수
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harm: [0, 2, 3, 5, 7, 8, 11] };
const MOODS = {
  title: { root: 50, scale: 'minor', bpm: 72, prog: [0, 5, 3, 4], lead: 'triangle', drums: 0, arp: 0.5, bright: 2200, seed: 11, vol: 1 },
  plaza: { root: 55, scale: 'major', bpm: 92, prog: [0, 4, 5, 3], lead: 'triangle', drums: 1, arp: 0.6, bright: 2600, seed: 3, vol: 0.9 },
  cave: { root: 45, scale: 'dorian', bpm: 104, prog: [0, 0, 6, 4], lead: 'square', drums: 2, arp: 0.7, bright: 1500, seed: 7, vol: 0.85 },
  swamp: { root: 43, scale: 'phryg', bpm: 98, prog: [0, 1, 0, 6], lead: 'triangle', drums: 2, arp: 0.6, bright: 1100, seed: 19, vol: 0.85 },
  rift: { root: 40, scale: 'harm', bpm: 126, prog: [0, 5, 6, 4], lead: 'sawtooth', drums: 3, arp: 0.8, bright: 1300, seed: 23, vol: 0.7 },
  frost: { root: 52, scale: 'lydian', bpm: 100, prog: [0, 1, 4, 5], lead: 'triangle', drums: 2, arp: 0.8, bright: 3200, seed: 29, vol: 0.85 },
  grave: { root: 38, scale: 'minor', bpm: 88, prog: [0, 5, 1, 4], lead: 'sine', drums: 2, arp: 0.5, bright: 900, seed: 31, vol: 0.95 },
  labyrinth: { root: 41, scale: 'phryg', bpm: 96, prog: [0, 1, 6, 1], lead: 'triangle', drums: 2, arp: 0.6, bright: 1000, seed: 37, vol: 0.85 },
  palace: { root: 55, scale: 'major', bpm: 84, prog: [0, 3, 4, 0, 5, 3, 1, 4], lead: 'sine', drums: 1, arp: 0.5, bright: 2400, seed: 41, vol: 0.9 },
  forest: { root: 50, scale: 'dorian', bpm: 96, prog: [0, 6, 3, 4], lead: 'triangle', drums: 1, arp: 0.7, bright: 2400, seed: 59, vol: 0.85 },
  desert: { root: 45, scale: 'phryg', bpm: 110, prog: [0, 1, 0, 5], lead: 'square', drums: 2, arp: 0.6, bright: 1800, seed: 61, vol: 0.8 },
  boss: { root: 40, scale: 'harm', bpm: 144, prog: [0, 0, 5, 4, 0, 0, 6, 4], lead: 'sawtooth', drums: 4, arp: 1, bright: 1800, seed: 53, vol: 0.75 },
};
let music = null, pendingMusic = null, noiseBuf = null;
const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function voice(dest, type, freq, t0, dur, vol, att = 0.01) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dest, t0, dur, vol, hp) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t0); src.stop(t0 + dur + 0.02);
}
function kick(dest, t0, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + 0.25);
}
// 선율 동기: 2마디(32칸) · 칸마다 [도수 또는 null, 길이]
function motif(rnd, busy) {
  const out = []; let deg = 0;
  for (let i = 0; i < 32;) {
    const len = rnd() < busy ? 2 : rnd() < 0.5 ? 4 : 6;
    if (rnd() < 0.22 && i % 8 !== 0) out.push([i, null, len]);
    else { deg += [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(rnd() * 8)]; deg = Math.max(-2, Math.min(7, deg)); out.push([i, deg, len]); }
    i += len;
  }
  return out;
}

export function startMusic(id) {
  if (music?.id === id) return; // 같은 곡이면 이어서
  pendingMusic = id;
  if (!ctx) return;
  stopMusic();
  const m = MOODS[id] || MOODS.plaza, sc = SCALES[m.scale];
  const note = (deg, oct = 0) => { const n = sc.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n; return m.root + sc[d] + 12 * (o + oct); };
  const bus = ctx.createGain(); bus.gain.value = 0; bus.gain.linearRampToValueAtTime(m.vol * 2.5, ctx.currentTime + 1.5); // 곡이 바뀔 때 부드럽게 들어온다
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = m.bright; lp.connect(bus); bus.connect(musicGain);
  const delay = ctx.createDelay(); delay.delayTime.value = 60 / m.bpm * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.28; delay.connect(fb); fb.connect(delay); delay.connect(lp); // 메아리
  const rnd = seeded(m.seed), A = motif(rnd, m.arp * 0.6), B = motif(rnd, m.arp * 0.6);
  const step = 60 / m.bpm / 4; // 16분음표
  let k = 0, next = ctx.currentTime + 0.1;
  const sched = () => {
    while (next < ctx.currentTime + 0.25) {
      const bar = Math.floor(k / 16), s16 = k % 16, root = m.prog[bar % m.prog.length], t = next;
      const chord = [root, root + 2, root + 4];
      if (s16 === 0) for (const c of chord) voice(lp, 'triangle', mtof(note(c, -1)), t, step * 15, 0.035, 0.25); // 바탕 화음
      if (s16 % 8 === 0 || (m.drums >= 3 && s16 % 4 === 2 && rnd() < 0.5)) voice(lp, m.drums >= 3 ? 'sawtooth' : 'triangle', mtof(note(root, -2)), t, step * (m.drums >= 3 ? 2 : 6), 0.09); // 베이스
      if (m.arp && s16 % 2 === 0 && rnd() < m.arp) voice(delay, 'square', mtof(note(chord[(s16 / 2) % 3], 1)), t, step * 1.6, 0.012); // 아르페지오 (메아리로)
      const phrase = [A, A, B, A][Math.floor(bar / 2) % 4], pos = (bar % 2) * 16 + s16;
      for (const [at, deg, len] of phrase) if (at === pos && deg != null) { const f = mtof(note(root + deg, 1)); voice(lp, m.lead, f, t, step * len * 0.95, m.lead === 'sawtooth' ? 0.022 : m.lead === 'square' ? 0.02 : 0.05, 0.02); voice(delay, m.lead, f, t, step * len * 0.6, 0.01); }
      if (m.drums) {
        if (s16 % 8 === 0 || (m.drums >= 3 && s16 === 10)) kick(lp, t, m.drums >= 3 ? 0.35 : 0.18);
        if (m.drums >= 2 && s16 % 8 === 4) noise(bus, t, 0.14, m.drums >= 3 ? 0.12 : 0.07, 1800);
        if (m.drums >= 2 && s16 % 2 === 0) noise(bus, t, 0.04, m.drums >= 4 ? 0.05 : 0.025, 7000);
      }
      k++; next += step;
    }
  };
  sched();
  music = { id, bus, lp, delay, timer: setInterval(sched, 60) };
}

export function stopMusic() {
  if (!music) return;
  clearInterval(music.timer);
  const old = music; music = null;
  try { old.bus.gain.cancelScheduledValues(ctx.currentTime); old.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } catch { /* 무시 */ }
  setTimeout(() => { try { old.bus.disconnect(); old.delay.disconnect(); } catch { /* 무시 */ } }, 1500);
}
