# 식단앱 — 오늘 뭘 먹을까

하루 목표 칼로리를 계산하고, 식사·운동 기록과 냉장고 재료를 바탕으로 **다음에 무엇을 먹을지** 알려주는 웹 앱.

기능 명세는 [`기능명세서.md`](기능명세서.md)에 있고, 구현 계약은 [`.claude/skills/`](.claude/skills/)의 스킬 문서들이 갖는다.

```
키·몸무게·나이·성별  →  BMR
        + 일상 활동  →  TDEE
   + 목표 체중 · 기간  →  기본 목표 칼로리
              + 오늘의 운동 소모  →  오늘 목표 칼로리
              − 오늘 섭취        →  잔여 칼로리
                                 →  다음 식사 / 레시피 추천
```

## 기능

| ID | 기능 | 상태 |
|---|---|---|
| F1 | 프로필 및 목표 설정 (BMR·TDEE·기본 목표·탄단지) | ✅ |
| F2 | 하루 식단 기록 | ✅ |
| F3 | 운동 기록 및 소모 칼로리 반영 (MET) | ✅ |
| F4 | 냉장고 재료 관리 | ✅ 수동 입력 (사진 인식은 준비 중) |
| F5 | 다음 식사 추천 | ✅ |
| F6 | 재료 기반 레시피 추천 | ✅ |
| F7 | 일일 대시보드 | ✅ |

1차 배포에 넣지 않은 것 — F4 사진 재료 인식(미결정 #1), F3 웨어러블 연동(미결정 #4), 소셜 로그인.

## 기술 스택

React 19 · TypeScript · Vite · Tailwind v4 · React Router · Supabase(Auth + Postgres) · Vitest

```
src/
  domain/      순수 계산 함수 — React·Supabase 의존 없음
  data/        foods.json · met.json · recipes.json
  db/          Supabase 클라이언트 + repository 계층
  features/    profile meals exercise fridge suggest recipes dashboard auth
  components/  공용 UI
  lib/         날짜·포맷 유틸
supabase/migrations/
```

의존 방향은 한쪽으로만 흐른다 — `features → db → domain`. 화면은 Supabase를 직접 부르지 않고 `src/db/`만 쓴다.

## 로컬 실행

### 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **SQL Editor**에 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)을 그대로 붙여넣고 실행
3. **Authentication > Providers**에서 Email 활성화
   실습 중이라면 **Confirm email**을 꺼두면 가입 즉시 로그인된다
4. **Project Settings > API**에서 `URL`과 `anon public` 키 복사

### 2. 환경변수

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> `anon` 키는 브라우저에 노출되는 것이 정상이며, 보호 수단은 키가 아니라 **RLS**다.
> `service_role` 키는 프론트엔드에 절대 넣지 않는다 — RLS를 우회한다.

### 3. 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 65개 테스트
npm run build    # 타입 검사 + 프로덕션 빌드
```

## 배포 (Vercel)

1. 저장소를 Vercel에 연결
2. Framework Preset **Vite** · Build `npm run build` · Output `dist`
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록
4. SPA 폴백은 [`vercel.json`](vercel.json)에 이미 있다 (없으면 `/meals` 새로고침 시 404)
5. Supabase **Authentication > URL Configuration**의 Site URL / Redirect URLs에 배포 도메인 추가

## 계산 규칙에서 주의할 점

**단계적 반올림.** BMR·TDEE·일일 조정량을 각각 정수로 반올림한 뒤 기본 목표를 계산한다.
실수로 이어 계산하면 명세의 1,581이 1,580으로 어긋난다.

```
BMR      = round(1698.75)            = 1699
TDEE     = round(1698.75 × 1.2)      = 2039
일일 조정량 = round(38500 ÷ 84)        = 458
기본 목표  = 2039 − 458               = 1581  ✓
```

**활동계수는 운동을 제외한 일상 활동만.** 운동은 전부 F3에서 그날그날 더한다. 활동계수에 운동 빈도를 넣으면 같은 운동을 두 번 세게 된다.

**운동 소모는 100% 반영**하고(미결정 #8), 대신 다이어트 목표 사용자에게 "절반 정도만 채우기"를 권하는 안내를 띄운다.

전체 규칙은 [`.claude/skills/diet-domain/`](.claude/skills/diet-domain/)에 있다.

## 테스트

명세의 계산 예시와 시나리오 S1~S6를 그대로 테스트로 고정했다.

```
src/domain/__tests__/calc.test.ts       계산 공식 35개
src/domain/__tests__/scenarios.test.ts  S3~S6 도메인 흐름 16개
src/features/__tests__/screens.test.tsx 화면 출력 14개
```

## 스킬 문서

기능마다 구현 계약을 담은 스킬이 `.claude/skills/`에 있다. Claude Code에서 해당 기능을 작업하면 자동으로 로드된다.

| 스킬 | 내용 |
|---|---|
| `diet-domain` | 용어·상수·반올림 규칙·타입·DB 스키마 (나머지 전부가 참조) |
| `f1-profile` ~ `f7-dashboard` | 기능별 명세 출처·데이터 모델·계산 규칙·엣지케이스·확정 문구·완료 판정 |
| `app-shell` | 라우팅·인증·디자인 토큰·공용 컴포넌트·배포 |
