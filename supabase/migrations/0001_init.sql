-- 식단앱 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣어 실행한다.
-- 계약 문서: .claude/skills/diet-domain/references/schema.md

-- updated_at 자동 갱신
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── profiles (F1) ─────────────────────────────────────────
create table if not exists public.profiles (
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── meal_logs (F2) ────────────────────────────────────────
create table if not exists public.meal_logs (
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
create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, date);

-- ── exercise_logs (F3) ────────────────────────────────────
create table if not exists public.exercise_logs (
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
create index if not exists exercise_logs_user_date_idx on public.exercise_logs (user_id, date);

-- ── fridge_items (F4) ─────────────────────────────────────
create table if not exists public.fridge_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  quantity     numeric not null default 1 check (quantity > 0),
  unit         text not null default '개',
  purchased_on date not null default current_date,
  expires_on   date,
  created_at   timestamptz not null default now(),
  -- 유통기한이 구매일보다 앞설 수 없다
  constraint expiry_after_purchase check (expires_on is null or expires_on >= purchased_on)
);
create index if not exists fridge_items_user_idx on public.fridge_items (user_id);

-- ── custom_foods (F2) ─────────────────────────────────────
create table if not exists public.custom_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  serving_g    numeric not null default 100 check (serving_g > 0),
  kcal_100g    numeric not null check (kcal_100g >= 0),
  carb_100g    numeric not null default 0 check (carb_100g >= 0),
  protein_100g numeric not null default 0 check (protein_100g >= 0),
  fat_100g     numeric not null default 0 check (fat_100g >= 0),
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

-- ── custom_recipes (F6) ───────────────────────────────────
create table if not exists public.custom_recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kcal        numeric not null check (kcal >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  steps       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ── RLS ───────────────────────────────────────────────────
-- 보호 수단은 anon 키가 아니라 RLS다. 키는 공개 전제로 다룬다.
-- using 과 with check 를 둘 다 건다 — using 만 걸면 남의 user_id 로
-- 행을 삽입하는 것을 막지 못한다.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','meal_logs','exercise_logs','fridge_items','custom_foods','custom_recipes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
