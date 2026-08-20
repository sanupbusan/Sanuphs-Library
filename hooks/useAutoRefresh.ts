'use client'

import { useEffect, useRef } from 'react'

const DEFAULT_REFRESH_INTERVAL_MS = 5_000

type RefreshHandler = () => void | Promise<void>

export function useAutoRefresh(
  refresh: RefreshHandler,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS
) {
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    function runRefresh() {
      if (document.visibilityState !== 'visible') {
        return
      }

      try {
        void Promise.resolve(refreshRef.current()).catch(() => undefined)
      } catch {
        // Refresh failures are handled by the consumer that owns the data.
      }
    }

    const intervalId = window.setInterval(runRefresh, intervalMs)
    document.addEventListener('visibilitychange', runRefresh)
    window.addEventListener('focus', runRefresh)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', runRefresh)
      window.removeEventListener('focus', runRefresh)
    }
  }, [intervalMs])
}
