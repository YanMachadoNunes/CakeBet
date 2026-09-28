// Marca do CakeBet (compartilhada entre lobby e jogos)

// Fatia de bolo: logo do CakeBet
export function CakeLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M8 30 L56 22 L56 52 L8 58 Z" fill="#7a3b1f" />
      <path d="M8 38 L56 31 L56 36 L8 43 Z" fill="#ffe3b3" />
      <path d="M8 48 L56 42 L56 46 L8 52 Z" fill="#ffe3b3" />
      <path d="M8 30 L56 22 L56 26 C50 30 46 25 40 29 C34 33 30 27 24 31 C18 35 14 30 8 34 Z" fill="#ff7ac8" />
      <path d="M4 30 L32 8 L60 22 L56 22 L8 30 Z" fill="#ffb0de" />
      <circle cx="34" cy="10" r="6" fill="#e0103a" />
      <path d="M34 4 Q38 -2 44 2" stroke="#3a7a1a" strokeWidth="2" fill="none" />
      <circle cx="32" cy="8" r="1.8" fill="#fff" opacity="0.8" />
    </svg>
  );
}

export function Coin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#ffc21a" stroke="#c27a00" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#fff3b0" strokeWidth="1" opacity="0.8" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#a35a00">C</text>
    </svg>
  );
}
