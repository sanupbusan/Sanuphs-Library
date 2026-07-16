import { differenceInDateKeys, getTodayDateKey } from '@/lib/shared/date'

export function isLoanOverdue(dueOn: string, today = getTodayDateKey()) {
  return dueOn < today
}

export function getOverdueDays(dueOn: string, today: string) {
  return Math.max(0, differenceInDateKeys(today, dueOn))
}

export function getLoanBanRemainingDays(loanBannedUntil: string | null, today: string) {
  if (!loanBannedUntil || loanBannedUntil < today) {
    return 0
  }

  return differenceInDateKeys(loanBannedUntil, today) + 1
}
