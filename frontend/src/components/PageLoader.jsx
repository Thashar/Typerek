export default function PageLoader() {
  return (
    <>
      <style>{`
        @keyframes ballBounce {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0);
          }
          50% {
            transform: translateY(-40px) rotate(180deg);
            animation-timing-function: cubic-bezier(0.33, 1, 0.66, 1);
          }
        }
        @keyframes shadowScale {
          0%, 100% { transform: scaleX(1); opacity: 0.35; }
          50%       { transform: scaleX(0.4); opacity: 0.1; }
        }
        @keyframes dotFade {
          0%, 80%, 100% { opacity: 0.15; transform: scale(0.75); }
          40%            { opacity: 1;    transform: scale(1); }
        }
      `}</style>
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex flex-col items-center gap-2">
          <span style={{ fontSize: '2.5rem', lineHeight: 1, display: 'block', animation: 'ballBounce 0.85s infinite' }}>
            ⚽
          </span>
          <div
            className="w-7 h-1 rounded-full bg-black blur-sm"
            style={{ animation: 'shadowScale 0.85s infinite' }}
          />
        </div>
        <div className="flex gap-2">
          {[0, 0.15, 0.3].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-500"
              style={{ animation: `dotFade 1.2s ${delay}s infinite ease-in-out` }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
