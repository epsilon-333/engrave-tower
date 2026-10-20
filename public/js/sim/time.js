// 하루의 시간: 게임 1분 = 실제 1초 (하루 = 실제 24분). 저장의 time = { day, min } (min: 0~1439, 자정부터)
// 낮 · 노을 · 밤 · 새벽의 빛 색(곱하기)과 어둠 정도, 시계 글씨, 잠잘 수 있는 때.
export const MIN_PER_SEC = 1;
export const WAKE_MIN = 6 * 60;       // 잠에서 깨는 시각
export const SLEEP_FROM = 17 * 60;    // 저녁 5시부터 잘 수 있다
export const newClock = () => ({ day: 1, min: 7 * 60 });
export const absMin = (c) => (c.day - 1) * 1440 + c.min;

// [분, 빛 색 r, g, b, 어둠 0~1]
const KEYS = [
  [0, 58, 70, 132, 1], [270, 58, 70, 132, 1], [330, 112, 104, 168, 0.72], [375, 255, 192, 170, 0.28], [450, 255, 255, 255, 0],
  [990, 255, 255, 255, 0], [1065, 255, 222, 172, 0.08], [1125, 245, 156, 120, 0.34], [1185, 112, 100, 160, 0.74], [1230, 58, 70, 132, 1], [1440, 58, 70, 132, 1],
];
function sample(min) {
  const m = ((min % 1440) + 1440) % 1440;
  for (let i = 1; i < KEYS.length; i++) {
    const a = KEYS[i - 1], b = KEYS[i];
    if (m <= b[0]) { const k = (m - a[0]) / (b[0] - a[0] || 1); return [0, 1, 2, 3].map((j) => a[j + 1] + (b[j + 1] - a[j + 1]) * k); }
  }
  return KEYS[0].slice(1);
}
export const skyColor = (min) => sample(min).slice(0, 3).map(Math.round);
export const darkness = (min) => sample(min)[3];
export const isNight = (min) => darkness(min) >= 0.6;
export const canSleep = (min) => min >= SLEEP_FROM || min < 5 * 60;
export function clockText(c) {
  const h = Math.floor(c.min / 60) % 24, m = Math.floor(c.min % 60);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m - (m % 10)).padStart(2, '0')}`;
}
export function partOfDay(min) {
  const h = min / 60;
  return h < 5 ? '한밤' : h < 7 ? '새벽' : h < 11 ? '아침' : h < 14 ? '낮' : h < 17 ? '오후' : h < 19.5 ? '저녁' : '밤';
}
// 잠: 다음 아침 6시까지 (자정 전에 자면 다음 날)
export function sleepUntilMorning(c) {
  const before = absMin(c);
  if (c.min >= WAKE_MIN) c.day++;
  c.min = WAKE_MIN;
  return absMin(c) - before; // 잔 시간 (분)
}
