// F3 단위 테스트 — 계획서 3.2 · 3.3의 검증 케이스
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG, CATALOG_BY_ID, searchCatalog } from '../data/exercises.js';
import {
  applyProteinFloor,
  buildDailyExerciseState,
  buildExerciseLog,
  calcExerciseCalories,
  calcProteinFloorG,
  calcTodayTarget,
  hasStrengthTraining,
  isDailyTotalSuspicious,
  sumExerciseCalories,
} from '../src/domain/exercise.js';

const WEIGHT = 75;
const BASE_TARGET = 1581;
const MACROS = { carb: 158, protein: 119, fat: 53 };
const TODAY = '2026-07-29';

/* ── 검증 케이스 A: 명세 S3 재현 ───────────────────────────── */

test('조깅 30분 · 75kg → 311 kcal', () => {
  const jog = CATALOG_BY_ID.get('jog_8');
  assert.equal(jog.met, 8.3);
  assert.equal(calcExerciseCalories({ met: jog.met, weightKg: WEIGHT, durationMin: 30 }), 311);
});

test('오늘 목표 = 기본 목표 1,581 + 운동 311 = 1,892', () => {
  assert.equal(calcTodayTarget(BASE_TARGET, 311), 1892);
});

test('중간 반올림을 하지 않는다', () => {
  // 8.3 × 75 × 0.5 = 311.25 → 311. 시간을 먼저 반올림하면(0.5→1) 623이 된다.
  assert.equal(calcExerciseCalories({ met: 8.3, weightKg: 75, durationMin: 30 }), 311);
});

/* ── 검증 케이스 B: 근력운동 시 단백질 하한 상향 ───────────── */

test('웨이트(보통) 40분 · 75kg → 175 kcal', () => {
  const w = CATALOG_BY_ID.get('weight_mod');
  assert.equal(w.type, 'strength');
  assert.equal(calcExerciseCalories({ met: w.met, weightKg: WEIGHT, durationMin: 40 }), 175);
});

test('단백질 하한: 근력 없으면 1.2배, 있으면 1.6배', () => {
  assert.equal(calcProteinFloorG(WEIGHT, false), 90);
  assert.equal(calcProteinFloorG(WEIGHT, true), 120);
});

test('하한 미달이면 단백질을 올리고 늘어난 만큼 탄수를 뺀다', () => {
  const result = applyProteinFloor(MACROS, 120);
  assert.deepEqual(
    { carb: result.carb, protein: result.protein, fat: result.fat },
    { carb: 157, protein: 120, fat: 53 },
  );
  assert.equal(result.adjusted, true);
  assert.equal(result.carbCutG, 1);
});

test('하한을 이미 넘으면 탄단지를 건드리지 않는다', () => {
  const result = applyProteinFloor(MACROS, 90);
  assert.deepEqual(
    { carb: result.carb, protein: result.protein, fat: result.fat },
    MACROS,
  );
  assert.equal(result.adjusted, false);
});

/* ── 파생 상태 통합 ────────────────────────────────────────── */

function log(over = {}) {
  return {
    id: over.id ?? 'l1',
    date: over.date ?? TODAY,
    time: over.time ?? '07:30',
    source: 'catalog',
    catalogId: over.catalogId ?? 'jog_8',
    name: over.name ?? '조깅 (8km/h)',
    durationMin: over.durationMin ?? 30,
    calories: over.calories ?? 311,
    type: over.type ?? 'cardio',
    weightSnapshot: over.weightSnapshot ?? WEIGHT,
    createdAt: 0,
  };
}

test('유산소만 있는 날: 목표 1,892 / 단백질 그대로 119g', () => {
  const state = buildDailyExerciseState({
    logs: [log()],
    date: TODAY,
    baseTarget: BASE_TARGET,
    weightKg: WEIGHT,
    targetMacros: MACROS,
  });
  assert.equal(state.exerciseTotal, 311);
  assert.equal(state.todayTarget, 1892);
  assert.equal(state.hasStrength, false);
  assert.equal(state.proteinFloorG, 90);
  assert.equal(state.macros.protein, 119);
  assert.equal(state.macros.carb, 158);
});

test('근력이 섞인 날: 합계 486 / 단백질 120g · 탄수 157g', () => {
  const state = buildDailyExerciseState({
    logs: [
      log(),
      log({ id: 'l2', time: '19:00', catalogId: 'weight_mod', name: '웨이트 (보통 강도)', durationMin: 40, calories: 175, type: 'strength' }),
    ],
    date: TODAY,
    baseTarget: BASE_TARGET,
    weightKg: WEIGHT,
    targetMacros: MACROS,
  });
  assert.equal(state.exerciseTotal, 486);
  assert.equal(state.todayTarget, 2067);
  assert.equal(state.hasStrength, true);
  assert.equal(state.macros.protein, 120);
  assert.equal(state.macros.carb, 157);
});

