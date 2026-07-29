# 식단앱 — F3 · F6 구현

계획서 두 편의 구현체입니다.

- [F3 운동 기록 및 소모 칼로리 반영](../F3-운동기록-구체화-계획서.md)
- [F6 재료 기반 레시피 추천](../F6-레시피추천-구체화-계획서.md)

프레임워크 없이 바닐라 JS + ES 모듈 + localStorage로 만들었습니다 (계획서 8장의 가정).

## 실행

ES 모듈은 `file://`에서 CORS로 막히므로 정적 서버가 필요합니다.

```bash
cd meal-app
npm run serve          # → http://localhost:8000
# 또는
python -m http.server 8000
```

- 운동 기록 (F3): http://localhost:8000/exercise.html
- 레시피 추천 (F6): http://localhost:8000/recipes.html

## 테스트

```bash
npm test          # 35개 (F3 20 + F6 15)
npm run test:f3
npm run test:f6
```

계획서의 검증 케이스가 그대로 테스트로 들어가 있습니다 — 조깅 30분 → 311 kcal, 근력 기록 시 단백질 119 → 120 g · 탄수 158 → 157 g, 두부 계란찜 100% 1위, 닭가슴살 볶음 부족 재료 파프리카.

## 구조

```
data/
  exercises.js      F3 MET 카탈로그 24종 (필수 12 검증됨 + 확장 12 verified:false)
  recipes.js        F6 레시피 시드 15종
  synonyms.js       F6 재료명 동의어 사전
  staples.js        F6 기본 양념 화이트리스트

src/
  domain/
    exercise.js     F3 순수 계산 — DOM·localStorage 참조 없음
    recipe.js       F6 매칭·정렬 — DOM·localStorage 참조 없음
  state/
    store.js        localStorage 저장 계층 (F3·F6 공유)
    selectors.js    인터페이스 계약 + F1·F2·F4 스텁 (F3·F6 공유)
  pages/
    exercise.js     F3 화면
    recipes.js      F6 화면

exercise.html  recipes.html  styles.css
test/exercise.test.js  test/recipe.test.js
```

`domain/`은 브라우저 API를 참조하지 않으므로 Node에서 그대로 테스트됩니다.

## 미구현 기능 스텁

F1·F2·F4가 없어도 두 화면이 동작하도록 `src/state/selectors.js`에 스텁을 두었습니다. 기본값은 명세 S1~S6의 인물(민수) 기준입니다.

| 값 | 기본값 |
|---|---|
| 프로필 | 남 30세 175cm 75kg 사무직 다이어트 |
| 기본 목표 칼로리 (F1) | 1,581 kcal |
| 목표 탄단지 (F1) | 탄 158 · 단 119 · 지 53 g |
| 누적 섭취 (F2) | 1,450 kcal |
| 보유 재료 (F4) | 양파 · 계란 · 두부(임박) · 대파 · 닭가슴살 |

브라우저 콘솔에서 스텁을 바꿔 예외 화면을 확인할 수 있습니다.

```js
// F1 미완료 → 「운동 선택」 탭 비활성, 잔여 칼로리 토글 비활성
localStorage.setItem('mealapp.stub.noProfile', '1');

// 목표를 넘긴 상태 → 잔여 칼로리 음수 표시, F6 "가벼운 요리부터"
localStorage.setItem('mealapp.stub.intakeTotal', '2200');

// 냉장고 비우기 → F6 빈 상태
localStorage.setItem('mealapp.stub.ingredients', '[]');

// 원복
['noProfile','intakeTotal','ingredients','baseTarget']
  .forEach(k => localStorage.removeItem('mealapp.stub.' + k));
```

F3 기록은 `mealapp.v1` 키에 저장됩니다. 초기화: `localStorage.removeItem('mealapp.v1')`

## 구현하면서 정한 것 · 명세와 다른 점

1. **데이터 파일을 `.json`이 아니라 `.js`로 두었습니다.** JSON 모듈 import는 브라우저·Node 양쪽에서 import attributes(`with { type: 'json' }`)를 요구해 지원 범위가 좁습니다. `export const`로 두면 `fetch`도 빌드도 필요 없습니다. 구조는 계획서와 동일합니다.

2. **줄넘기·맨몸운동의 30분 기준 예시값이 명세와 1 kcal 다릅니다.** 명세 표는 줄넘기 442, 맨몸운동 142로 적었는데 계산값은 442.5, 142.5입니다. 명세 표 안에서도 .5의 처리가 엇갈립니다(빠르게 걷기 187.5 → 188, 수영 217.5 → 218은 올림). 구현은 `Math.round`로 일관되게 처리해 각각 **443 / 143**이 됩니다. MET 값 자체는 명세 그대로이며, 검증 대상인 조깅(311)은 영향이 없습니다.

3. **`MIN_MATCHED = 1`을 추가했습니다** (`src/domain/recipe.js`). 명세의 "부족 1~2개까지 노출" 규칙만 적용하면 필수 재료가 2개인데 하나도 안 가진 레시피(매칭률 0%)가 목록에 올라옵니다. 최소 1개는 겹쳐야 후보로 올립니다.

4. **점수 가중치는 이 구현에서 정한 값입니다** (`SCORE` 상수). 명세는 "가산점", "후순위"라고만 적었습니다. 임박 +10/최대 +20, 칼로리 초과 −30, 허용 오차 ×1.15, 잔여 음수 시 대체 기준 300 kcal — 레시피를 30종까지 늘린 뒤 순위를 보고 조정할 대상입니다.

5. **`getIntakeTotal` 스텁을 1,450으로 통일했습니다.** F3 계획서는 0, F6 계획서는 1,450으로 적어 서로 달랐습니다. 두 화면이 같은 S6 이야기를 하도록 1,450을 골랐습니다 (잔여 = 1,892 − 1,450 = 442 kcal).

6. **레시피는 15종입니다.** 계획서 목표는 30종이고 최소 기준은 10종입니다. 매칭률 분포를 넓히려면 필수 재료가 3~5개인 레시피를 15종 더 채워야 합니다.

## 미탑재 (선행 결정에 따름)

- F3 입력 경로 ③ 웨어러블 연동 — 설정에 비활성 항목으로만 표시 (결정 #4)
- 자동 수집 기록과 수동 기록의 중복 방지 — 경로 ③과 함께 Phase 2 (겹칠 대상이 없음)
- 운동 소모 반영 비율 토글 — 100% 반영 고정 (결정 #8)
- F4 사진 재료 인식 — 수동 입력 전제 (결정 #1)
