// 화면은 supabase 클라이언트를 직접 부르지 않고 이 계층만 쓴다.
// 저장 방식을 바꿔야 할 때 화면을 건드리지 않기 위함이다.
import type {
  DateKey,
  ExerciseEntry,
  Food,
  FridgeItem,
  MealEntry,
  Profile,
  Recipe,
} from '../domain/types'
import { supabase } from './supabase'

function fail(context: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`${context}: ${error.message}`)
}

// ── 매핑 ──────────────────────────────────────────────────

type Row = Record<string, unknown>

const n = (v: unknown) => Number(v)

function toProfile(r: Row): Profile {
  return {
    userId: r.user_id as string,
    sex: r.sex as Profile['sex'],
    age: n(r.age),
    heightCm: n(r.height_cm),
    weightKg: n(r.weight_kg),
    activityLevel: n(r.activity_level) as Profile['activityLevel'],
    goal: r.goal as Profile['goal'],
    targetWeightKg: r.target_weight_kg === null ? null : n(r.target_weight_kg),
    targetDate: (r.target_date as string | null) ?? null,
    startedOn: r.started_on as string,
    startWeightKg: n(r.start_weight_kg),
  }
}

function toMeal(r: Row): MealEntry {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    date: r.date as string,
    slot: r.slot as MealEntry['slot'],
    foodName: r.food_name as string,
    amountG: n(r.amount_g),
    nutrition: {
      kcal: n(r.kcal),
      carbG: n(r.carb_g),
      proteinG: n(r.protein_g),
      fatG: n(r.fat_g),
    },
    createdAt: r.created_at as string,
  }
}

function toExercise(r: Row): ExerciseEntry {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    date: r.date as string,
    time: (r.time as string).slice(0, 5),
    name: r.name as string,
    source: r.source as ExerciseEntry['source'],
    met: r.met === null ? null : n(r.met),
    minutes: r.minutes === null ? null : n(r.minutes),
    kcal: n(r.kcal),
    kind: r.kind as ExerciseEntry['kind'],
    weightSnapshotKg: n(r.weight_snapshot_kg),
    createdAt: r.created_at as string,
  }
}

function toFridge(r: Row): FridgeItem {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    quantity: n(r.quantity),
    unit: r.unit as string,
    purchasedOn: r.purchased_on as string,
    expiresOn: (r.expires_on as string | null) ?? null,
  }
}

function toCustomFood(r: Row): Food {
  return {
    id: `user:${r.id as string}`,
    name: r.name as string,
    per100g: {
      kcal: n(r.kcal_100g),
      carbG: n(r.carb_100g),
      proteinG: n(r.protein_100g),
      fatG: n(r.fat_100g),
    },
    servingG: n(r.serving_g),
    tags: ['내 음식'],
  }
}

function toCustomRecipe(r: Row): Recipe {
  return {
    id: `user:${r.id as string}`,
    name: r.name as string,
    kcal: n(r.kcal),
    ingredients: (r.ingredients as Recipe['ingredients']) ?? [],
    steps: (r.steps as string[]) ?? [],
  }
}

// ── 프로필 (F1) ───────────────────────────────────────────

export const profileRepo = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    fail('프로필을 불러오지 못했습니다', error)
    return data ? toProfile(data) : null
  },

  async upsert(userId: string, p: Omit<Profile, 'userId'>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          sex: p.sex,
          age: p.age,
          height_cm: p.heightCm,
          weight_kg: p.weightKg,
          activity_level: p.activityLevel,
          goal: p.goal,
          target_weight_kg: p.targetWeightKg,
          target_date: p.targetDate,
          started_on: p.startedOn,
          start_weight_kg: p.startWeightKg,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()
    fail('프로필을 저장하지 못했습니다', error)
    return toProfile(data as Row)
  },
}

// ── 식단 기록 (F2) ────────────────────────────────────────

