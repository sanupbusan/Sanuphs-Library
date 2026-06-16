export function getTodayDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function getDateKeyTime(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

export function getOverdueDays(dueOn: string, today: string) {
  return Math.max(0, Math.floor((getDateKeyTime(today) - getDateKeyTime(dueOn)) / 86_400_000))
}

export function getLoanBanRemainingDays(loanBannedUntil: string | null, today: string) {
  if (!loanBannedUntil || loanBannedUntil < today) {
    return 0
  }

  return Math.floor((getDateKeyTime(loanBannedUntil) - getDateKeyTime(today)) / 86_400_000) + 1
}

export function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}
