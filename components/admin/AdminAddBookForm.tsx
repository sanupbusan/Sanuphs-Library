'use client'

import { BookPlus } from 'lucide-react'
import { useAdminAddBookForm } from '@/components/admin/useAdminAddBookForm'
import { ScanInput } from '@/components/ui/ScanInput'
import { StatusMessage } from '@/components/ui/StatusMessage'
import { WorkflowStepCard } from '@/components/ui/WorkflowStepCard'
import type { AdminBookRow } from '@/types/library'

type AdminAddBookFormProps = {
  onBookCreated?: (book: AdminBookRow) => void
}

export default function AdminAddBookForm({ onBookCreated }: AdminAddBookFormProps) {
  const {
    activeStep,
    errorMessage,
    form,
    handleIsbnEnter,
    handleScanCompositionEnd,
    handleScanCompositionStart,
    handleSchoolBookCodeEnter,
    infoMessage,
    isLookingUpIsbn,
    isSubmitting,
    isbnInputRef,
    schoolBookCodeInputRef,
    successMessage,
    updateField,
  } = useAdminAddBookForm({ onBookCreated })

  return (
    <section className="bg-gray-50 py-14 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <BookPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">새 책 추가</h1>
            <p className="mt-1 text-sm text-gray-600">ISBN 바코드로 책 정보를 찾고, 학교 내 도서 코드를 등록합니다.</p>
          </div>
        </div>

        <div className="space-y-4">
          <WorkflowStepCard
            step={1}
            title="ISBN 스캔"
            description="책 뒷면의 ISBN 바코드를 스캔하면 도서 정보를 자동으로 불러옵니다."
            state={activeStep === 'isbn' ? 'current' : 'complete'}
          >
            <ScanInput
              ref={isbnInputRef}
              id="isbn"
              label="ISBN 코드"
              value={form.isbn}
              onChangeValue={(value) => updateField('isbn', value)}
              onCompositionStart={() => handleScanCompositionStart('isbn')}
              onCompositionEnd={(value) => handleScanCompositionEnd('isbn', value)}
              onEnter={handleIsbnEnter}
              loading={isLookingUpIsbn}
              disabled={isSubmitting}
              placeholder="ISBN 바코드 스캔"
              helperText="바코드를 스캔하면 조회가 진행됩니다."
            />
          </WorkflowStepCard>

          <WorkflowStepCard
            step={2}
            title="도서 정보 확인"
            description="자동으로 불러온 정보를 확인하고 필요한 부분만 수정해주세요."
            state={activeStep === 'info' ? 'current' : activeStep === 'isbn' ? 'locked' : 'complete'}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="book-title" className="mb-2 block text-sm font-medium text-gray-700">
                  책 이름
                </label>
                <input
                  id="book-title"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  disabled={activeStep === 'isbn' || isSubmitting}
                  className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="책 이름"
                  type="text"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="author" className="mb-2 block text-sm font-medium text-gray-700">
                    저자
                  </label>
                  <input
                    id="author"
                    value={form.author}
                    onChange={(event) => updateField('author', event.target.value)}
                    disabled={activeStep === 'isbn' || isSubmitting}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="저자"
                    type="text"
                  />
                </div>

                <div>
                  <label htmlFor="publisher" className="mb-2 block text-sm font-medium text-gray-700">
                    출판사
                  </label>
                  <input
                    id="publisher"
                    value={form.publisher}
                    onChange={(event) => updateField('publisher', event.target.value)}
                    disabled={activeStep === 'isbn' || isSubmitting}
                    className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="출판사"
                    type="text"
                  />
                </div>
              </div>

            </div>
          </WorkflowStepCard>

          <WorkflowStepCard
            step={3}
            title="학교 내 도서 코드 등록"
            description="학교에서 부착한 도서 코드 바코드를 스캔하면 등록이 완료됩니다."
            state={activeStep === 'code' ? 'current' : 'locked'}
          >
            <ScanInput
              ref={schoolBookCodeInputRef}
              id="school-book-code"
              label="학교 내 도서 코드"
              value={form.schoolBookCode}
              onChangeValue={(value) => updateField('schoolBookCode', value)}
              onCompositionStart={() => handleScanCompositionStart('schoolBookCode')}
              onCompositionEnd={(value) => handleScanCompositionEnd('schoolBookCode', value)}
              onEnter={handleSchoolBookCodeEnter}
              disabled={activeStep !== 'code' || isSubmitting}
              loading={isSubmitting}
              placeholder="학교 바코드 스캔"
            />
          </WorkflowStepCard>
        </div>

        {errorMessage ? (
          <div className="mt-4">
            <StatusMessage variant="error">{errorMessage}</StatusMessage>
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mt-4">
            <StatusMessage variant="info">{infoMessage}</StatusMessage>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4">
            <StatusMessage variant="success">{successMessage}</StatusMessage>
          </div>
        ) : null}
      </div>
    </section>
  )
}
