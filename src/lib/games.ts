// Catálogo do CakeBet. Pra lançar um jogo novo: crie a rota em
// src/app/jogos/<slug>/page.tsx e mude o status dele para "live".

export type Category = "slots" | "crash" | "originais" | "mesa";

export type GameInfo = {
  slug: string;
  name: string;
  category: Category;
  status: "live" | "soon";
  tagline: string;
  /** Gradiente do card [de, até] */
  accent: [string, string];
  icon: string;
  tag?: string; // selo no card (ex.: "5.000x", "NOVO")
};

export const CATEGORIES: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "slots", label: "Slots" },
  { id: "crash", label: "Crash" },
  { id: "originais", label: "Originais" },
  { id: "mesa", label: "Mesa" },
];

export const GAMES: GameInfo[] = [
  {
    slug: "sugar-rush",
    name: "Sugar Rush",
    category: "slots",
    status: "live",
    tagline: "Clusters, cascatas e multiplicadores até x1024",
    accent: ["#ff5cc8", "#9b4dff"],
    icon: "🍭",
    tag: "5.000x",
  },
  {
    slug: "cake-crash",
    name: "Cake Crash",
    category: "crash",
    status: "soon",
    tagline: "O bolo cresce… saia antes dele desabar",
    accent: ["#ffb347", "#e0450f"],
    icon: "🎂",
  },
  {
    slug: "donut-mines",
    name: "Donut Mines",
    category: "originais",
    status: "soon",
    tagline: "Ache os donuts e fuja das bombas",
    accent: ["#5fe08a", "#12804a"],
    icon: "🍩",
  },
  {
    slug: "cupcake-plinko",
    name: "Cupcake Plinko",
    category: "originais",
    status: "soon",
    tagline: "Solte o confeito e torça pelo multiplicador",
    accent: ["#6fc8ff", "#2f5bd6"],
    icon: "🧁",
  },
  {
    slug: "roleta-doce",
    name: "Roleta Doce",
    category: "mesa",
    status: "soon",
    tagline: "Vermelho, preto… ou morango?",
    accent: ["#ff6b6b", "#8a0f2a"],
    icon: "🍒",
  },
  {
    slug: "blackjack-cream",
    name: "Blackjack Cream",
    category: "mesa",
    status: "soon",
    tagline: "21 com cobertura de chantilly",
    accent: ["#c9a26b", "#5a3620"],
    icon: "🃏",
  },
];
