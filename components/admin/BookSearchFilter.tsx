import { Search } from 'lucide-react'

type BookSearchFilterProps = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
}

export default function BookSearchFilter({
  searchQuery,
  onSearchQueryChange,
}: BookSearchFilterProps) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor="admin-book-search" className="sr-only">
        도서 검색
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        id="admin-book-search"
        className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="도서명, 저자, ISBN, 학교 도서 코드 검색"
        type="search"
        value={searchQuery}
      />
    </div>
  )
}
