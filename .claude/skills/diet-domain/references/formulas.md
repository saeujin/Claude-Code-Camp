# 계산 함수와 검증값

`src/domain/`에 **순수 함수**로 구현한다. React·Supabase에 의존하지 않는다. 모든 함수는 `src/domain/__tests__/`에서 아래 검증값으로 테스트한다.

반올림은 [SKILL.md의 반올림 규칙](../SKILL.md)을 따른다 — **BMR·TDEE·일일 조정량을 각각 반올림한 뒤** 기본 목표를 계산한다.

## 시그니처

```ts
calcBMR(sex, weightKg, heightCm, age): number
calcTDEE(bmr, activityLevel): number
calcGoalDays(startedOn, targetDate): number
calcDailyAdjustment(currentWeightKg, targetWeightKg, days): number
calcBaseTarget(tdee, dailyAdjustment, goal): number
calcWeeklyRate(weightDeltaKg, days): number
calcMacros(targetKcal, goal, weightKg, hasStrength): Macros
calcExerciseBurn(met, weightKg, minutes): number
calcTodayTarget(baseTarget, exerciseBurnTotal): number
calcRemaining(todayTarget, consumedKcal): number
calcProteinFloor(weightKg, hasStrength): number
distributeRemaining(remainingKcal, remainingMealCount): number
calcRecipeMatchRate(recipe, ownedNames): number
buildGoalPlan(profile): GoalPlan          // 위 함수들을 엮은 진입점
```

## 공식

**① BMR — Mifflin-St Jeor**
```
남성: 10 × 체중(kg) + 6.25 × 키(cm) − 5 × 나이 + 5
여성: 10 × 체중(kg) + 6.25 × 키(cm) − 5 × 나이 − 161
```

**② TDEE** = `round(BMR × 활동계수)` — BMR은 반올림 **전** 실수를 쓴다.
명세 예시가 `1698.75 × 1.2 = 2038.5 → 2039`이므로, 1699로 반올림한 뒤 곱하면 2039로 같지만 다른 입력에서 어긋날 수 있다. **원본 실수에 곱하고 그 결과만 반올림한다.**

**③ 일일 조정량**
```
체중 변화량   = |목표 체중 − 현재 체중|      (kg)
총 필요 에너지 = 체중 변화량 × 7,700
일일 조정량   = round(총 필요 에너지 ÷ 목표 기간(일))
```

**④ 기본 목표**
```
다이어트 : TDEE − 일일 조정량
증량     : TDEE + 일일 조정량
유지     : TDEE
```
**값을 제한하지 않는다.** BMR보다 낮게 나오거나 0 이하가 되어도 그대로 쓰고 사실만 알린다 (명세 130~133, 195행). 속도를 정하는 것은 사용자의 몫이다.

**⑤ 탄단지**
```
비율에서 계산:  carb = round(target × r.c ÷ 4)
               protein = round(target × r.p ÷ 4)
               fat = round(target × r.f ÷ 9)

단백질 하한 적용:
  floor = round(체중 × (근력운동 있으면 1.6 : 1.2))
  if (protein < floor):
      부족분 = floor − protein                 (g)
      protein = floor
      carb   -= round(부족분 × 4 ÷ 4)          // 부족분 kcal를 탄수에서 뺀다
```

**⑥ 운동 소모** = `round(MET × 체중(kg) × 분 ÷ 60)`. 체중은 **기록 시점** 값을 쓰고 `weightSnapshotKg`에 남긴다.

**⑦ 매칭률**
```
필요 재료 = recipe.ingredients.filter(i => !i.pantry)   // 조미료 제외
매칭률   = round(보유한 필요 재료 수 ÷ 필요 재료 수 × 100)
```

## 재계산 규칙

- 식사·운동 기록을 추가·수정·삭제하면 **누적 → 오늘 목표 → 잔여 → 단백질 하한** 순으로 전부 다시 계산한다
- 잔여가 음수가 되는 것은 정상 동작이다. 막지 않고 음수로 표시한다 (명세 225, 284행)
- **체중을 갱신하면** BMR·TDEE가 달라지고 남은 기간도 줄었으므로 `남은 체중 변화량 ÷ 남은 기간(일)`으로 일일 조정량을 다시 계산한다. 목표 체중·기간 자체는 사용자가 바꾸지 않는 한 유지한다 (명세 196행)
- **과거 운동 기록은 소급 재계산하지 않는다.** 체중 스냅샷으로 고정한다
- **목표 체중 = 현재 체중**이면 어느 목표를 골랐든 유지로 처리하고 일일 조정량은 0 (명세 194행)
- **목표 기간이 지나면**(남은 일수 ≤ 0) 달성 여부를 확인하고 새 목표 설정을 유도한다. 새 목표를 정하기 전까지 마지막 기본 목표를 그대로 쓴다 (명세 197행)

## 검증값 (테스트로 고정)

기준 인물: **남 / 30세 / 175cm / 75kg / 활동계수 1.2** (명세 146~180행, S1~S6)

| 함수 | 입력 | 기대값 |
|---|---|---|
| `calcBMR` | 위 기준 | **1699** (실수 1698.75) |
| `calcTDEE` | 1698.75, 1.2 | **2039** |
| `calcGoalDays` | 12주 | **84** |
| `calcDailyAdjustment` | 75→70kg, 84일 | **458** |
| `calcBaseTarget` | 2039, 458, lose | **1581** |
| `calcWeeklyRate` | 5kg, 84일 | **0.42** |
| `calcMacros` | 1581, lose, 75kg, 근력X | **carb 158 / protein 119 / fat 53** |
| `calcMacros` | 1581, lose, 75kg, 근력O | **carb 157 / protein 120 / fat 53** |
| `calcProteinFloor` | 75kg, 근력X / 근력O | **90** / **120** |
| `calcDailyAdjustment` | 75→78kg, 112일 | **206** |
| `calcBaseTarget` | 2039, 206, gain | **2245** |
| `calcWeeklyRate` | 3kg, 112일 | **0.19** |
| `calcExerciseBurn` | MET 8.3, 75kg, 30분 | **311** |
| `calcTodayTarget` | 1581, 311 | **1892** |
| `calcRemaining` | 1892, 420 | **1472** |
| `distributeRemaining` | 1472, 3끼 | **491** |
| `calcRemaining` | 1892, 1450 | **442** (S6 부족분) |
| `calcBaseTarget` | goal=maintain | TDEE 그대로, 조정량 0 |
| `buildGoalPlan` | 기준 인물 다이어트 | `belowBmr === true` (1581 < 1699) |
| `calcTodayTarget` | 1581, 311 | 1892 > BMR 1699 → 경고 해제 |

경계 케이스도 함께 고정한다.

| 케이스 | 기대 동작 |
|---|---|
| 목표 체중 = 현재 체중 | 조정량 0, 기본 목표 = TDEE |
| 목표 기간 1일, 5kg 감량 | 기본 목표가 음수여도 그대로 반환. 값을 올리지 않는다 |
| 남은 기간 0일 이하 | 재계산하지 않고 직전 기본 목표 유지 |
| 섭취 0, 운동 0 | 잔여 = 기본 목표 |
| 잔여 음수 | 그대로 음수 반환 |
| `distributeRemaining(x, 0)` | 0 반환 (0으로 나누지 않는다) |
| 필요 재료가 전부 조미료인 레시피 | 매칭률 100 |
