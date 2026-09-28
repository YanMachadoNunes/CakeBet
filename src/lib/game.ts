// Motor do jogo — TypeScript puro, sem React.
// Resolve uma rodada inteira de uma vez e devolve os "passos" para a UI animar.

export const COLS = 7;
export const ROWS = 7;
export const MIN_CLUSTER = 5;
export const MAX_MULT = 1024;
export const BUY_COST = 100; // compra de rodadas grátis = 100x a aposta
export const MAX_WIN = 5000; // teto de ganho por rodada/bônus, em x da aposta

export type Sym =
  | "heart"
  | "candy"
  | "star"
  | "bean"
  | "orangeBear"
  | "purpleBear"
  | "redBear"
  | "scatter";

export const REGULAR: Exclude<Sym, "scatter">[] = [
  "heart",
  "candy",
  "star",
  "bean",
  "orangeBear",
  "purpleBear",
  "redBear",
];

// Peso de cada símbolo no sorteio (quanto maior, mais comum).
const WEIGHTS: Record<Sym, number> = {
  heart: 6,
  candy: 8,
  star: 10,
  bean: 12,
  orangeBear: 16,
  purpleBear: 21,
  redBear: 27,
  scatter: 0, // definido abaixo, muda no bônus
};

// No bônus os símbolos baratos dominam: mais cascatas = multiplicadores maiores.
const BONUS_WEIGHTS: Record<Sym, number> = {
  heart: 6,
  candy: 8,
  star: 10,
  bean: 12,
  orangeBear: 16,
  purpleBear: 22,
  redBear: 32,
  scatter: 0,
};

// Scatter mais raro dentro do bônus, senão os retriggers explodem o RTP.
const SCATTER_WEIGHT = { base: 0.62, bonus: 0.45 };

// Fator global da tabela — calibrado com `bun run sim` para RTP ~96%.
const PAY_SCALE = 1;

// Tabela de pagamento: multiplicador da aposta por tamanho do cluster.
// Índices: 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15+
export const PAYTABLE: Record<Exclude<Sym, "scatter">, number[]> = {
  heart:      [1.0, 1.5, 2.0, 3.0, 5.0, 8.0, 12, 20, 30, 50, 150],
  candy:      [0.8, 1.2, 1.5, 2.5, 4.0, 6.0, 10, 15, 25, 40, 100],
  star:       [0.6, 0.8, 1.0, 1.5, 2.5, 4.0, 7, 10, 15, 25, 60],
  bean:       [0.4, 0.6, 0.8, 1.2, 2.0, 3.0, 5, 8, 12, 20, 50],
  orangeBear: [0.3, 0.4, 0.6, 0.9, 1.5, 2.5, 4, 6, 10, 15, 40],
  purpleBear: [0.25, 0.35, 0.5, 0.75, 1.2, 2.0, 3, 5, 8, 12, 30],
  redBear:    [0.2, 0.3, 0.4, 0.6, 1.0, 1.5, 2.5, 4, 6, 10, 25],
};

export function payFor(sym: Exclude<Sym, "scatter">, size: number) {
  const idx = Math.min(size, 15) - MIN_CLUSTER;
  return idx < 0 ? 0 : round2(PAYTABLE[sym][idx] * PAY_SCALE);
}

// Scatters -> quantidade de rodadas grátis
export const FREE_SPINS_BY_SCATTER: Record<number, number> = {
  3: 10,
  4: 12,
  5: 15,
  6: 20,
  7: 30,
};
export function freeSpinsFor(scatters: number) {
  if (scatters < 3) return 0;
  return FREE_SPINS_BY_SCATTER[Math.min(scatters, 7)];
}

export type Cell = { id: number; sym: Sym };
export type Grid = Cell[][]; // grid[col][row], row 0 = topo
export type Marks = number[][]; // 0 = nada, 1 = marcado, >=2 = multiplicador
export type Pos = [col: number, row: number];

export type Cluster = {
  sym: Exclude<Sym, "scatter">;
  cells: Pos[];
  base: number; // multiplicador da tabela
  mult: number; // soma dos multiplicadores das posições (1 se nenhum)
  win: number; // valor em R$
};

export type Step = {
  grid: Grid;
  clusters: Cluster[]; // vitórias nesta grade (vazio = fim da cascata)
  marksAfter: Marks; // marcas depois de explodir as vitórias
  stepWin: number;
};

export type SpinResult = {
  steps: Step[];
  totalWin: number;
  scatters: number;
  marks: Marks;
};

let nextId = 1;
const newCell = (sym: Sym): Cell => ({ id: nextId++, sym });

// Tabela de sorteio pré-calculada (pesos acumulados). Antes, cada sorteio
// recriava um objeto com Object.entries — 49+ alocações por grade.
type Reel = { syms: Sym[]; cum: number[]; total: number };

function makeReel(weights: Record<Sym, number>, scatterW: number): Reel {
  const syms = Object.keys(weights) as Sym[];
  const cum: number[] = [];
  let acc = 0;
  for (const s of syms) {
    acc += s === "scatter" ? scatterW : weights[s];
    cum.push(acc);
  }
  return { syms, cum, total: acc };
}

