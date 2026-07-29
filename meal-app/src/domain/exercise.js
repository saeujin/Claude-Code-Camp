// F3 계산 로직 — 계획서 3장
//
// 이 파일은 DOM·localStorage를 일절 참조하지 않는다. 순수 함수만 둔다.
// 계산의 정확성이 앱 신뢰도의 전부이므로 UI 없이 테스트 가능해야 한다.

export const KCAL_PER_G = { carb: 4, protein: 4, fat: 9 };

/** 단백질 하한 계수. 근력운동을 기록한 날은 1.6으로 올라간다 (명세 F3 처리 ③). */
export const PROTEIN_FLOOR_FACTOR = { default: 1.2, strength: 1.6 };

/** 이 시간을 넘으면 입력 오류 가능성을 알린다 (계획서 7장). 저장은 막지 않는다. */
export const DURATION_WARN_MIN = 600;

/**
 * 소모 칼로리 = MET × 체중(kg) × 시간(h)
 * 중간 반올림 없이 결과만 한 번 반올림한다.
 * 입력이 불완전하면 0을 반환한다 — 폼 미리보기에서 그대로 쓰기 위함.
 */
export function calcExerciseCalories({ met, weightKg, durationMin }) {
  const m = Number(met);
  const w = Number(weightKg);
  const d = Number(durationMin);
  if (![m, w, d].every(Number.isFinite)) return 0;
  if (m <= 0 || w <= 0 || d <= 0) return 0;
  return Math.round(m * w * (d / 60));
}

/** 해당 날짜의 기록만 추린다. */
export function logsOn(logs, date) {
  return (logs ?? []).filter((l) => l.date === date);
}

/** 그날 소모 칼로리 합계. 각 값이 이미 정수이므로 추가 반올림 없음. */
export function sumExerciseCalories(logs, date) {
  return logsOn(logs, date).reduce((sum, l) => sum + (Number(l.calories) || 0), 0);
}

/** 근력 유형 기록이 하나라도 있으면 true. */
export function hasStrengthTraining(logs, date) {
  return logsOn(logs, date).some((l) => l.type === 'strength');
}

/** 오늘 목표 = 기본 목표 + 운동 소모 합계. 상한을 두지 않는다 (선행 결정 #8: 100% 반영). */
export function calcTodayTarget(baseTarget, exerciseTotal) {
  return (Number(baseTarget) || 0) + (Number(exerciseTotal) || 0);
}

/** 단백질 하한(g) = 체중 × 계수 */
export function calcProteinFloorG(weightKg, hasStrength) {
  const factor = hasStrength ? PROTEIN_FLOOR_FACTOR.strength : PROTEIN_FLOOR_FACTOR.default;
  return Math.round((Number(weightKg) || 0) * factor);
}

/**
 * 단백질이 하한에 못 미치면 하한값으로 올리고,
 * 늘어난 그램 × 4 kcal를 탄수화물에서 차감한다 (명세 F1 처리 ④).
 * 지방은 건드리지 않는다.
 */
export function applyProteinFloor(macros, floorG) {
  const carb = Number(macros?.carb) || 0;
  const protein = Number(macros?.protein) || 0;
  const fat = Number(macros?.fat) || 0;
  if (protein >= floorG) return { carb, protein, fat, adjusted: false, carbCutG: 0 };

  const addedG = floorG - protein;
  const carbCutG = Math.round((addedG * KCAL_PER_G.protein) / KCAL_PER_G.carb);
  return {
    carb: Math.max(0, carb - carbCutG),
    protein: floorG,
    fat,
    adjusted: true,
    carbCutG,
  };
}

/** 하루 소모 합계가 기본 목표를 넘으면 입력 오류 가능성을 확인시킨다 (명세 F3 예외). */
export function isDailyTotalSuspicious(exerciseTotal, baseTarget) {
  return Number(baseTarget) > 0 && Number(exerciseTotal) > Number(baseTarget);
}

/**
 * 화면이 쓰는 파생 상태 한 묶음 (계획서 2.3).
 * 저장하지 않고 매번 계산한다.
 */
export function buildDailyExerciseState({ logs, date, baseTarget, weightKg, targetMacros }) {
  const exerciseTotal = sumExerciseCalories(logs, date);
  const hasStrength = hasStrengthTraining(logs, date);
  const proteinFloorG = calcProteinFloorG(weightKg, hasStrength);
  return {
    date,
    logs: logsOn(logs, date),
    exerciseTotal,
    hasStrength,
    baseTarget: Number(baseTarget) || 0,
    todayTarget: calcTodayTarget(baseTarget, exerciseTotal),
    proteinFloorG,
    macros: applyProteinFloor(targetMacros ?? {}, proteinFloorG),
    suspicious: isDailyTotalSuspicious(exerciseTotal, baseTarget),
  };
}

/**
 * 기록 1건을 만든다. weightSnapshot을 반드시 남긴다 —
 * 나중에 체중을 갱신해도 과거 기록의 소모 칼로리가 바뀌면 안 된다 (계획서 2.2).
 */
export function buildExerciseLog({
  id,
  date,
  time,
  source,
  catalogItem = null,
  durationMin = null,
  name = null,
  calories = null,
  type = null,
  weightKg,
  createdAt = Date.now(),
}) {
  if (source === 'catalog') {
    if (!catalogItem) throw new Error('catalogItem이 필요합니다');
    return {
      id,
      date,
      time,
      source: 'catalog',
      catalogId: catalogItem.id,
      name: catalogItem.name,
      durationMin: Number(durationMin),
      calories: calcExerciseCalories({ met: catalogItem.met, weightKg, durationMin }),
      type: catalogItem.type,
      weightSnapshot: Number(weightKg) || 0,
      createdAt,
    };
  }
  return {
    id,
    date,
    time,
    source: 'manual',
    catalogId: null,
    name: String(name ?? '').trim(),
    durationMin: durationMin === null || durationMin === '' ? null : Number(durationMin),
    calories: Math.round(Number(calories) || 0),
    type,
    weightSnapshot: Number(weightKg) || 0,
    createdAt,
  };
}
