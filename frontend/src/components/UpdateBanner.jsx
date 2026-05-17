import { useVersionCheck } from '../hooks/useVersionCheck'

export default function UpdateBanner() {
  const updateAvailable = useVersionCheck()
  if (!updateAvailable) return null

  return (
    <div
      onClick={() => window.location.reload()}
      className="fixed top-3 right-3 z-50 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition shadow-lg"
    >
      Nowa wersja — odśwież ↻
    </div>
  )
}
