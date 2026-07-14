import { desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { books } from '@/db/schema'
import type { DbClient, DbTransaction } from '@/lib/db'
import type { AdminBookRow, BookRow, RecentBook, RemovableBook, SearchBook } from '@/types/library'

export const adminBookSelect = {
  id: books.id,
  isbn: books.isbn,
  school_book_code: books.school_book_code,
  school_book_codes: books.school_book_codes,
  title: books.title,
  author: books.author,
  publisher: books.publisher,
  category: books.category,
  total_copies: books.total_copies,
  available_copies: books.available_copies,
  created_at: books.created_at,
}

export const bookExportSelect = {
  id: books.id,
  title: books.title,
  author: books.author,
  publisher: books.publisher,
  isbn: books.isbn,
  school_book_code: books.school_book_code,
  category: books.category,
  total_copies: books.total_copies,
  available_copies: books.available_copies,
}

export type AdminBookInsertValues = {
  author: string
  available_copies: number
  category: string
  isbn: string | null
  publisher: string | null
  school_book_code: string | null
  school_book_codes: string[]
  title: string
  total_copies: number
}

export type AdminBookCopiesUpdate = {
  available_copies: number
  id: string
  school_book_code: string | null
  school_book_codes: string[]
  total_copies: number
}

function textArraySql(values: string[]) {
  return sql`array[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`
}

export async function listAdminBooks(db: DbClient): Promise<AdminBookRow[]> {
  return db.select(adminBookSelect).from(books).orderBy(desc(books.created_at)).limit(100)
}

export async function listAdminBooksForExport(db: DbClient): Promise<BookRow[]> {
  const rows = await db.select(bookExportSelect).from(books).orderBy(desc(books.created_at))
  return rows as unknown as BookRow[]
}

export async function listRecentBooks(db: DbClient, limit: number): Promise<RecentBook[]> {
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      category: books.category,
      available_copies: books.available_copies,
      total_copies: books.total_copies,
      created_at: books.created_at,
    })
    .from(books)
    .orderBy(desc(books.created_at))
    .limit(limit)
}

export async function searchBooks(db: DbClient, query: string, limit: number): Promise<SearchBook[]> {
  const searchQuery = query.trim()
  const rows = await db
    .select({
      id: books.id,
      isbn: books.isbn,
      title: books.title,
      author: books.author,
      publisher: books.publisher,
      category: books.category,
      available_copies: books.available_copies,
      total_copies: books.total_copies,
    })
    .from(books)
    .where(
      searchQuery
        ? or(
            ilike(books.title, `%${searchQuery}%`),
            ilike(books.author, `%${searchQuery}%`)
          )
        : undefined
    )
    .orderBy(books.title)
    .limit(limit)

  return rows
}

export async function findBookByIsbn(db: DbClient, isbn: string): Promise<AdminBookRow | null> {
  const rows = await db.select(adminBookSelect).from(books).where(eq(books.isbn, isbn)).limit(1)
  return rows[0] ?? null
}

export async function findBookBySchoolBookCode(db: DbClient, schoolBookCode: string): Promise<AdminBookRow | null> {
  const containsCode = sql<boolean>`coalesce(${books.school_book_codes}, '{}'::text[]) @> array[${schoolBookCode}]::text[]`
  const rows = await db
    .select(adminBookSelect)
    .from(books)
    .where(or(containsCode, eq(books.school_book_code, schoolBookCode)))
    .orderBy(sql`case when ${containsCode} then 0 else 1 end`)
    .limit(1)

  return rows[0] ?? null
}

export async function findBooksForImport(
  db: DbTransaction,
  input: { isbns: string[]; schoolBookCodes: string[] }
): Promise<AdminBookRow[]> {
  const isbnCondition = input.isbns.length > 0
    ? inArray(books.isbn, input.isbns)
    : undefined
  const schoolBookCodeCondition = input.schoolBookCodes.length > 0
    ? or(
        inArray(books.school_book_code, input.schoolBookCodes),
        sql<boolean>`coalesce(${books.school_book_codes}, '{}'::text[]) && ${textArraySql(input.schoolBookCodes)}`
      )
    : undefined
  const condition = isbnCondition && schoolBookCodeCondition
    ? or(isbnCondition, schoolBookCodeCondition)
    : isbnCondition ?? schoolBookCodeCondition

  if (!condition) {
    return []
  }

  return db.select(adminBookSelect).from(books).where(condition)
}

