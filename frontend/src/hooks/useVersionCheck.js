import { useEffect, useState } from 'react'

const POLL_INTERVAL = 5 * 60 * 1000

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now())
        if (!res.ok) return
        const { id } = await res.json()
        if (id !== __BUILD_ID__) setUpdateAvailable(true)
      } catch {}
    }

    check()
    const timer = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return updateAvailable
}
