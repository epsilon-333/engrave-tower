// 언어 바꾸기(설정 → 언어): 영어면 게임 코드는 그대로 두고, 화면에 나가는 글자(캔버스 글자 · 페이지 글자 · 알림 창)만 영어로 바꾼다.
// DICT(한국어 조각 → 영어)는 build.mjs가 이 파일 앞에 붙인다. 게임 안의 판단(이름 · 정규식 · 표의 열쇠)은 한국어 그대로라 놀이가 바뀌지 않는다.
(() => {
  let L = null; try { L = localStorage.getItem('lang'); } catch { /* 저장소 막힘 */ }
  window.__lang = L || (/^ko/i.test(navigator.language || '') ? 'ko' : 'en'); // 고른 적이 없으면 브라우저 언어
  if (window.__lang !== 'en') return;
  const HANGUL = /[가-힣]/;
  const byFirst = new Map(); // 첫 글자 → 그 글자로 시작하는 조각 (긴 것부터)
  for (const k of Object.keys(DICT)) { const c = k[0]; if (!byFirst.has(c)) byFirst.set(c, []); byFirst.get(c).push(k); }
  for (const list of byFirst.values()) list.sort((a, b) => b.length - a.length);
  const cache = new Map();
  const word = (c) => !!c && /[\w」)%]/.test(c);
  // 짧은 한글 조각(조사 · 한 글자 낱말)은 낱말 한가운데에 쓰지 않는다: 「나눌」의 「나」를 Me로 바꾸던 것
  const shortOk = (s, i, k) => !(/^[가-힣]{1,2}$/.test(k) && (HANGUL.test(s[i + k.length] || '') || HANGUL.test(s[i - 1] || '')));
  // 조사: 번역한 낱말 바로 뒤에 붙은 것은 버린다 (「족장이」 → Chieftain)
  const PARTICLES = new Set(['은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로', '도', '만', '으로', '에서', '에게', '까지', '부터', '마다', '보다', '처럼', '한테', '이나', '이다', '이야', '요']);
  // 조각 고르기: 한글을 가장 많이 덮고, 같으면 조각이 가장 적은 나눔 (앞에서부터 아무 조각이나 잡으면 「3. 각인」이 문장 하나를 깨뜨렸다)
  function split(s) {
    const n = s.length, best = new Array(n + 1).fill(null);
    best[n] = { cov: 0, cnt: 0, k: null };
    for (let i = n - 1; i >= 0; i--) {
      const skip = best[i + 1]; let b = { cov: skip.cov, cnt: skip.cnt, k: null };
      for (const k of byFirst.get(s[i]) || []) {
        if (!s.startsWith(k, i) || !shortOk(s, i, k)) continue;
        const nx = best[i + k.length], cov = nx.cov + (k.match(/[가-힣]/g) || []).length, cnt = nx.cnt + 1;
        if (cov > b.cov || (cov === b.cov && cnt < b.cnt && cov > skip.cov)) b = { cov, cnt, k };
      }
      best[i] = b;
    }
    const parts = []; for (let i = 0; i < n;) { const k = best[i].k; if (k) { parts.push([k, true]); i += k.length; } else { parts.push([s[i], false]); i++; } }
    // 번역한 조각 바로 뒤의 조사(남은 한글 1~2자)는 지운다
    for (let j = 1; j < parts.length; j++) {
      if (!parts[j - 1][1] || parts[j][1]) continue;
      let run = '', m = j; while (m < parts.length && !parts[m][1] && HANGUL.test(parts[m][0]) && run.length < 2) run += parts[m++][0];
      if (PARTICLES.has(run) && !HANGUL.test(parts[m]?.[0]?.[0] || '')) parts.splice(j, m - j);
    }
    return parts;
  }
  // 문장 틀: 글자 부분이 긴 것부터 (더 자세한 틀이 먼저) · {n} 자리는 무엇이든 받는다
  const esc = (t) => t.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  // 자리 하나의 모양: 바로 뒤가 다른 자리면 비어도 되고, 뒤에 조사가 아닌 한글(분 · 층 · 개 …)이 붙으면 숫자처럼 한글로 끝나지 않는 것만 (「광분」을 「광 + 분」으로 읽지 않게)
  const PART_RE = /^(\(으\)|이\(가\)|을\(를\)|과\(와\)|은\(는\)|의|을|를|이|가|에|와|과|로|은|는|도|만|에서|에게|까지|부터|처럼|보다)/;
  const slotRe = (next, inner) => (next === '' && inner ? '(.*?)' : /^[가-힣]/.test(next) && !PART_RE.test(next) ? '(.*?[^가-힣])' : '(.+?)');
  const tpls = (typeof TPL !== 'undefined' ? TPL : []).map(([k, v]) => {
    const lit = k.replace(/\{\d+\}/g, ''), order = [...k.matchAll(/\{(\d+)\}/g)].map((m) => +m[1]);
    return { re: new RegExp('^' + k.split(/\{\d+\}/).map((p, i, all) => (i ? slotRe(p, i < all.length - 1) : '') + esc(p)).join('') + '$'), order, v, lit: lit.length, need: lit.match(/[가-힣]+/)?.[0] || '' };
  }).sort((a, b) => b.lit - a.lit);
  const hangulN = (t) => (t.match(/[가-힣]/g) || []).length;
  function fromTpl(whole) { // 한글이 하나도 남지 않는 틀을 먼저 · 없으면 가장 적게 남는 것
    let best = null, bestN = Infinity;
    for (const t of tpls) {
      if (!whole.includes(t.need)) continue;
      const m = t.re.exec(whole); if (!m) continue;
      const got = {}; t.order.forEach((n, i) => { got[n] = tr(m[i + 1]); });
      const r = t.v.replace(/\{(\d+)\}/g, (_, n) => got[n] ?? ''), h = hangulN(r);
      if (!h) return r;
      if (h < bestN) { best = r; bestN = h; }
    }
    return best;
  }
  function tr(s) {
    if (typeof s !== 'string' || !HANGUL.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    const whole = s.trim();
    let done = DICT[whole] != null ? DICT[whole] : fromTpl(whole); // 문장 통째로 · 문장 틀로 먼저
    if (done != null && hangulN(done)) { const p = pieces(s); if (hangulN(p) < hangulN(done)) done = null; } // 틀이 한글을 더 남기면 조각 번역으로
    if (done != null) { const r = s.replace(whole, done); cache.set(s, r); cache.set(r, r); return r; }
    const r = pieces(s);
    if (cache.size > 20000) cache.clear();
    cache.set(s, r); cache.set(r, r);
    return r;
  }
  function pieces(s) {
    let out = '';
    const parts = split(s);
    for (let j = 0; j < parts.length; j++) {
      const [k, isKey] = parts[j]; if (!isKey) { out += k; continue; }
      let v = DICT[k];
      const nextCh = parts[j + 1]?.[0]?.[0] || '';
      if (v && /^[\w(「◆"]/.test(v) && word(out[out.length - 1])) v = ' ' + v; // 한국어는 붙여 쓰던 자리 → 영어는 한 칸
      if (v && /[\w)」.!?…]$/.test(v) && /[\w「(◆가-힣]/.test(nextCh)) v += ' ';
      out += v;
    }
    return out.replace(/ {2,}/g, ' '); // 바꾼 글자는 tr이 캐시에 넣어 다시 바꾸지 않는다 (페이지 감시가 제 변경을 또 보고 끝없이 돌던 것)
  }
  window.__tr = tr; window.__trCache = cache; // 디버그: 화면에 나간 글자 · 번역 쌍
  // 캔버스 글자
  const P = CanvasRenderingContext2D.prototype;
  for (const m of ['fillText', 'strokeText']) { const f = P[m]; P[m] = function (t, ...a) { return f.call(this, tr(String(t)), ...a); }; }
  const mt = P.measureText; P.measureText = function (t) { return mt.call(this, tr(String(t))); };
  // 알림 창
  for (const m of ['alert', 'confirm', 'prompt']) { const f = window[m]; window[m] = (t, ...a) => f.call(window, tr(String(t ?? '')), ...a); }
  // 페이지 글자 · 속성(제목 · 안내 글 · 버튼 이름)
  const ATTRS = ['title', 'placeholder', 'aria-label', 'data-tip', 'value'];
  function fixNode(n) {
    if (n.nodeType === 3) {
      const o = n.data; if (!HANGUL.test(o)) return;
      let v = tr(o); if (v === o) return;
      if (/^[\w(「◆]/.test(v) && !/^\s/.test(o) && n.previousSibling) v = ' ' + v; // <b>낱말</b>을 … → 영어는 굵은 낱말 옆을 띄운다
      if (/[\w)」.!?…]$/.test(v) && !/\s$/.test(o) && n.nextSibling) v += ' ';
      n.data = v; return;
    }
    if (n.nodeType !== 1) return;
    for (const a of ATTRS) { const v = n.getAttribute?.(a); if (v && HANGUL.test(v) && !(a === 'value' && n.tagName === 'INPUT' && n.type !== 'button' && n.type !== 'submit')) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
    if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'TEXTAREA') return;
    for (const c of n.childNodes) fixNode(c);
  }
  const start = () => {
    fixNode(document.documentElement);
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fixNode(m.target); else if (m.type === 'attributes') fixNode(m.target); else for (const n of m.addedNodes) fixNode(n); } })
      .observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.title = tr(document.title);
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();
