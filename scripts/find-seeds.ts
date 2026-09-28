// Procura seeds para cada nível do modo demo. Uso: bun scripts/find-seeds.ts
import { DEMO_TIERS, simulateBuyBonus } from "../src/lib/demo";

for (const tier of DEMO_TIERS) {
  const t0 = performance.now();
  for (let s = 1; s < 200_000; s++) {
    const x = simulateBuyBonus(s);
    if (x >= tier.min && x <= tier.max) {
      console.log(`${tier.id}: seed ${s} -> ${x.toFixed(2)}x (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
      break;
    }
  }
}