test('근력 기록을 지우면 단백질 목표가 119g으로 되돌아온다', () => {
  const logs = [log(), log({ id: 'l2', type: 'strength', calories: 175 })];
  const after = buildDailyExerciseState({
    logs: logs.filter((l) => l.id !== 'l2'),
    date: TODAY,
    baseTarget: BASE_TARGET,
    weightKg: WEIGHT,
    targetMacros: MACROS,
  });
  assert.equal(after.hasStrength, false);
  assert.equal(after.macros.protein, 119);
  assert.equal(after.macros.carb, 158);
});

test('다른 날짜 기록은 오늘 합계에 섞이지 않는다', () => {
  const logs = [log(), log({ id: 'l2', date: '2026-07-28', calories: 999 })];
  assert.equal(sumExerciseCalories(logs, TODAY), 311);
  assert.equal(hasStrengthTraining(logs, TODAY), false);
});

test('하루 소모 합계가 기본 목표를 넘으면 확인 대상이다', () => {
  assert.equal(isDailyTotalSuspicious(1580, BASE_TARGET), false);
  assert.equal(isDailyTotalSuspicious(1582, BASE_TARGET), true);
});

/* ── weightSnapshot: 체중을 바꿔도 과거 기록이 변하지 않는다 ── */

test('체중을 76kg으로 갱신해도 어제 기록한 조깅은 311 kcal다', () => {
  const yesterday = buildExerciseLog({
    id: 'y1',
    date: '2026-07-28',
    time: '07:30',
    source: 'catalog',
    catalogItem: CATALOG_BY_ID.get('jog_8'),
    durationMin: 30,
    weightKg: 75,
  });
  assert.equal(yesterday.calories, 311);
  assert.equal(yesterday.weightSnapshot, 75);

  // 체중 갱신 후 새로 기록한 같은 운동은 다른 값이 나온다.
  const today = buildExerciseLog({
    id: 't1',
    date: TODAY,
    time: '07:30',
    source: 'catalog',
    catalogItem: CATALOG_BY_ID.get('jog_8'),
    durationMin: 30,
    weightKg: 76,
  });
  assert.equal(today.calories, 315);
  // 과거 기록은 그대로다.
  assert.equal(yesterday.calories, 311);
});

/* ── 직접 입력 경로 ────────────────────────────────────────── */

test('직접 입력은 소모 칼로리를 그대로 쓰고 유형을 보존한다', () => {
  const manual = buildExerciseLog({
    id: 'm1',
    date: TODAY,
    time: '20:00',
    source: 'manual',
    name: '크로스핏 WOD',
    calories: 250.6,
    type: 'strength',
    weightKg: WEIGHT,
  });
  assert.equal(manual.calories, 251);
  assert.equal(manual.catalogId, null);
  assert.equal(manual.durationMin, null);
  assert.equal(manual.type, 'strength');
});

/* ── 입력 방어 ─────────────────────────────────────────────── */

test('불완전한 입력은 0을 반환한다 (폼 미리보기용)', () => {
  assert.equal(calcExerciseCalories({ met: 8.3, weightKg: 75, durationMin: 0 }), 0);
  assert.equal(calcExerciseCalories({ met: 8.3, weightKg: 75, durationMin: NaN }), 0);
  assert.equal(calcExerciseCalories({ met: 8.3, weightKg: 0, durationMin: 30 }), 0);
});

/* ── 카탈로그 ──────────────────────────────────────────────── */

test('필수 12종의 MET 값이 명세와 일치한다', () => {
  const spec = {
    walk_48: 3.5, walk_64: 5.0, jog_8: 8.3, run_97: 9.8,
    cycle_flat: 7.5, swim_free: 5.8, hiking: 6.0, jumprope: 11.8,
    yoga: 2.5, weight_mod: 3.5, weight_high: 6.0, bodyweight: 3.8,
  };
  for (const [id, met] of Object.entries(spec)) {
    assert.equal(CATALOG_BY_ID.get(id)?.met, met, `${id}의 MET`);
  }
  assert.equal(CATALOG.filter((e) => e.verified).length, 12);
  assert.equal(CATALOG.length, 24);
});

test('검색은 이름과 별칭 모두에 걸린다', () => {
  assert.ok(searchCatalog('조깅').some((e) => e.id === 'jog_8'));
  assert.ok(searchCatalog('러닝').some((e) => e.id === 'jog_8'));
  assert.ok(searchCatalog('홈트').some((e) => e.id === 'bodyweight'));
  assert.equal(searchCatalog('없는운동').length, 0);
});
