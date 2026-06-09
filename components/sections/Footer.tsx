'use client'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center">
            <img src="/logo.png" alt="SanupHs Library" className="h-6 w-auto" />
          </div>

          <p className="text-sm text-gray-500">
            © 2026 IT contents. All rights reserved.
          </p>


        </div>
      </div>
    </footer>
  )
}
