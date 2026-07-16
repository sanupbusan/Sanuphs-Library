'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import { Barcode, Printer, Search, Users } from 'lucide-react'
import { getBorrowerType, type BorrowerType } from '@/lib/loan-limits'
import type { BorrowerBarcodeRow } from '@/types/library'

type BorrowerBarcodeManagerProps = {
  borrowers: BorrowerBarcodeRow[]
}

type BorrowerFilter = 'all' | BorrowerType

function BarcodeSvg({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    JsBarcode(svgRef.current, value, {
      background: '#ffffff',
      displayValue: false,
      format: 'CODE128',
      height: 46,
      lineColor: '#111827',
      margin: 0,
      width: 1.7,
    })
  }, [value])

  return <svg ref={svgRef} aria-label={`${value} 바코드`} className="max-h-14 max-w-full" role="img" />
}

function getBorrowerDescription(borrower: BorrowerBarcodeRow) {
  if (getBorrowerType(borrower) === 'staff') {
    return `교직원 ${borrower.seat_number}번`
  }

  return `${borrower.grade}학년 ${borrower.class_number}반 ${borrower.seat_number}번`
}

function BarcodeLabel({ borrower }: { borrower: BorrowerBarcodeRow }) {
  return (
    <article className="borrower-barcode-label flex min-w-0 flex-col items-center justify-center border border-gray-300 bg-white px-3 py-2 text-gray-950">
      <div className="mb-1 flex w-full items-baseline justify-between gap-2">
        <strong className="truncate text-xs">{borrower.name}</strong>
        <span className="shrink-0 text-[10px] text-gray-600">{getBorrowerDescription(borrower)}</span>
      </div>
      <BarcodeSvg value={borrower.student_number} />
      <span className="mt-1 font-mono text-[11px] font-semibold tracking-normal">
        {borrower.student_number}
      </span>
    </article>
  )
}

export default function BorrowerBarcodeManager({ borrowers }: BorrowerBarcodeManagerProps) {
  const [borrowerFilter, setBorrowerFilter] = useState<BorrowerFilter>('all')
  const [classFilter, setClassFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const gradeOptions = useMemo(
    () => Array.from(new Set(
      borrowers
        .filter((borrower) => getBorrowerType(borrower) === 'student')
        .map((borrower) => borrower.grade)
    )).sort((left, right) => left - right),
    [borrowers]
  )

  const classOptions = useMemo(
    () => Array.from(new Set(
      borrowers
        .filter((borrower) => {
          if (getBorrowerType(borrower) !== 'student') return false
          return gradeFilter === 'all' || borrower.grade === Number(gradeFilter)
        })
        .map((borrower) => borrower.class_number)
    )).sort((left, right) => left - right),
    [borrowers, gradeFilter]
  )

  const filteredBorrowers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return borrowers.filter((borrower) => {
      const type = getBorrowerType(borrower)
      if (borrowerFilter !== 'all' && type !== borrowerFilter) return false
      if (type === 'student' && gradeFilter !== 'all' && borrower.grade !== Number(gradeFilter)) {
        return false
      }
      if (type === 'student' && classFilter !== 'all' && borrower.class_number !== Number(classFilter)) {
        return false
      }
      if (!normalizedQuery) return true

      return borrower.name.toLowerCase().includes(normalizedQuery)
        || borrower.student_number.toLowerCase().includes(normalizedQuery)
    })
  }, [borrowerFilter, borrowers, classFilter, gradeFilter, query])

  const selectedBorrowers = useMemo(
    () => borrowers.filter((borrower) => selectedIds.has(borrower.id)),
    [borrowers, selectedIds]
  )
  const areAllFilteredSelected = filteredBorrowers.length > 0
    && filteredBorrowers.every((borrower) => selectedIds.has(borrower.id))

  function setFilter(filter: BorrowerFilter) {
    setBorrowerFilter(filter)
    if (filter === 'staff') {
      setGradeFilter('all')
      setClassFilter('all')
    }
  }

  function toggleBorrower(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleFilteredBorrowers() {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const borrower of filteredBorrowers) {
        if (areAllFilteredSelected) next.delete(borrower.id)
        else next.add(borrower.id)
      }
      return next
    })
  }

  return (
    <section className="bg-gray-50 py-12 print:bg-white print:py-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 print:hidden">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">이용자 바코드</h1>
              <p className="mt-1 text-sm text-gray-600">학생 {borrowers.filter((item) => getBorrowerType(item) === 'student').length}명 · 교직원 {borrowers.filter((item) => getBorrowerType(item) === 'staff').length}명</p>
            </div>
          </div>

          <button
            className="inline-flex h-10 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            disabled={selectedBorrowers.length === 0}
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="h-4 w-4" />
            선택 인쇄 ({selectedBorrowers.length})
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex h-10 w-fit rounded-md border border-gray-200 bg-white p-1">
            {([
              ['all', '전체'],
              ['student', '학생'],
              ['staff', '교직원'],
            ] as const).map(([value, label]) => (
              <button
                className={`h-8 shrink-0 whitespace-nowrap rounded px-3 text-sm font-medium transition-colors ${borrowerFilter === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-0 flex-1 xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              aria-label="번호 또는 이름 검색"
              className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="번호 또는 이름 검색"
              type="text"
              value={query}
            />
          </div>

          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400"
            disabled={borrowerFilter === 'staff'}
            onChange={(event) => {
              setGradeFilter(event.target.value)
              setClassFilter('all')
            }}
            value={gradeFilter}
          >
            <option value="all">전체 학년</option>
            {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
          </select>

          <select
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-400"
            disabled={borrowerFilter === 'staff'}
            onChange={(event) => setClassFilter(event.target.value)}
            value={classFilter}
          >
            <option value="all">전체 반</option>
            {classOptions.map((classNumber) => <option key={classNumber} value={classNumber}>{classNumber}반</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input
                aria-label="현재 목록 전체 선택"
                checked={areAllFilteredSelected}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                onChange={toggleFilteredBorrowers}
                type="checkbox"
              />
              현재 목록 전체 선택
            </label>
            <span className="text-xs text-gray-500">{filteredBorrowers.length}명</span>
          </div>

          <div className="max-h-[58vh] overflow-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-12 px-4 py-3" />
                  <th className="px-4 py-3">번호</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3">소속</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredBorrowers.map((borrower) => {
                  const type = getBorrowerType(borrower)
                  return (
                    <tr className="hover:bg-gray-50" key={borrower.id}>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`${borrower.name} ${borrower.student_number} 선택`}
                          checked={selectedIds.has(borrower.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                          onChange={() => toggleBorrower(borrower.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{borrower.student_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{borrower.name}</td>
                      <td className="px-4 py-3">{type === 'staff' ? '교직원' : '학생'}</td>
                      <td className="px-4 py-3">{getBorrowerDescription(borrower)}</td>
                    </tr>
                  )
                })}
                {filteredBorrowers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={5}>
                      <Users className="mx-auto mb-2 h-5 w-5" />
                      표시할 이용자가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="borrower-barcode-sheet hidden print:grid">
        {selectedBorrowers.map((borrower) => <BarcodeLabel borrower={borrower} key={borrower.id} />)}
      </div>

      <style jsx global>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
          .borrower-barcode-sheet {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4mm;
          }
          .borrower-barcode-label {
            height: 28mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </section>
  )
}
