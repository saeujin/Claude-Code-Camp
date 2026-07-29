/**
 * 음식 이름 검색 — 순수 함수.
 *
 * 저장소 안에서 목록을 읽어오는 대신 목록을 인자로 받는다. 그래서 화면은
 * `useMemo(() => filterFoodsByName(foods, query), [foods, query])`처럼 의존성을
 * 정직하게 적을 수 있다.
 */

import type { Food } from './types'

/** 질의가 비면 전체를 돌려준다. 대소문자는 구분하지 않는다 */
export function filterFoodsByName(foods: readonly Food[], query: string): Food[] {
  const keyword = query.trim().toLowerCase()
  if (keyword === '') return [...foods]

  return foods.filter((food) => food.name.toLowerCase().includes(keyword))
}
