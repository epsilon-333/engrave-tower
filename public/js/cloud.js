// 계정 로그인 + 서버 저장 (claude.ai 공유 페이지의 user / db 기능)
// 로그인한 사람마다 data/users/<id>/save 에 비공개로 저장. 쓸 수 없으면 브라우저 저장만 사용.
const listeners = new Set();
export const cloud = { state: 'local', name: '', avatar: '', id: null, lastSaved: 0 };
// state: local(로그인 안 됨·로컬) | ready | saving | saved | error | readonly
let db = null, ref = null, pending = null, writing = false;

function emit() { for (const f of listeners) f(cloud); }
export function onCloud(f) { listeners.add(f); f(cloud); return () => listeners.delete(f); }

const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

export async function initCloud() {
  const use = window.claude?.use;
  if (!use) return null;
  try {
    const [user, d] = await within(Promise.all([use('user'), use('db')]), 6000) || [];
    if (!user || !d) return null;
    const me = await user.me();
    cloud.name = me.name; cloud.avatar = me.avatarUrl; cloud.id = me.id;
    if (!me.id) return null;
    db = d;
    ref = db.doc(`data/users/${me.id}/save`);
    const snap = await ref.get();
    cloud.state = 'ready'; emit();
    return snap.exists ? snap.data().save || null : null;
  } catch {
    cloud.state = 'local'; emit();
    return null;
  }
}

// 저장 요청이 몰리면 마지막 상태만 1.5초 뒤 한 번에 쓴다
let timer = null;
export function cloudSave(save) {
  if (!ref || cloud.state === 'readonly') return;
  pending = JSON.parse(JSON.stringify(save));
  cloud.state = 'saving'; emit();
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

async function flush() {
  if (writing || !pending) return;
  writing = true;
  const body = pending; pending = null;
  try {
    await ref.set({ save: body, updatedAt: Date.now() });
    cloud.state = pending ? 'saving' : 'saved'; cloud.lastSaved = Date.now();
  } catch (e) {
    cloud.state = e?.code === 'invalid_argument' || e?.code === 'not_granted' ? 'readonly' : 'error';
    if (cloud.state === 'error') { pending ||= body; setTimeout(flush, 4000 + Math.random() * 2000); }
  }
  writing = false; emit();
  if (pending) flush();
}

export async function cloudDelete() {
  if (!ref) return;
  try { await ref.delete(); } catch { /* 무시 */ }
}

export function cloudLabel() {
  switch (cloud.state) {
    case 'saving': return '저장 중…';
    case 'saved': return '서버에 저장됨';
    case 'ready': return '로그인됨';
    case 'error': return '저장 실패 · 다시 시도 중';
    case 'readonly': return '보기 권한이라 이 브라우저에만 저장';
    default: return '로그인 안 됨 · 이 브라우저에만 저장';
  }
}
