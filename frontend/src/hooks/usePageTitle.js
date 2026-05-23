import { useEffect } from 'react'

const BASE = 'TypeRek'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} – ${BASE}` : BASE
    return () => { document.title = BASE }
  }, [title])
}
