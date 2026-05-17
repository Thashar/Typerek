import { useVersionCheck } from '../hooks/useVersionCheck'

export default function UpdateBanner() {
  const updateAvailable = useVersionCheck()
  if (!updateAvailable) return null

  return (
    <div
      onClick={() => window.location.reload()}
      className="fixed top-0 left-0 right-0 z-50 bg-brand-600 text-white text-sm font-semibold text-center py-3 cursor-pointer hover:bg-brand-700 transition shadow-lg"
    >
      Dostępna nowa wersja — kliknij, aby odświeżyć ↻
    </div>
  )
}
