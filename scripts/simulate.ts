// Roda N rodadas e mede o RTP (retorno ao jogador). Uso: bun run sim [N]
import { resolveSpin, emptyMarks, freeSpinsFor, MAX_WIN } from "../src/lib/game";

const N = Number(process.argv[2] ?? 200_000);
const bet = 1;
let wagered = 0;
let won = 0;
let baseWon = 0;
let bonusWon = 0;
let bonuses = 0;
let maxWin = 0;

function playBonus(spins: number) {
  let marks = emptyMarks();
  let total = 0;
  while (spins > 0) {
    spins--;
    const r = resolveSpin({ bet, marks, inBonus: true });
    marks = r.marks; // no bônus as marcas persistem
    total += r.totalWin;
    spins += freeSpinsFor(r.scatters);
  }
  return Math.min(total, MAX_WIN * bet);
}

for (let i = 0; i < N; i++) {
  wagered += bet;
  const r = resolveSpin({ bet, marks: emptyMarks() });
  let spinWin = r.totalWin;
  baseWon += r.totalWin;
  const fs = freeSpinsFor(r.scatters);
  if (fs) {
    bonuses++;
    const b = playBonus(fs);
    bonusWon += b;
    spinWin += b;
  }
  spinWin = Math.min(spinWin, MAX_WIN * bet);
  won += spinWin;
  maxWin = Math.max(maxWin, spinWin);
}

// Compra de bônus (100x)
let buyWon = 0;
const BUYS = Number(process.argv[3] ?? Math.max(200, Math.floor(N / 500)));
for (let i = 0; i < BUYS; i++) {
  const r = resolveSpin({ bet, marks: emptyMarks(), forceScatters: 3 });
  buyWon += r.totalWin + playBonus(freeSpinsFor(r.scatters));
}

const pct = (x: number) => (x * 100).toFixed(2) + "%";
console.log(`rodadas: ${N}`);
console.log(`RTP total:  ${pct(won / wagered)}`);
console.log(`  base:     ${pct(baseWon / wagered)}`);
console.log(`  bônus:    ${pct(bonusWon / wagered)}`);
console.log(`bônus a cada ~${(N / Math.max(bonuses, 1)).toFixed(0)} rodadas`);
console.log(`maior prêmio: ${maxWin.toFixed(2)}x`);
console.log(`RTP compra (100x): ${pct(buyWon / (BUYS * 100))}`);
