// Modo demo: bônus "de roteiro" usando RNG com seed.
// Mesma seed = mesma sequência de números = mesmo bônus, então dá pra
// achar seeds boas offline (bun scripts/find-seeds.ts) e só reproduzir.
import { MAX_WIN, emptyMarks, freeSpinsFor, resolveSpin, rollBuyScatters } from "./game";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Replica exatamente a ordem de sorteios que o Game.tsx faz na compra + bônus.
// Retorna o ganho total em "x da aposta".
export function simulateBuyBonus(seed: number) {
  const rng = mulberry32(seed);
  const buy = resolveSpin({ bet: 1, marks: emptyMarks(), forceScatters: rollBuyScatters(rng), rng });
  let marks = emptyMarks();
  let left = freeSpinsFor(buy.scatters);
  let total = 0;
  while (left > 0) {
    left--;
    const r = resolveSpin({ bet: 1, marks, inBonus: true, rng });
    marks = r.marks;
    total = Math.min(total + r.totalWin, MAX_WIN);
    if (total >= MAX_WIN) break;
    left += freeSpinsFor(r.scatters);
  }
  return buy.totalWin + total;
}

export type DemoTier = { id: string; label: string; desc: string; min: number; max: number; hint: number };

// `hint` = seed achada pelo script; se o motor mudar, findSeed procura outra a partir dela.
export const DEMO_TIERS: DemoTier[] = [
  { id: "good", label: "Bônus bom", desc: "algo entre 100x e 300x", min: 100, max: 300, hint: 9 },
  { id: "mega", label: "Mega bônus", desc: "entre 1.000x e 3.000x", min: 1000, max: 3000, hint: 492 },
  { id: "max", label: "JACKPOT 5.000x", desc: "o ganho máximo do jogo", min: MAX_WIN, max: Infinity, hint: 686 },
];

export function findSeed(tier: DemoTier, tries = 5000) {
  for (let s = tier.hint; s < tier.hint + tries; s++) {
    const x = simulateBuyBonus(s);
    if (x >= tier.min && x <= tier.max) return s;
  }
  return null;
}
