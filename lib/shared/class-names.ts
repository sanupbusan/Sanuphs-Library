/**
 * BookBridge 공용 유틸리티 함수
 */

/**
 * 클래스 이름들을 조걶합하여 하나의 문자열로 반환합니다.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