const REELS = {
  base: makeReel(WEIGHTS, SCATTER_WEIGHT.base),
  bonus: makeReel(BONUS_WEIGHTS, SCATTER_WEIGHT.bonus),
  buy: makeReel(WEIGHTS, 0), // grade da compra: scatters são colocados à mão
};

function pick(rng: () => number, reel: Reel): Sym {
  const r = rng() * reel.total;
  const { cum, syms } = reel;
  for (let i = 0; i < cum.length; i++) if (r < cum[i]) return syms[i];
  return syms[syms.length - 1];
}

export function emptyMarks(): Marks {
  return Array.from({ length: COLS }, () => Array(ROWS).fill(0));
}

function randomGrid(rng: () => number, reel: Reel, forceScatters = 0): Grid {
  const grid: Grid = Array.from({ length: COLS }, () =>
    Array.from({ length: ROWS }, () => newCell(pick(rng, reel))),
  );
  // Compra de bônus: coloca N scatters em colunas diferentes
  if (forceScatters > 0) {
    // Fisher-Yates: embaralhamento justo e com nº fixo de sorteios.
    // (sort com comparador aleatório é viciado e muda entre motores JS,
    // o que quebrava as seeds do demo entre Bun e navegador)
    const cols = [...Array(COLS).keys()];
    for (let i = cols.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    for (let i = 0; i < forceScatters; i++) {
      const row = Math.floor(rng() * ROWS);
      grid[cols[i]][row] = newCell("scatter");
    }
  }
  return grid;
}

// Flood fill: acha grupos de 5+ símbolos iguais conectados na horizontal/vertical.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function findClusters(grid: Grid, marks: Marks, bet: number): Cluster[] {
  const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  const clusters: Cluster[] = [];

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = grid[c][r].sym;
      if (seen[c][r] || sym === "scatter") continue;

      const cells: Pos[] = [];
      const stack: Pos[] = [[c, r]];
      seen[c][r] = true;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (seen[nx][ny] || grid[nx][ny].sym !== sym) continue;
          seen[nx][ny] = true;
          stack.push([nx, ny]);
        }
      }

      if (cells.length >= MIN_CLUSTER) {
        const s = sym as Exclude<Sym, "scatter">;
        const multSum = cells.reduce(
          (a, [x, y]) => a + (marks[x][y] >= 2 ? marks[x][y] : 0),
          0,
        );
        const mult = multSum || 1;
        const base = payFor(s, cells.length);
        clusters.push({ sym: s, cells, base, mult, win: round2(base * bet * mult) });
      }
    }
  }
  return clusters;
}

// Posição que explode: 0 -> marcada; marcada -> x2; x2 -> x4 ... até x1024
function bumpMarks(marks: Marks, clusters: Cluster[]): Marks {
  const next = marks.map((col) => [...col]);
  for (const cl of clusters) {
    for (const [c, r] of cl.cells) {
      const m = next[c][r];
      next[c][r] = m === 0 ? 1 : m === 1 ? 2 : Math.min(m * 2, MAX_MULT);
    }
  }
  return next;
}

// Remove as células vencedoras, faz o resto cair e completa por cima.
function tumble(grid: Grid, clusters: Cluster[], rng: () => number, reel: Reel): Grid {
  const dead = Array.from({ length: COLS }, () => Array<boolean>(ROWS).fill(false));
  for (const cl of clusters) for (const [c, r] of cl.cells) dead[c][r] = true;
  return grid.map((col, c) => {
    const kept = col.filter((_, r) => !dead[c][r]);
    const fresh = Array.from({ length: ROWS - kept.length }, () =>
      newCell(pick(rng, reel)),
    );
    return [...fresh, ...kept];
  });
}

export function resolveSpin(opts: {
  bet: number;
  marks: Marks;
  rng?: () => number;
  inBonus?: boolean;
  forceScatters?: number;
}): SpinResult {
  const rng = opts.rng ?? Math.random;
  // Na compra de bônus, a grade forçada não recebe scatters extras
  const reel = opts.forceScatters ? REELS.buy : opts.inBonus ? REELS.bonus : REELS.base;
  let marks = opts.marks;
  let grid = randomGrid(rng, reel, opts.forceScatters ?? 0);
  const steps: Step[] = [];
  let totalWin = 0;

  // Limite de segurança contra cascata infinita
  for (let i = 0; i < 100; i++) {
    const clusters = findClusters(grid, marks, opts.bet);
    const stepWin = round2(clusters.reduce((a, cl) => a + cl.win, 0));
    const marksAfter = clusters.length ? bumpMarks(marks, clusters) : marks;
    steps.push({ grid, clusters, marksAfter, stepWin });
    if (!clusters.length) break;
    totalWin = round2(totalWin + stepWin);
    marks = marksAfter;
    grid = tumble(grid, clusters, rng, reel);
  }

  const scatters = grid.flat().filter((c) => c.sym === "scatter").length;
  return { steps, totalWin, scatters, marks };
}

// Na compra, sorteia 3–5 scatters (3 é o mais comum)
export function rollBuyScatters(rng: () => number = Math.random) {
  const x = rng();
  return x < 0.85 ? 3 : x < 0.97 ? 4 : 5;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
