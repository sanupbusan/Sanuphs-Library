const DAY_IN_MILLISECONDS = 86_400_000
const koreanDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getDateKeyTime(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

export function formatDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

export function getTodayDateKey() {
  return formatDateKey(new Date())
}

export function differenceInDateKeys(laterDate: string, earlierDate: string) {
  return Math.floor(
    (getDateKeyTime(laterDate) - getDateKeyTime(earlierDate)) / DAY_IN_MILLISECONDS
  )
}

export function addDaysToDateKey(value: string, days: number) {
  return new Date(getDateKeyTime(value) + days * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10)
}

export function formatKoreanDate(value: string) {
  const [year, month, day] = value.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`
}

export function formatLocalizedDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '-' : koreanDateFormatter.format(date)
}
