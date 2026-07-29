import { Link } from 'react-router-dom'
import { useDay } from '../app/DayContext'
import { Notice } from './ui'

/**
 * F1 미완료 안내. 강제 리다이렉트하지 않는다 —
 * 명세상 F2·F3·F4는 프로필 없이도 기록할 수 있어야 한다.
 */
export function ProfileBanner({ blocking = false }: { blocking?: boolean }) {
  const { profile } = useDay()
  if (profile) return null

  return (
    <Notice tone="caution">
      {blocking
        ? '프로필을 먼저 설정해야 추천을 받을 수 있어요. '
        : '프로필을 설정하면 목표와 잔여 칼로리를 볼 수 있어요. 기록은 지금도 가능합니다. '}
      <Link to="/profile" className="font-semibold underline">
        설정하러 가기
      </Link>
    </Notice>
  )
}
