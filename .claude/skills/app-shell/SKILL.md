---
name: app-shell
description: 식단앱의 껍데기 — 라우팅, 모바일 우선 레이아웃, Supabase 인증, 디자인 토큰, 공용 컴포넌트 규약, Vercel 배포 절차. Use when scaffolding the project, adding routes, touching auth, styling shared UI, or deploying.
user-invocable: true
---

# 앱 셸 — 라우팅·인증·디자인·배포

F1~F7 기능이 올라앉는 공통 껍데기. 기능 스킬은 화면 안쪽만 다루고, 화면 밖의 모든 것은 여기서 정한다.
도메인 계약은 [`diet-domain`](../diet-domain/SKILL.md).

## 스택

React 19 + TypeScript + Vite + Tailwind + React Router + Vitest + `@supabase/supabase-js`.
빌드 산출물은 정적 파일(`dist/`)이고 서버 코드는 없다.

## 디렉터리

```
src/
  domain/      순수 계산 함수 — React·Supabase 의존 금지
  data/        foods.json · met.json · recipes.json
  db/          supabase 클라이언트 + repository 계층
  features/    profile meals exercise fridge suggest recipes dashboard
  components/  공용 UI
  lib/         날짜·포맷 유틸
supabase/migrations/
```

**의존 방향은 한쪽으로만 흐른다** — `features → db → domain`, `features → components`. `domain`은 순수 유틸(`lib/`) 외에는 아무것도 import 하지 않는다. React·Supabase·브라우저 API에 절대 의존하지 않는다. 이 규칙이 깨지면 계산 로직을 테스트할 수 없게 된다.

## 라우팅

| 경로 | 화면 | 기능 |
|---|---|---|
| `/` | 대시보드 (홈) | F7 |
| `/profile` | 프로필·목표 설정 | F1 |
| `/meals` | 식단 기록 | F2 |
| `/exercise` | 운동 기록 | F3 |
| `/fridge` | 냉장고 | F4 |
| `/suggest` | 다음 식사 추천 | F5 |
| `/recipes` | 레시피 추천 | F6 |
| `/login` | 로그인·회원가입 | — |

- `/login` 외 전부 **보호 라우트**. 미로그인이면 `/login`으로
- 로그인했으나 **프로필이 없으면** `/profile`로 유도한다. 다만 강제 리다이렉트는 하지 않는다 — 명세상 F2·F3·F4는 프로필 없이도 기록할 수 있어야 한다. 각 화면 상단에 설정 유도 배너를 띄우는 방식으로 처리한다
- 하단 탭: 홈 · 식단 · 운동 · 냉장고 · 추천 (모바일 우선)

## 인증

Supabase 이메일 + 비밀번호. 소셜 로그인은 1차 범위 밖.

- `AuthProvider`가 세션을 들고 있고, `onAuthStateChange`를 구독해 로그인·로그아웃·토큰 갱신을 반영한다
- 세션 로딩 중에는 리다이렉트하지 않는다. 로딩 상태를 구분하지 않으면 새로고침할 때마다 로그인 화면이 번쩍인다
- 로그아웃 시 로컬 캐시를 비운다
- 배포 후 Supabase 대시보드의 **Site URL / Redirect URLs에 배포 도메인을 등록**해야 확인 메일 링크가 동작한다

보안 전제는 `diet-domain/references/schema.md`를 따른다 — **anon 키는 공개 전제, `service_role` 키는 프론트엔드에 절대 넣지 않는다.** 보호 수단은 RLS다.

## 디자인 토큰

```
색   배경 #FAFAF9 / 카드 #FFFFFF / 본문 #1C1917 / 보조 #78716C / 경계 #E7E5E4
     강조 #16A34A (초록 — 진행·달성)
     정보 #0EA5E9 (파랑 — 운동으로 늘어난 양)
     주의 #D97706 (호박 — 유통기한 임박). 붉은 경고색은 쓰지 않는다
타이포 시스템 폰트. 숫자는 tabular-nums
간격  4px 배수. 카드 padding 16px, 화면 좌우 여백 16px
모서리 12px, 그림자는 카드 한 겹만
```

**붉은색을 쓰지 않는 이유** — 목표 초과를 경고처럼 보이게 하면 사용자가 기록을 회피한다 (명세 398행). 초과·부족 모두 중립적인 회색·호박색으로 표현한다.

## 공용 컴포넌트 규약

- `<Stat>` — 큰 숫자 + 라벨. 칼로리는 항상 천 단위 콤마 (`1,581 kcal`)
- `<ProgressBar>` — 100% 초과 시 넘친 부분을 다른 색으로 표시하되 경고색은 아니다
- `<EmptyState>` — 아이콘 + 한 줄 안내 + 행동 버튼. 기록이 없는 모든 화면에 필요하다
- `<Formula>` — 계산 근거 노출용. `MET 8.3 × 75kg × 0.5시간 = 311 kcal` 같은 식을 작은 글씨로
- `<Notice>` — 안내 문구. `info` / `caution` 두 톤만. `error` 톤은 입력 검증에만 쓴다
- 숫자 포맷·날짜 포맷은 `src/lib/format.ts` 한 곳에서만 만든다

## 환경변수

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

`.env.example`만 커밋한다. `.env`는 `.gitignore`.
값이 없으면 앱 시작 시 명확히 실패시킨다 — 조용히 `undefined`로 진행하면 원인 모를 네트워크 오류로 나타난다.

## 배포 (Vercel)

1. 저장소를 Vercel에 연결
2. Framework Preset **Vite**, Build `npm run build`, Output `dist`
3. Environment Variables에 위 두 개 등록
4. SPA 폴백 — `vercel.json`
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
   이게 없으면 `/meals`에서 새로고침할 때 404가 난다
5. Supabase Auth의 Site URL / Redirect URLs에 배포 도메인 추가
6. 배포본에서 시나리오 S1~S6를 다시 통과시킨다

## 완료 판정

- `npm run build` 타입 오류 0
- `npm run test` 도메인 테스트 전부 통과
- 미로그인 상태로 `/meals` 접근 시 `/login`으로, 로그인 후 원래 가려던 경로로 복귀
- 배포본에서 각 경로 새로고침 시 404가 나지 않음
- 다른 계정으로 로그인하면 앞 계정 데이터가 보이지 않음 (RLS 확인)
