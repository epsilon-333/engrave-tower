// 로그인 + 서버 저장
// 1) claude.ai 공유 페이지: 보는 사람의 Claude 계정 (user / db 기능)
// 2) 일반 웹(Render 등): 아이디·비밀번호 계정 (Supabase DB 함수)
// 어느 쪽도 안 되면 브라우저 저장만 사용
const SUPABASE_URL = 'https://mfsnnsargtvxedmawpkp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tL_9GLvGGo0ndLQYBULpjQ_UAt-uPz7'; // 공개용 키 (DB 함수 호출만 가능)
const TOKEN_KEY = 'et-token';

const listeners = new Set();
export const cloud = { mode: 'local', state: 'local', name: '', avatar: '', id: null };
// state: local | ready | saving | saved | error | readonly
let ref = null, token = null, pending = null, writing = false, timer = null;

function emit() { for (const f of listeners) f(cloud); }
export function onCloud(f) { listeners.add(f); f(cloud); return () => listeners.delete(f); }
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 무시 */ } } };

async function rpc(fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(body?.message || 'network'); e.code = body?.message || 'network'; throw e; }
  return body;
}

export const isClaudePage = () => !!window.claude?.use;

// 시작 시 호출: 로그인된 상태면 서버 저장을 돌려준다 (없으면 null)
export async function initCloud() {
  if (isClaudePage()) {
    try {
      const use = window.claude.use;
      const [user, d] = (await within(Promise.all([use('user'), use('db')]), 6000)) || [];
      if (!user || !d) return null;
      const me = await user.me();
      if (!me.id) return null;
      cloud.mode = 'claude'; cloud.name = me.name; cloud.avatar = me.avatarUrl; cloud.id = me.id;
      ref = d.doc(`data/users/${me.id}/save`);
      const snap = await ref.get();
      cloud.state = 'ready'; emit();
      return snap.exists ? snap.data().save || null : null;
    } catch { return null; }
  }
  token = ls.get(TOKEN_KEY);
  if (!token) return null;
  try {
    const r = await within(rpc('game_session', { p_token: token }), 8000);
    if (!r) return null;
    loggedIn(r.username);
    return r.save || null;
  } catch (e) {
    if (e.code === 'invalid_session') { token = null; ls.set(TOKEN_KEY, null); }
    return null;
  }
}

function loggedIn(username) {
  cloud.mode = 'account'; cloud.name = username; cloud.id = username; cloud.avatar = ''; cloud.state = 'ready'; emit();
}

const ERR = {
  invalid_login: '아이디 또는 비밀번호가 맞지 않습니다.',
  username_taken: '이미 있는 아이디입니다.',
  bad_username: '아이디는 2~16자의 한글·영문·숫자·_ 만 쓸 수 있습니다.',
  password_too_short: '비밀번호는 4자 이상이어야 합니다.',
  network: '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.',
};
export const errorText = (e) => ERR[e?.code] || ERR.network;

// 로그인 / 회원가입: 성공하면 서버에 있던 저장(없으면 null)을 돌려준다
export async function login(username, password) {
  const r = await rpc('game_login', { p_username: username.trim(), p_password: password });
  token = r.token; ls.set(TOKEN_KEY, token); loggedIn(r.username);
  return r.save || null;
}
export async function register(username, password) {
  const r = await rpc('game_register', { p_username: username.trim(), p_password: password });
  token = r.token; ls.set(TOKEN_KEY, token); loggedIn(r.username);
  return null;
}
export async function logout() {
  if (token) rpc('game_logout', { p_token: token }).catch(() => {});
  token = null; ls.set(TOKEN_KEY, null);
  cloud.mode = 'local'; cloud.state = 'local'; cloud.name = ''; cloud.id = null; emit();
}

// 저장 요청이 몰리면 마지막 상태만 1.5초 뒤 한 번에 쓴다
export function cloudSave(save) {
  if (cloud.mode === 'local' || cloud.state === 'readonly') return;
  pending = JSON.parse(JSON.stringify(save));
  cloud.state = 'saving'; emit();
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
// 즉시 저장 (사냥 결과처럼 중요한 순간)
export function cloudSaveNow(save) { cloudSave(save); clearTimeout(timer); flush(); }

async function flush() {
  if (writing || !pending) return;
  writing = true;
  const body = pending; pending = null;
  try {
    if (cloud.mode === 'claude') await ref.set({ save: body, updatedAt: Date.now() });
    else await rpc('game_store', { p_token: token, p_save: body });
    cloud.state = pending ? 'saving' : 'saved';
  } catch (e) {
    if (cloud.mode === 'claude' && (e?.code === 'invalid_argument' || e?.code === 'not_granted')) cloud.state = 'readonly';
    else if (e?.code === 'invalid_session') { await logout(); }
    else { cloud.state = 'error'; pending ||= body; setTimeout(flush, 4000 + Math.random() * 2000); }
  }
  writing = false; emit();
  if (pending) flush();
}

export async function cloudDelete() {
  if (cloud.mode === 'claude' && ref) { try { await ref.delete(); } catch { /* 무시 */ } }
  else if (cloud.mode === 'account' && token) { try { await rpc('game_store', { p_token: token, p_save: null }); } catch { /* 무시 */ } }
}

export function cloudLabel() {
  switch (cloud.state) {
    case 'saving': return '저장 중…';
    case 'saved': return '서버에 저장됨';
    case 'ready': return '로그인됨';
    case 'error': return '저장 실패 · 다시 시도 중';
    case 'readonly': return '보기 권한이라 이 브라우저에만 저장';
    default: return '게스트 · 이 브라우저에만 저장';
  }
}
