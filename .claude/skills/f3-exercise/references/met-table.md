# MET 표 (미결정 #3 확정 — 직접 구축 34종)

`src/data/met.json`의 원본. 명세 253~265행의 12종을 **값 그대로** 포함하고 22종을 확장했다.

`kind`는 단백질 하한 상향(체중 × 1.2g → 1.6g)의 판정 입력이다. **근력 요소가 포함된 종목은 `strength`로 분류한다** — 크로스핏·서킷·케틀벨이 그렇다. 요가·필라테스는 명세가 요가를 유산소로 다루는 것에 맞춰 `cardio`로 둔다.

`kcal` 열은 참고용 표시값이다(75kg · 30분 = `MET × 37.5`). 저장하지 않는다.

| id | 운동 | MET | kind | 75kg·30분 |
|---|---|---|---|---|
| `walk` | 걷기 (평지 4.8km/h) | 3.5 | cardio | 131 |
| `walk-fast` | 빠르게 걷기 (6.4km/h) | 5.0 | cardio | 188 |
| `jog` | 조깅 (8km/h) | 8.3 | cardio | 311 |
| `run` | 달리기 (9.7km/h) | 9.8 | cardio | 368 |
| `run-fast` | 달리기 (12km/h) | 11.5 | cardio | 431 |
| `cycling` | 자전거 (평지) | 7.5 | cardio | 281 |
| `spin-bike` | 실내 사이클 (보통) | 7.0 | cardio | 263 |
| `spinning` | 스피닝 (고강도) | 8.5 | cardio | 319 |
| `swim-free` | 수영 (자유형) | 5.8 | cardio | 218 |
| `swim-breast` | 수영 (평영) | 5.3 | cardio | 199 |
| `hiking` | 등산 | 6.0 | cardio | 225 |
| `stairs` | 계단 오르기 | 8.8 | cardio | 330 |
| `jump-rope` | 줄넘기 | 11.8 | cardio | 443 |
| `rowing` | 로잉머신 | 7.0 | cardio | 263 |
| `elliptical` | 일립티컬 | 5.0 | cardio | 188 |
| `yoga` | 요가 | 2.5 | cardio | 94 |
| `pilates` | 필라테스 | 3.0 | cardio | 113 |
| `stretching` | 스트레칭 | 2.3 | cardio | 86 |
| `badminton` | 배드민턴 | 5.5 | cardio | 206 |
| `table-tennis` | 탁구 | 4.0 | cardio | 150 |
| `tennis` | 테니스 | 7.3 | cardio | 274 |
| `squash` | 스쿼시 | 7.3 | cardio | 274 |
| `soccer` | 축구 | 7.0 | cardio | 263 |
| `basketball` | 농구 | 6.5 | cardio | 244 |
| `boxing` | 복싱 (샌드백) | 5.5 | cardio | 206 |
| `martial-arts` | 태권도·무술 | 10.3 | cardio | 386 |
| `dance-aerobic` | 댄스 (에어로빅) | 6.5 | cardio | 244 |
| `climbing` | 클라이밍 (실내) | 8.0 | cardio | 300 |
| `golf` | 골프 (걸어서) | 4.8 | cardio | 180 |
| `weight-moderate` | 웨이트 (보통 강도) | 3.5 | **strength** | 131 |
| `weight-vigorous` | 웨이트 (고강도) | 6.0 | **strength** | 225 |
| `bodyweight` | 맨몸운동 | 3.8 | **strength** | 143 |
| `crossfit` | 크로스핏·서킷 | 8.0 | **strength** | 300 |
| `kettlebell` | 케틀벨 | 8.0 | **strength** | 300 |

## 명세 표와 다른 두 칸 (의도된 차이)

명세의 참고 표에서 **줄넘기 442**, **맨몸운동 142** 로 적힌 두 칸이 여기서는 **443**, **143** 이다.

두 값은 정확히 `442.5`, `142.5` — 즉 0.5 경계다. 명세의 참고 표는 이 경계를 내림(짝수 반올림)으로 처리했지만, 같은 문서의 `TDEE = 1698.75 × 1.2 = 2038.5 → 2,039` 는 올림으로 처리했다. **두 방식이 명세 안에서 엇갈린다.**

앱은 `Math.round`(0.5 올림) 하나로 통일한다. 그래야 F1의 기본 목표 1,581과 S1~S6의 모든 수치가 재현되기 때문이다. 참고 표의 두 칸은 표시 예시일 뿐 계산에 쓰이지 않으므로 영향이 없다.

## 미등록 운동 처리

목록에 없는 운동에 **MET를 임의로 지어내지 않는다.**

1. 이름으로 유사 종목 2~3개를 MET와 함께 제시하고 고르게 한다
2. 마땅한 게 없으면 경로 ②(운동 이름 + 소모 칼로리 직접 입력)로 유도한다
3. 이때 유형(유산소/근력)은 사용자가 직접 고른다 — 단백질 하한 판정에 필요하다