export const mealRepo = {
  async listByDate(userId: string, date: DateKey): Promise<MealEntry[]> {
    const { data, error } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })
    fail('식단 기록을 불러오지 못했습니다', error)
    return (data ?? []).map(toMeal)
  },

  async add(
    userId: string,
    e: Omit<MealEntry, 'id' | 'userId' | 'createdAt'>,
  ): Promise<MealEntry> {
    const { data, error } = await supabase
      .from('meal_logs')
      .insert({
        user_id: userId,
        date: e.date,
        slot: e.slot,
        food_name: e.foodName,
        amount_g: e.amountG,
        kcal: e.nutrition.kcal,
        carb_g: e.nutrition.carbG,
        protein_g: e.nutrition.proteinG,
        fat_g: e.nutrition.fatG,
      })
      .select()
      .single()
    fail('식단을 기록하지 못했습니다', error)
    return toMeal(data as Row)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('meal_logs').delete().eq('id', id)
    fail('식단 기록을 삭제하지 못했습니다', error)
  },
}

// ── 운동 기록 (F3) ────────────────────────────────────────

export const exerciseRepo = {
  async listByDate(userId: string, date: DateKey): Promise<ExerciseEntry[]> {
    const { data, error } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('time', { ascending: true })
    fail('운동 기록을 불러오지 못했습니다', error)
    return (data ?? []).map(toExercise)
  },

  async add(
    userId: string,
    e: Omit<ExerciseEntry, 'id' | 'userId' | 'createdAt'>,
  ): Promise<ExerciseEntry> {
    const { data, error } = await supabase
      .from('exercise_logs')
      .insert({
        user_id: userId,
        date: e.date,
        time: e.time,
        name: e.name,
        source: e.source,
        met: e.met,
        minutes: e.minutes,
        kcal: e.kcal,
        kind: e.kind,
        weight_snapshot_kg: e.weightSnapshotKg,
      })
      .select()
      .single()
    fail('운동을 기록하지 못했습니다', error)
    return toExercise(data as Row)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
    fail('운동 기록을 삭제하지 못했습니다', error)
  },
}

// ── 냉장고 (F4) ───────────────────────────────────────────

export const fridgeRepo = {
  async list(userId: string): Promise<FridgeItem[]> {
    const { data, error } = await supabase
      .from('fridge_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    fail('재료 목록을 불러오지 못했습니다', error)
    return (data ?? []).map(toFridge)
  },

  async add(userId: string, item: Omit<FridgeItem, 'id' | 'userId'>): Promise<FridgeItem> {
    const { data, error } = await supabase
      .from('fridge_items')
      .insert({
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        purchased_on: item.purchasedOn,
        expires_on: item.expiresOn,
      })
      .select()
      .single()
    fail('재료를 등록하지 못했습니다', error)
    return toFridge(data as Row)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fridge_items').delete().eq('id', id)
    fail('재료를 삭제하지 못했습니다', error)
  },
}

// ── 사용자 음식·레시피 ────────────────────────────────────

export const customFoodRepo = {
  async list(userId: string): Promise<Food[]> {
    const { data, error } = await supabase
      .from('custom_foods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    fail('내 음식 목록을 불러오지 못했습니다', error)
    return (data ?? []).map(toCustomFood)
  },

  async add(userId: string, food: Omit<Food, 'id' | 'tags'>): Promise<Food> {
    const { data, error } = await supabase
      .from('custom_foods')
      .upsert(
        {
          user_id: userId,
          name: food.name,
          serving_g: food.servingG,
          kcal_100g: food.per100g.kcal,
          carb_100g: food.per100g.carbG,
          protein_100g: food.per100g.proteinG,
          fat_100g: food.per100g.fatG,
        },
        { onConflict: 'user_id,name' },
      )
      .select()
      .single()
    fail('내 음식을 저장하지 못했습니다', error)
    return toCustomFood(data as Row)
  },
}

export const customRecipeRepo = {
  async list(userId: string): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('custom_recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    fail('내 레시피 목록을 불러오지 못했습니다', error)
    return (data ?? []).map(toCustomRecipe)
  },
}
