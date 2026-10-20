// 효과음 (Kenney CC0) + 지역별 앰비언트 배경음 (WebAudio 합성)
const SFX = {
  swing: ['knifeSlice.ogg', 'knifeSlice2.ogg', 'drawKnife2.ogg'],
  heavySwing: ['chop.ogg'],
  shoot: ['drawKnife1.ogg'],
  cast: ['maximize_003.ogg'],
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
  lore: ['bookOpen.ogg'], skill: ['minimize_003.ogg'], select: ['select_002.ogg'], drop: ['drop_002.ogg'],
};

let ctx = null, master = null, sfxGain = null, musicGain = null;
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
  sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = vol.music; musicGain.connect(master);
  const files = new Set(Object.values(SFX).flat());
  for (const f of files) {
    fetch('assets/sfx/' + f).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => buffers.set(f, b)).catch(() => {});
  }
  if (pendingMusic) startMusic(pendingMusic);
}

const lastPlay = new Map();
export function sfx(name, { vol: v = 1, rate = 1, jitter = 0.08 } = {}) {
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

// ───── 앰비언트 배경음 (지역별 음계·음색) ─────
const MOODS = {
  plaza: { root: 57, scale: [0, 3, 5, 7, 10], wave: 'triangle', tempo: 1.6, drone: 0.05, bright: 1800 },
  cave: { root: 45, scale: [0, 2, 3, 7, 8], wave: 'sine', tempo: 2.4, drone: 0.07, bright: 900 },
  swamp: { root: 43, scale: [0, 1, 5, 7, 8], wave: 'sine', tempo: 2.8, drone: 0.08, bright: 700 },
  rift: { root: 40, scale: [0, 1, 4, 6, 7], wave: 'sawtooth', tempo: 2.0, drone: 0.06, bright: 600 },
  frost: { root: 52, scale: [0, 2, 4, 7, 9], wave: 'triangle', tempo: 2.6, drone: 0.05, bright: 2400 },
  grave: { root: 38, scale: [0, 1, 3, 6, 7], wave: 'sine', tempo: 3.2, drone: 0.09, bright: 500 },
  labyrinth: { root: 41, scale: [0, 1, 3, 5, 8], wave: 'triangle', tempo: 2.9, drone: 0.08, bright: 650 },
  palace: { root: 55, scale: [0, 2, 4, 7, 9, 11], wave: 'sine', tempo: 2.2, drone: 0.05, bright: 2000 },
};
let music = null, pendingMusic = null;

export function startMusic(id) {
  pendingMusic = id;
  if (!ctx) return;
  stopMusic();
  const m = MOODS[id] || MOODS.plaza;
  const f = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const nodes = [];
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = m.bright; lp.connect(musicGain);
  // 드론
  for (const [n, det] of [[m.root - 12, 0], [m.root - 5, 4]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f(n); o.detune.value = det;
    const gn = ctx.createGain(); gn.gain.value = m.drone;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const lg = ctx.createGain(); lg.gain.value = m.drone * 0.6; lfo.connect(lg); lg.connect(gn.gain);
    o.connect(gn); gn.connect(lp); o.start(); lfo.start();
    nodes.push(o, lfo);
  }
  // 띄엄띄엄 울리는 선율
  let alive = true;
  const tick = () => {
    if (!alive) return;
    const t0 = ctx.currentTime;
    const note = m.root + m.scale[Math.floor(Math.random() * m.scale.length)] + (Math.random() < 0.3 ? 12 : 0);
    const o = ctx.createOscillator(); o.type = m.wave; o.frequency.value = f(note);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(m.wave === 'sawtooth' ? 0.025 : 0.06, t0 + 0.05);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + m.tempo * 1.4);
    o.connect(gn); gn.connect(lp); o.start(t0); o.stop(t0 + m.tempo * 1.5);
    music.timer = setTimeout(tick, m.tempo * 1000 * (0.6 + Math.random() * 0.8));
  };
  music = { nodes, lp, stop: () => { alive = false; } };
  tick();
}

export function stopMusic() {
  if (!music) return;
  music.stop(); clearTimeout(music.timer);
  for (const n of music.nodes) { try { n.stop(); } catch { /* 무시 */ } }
  music.lp.disconnect();
  music = null;
}
