import type { Database } from '@/types/supabase'

export type BookRow = Database['public']['Tables']['books']['Row']
export type StudentRow = Database['public']['Tables']['students']['Row']
export type LoanRow = Database['public']['Tables']['loans']['Row']
export type LoanStatus = Database['public']['Enums']['loan_status']
export type DashboardSummary = Database['public']['Views']['dashboard_summary']['Row']
export type RecentLoan = Database['public']['Views']['dashboard_recent_loans']['Row']

export type ApiError = {
  code?: string
  message: string
}

export type ApiResponse<T> = {
  data?: T
  error?: ApiError
}

export type ApiResponseWithMeta<T, TMeta extends Record<string, unknown> = Record<string, unknown>> =
  ApiResponse<T> & {
    meta?: TMeta
  }

export type BookSearchResult = Omit<
  Database['public']['Functions']['search_books']['Returns'][number],
  'category'
>
export type SearchBook = Database['public']['Functions']['search_books']['Returns'][number]

type BookIdentityFields =
  | 'author'
  | 'available_copies'
  | 'id'
  | 'isbn'
  | 'publisher'
  | 'school_book_code'
  | 'school_book_codes'
  | 'title'
  | 'total_copies'

type AdminBookFields =
  | BookIdentityFields
  | 'category'
  | 'created_at'
  | 'location'

type IsbnLookupFields = 'author' | 'isbn' | 'publisher' | 'title'
type RecentBookFields =
  | 'available_copies'
  | 'author'
  | 'category'
  | 'created_at'
  | 'id'
  | 'title'
  | 'total_copies'

export type AdminBookRow = Pick<BookRow, AdminBookFields>
export type RemovableBook = Pick<BookRow, BookIdentityFields>
export type BookLookupResult = RemovableBook & {
  matched_school_book_code: string | null
}
export type IsbnLookupResult = Pick<BookRow, IsbnLookupFields>
export type RecentBook = Pick<BookRow, RecentBookFields>

export type BorrowerType = 'staff' | 'student'

export type LoanStudent = Omit<
  Database['public']['Functions']['lookup_student_for_loan']['Returns'][number],
  'borrower_type'
> & {
  borrower_type: BorrowerType
}

export type CreatedPublicLoan =
  Database['public']['Functions']['create_public_loan']['Returns'][number]

export type LoanCreationResult = {
  activeLoanCount: number
  bookTitle: string
  borrowerLabel: string
  borrowerType: BorrowerType
  dueOn: string
  loanId: string
  loanLimit: number
  remainingLoanCount: number
  studentName: string
}

export type LoanWithBookAndStudent = Pick<
  LoanRow,
  'book_id' | 'borrowed_on' | 'due_on' | 'id' | 'returned_on' | 'status' | 'student_id'
> & {
  books: Pick<BookRow, 'school_book_code' | 'title'> | null
  students: Pick<StudentRow, 'name' | 'student_number'> | null
}

export type ReturnableLoan =
  Database['public']['Functions']['get_returnable_loan_by_school_book_code']['Returns'][number]

export type ReturnedLoan =
  Database['public']['Functions']['return_loans_by_school_book_codes']['Returns'][number]

export type OverdueLoanRow = {
  bookTitle: string | null
  borrowedOn: string
  dueOn: string
  id: string
  studentName: string | null
  studentNumber: string | null
}

export type OverdueLoanSelectRow = Pick<LoanRow, 'borrowed_on' | 'due_on' | 'id'> & {
  books: Pick<BookRow, 'title'> | null
  students: Pick<StudentRow, 'name' | 'student_number'> | null
}

export type StudentLoanStat = {
  student_id: string
  student_name: string
  total_loans: number
}

export type DashboardOverdueLoan = {
  due_on: string
  id: string
  student_name: string
}

export type ActiveLoanWithStudent = Pick<LoanRow, 'id' | 'student_id'> & {
  students: Pick<StudentRow, 'name'> | null
}

export type DashboardOverdueLoanWithStudent = Pick<LoanRow, 'due_on' | 'id'> & {
  students: Pick<StudentRow, 'name'> | null
}
