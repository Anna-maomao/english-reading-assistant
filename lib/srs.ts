import type { SrsFields } from '@/types'

// 简化版间隔重复：失败回到阶梯起点，成功沿阶梯前进（天数）
const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]
const DAY = 24 * 60 * 60 * 1000

// 句卡连续看懂这么多次后毕业，不再排期
export const GRADUATE_STREAK = 3

export function newSrsFields(): SrsFields {
  return { step: 0, due: Date.now(), streak: 0, reps: 0 }
}

export function reviewCard<T extends SrsFields>(card: T, remembered: boolean): T {
  const now = Date.now()
  if (!remembered) {
    // 失败：归零，本次复习会话内重新出现（due 保持过期状态）
    return { ...card, step: 0, streak: 0, reps: card.reps + 1, due: now }
  }
  const step = Math.min(card.step + 1, INTERVALS_DAYS.length)
  const days = INTERVALS_DAYS[Math.min(card.step, INTERVALS_DAYS.length - 1)]
  return { ...card, step, streak: card.streak + 1, reps: card.reps + 1, due: now + days * DAY }
}
