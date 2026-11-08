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
  function tr(s) {
    if (typeof s !== 'string' || !HANGUL.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    let out = '', i = 0;
    while (i < s.length) {
      let done = false;
      for (const k of byFirst.get(s[i]) || []) {
        if (!s.startsWith(k, i) || !HANGUL.test(k)) continue;
        if (k.length <= 2 && HANGUL.test(s[i - 1] || '')) continue; // 짧은 조각(조사 · 한 글자)은 낱말 한가운데에서 고르지 않는다
        let v = DICT[k];
        if (v && /^[\w(「◆"]/.test(v) && word(out[out.length - 1])) v = ' ' + v; // 한국어는 붙여 쓰던 자리 → 영어는 한 칸
        if (v && /[\w)」.!?…]$/.test(v) && /[\w「(◆]/.test(s[i + k.length] || '')) v += ' ';
        out += v; i += k.length; done = true; break;
      }
      if (!done) out += s[i++];
    }
    out = out.replace(/ {2,}/g, ' ');
    if (cache.size > 20000) cache.clear();
    cache.set(s, out); cache.set(out, out); // 바꾼 글자를 다시 바꾸지 않는다 (페이지 감시가 제 변경을 또 보고 끝없이 돌던 것)
    return out;
  }
  window.__tr = tr;
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
