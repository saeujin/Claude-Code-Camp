// 인터페이스 계약 — F3 문서 4장 / F6 문서 4장
//
// F1·F2·F4는 아직 구현되지 않았다. 여기서 셀렉터 시그니처를 먼저 고정하고
// 미구현 기능은 스텁으로 채운다. 각 기능이 구현되면 이 파일의 함수 본문만
// 바꾸면 되고, F3·F6 코드는 손대지 않는다.

import { getExerciseLogs, getStubOverride } from './store.js';
import { buildDailyExerciseState, calcProteinFloorG, hasStrengthTraining, sumExerciseCalories } from '../domain/exercise.js';

/* ── 스텁 상수 — 명세 S1~S6의 인물(민수) 기준 ─────────────── */

const STUB_PROFILE = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityFactor: 1.2,
  goal: 'diet', // 'diet' | 'maintain' | 'bulk'
};

const STUB_BASE_TARGET = 1581; // F1 계산 예시 ㉮
const STUB_TARGET_MACROS = { carb: 158, protein: 119, fat: 53 };

// F3 문서는 0, F6 문서는 1450으로 적었다. 두 페이지가 같은 이야기(S6)를 하도록
// 1450으로 통일했다. 잔여 칼로리 = 1892 − 1450 = 442 kcal.
const STUB_INTAKE_TOTAL = 1450;

// F4 시드 — 명세 S5에서 등록한 5종. 두부만 유통기한 임박(오늘 +3일).
const STUB_INGREDIENTS = [
  { id: 'ing-onion', name: '양파', qty: 2, unit: '개', purchasedAt: null, expiresAt: null },
  { id: 'ing-egg', name: '계란', qty: 10, unit: '개', purchasedAt: null, expiresAt: null },
  { id: 'ing-tofu', name: '두부', qty: 1, unit: '모', purchasedAt: null, expiresAt: plusDaysISO(3) },
  { id: 'ing-greenonion', name: '대파', qty: 1, unit: '대', purchasedAt: null, expiresAt: null },
  { id: 'ing-chicken', name: '닭가슴살', qty: 2, unit: '쪽', purchasedAt: null, expiresAt: null },
];

/* ── F1 ────────────────────────────────────────────────────── */

/** 프로필 미완료 상태를 재현하려면 localStorage에 mealapp.stub.noProfile=1 */
export function getProfile() {
  if (getStubOverride('noProfile') === '1') return null;
  return { ...STUB_PROFILE };
}

export function getBaseTargetCalories() {
  return numberOverride('baseTarget') ?? STUB_BASE_TARGET;
}

export function getTargetMacros() {
  return { ...STUB_TARGET_MACROS };
}

/* ── F2 ────────────────────────────────────────────────────── */

export function getIntakeTotal(_date) {
  return numberOverride('intakeTotal') ?? STUB_INTAKE_TOTAL;
}

/**
 * 숫자 스텁 덮어쓰기를 읽는다. 값이 없으면 null.
 * Number(null)이 0이므로 원본 문자열을 먼저 확인해야 한다 —
 * 그냥 Number()로 감싸면 덮어쓰기가 없을 때 항상 0이 된다.
 */
function numberOverride(name) {
  const raw = getStubOverride(name);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/* ── F4 ────────────────────────────────────────────────────── */

export function getIngredients() {
  const override = getStubOverride('ingredients');
  if (override) {
    try {
      return JSON.parse(override);
    } catch {
      /* 무시하고 시드 반환 */
    }
  }
  return STUB_INGREDIENTS.map((i) => ({ ...i }));
}

/* ── F3이 제공하는 것 (F3 문서 4.2 — 시그니처 고정) ────────── */

export function getTodayTarget(date = todayISO()) {
  return getBaseTargetCalories() + sumExerciseCalories(getExerciseLogs(), date);
}

export function getExerciseSummary(date = todayISO()) {
  const logs = getExerciseLogs().filter((l) => l.date === date);
  return {
    total: sumExerciseCalories(logs, date),
    hasStrength: hasStrengthTraining(logs, date),
    logs,
  };
}

export function getProteinFloorG(date = todayISO()) {
  const profile = getProfile();
  const weightKg = profile?.weightKg ?? 0;
  return calcProteinFloorG(weightKg, hasStrengthTraining(getExerciseLogs(), date));
}

/** F3 페이지가 한 번에 쓰는 묶음. 위 세 셀렉터와 같은 값을 계산한다. */
export function getDailyState(date = todayISO()) {
  const profile = getProfile();
  return buildDailyExerciseState({
    logs: getExerciseLogs(),
    date,
    baseTarget: getBaseTargetCalories(),
    weightKg: profile?.weightKg ?? 0,
    targetMacros: getTargetMacros(),
  });
}

/* ── F6이 쓰는 파생값 ──────────────────────────────────────── */

/** 잔여 칼로리 = 오늘 목표(F3) − 누적 섭취(F2). 음수 허용. */
export function getRemainingCalories(date = todayISO()) {
  return getTodayTarget(date) - getIntakeTotal(date);
}

/* ── 날짜 유틸 ─────────────────────────────────────────────── */

export function todayISO() {
  return toISO(new Date());
}

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function plusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
