// 저장 계층 — F3·F6 공유
// 선행 결정 #6: 비로그인 · 브라우저 로컬 저장(localStorage)
// localStorage가 없는 환경(Node 테스트 등)에서는 메모리로 대체한다.

const STORAGE_KEY = 'mealapp.v1';
const STUB_PREFIX = 'mealapp.stub.';

const memory = new Map();

function backend() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      // Safari 프라이빗 모드는 접근 시점에 던지므로 실제로 한 번 써본다.
      localStorage.setItem(STUB_PREFIX + 'probe', '1');
      localStorage.removeItem(STUB_PREFIX + 'probe');
      return localStorage;
    }
  } catch {
    /* fall through */
  }
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
  };
}

function readAll() {
  try {
    return JSON.parse(backend().getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeAll(state) {
  backend().setItem(STORAGE_KEY, JSON.stringify(state));
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.abs(Date.now() ^ (performance?.now?.() ?? 0)).toString(36);
}

/* ── F3: 운동 기록 ─────────────────────────────────────────── */

export function getExerciseLogs() {
  return readAll().exerciseLogs ?? [];
}

/** id가 이미 있으면 교체(수정), 없으면 추가. 시각 오름차순으로 정렬해 보관한다. */
export function putExerciseLog(log) {
  const state = readAll();
  const logs = state.exerciseLogs ?? [];
  const idx = logs.findIndex((l) => l.id === log.id);
  if (idx >= 0) logs[idx] = log;
  else logs.push(log);
  logs.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  state.exerciseLogs = logs;
  writeAll(state);
  return log;
}

/** 삭제한 로그를 반환한다 — 되돌리기 스낵바에서 그대로 putExerciseLog 하면 복구된다. */
export function deleteExerciseLog(id) {
  const state = readAll();
  const logs = state.exerciseLogs ?? [];
  const idx = logs.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const [removed] = logs.splice(idx, 1);
  state.exerciseLogs = logs;
  writeAll(state);
  return removed;
}

/* ── 스텁 값 덮어쓰기 (개발·수동 테스트용) ──────────────────── */
// 예) localStorage.setItem('mealapp.stub.intakeTotal', '2000')
//     localStorage.setItem('mealapp.stub.noProfile', '1')
export function getStubOverride(name) {
  return backend().getItem(STUB_PREFIX + name);
}