export async function findRemovableBookByCode(
  db: DbClient,
  code: string,
  isIsbn: boolean
): Promise<RemovableBook | null> {
  const containsCode = sql<boolean>`coalesce(${books.school_book_codes}, '{}'::text[]) @> array[${code}]::text[]`
  const rows = await db
    .select({
      id: books.id,
      isbn: books.isbn,
      school_book_code: books.school_book_code,
      school_book_codes: books.school_book_codes,
      title: books.title,
      author: books.author,
      publisher: books.publisher,
      available_copies: books.available_copies,
      total_copies: books.total_copies,
    })
    .from(books)
    .where(isIsbn ? eq(books.isbn, code) : or(containsCode, eq(books.school_book_code, code)))
    .orderBy(isIsbn ? books.title : sql`case when ${containsCode} then 0 else 1 end`)
    .limit(1)

  return rows[0] ?? null
}

export async function insertAdminBook(db: DbClient, input: AdminBookInsertValues): Promise<AdminBookRow> {
  const rows = await db.insert(books).values(input).returning(adminBookSelect)
  return rows[0]
}

export async function insertAdminBooks(db: DbTransaction, inputs: AdminBookInsertValues[]) {
  if (inputs.length === 0) {
    return
  }

  await db.insert(books).values(inputs)
}

export async function updateBookCopiesAndCodes(
  db: DbClient,
  input: AdminBookCopiesUpdate
): Promise<AdminBookRow | null> {
  const rows = await db
    .update(books)
    .set({
      available_copies: input.available_copies,
      school_book_code: input.school_book_code,
      school_book_codes: input.school_book_codes,
      total_copies: input.total_copies,
    })
    .where(eq(books.id, input.id))
    .returning(adminBookSelect)

  return rows[0] ?? null
}

export async function updateBookCopiesAndCodesInBulk(
  db: DbTransaction,
  inputs: AdminBookCopiesUpdate[]
) {
  if (inputs.length === 0) {
    return
  }

  const updateValues = sql.join(
    inputs.map((input) => sql`(
      ${input.id}::uuid,
      ${input.available_copies}::integer,
      ${input.total_copies}::integer,
      ${input.school_book_code}::text,
      ${textArraySql(input.school_book_codes)}
    )`),
    sql`, `
  )

  await db.execute(sql`
    update ${books}
    set
      available_copies = updates.available_copies,
      total_copies = updates.total_copies,
      school_book_code = updates.school_book_code,
      school_book_codes = updates.school_book_codes
    from (values ${updateValues}) as updates(
      id,
      available_copies,
      total_copies,
      school_book_code,
      school_book_codes
    )
    where ${books.id} = updates.id
  `)
}

export async function deleteAdminBook(db: DbClient, bookId: string) {
  const rows = await db.delete(books).where(eq(books.id, bookId)).returning({ id: books.id, title: books.title })
  return rows[0] ?? null
}

export async function updateAdminBook(db: DbClient, bookId: string, input: {
  author: string
  isbn: string | null
  publisher: string
  schoolBookCode: string
  title: string
}): Promise<AdminBookRow | null> {
  const rows = await db
    .update(books)
    .set({
      author: input.author,
      isbn: input.isbn,
      publisher: input.publisher,
      school_book_code: input.schoolBookCode,
      school_book_codes: [input.schoolBookCode],
      title: input.title,
    })
    .where(eq(books.id, bookId))
    .returning(adminBookSelect)

  return rows[0] ?? null
}

export async function findStoredBookInfoByIsbn(db: DbClient, isbn: string) {
  const rows = await db
    .select({
      author: books.author,
      isbn: books.isbn,
      publisher: books.publisher,
      title: books.title,
    })
    .from(books)
    .where(eq(books.isbn, isbn))
    .limit(1)

  return rows[0] ?? null
}
