const HANGUL_BASE_CODE = 0xac00
const HANGUL_LAST_CODE = 0xd7a3
const JUNGSEONG_COUNT = 21
const JONGSEONG_COUNT = 28

const CHOSEONG_TO_QWERTY = [
  'r',
  'R',
  's',
  'e',
  'E',
  'f',
  'a',
  'q',
  'Q',
  't',
  'T',
  'd',
  'w',
  'W',
  'c',
  'z',
  'x',
  'v',
  'g',
]

const JUNGSEONG_TO_QWERTY = [
  'k',
  'o',
  'i',
  'O',
  'j',
  'p',
  'u',
  'P',
  'h',
  'hk',
  'ho',
  'hl',
  'y',
  'n',
  'nj',
  'np',
  'nl',
  'b',
  'm',
  'ml',
  'l',
]

const JONGSEONG_TO_QWERTY = [
  '',
  'r',
  'R',
  'rt',
  's',
  'sw',
  'sg',
  'e',
  'f',
  'fr',
  'fa',
  'fq',
  'ft',
  'fx',
  'fv',
  'fg',
  'a',
  'q',
  'qt',
  't',
  'T',
  'd',
  'w',
  'c',
  'z',
  'x',
  'v',
  'g',
]

const COMPAT_JAMO_TO_QWERTY: Record<string, string> = {
  ㄱ: 'r',
  ㄲ: 'R',
  ㄳ: 'rt',
  ㄴ: 's',
  ㄵ: 'sw',
  ㄶ: 'sg',
  ㄷ: 'e',
  ㄸ: 'E',
  ㄹ: 'f',
  ㄺ: 'fr',
  ㄻ: 'fa',
  ㄼ: 'fq',
  ㄽ: 'ft',
  ㄾ: 'fx',
  ㄿ: 'fv',
  ㅀ: 'fg',
  ㅁ: 'a',
  ㅂ: 'q',
  ㅃ: 'Q',
  ㅄ: 'qt',
  ㅅ: 't',
  ㅆ: 'T',
  ㅇ: 'd',
  ㅈ: 'w',
  ㅉ: 'W',
  ㅊ: 'c',
  ㅋ: 'z',
  ㅌ: 'x',
  ㅍ: 'v',
  ㅎ: 'g',
  ㅏ: 'k',
  ㅐ: 'o',
  ㅑ: 'i',
  ㅒ: 'O',
  ㅓ: 'j',
  ㅔ: 'p',
  ㅕ: 'u',
  ㅖ: 'P',
  ㅗ: 'h',
  ㅘ: 'hk',
  ㅙ: 'ho',
  ㅚ: 'hl',
  ㅛ: 'y',
  ㅜ: 'n',
  ㅝ: 'nj',
  ㅞ: 'np',
  ㅟ: 'nl',
  ㅠ: 'b',
  ㅡ: 'm',
  ㅢ: 'ml',
  ㅣ: 'l',
}

export function convertKoreanKeyboardToEnglish(value: string) {
  return Array.from(value)
    .map((character) => {
      const qwerty = COMPAT_JAMO_TO_QWERTY[character]

      if (qwerty) {
        return qwerty
      }

      const code = character.charCodeAt(0)

      if (code < HANGUL_BASE_CODE || code > HANGUL_LAST_CODE) {
        return character
      }

      const hangulIndex = code - HANGUL_BASE_CODE
      const choseongIndex = Math.floor(hangulIndex / (JUNGSEONG_COUNT * JONGSEONG_COUNT))
      const jungseongIndex = Math.floor((hangulIndex % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT)
      const jongseongIndex = hangulIndex % JONGSEONG_COUNT

      return [
        CHOSEONG_TO_QWERTY[choseongIndex],
        JUNGSEONG_TO_QWERTY[jungseongIndex],
        JONGSEONG_TO_QWERTY[jongseongIndex],
      ].join('')
    })
    .join('')
}

export function normalizeBarcodeInput(value: string) {
  return convertKoreanKeyboardToEnglish(value)
    .replace(/\s+/g, '')
    .replace(/[^0-9A-Za-z-]/g, '')
}

export function normalizeIsbnInput(value: string) {
  return convertKoreanKeyboardToEnglish(value).replace(/[^0-9Xx]/g, '')
}
