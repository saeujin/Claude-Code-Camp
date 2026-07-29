# Supabase 스키마

마이그레이션 SQL은 `supabase/migrations/0001_init.sql`에 커밋한다. 팀원이 자기 Supabase 프로젝트에서 그대로 실행해 동일한 상태를 만들 수 있어야 한다.

## 보안 전제

- **`anon` 키는 공개된다.** 프론트엔드 번들에 들어가고 브라우저에서 읽을 수 있다. 이건 정상이며, 보호 수단은 키가 아니라 **RLS**다
- **`service_role` 키는 프론트엔드에 절대 넣지 않는다.** RLS를 우회하므로 노출되면 전체 사용자 데이터가 열린다
- 모든 테이블에 RLS를 켜고 `auth.uid() = user_id` 정책을 건다. RLS를 켜지 않은 테이블이 하나라도 있으면 그 테이블은 전부 공개된 것과 같다

## 테이블

| 테이블 | 용도 | 기능 |
|---|---|---|
| `profiles` | 신체 정보·목표. 사용자당 1행 | F1 |
| `meal_logs` | 끼니별 식사 기록 | F2 |
| `exercise_logs` | 운동 기록 | F3 |
| `fridge_items` | 보유 재료 | F4 |
| `custom_foods` | 사용자가 등록한 음식 | F2, F5 |
| `custom_recipes` | 사용자가 등록한 레시피 | F6 |

## SQL

```sql
-- 공통: updated_at 자동 갱신
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── profiles (F1) ─────────────────────────────────────────
create table profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  sex              text    not null check (sex in ('male','female')),
  age              int     not null check (age between 10 and 100),
  height_cm        numeric not null check (height_cm between 100 and 250),
  weight_kg        numeric not null check (weight_kg between 30 and 300),
  activity_level   numeric not null check (activity_level in (1.2, 1.375, 1.55, 1.725)),
  goal             text    not null check (goal in ('lose','maintain','gain')),
  target_weight_kg numeric check (target_weight_kg between 30 and 300),
  target_date      date,
  started_on       date    not null,
  start_weight_kg  numeric not null check (start_weight_kg between 30 and 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 유지 목표는 목표 체중·기간을 받지 않는다
  constraint goal_fields check (
    (goal = 'maintain' and target_weight_kg is null and target_date is null)
    or (goal <> 'maintain' and target_weight_kg is not null and target_date is not null)
  )
);

-- ── meal_logs (F2) ────────────────────────────────────────
create table meal_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  slot       text not null check (slot in ('breakfast','lunch','dinner','snack')),
  food_name  text not null,
  amount_g   numeric not null check (amount_g > 0),
  kcal       numeric not null check (kcal >= 0),
  carb_g     numeric not null default 0 check (carb_g >= 0),
  protein_g  numeric not null default 0 check (protein_g >= 0),
  fat_g      numeric not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now()
);
create index on meal_logs (user_id, date);

-- ── exercise_logs (F3) ────────────────────────────────────
create table exercise_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  time               time not null,
  name               text not null,
  source             text not null check (source in ('met','manual')),
  met                numeric check (met > 0),
  minutes            numeric check (minutes > 0),
  kcal               numeric not null check (kcal >= 0),
  kind               text not null check (kind in ('cardio','strength')),
  weight_snapshot_kg numeric not null,
  created_at         timestamptz not null default now(),
  -- MET 경로는 met·minutes가 반드시 있어야 한다
  constraint met_fields check (
    source <> 'met' or (met is not null and minutes is not null)
  )
);
create index on exercise_logs (user_id, date);

-- ── fridge_items (F4) ─────────────────────────────────────
create table fridge_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  quantity      numeric not null default 1 check (quantity > 0),
  unit          text not null default '개',
  purchased_on  date not null default current_date,
  expires_on    date,
  created_at    timestamptz not null default now()
);
create index on fridge_items (user_id);

-- ── custom_foods (F2) ─────────────────────────────────────
create table custom_foods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  serving_g  numeric not null default 100 check (serving_g > 0),
  kcal_100g  numeric not null check (kcal_100g >= 0),
  carb_100g  numeric not null default 0,
  protein_100g numeric not null default 0,
  fat_100g   numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ── custom_recipes (F6) ───────────────────────────────────
create table custom_recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kcal        numeric not null check (kcal >= 0),
  -- [{name, pantry}] 형태
  ingredients jsonb not null default '[]'::jsonb,
  steps       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);
```

## RLS

여섯 테이블 모두 동일한 패턴. `profiles`만 키가 `user_id`(PK)이고 나머지는 일반 컬럼이지만 정책은 같다.

```sql
alter table profiles       enable row level security;
alter table meal_logs      enable row level security;
alter table exercise_logs  enable row level security;
alter table fridge_items   enable row level security;
alter table custom_foods   enable row level security;
alter table custom_recipes enable row level security;

-- 테이블마다 반복 (select/insert/update/delete 를 한 정책으로 처리)
create policy "own rows" on meal_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`using`과 `with check`를 **둘 다** 건다. `using`만 걸면 남의 `user_id`로 행을 삽입하는 것을 막지 못한다.

## repository 계층

화면은 `supabase` 클라이언트를 직접 부르지 않는다. `src/db/`의 인터페이스만 쓴다. 저장 방식을 바꿔야 할 때 화면을 건드리지 않기 위함이다.

```ts
// src/db/repositories.ts
export interface ProfileRepo {
  get(): Promise<Profile | null>
  upsert(p: Omit<Profile, 'userId'>): Promise<Profile>
}
export interface MealRepo {
  listByDate(date: DateKey): Promise<MealEntry[]>
  add(e: Omit<MealEntry, 'id' | 'userId' | 'createdAt'>): Promise<MealEntry>
  update(id: string, patch: Partial<MealEntry>): Promise<MealEntry>
  remove(id: string): Promise<void>
}
// ExerciseRepo · FridgeRepo · CustomFoodRepo · CustomRecipeRepo 도 같은 모양
```

## 환경변수

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

`.env.example`만 커밋하고 `.env`는 `.gitignore`에 넣는다. Vercel에는 대시보드의 Environment Variables에 같은 두 개를 등록한다.
