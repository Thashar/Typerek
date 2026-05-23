export default function UserAvatar({ username, avatar, className = 'w-8 h-8' }) {
  const initials = (username ?? '?').slice(0, 2).toUpperCase()
  return (
    <div className={`rounded-full overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center ${className}`}>
      {avatar
        ? <img src={avatar} className="w-full h-full object-cover" alt="" />
        : <span className="text-xs font-bold text-gray-400">{initials}</span>
      }
    </div>
  )
}
