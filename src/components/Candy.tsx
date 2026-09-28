import { memo } from "react";
import type { Sym } from "@/lib/game";

// Doces desenhados em SVG. Cada um usa gradiente radial + brilho branco
// pra dar aquele aspecto de goma/bala translúcida.

const BEAR_COLORS = {
  orangeBear: ["#ffd27a", "#ff9a1f", "#c85a00"],
  purpleBear: ["#d9a8ff", "#9b4dff", "#5a1fb0"],
  redBear: ["#ff9a9a", "#ff2d3d", "#a8001a"],
} as const;

function Grad({ id, c }: { id: string; c: readonly string[] }) {
  return (
    <radialGradient id={id} cx="35%" cy="30%" r="75%">
      <stop offset="0%" stopColor={c[0]} />
      <stop offset="55%" stopColor={c[1]} />
      <stop offset="100%" stopColor={c[2]} />
    </radialGradient>
  );
}

// Sombra barata desenhada no próprio SVG (antes: filter drop-shadow, que o
// navegador recalcula a cada quadro enquanto os doces caem)
function Shadow() {
  return <ellipse cx="52" cy="95" rx="30" ry="4.5" fill="#5a1040" opacity="0.18" />;
}

// Todos os gradientes definidos UMA vez na página (antes cada um dos 49
// doces repetia os seus <defs>, com IDs duplicados no DOM).
export function CandyDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {Object.entries(BEAR_COLORS).map(([s, c]) => (
          <Grad key={s} id={`g-${s}`} c={c} />
        ))}
        <Grad id="g-heart" c={["#ffd08a", "#ff7a1a", "#d63a00"]} />
        <Grad id="g-star" c={["#c8ffa0", "#3fd43a", "#14801a"]} />
        <Grad id="g-bean" c={["#ffc2f2", "#f040c8", "#9a0a7a"]} />
        <Grad id="g-candy" c={["#b8e8ff", "#2f8cff", "#0a3fa8"]} />
        <radialGradient id="g-lolli" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe6fa" />
          <stop offset="60%" stopColor="#ff5cc8" />
          <stop offset="100%" stopColor="#b0107e" />
        </radialGradient>
        <clipPath id="clip-lolli">
          <circle cx="50" cy="40" r="32" />
        </clipPath>
      </defs>
    </svg>
  );
}

function Bear({ sym }: { sym: keyof typeof BEAR_COLORS }) {
  const id = `g-${sym}`;
  const c = BEAR_COLORS[sym];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <g fill={`url(#${id})`} stroke={c[2]} strokeWidth="1.5">
        <circle cx="30" cy="16" r="9" />
        <circle cx="70" cy="16" r="9" />
        <circle cx="24" cy="56" r="9" />
        <circle cx="76" cy="56" r="9" />
        <ellipse cx="34" cy="86" rx="11" ry="9" />
        <ellipse cx="66" cy="86" rx="11" ry="9" />
        <ellipse cx="50" cy="65" rx="24" ry="25" />
        <circle cx="50" cy="32" r="21" />
      </g>
      <ellipse cx="50" cy="39" rx="9" ry="6" fill={c[0]} opacity="0.7" />
      <circle cx="42" cy="29" r="3" fill="#2a0a10" opacity="0.8" />
      <circle cx="58" cy="29" r="3" fill="#2a0a10" opacity="0.8" />
      <circle cx="50" cy="36" r="2.5" fill="#2a0a10" opacity="0.8" />
      <ellipse cx="40" cy="20" rx="7" ry="4" fill="#fff" opacity="0.55" transform="rotate(-25 40 20)" />
      <ellipse cx="40" cy="55" rx="5" ry="10" fill="#fff" opacity="0.35" />
    </svg>
  );
}

function Heart() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <path
        d="M50 88 C20 66 6 50 8 32 C10 16 24 8 36 10 C44 11 48 17 50 22 C52 17 56 11 64 10 C76 8 90 16 92 32 C94 50 80 66 50 88 Z"
        fill="url(#g-heart)"
        stroke="#b83200"
        strokeWidth="2"
      />
      <ellipse cx="30" cy="28" rx="11" ry="6" fill="#fff" opacity="0.6" transform="rotate(-30 30 28)" />
    </svg>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <path
        d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z"
        fill="url(#g-star)"
        stroke="#0f6a14"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="42" cy="32" rx="8" ry="4" fill="#fff" opacity="0.6" transform="rotate(-30 42 32)" />
    </svg>
  );
}

function Bean() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <path
        d="M12 58 C4 36 22 16 44 22 C54 25 58 34 68 30 C80 25 94 34 92 52 C90 74 66 86 42 82 C26 79 16 70 12 58 Z"
        fill="url(#g-bean)"
        stroke="#8a0a6c"
        strokeWidth="2"
      />
      <ellipse cx="30" cy="36" rx="10" ry="5" fill="#fff" opacity="0.6" transform="rotate(-25 30 36)" />
    </svg>
  );
}

function WrappedCandy() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <g fill="url(#g-candy)" stroke="#0a3a90" strokeWidth="2" strokeLinejoin="round">
        <path d="M24 50 L4 30 L10 50 L4 70 Z" />
        <path d="M76 50 L96 30 L90 50 L96 70 Z" />
        <ellipse cx="50" cy="50" rx="28" ry="24" />
      </g>
      <path d="M34 34 Q50 50 34 66" stroke="#fff" strokeWidth="5" fill="none" opacity="0.5" />
      <path d="M52 28 Q68 50 52 72" stroke="#fff" strokeWidth="5" fill="none" opacity="0.5" />
      <ellipse cx="40" cy="36" rx="9" ry="4" fill="#fff" opacity="0.7" transform="rotate(-25 40 36)" />
    </svg>
  );
}

function Lollipop() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <Shadow />
      <rect x="46" y="60" width="8" height="38" rx="3" fill="#fff" stroke="#ccc" />
      <circle cx="50" cy="40" r="34" fill="url(#g-lolli)" stroke="#a00a70" strokeWidth="2.5" />
      <path
        d="M50 40 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16 a20 20 0 1 1 -20 -20 a24 24 0 1 1 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        opacity="0.75"
        clipPath="url(#clip-lolli)"
      />
      <ellipse cx="36" cy="22" rx="10" ry="5" fill="#fff" opacity="0.7" transform="rotate(-30 36 22)" />
    </svg>
  );
}

export const Candy = memo(function Candy({ sym }: { sym: Sym }) {
  switch (sym) {
    case "heart":
      return <Heart />;
    case "candy":
      return <WrappedCandy />;
    case "star":
      return <Star />;
    case "bean":
      return <Bean />;
    case "scatter":
      return <Lollipop />;
    default:
      return <Bear sym={sym} />;
  }
});
