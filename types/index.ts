/**
 * BookBridge 타입 정의
 */

export interface NavItem {
  label: string
  href: string
}

export interface StatCard {
  icon: string
  label: string
  value: string | number
  color: string
}

export interface RentalRecord {
  id: number
  studentName: string
  bookTitle: string
  rentalDate: string
  returnDate: string
  status: 'rented' | 'overdue'
}

export interface FeatureCard {
  icon: string
  title: string
  description: string
}
