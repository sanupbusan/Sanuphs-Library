import {
  date,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  pgView,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const adminRole = pgEnum('admin_role', ['admin'])
export const loanStatus = pgEnum('loan_status', ['rented', 'returned'])
export const requestStatus = pgEnum('request_status', ['pending', 'approved', 'rejected', 'purchased'])

const authSchema = pgSchema('auth')

const createdAt = timestamp('created_at', { mode: 'string', withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull().defaultNow()

export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  isbn: text('isbn').unique(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  publisher: text('publisher'),
  category: text('category').notNull().default('미분류'),
  published_year: integer('published_year'),
  total_copies: integer('total_copies').notNull().default(1),
  available_copies: integer('available_copies').notNull().default(1),
  location: text('location'),
  school_book_code: text('school_book_code'),
  school_book_codes: text('school_book_codes').array().notNull().default([]),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_number: text('student_number').notNull().unique(),
  name: text('name').notNull(),
  grade: smallint('grade').notNull(),
  class_number: smallint('class_number').notNull(),
  seat_number: smallint('seat_number').notNull(),
  email: text('email').unique(),
  loan_banned_until: date('loan_banned_until', { mode: 'string' }),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  book_id: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  student_id: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  borrowed_on: date('borrowed_on', { mode: 'string' }).notNull(),
  due_on: date('due_on', { mode: 'string' }).notNull(),
  returned_on: date('returned_on', { mode: 'string' }),
  status: loanStatus('status').notNull().default('rented'),
  notes: text('notes'),
  school_book_code: text('school_book_code'),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const bookRequests = pgTable('book_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  student_id: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
  requester_name: text('requester_name').notNull(),
  title: text('title').notNull(),
  author: text('author'),
  reason: text('reason'),
  status: requestStatus('status').notNull().default('pending'),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const adminUsers = pgTable('admin_users', {
  user_id: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  login_id: text('login_id').notNull(),
  password_hash: text('password_hash').notNull(),
  role: adminRole('role').notNull().default('admin'),
  created_at: createdAt,
  updated_at: updatedAt,
})

export const dashboardSummary = pgView('dashboard_summary', {
  total_books: integer('total_books'),
  total_copies: integer('total_copies'),
  available_copies: integer('available_copies'),
  active_loans: integer('active_loans'),
  overdue_loans: integer('overdue_loans'),
}).existing()

export const dashboardRecentLoans = pgView('dashboard_recent_loans', {
  id: uuid('id'),
  student_name: text('student_name'),
  book_title: text('book_title'),
  rental_date: date('rental_date', { mode: 'string' }),
  return_date: date('return_date', { mode: 'string' }),
  status: text('status'),
}).existing()

export type Book = typeof books.$inferSelect
export type NewBook = typeof books.$inferInsert
export type Student = typeof students.$inferSelect
export type Loan = typeof loans.$inferSelect
