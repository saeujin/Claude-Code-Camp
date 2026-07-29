/**
 * 기본 음식 DB.
 *
 * 미결정 사항 #2(음식 영양 데이터 출처)가 정해지기 전까지 씨드 JSON으로 시작한다.
 * 값은 100g 기준이며 식약처 공공 식품영양성분 DB의 통상 값을 참고한 근사치다.
 * 나중에 API로 바꿀 때는 이 파일의 `SEED_FOODS`를 원격 조회로 대체하면 된다.
 */

import type { Food, FoodRole, Nutrition } from '../domain/types'
import seed from './foods.seed.json'

type SeedFood = {
  id: string
  name: string
  /** 추천 후보 자격. 씨드는 수동 분류했다 (미결정 — role 태그의 출처) */
  role: FoodRole
  per100g: Nutrition
  servingGram?: number
}

export const SEED_FOODS: Food[] = (seed as SeedFood[]).map((food) => ({
  ...food,
  source: 'db' as const,
}))
