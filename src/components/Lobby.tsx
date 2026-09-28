"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Candy, CandyDefs } from "./Candy";
import FxCanvas, { fx } from "./FxCanvas";
import { CakeLogo } from "./Brand";
import { GAMES, type Category, type GameInfo } from "@/lib/games";
import { sfx } from "@/lib/sfx";
import { DAILY_BONUS, DAY_MS, claimDailyBonus, dailyBonusWait, useWallet } from "@/lib/wallet";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// O "cardápio" da confeitaria = categorias de jogo
const MENU: { id: Category | "all"; label: string; icon: string }[] = [
  { id: "all", label: "Vitrine", icon: "🧁" },
  { id: "slots", label: "Slots", icon: "🍭" },
  { id: "crash", label: "Crash", icon: "🎂" },
  { id: "originais", label: "Originais", icon: "🍩" },
  { id: "mesa", label: "Mesa", icon: "🍒" },
];

function formatWait(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function greeting(h: number) {
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Lobby() {
  const balance = useWallet();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [wait, setWait] = useState<number | null>(null);
  const [hello, setHello] = useState("Olá");

  useEffect(() => {
    setHello(greeting(new Date().getHours()));
    const tick = () => setWait(dailyBonusWait());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const claim = (e: React.MouseEvent) => {
    sfx.unlock();
    if (!claimDailyBonus()) return;
    setWait(dailyBonusWait());
    sfx.fanfare();
    fx.rain(2200, 7);
    fx.confetti(e.clientX, e.clientY, 60);
  };

  const q = query.trim().toLowerCase();
  const visible = GAMES.filter(
    (g) => (filter === "all" || g.category === filter) && (!q || g.name.toLowerCase().includes(q)),
  );
  const live = visible.filter((g) => g.status === "live");
  const baking = visible.filter((g) => g.status === "soon");
  const featured = GAMES.find((g) => g.slug === "sugar-rush")!;

  return (
    <div className="cb-root min-h-dvh text-cream">
      <CandyDefs />
      <FxCanvas />

      {/* ===== Barra lateral (desktop) ===== */}
      <aside className="cb-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
        <div className="cb-frosting relative px-5 pb-10 pt-6">
          <Wordmark />
          <Drip className="absolute inset-x-0 -bottom-[26px] h-7 w-full" />
        </div>

        <div className="cb-scroll flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4 pt-10">
          <Comanda balance={balance} />

          <nav aria-label="Cardápio">
            <div className="cb-label mb-2 px-2">Cardápio</div>
            <ul className="flex flex-col gap-1">
              {MENU.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setFilter(item.id)}
                    aria-current={filter === item.id ? "page" : undefined}
                    className={`cb-nav-item flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-bold ${filter === item.id ? "active" : ""}`}
                  >
                    <span className="cb-nav-icon grid h-8 w-8 place-items-center rounded-xl text-lg">{item.icon}</span>
                    {item.label}
                    <span className="ml-auto text-xs font-normal opacity-60">
                      {item.id === "all" ? GAMES.length : GAMES.filter((g) => g.category === item.id).length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <Fornada wait={wait} onClaim={claim} />

          <p className="mt-auto px-2 text-[11px] leading-relaxed text-cream/40">
            Confeitaria de mentirinha: todo saldo é fictício. Nada entra, nada sai — só açúcar.
          </p>
        </div>
      </aside>

      {/* ===== Topo (mobile) ===== */}
      <header className="cb-frosting sticky top-0 z-30 lg:hidden">
        <div className="flex items-center justify-between px-4 pb-3 pt-3">
          <Wordmark small />
          <div className="cb-ticket-mini rounded-lg px-3 py-1 text-right">
            <div className="text-[9px] font-bold uppercase tracking-widest text-choco-600">Saldo</div>
            <div className="font-display text-base font-bold leading-none text-choco-800 tabular-nums">
              {balance === null ? "—" : brl(balance)}
            </div>
          </div>
        </div>
        <Drip className="absolute inset-x-0 -bottom-[18px] h-5 w-full" />
      </header>

      {/* ===== Conteúdo ===== */}
      <main className="px-4 pb-28 pt-8 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-5xl">
          {/* Saudação + busca */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-lg italic text-frosting">{hello}, formiguinha 🐜</p>
              <h1 className="font-display text-4xl font-black leading-tight sm:text-5xl">
                O que vai <span className="cb-underline">adoçar</span> hoje?
              </h1>
            </div>
            <label className="cb-search flex items-center gap-2 rounded-full px-4 py-2.5 sm:w-72">
              <span aria-hidden>🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar um doce…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-cream/40"
                aria-label="Procurar jogo"
              />
            </label>
          </div>

          {/* Vitrine em destaque */}
          {filter === "all" && !q && <Showcase game={featured} />}

          {/* Bônus diário no mobile */}
          <div className="mt-6 lg:hidden">
            <Fornada wait={wait} onClaim={claim} horizontal />
          </div>

          {/* Na vitrine */}
          {live.length > 0 && (
            <section className="mt-10">
              <SectionTitle title="Na vitrine" hint="prontos pra jogar" />
              <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {live.map((g) => (
                  <LiveCard key={g.slug} game={g} />
                ))}
              </div>
            </section>
          )}

          {/* No forno */}
          {baking.length > 0 && (
            <section className="mt-12">
              <SectionTitle title="No forno" hint="saindo em breve" />
              {/* Cozinha: parede de azulejo com os fornos em cima da bancada */}
              <div className="cb-kitchen mt-5 grid grid-cols-2 gap-x-5 gap-y-8 rounded-3xl px-4 pb-5 pt-6 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
                {baking.map((g) => (
                  <OvenCard key={g.slug} game={g} />
                ))}
              </div>
            </section>
          )}

          {visible.length === 0 && (
            <div className="mt-16 text-center">
              <div className="text-5xl">🍰</div>
              <p className="font-display mt-3 text-xl italic">Nenhum doce com esse nome… ainda.</p>
            </div>
          )}
        </div>
      </main>

      {/* ===== Navegação inferior (mobile) ===== */}
      <nav
        className="cb-bottom-nav fixed inset-x-0 bottom-0 z-30 flex justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 lg:hidden"
        aria-label="Cardápio"
      >
        {MENU.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            aria-current={filter === item.id ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-bold ${filter === item.id ? "text-frosting" : "text-cream/60"}`}
          >
            <span className={`text-xl transition-transform ${filter === item.id ? "-translate-y-0.5 scale-110" : ""}`}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- Peças da confeitaria ---------- */

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CakeBet — início">
      <CakeLogo className={small ? "h-8 w-8" : "h-11 w-11"} />
      <span className={`cb-wordmark font-display ${small ? "text-2xl" : "text-[2rem]"} leading-none`}>
        Cake<em>Bet</em>
      </span>
    </Link>
  );
}

// Cobertura escorrendo (borda de baixo da faixa rosa)
function Drip({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 28" preserveAspectRatio="none" className={`cb-drip ${className}`} aria-hidden>
      <path
        d="M0 0 H256 V6 C248 6 246 22 240 22 C234 22 234 8 226 8 C216 8 214 14 206 14 C198 14 200 6 190 6
           C180 6 180 26 172 26 C164 26 166 8 156 8 C146 8 146 16 136 16 C126 16 128 6 116 6
           C106 6 104 20 96 20 C88 20 90 8 80 8 C70 8 70 12 62 12 C54 12 56 6 46 6
           C36 6 36 24 28 24 C20 24 22 8 12 8 C6 8 4 6 0 6 Z"
        fill="var(--frosting-bottom)"
      />
    </svg>
  );
}

// Comanda de padaria com o saldo
function Comanda({ balance }: { balance: number | null }) {
  return (
    <div className="cb-ticket relative rounded-md px-4 pb-3 pt-3 text-choco-800">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-choco-600">
        <span>Comanda</span>
        <span>nº 0001</span>
      </div>
      <div className="my-2 border-t-2 border-dashed border-choco-600/25" />
      <div className="text-xs text-choco-600">Saldo na conta</div>
      <div className="font-display text-3xl font-black tabular-nums tracking-tight">
        {balance === null ? "—" : brl(balance)}
      </div>
      <div className="mt-1 text-[10px] italic text-choco-600/70">* moeda de açúcar, sem valor real</div>
    </div>
  );
}

// Bônus diário como um timer de forno
function Fornada({
  wait,
  onClaim,
  horizontal = false,
}: {
  wait: number | null;
  onClaim: (e: React.MouseEvent) => void;
  horizontal?: boolean;
}) {
  const ready = wait === 0;
  const progress = wait === null ? 0 : 1 - wait / DAY_MS;
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div
      className={`cb-oven-panel flex gap-4 rounded-3xl p-4 ${horizontal ? "items-center" : "flex-col items-center text-center"}`}
    >
      <div className={`relative h-20 w-20 shrink-0 ${ready ? "cb-ready" : ""}`}>
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,241,220,0.12)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={ready ? "#ffc21a" : "#ff7ac8"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-3xl">{ready ? "🥐" : "⏲️"}</span>
      </div>
      <div className={horizontal ? "flex-1" : "w-full"}>
        <div className="font-display text-lg font-bold">Fornada do dia</div>
        <div className="text-xs text-cream/60">
          {ready ? `${brl(DAILY_BONUS)} quentinhos te esperando` : "Uma fornada grátis a cada 24 h"}
        </div>
        <button
          onClick={onClaim}
          disabled={!ready}
          className={`cb-claim mt-3 w-full rounded-full px-4 py-2 text-sm font-black ${ready ? "ready" : ""}`}
        >
          {wait === null ? "…" : ready ? `Tirar do forno · ${brl(DAILY_BONUS)}` : `⏳ ${formatWait(wait)}`}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="font-display text-3xl font-black">{title}</h2>
      <span className="font-display text-sm italic text-cream/50">— {hint}</span>
      <span className="cb-sprinkle-line ml-2 h-2 flex-1 self-center" aria-hidden />
    </div>
  );
}

// Vitrine de vidro com o jogo em destaque
function Showcase({ game }: { game: GameInfo }) {
  return (
    <div className="relative mt-12">
    <Awning color="#ff5cc0" className="absolute -left-3 -right-3 -top-7 z-30 h-14" />
    <section className="cb-showcase relative overflow-hidden rounded-b-3xl rounded-t-lg pt-6">
      <div className="cb-glass pointer-events-none absolute inset-0 z-20" aria-hidden />

      <div className="relative z-10 grid gap-6 p-6 sm:p-10 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-center gap-4">
          <span className="font-display text-sm italic text-white/80">Especialidade da casa</span>
          <h2 className="cb-showcase-title font-display text-5xl font-black leading-[0.95] sm:text-6xl">
            Sugar
            <br />
            Rush
          </h2>
          <p className="max-w-sm text-sm text-white/85">
            Grupos de 5+ doces, cascatas que não param e casas que multiplicam até <b>x1024</b>.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/jogos/${game.slug}`}
              onClick={() => sfx.unlock()}
              className="cb-play font-display rounded-full px-7 py-3 text-lg font-black"
            >
              Provar agora →
            </Link>
            <span className="text-xs text-white/70">RTP ~96%</span>
          </div>
        </div>

        {/* Prateleira com os doces */}
        <div className="relative h-56 sm:h-64">
          <div className="absolute inset-x-0 bottom-6 flex items-end justify-center gap-1">
            <div className="cb-shelf-candy h-24 w-24 sm:h-28 sm:w-28">
              <Candy sym="redBear" />
            </div>
            <div className="cb-shelf-candy h-40 w-40 sm:h-48 sm:w-48" style={{ animationDelay: "-1s" }}>
              <Candy sym="scatter" />
            </div>
            <div className="cb-shelf-candy h-24 w-24 sm:h-28 sm:w-28" style={{ animationDelay: "-2s" }}>
              <Candy sym="heart" />
            </div>
          </div>
          <div className="cb-shelf absolute inset-x-0 bottom-0 h-6 rounded-md" />
          {/* Etiqueta de preço pendurada */}
          <div className="cb-price-tag absolute right-2 top-0 sm:right-6">
            <span className="text-[10px] uppercase tracking-widest">até</span>
            <span className="font-display text-2xl font-black leading-none">5.000x</span>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}

// Toldo listrado de confeitaria, com a barra em ondinhas
function Awning({ color, className = "" }: { color: string; className?: string }) {
  return (
    <div className={`cb-awning-wrap ${className}`} aria-hidden>
      <div className="cb-awning h-full w-full" style={{ "--a": color } as React.CSSProperties} />
    </div>
  );
}

// Suporte de bolo (prato com pezinho)
function CakeStand({ children, size }: { children: React.ReactNode; size: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`cb-stand-item ${size}`}>{children}</div>
      <div className="cb-stand-plate" />
      <div className="cb-stand-stem" />
    </div>
  );
}

// Card de jogo disponível: vitrine de confeitaria (toldo + vidro + balcão)
function LiveCard({ game }: { game: GameInfo }) {
  const isSugar = game.slug === "sugar-rush";
  return (
    <Link
      href={`/jogos/${game.slug}`}
      onClick={() => sfx.unlock()}
      className="cb-case-card group block"
      aria-label={`Jogar ${game.name}`}
      style={{ "--a": game.accent[0], "--b": game.accent[1] } as React.CSSProperties}
    >
      <div className="relative pt-5">
        <Awning color={game.accent[0]} className="absolute -left-2 -right-2 top-0 z-20 h-9" />

        <div className="cb-case">
          {/* vidro com luz quente e duas prateleiras */}
          <div className="cb-case-glass">
            <div className="cb-case-led" />
            <div className="cb-case-shelf-row top">
              {isSugar ? (
                <CakeStand size="h-16 w-16 sm:h-20 sm:w-20">
                  <Candy sym="scatter" />
                </CakeStand>
              ) : (
                <CakeStand size="h-14 w-14 text-5xl grid place-items-center">{game.icon}</CakeStand>
              )}
            </div>
            <div className="cb-case-shelf" />
            <div className="cb-case-shelf-row bottom">
              {isSugar ? (
                <>
                  <div className="cb-bob h-9 w-9 sm:h-11 sm:w-11"><Candy sym="purpleBear" /></div>
                  <div className="cb-bob h-9 w-9 sm:h-11 sm:w-11" style={{ animationDelay: "-0.8s" }}><Candy sym="heart" /></div>
                  <div className="cb-bob h-9 w-9 sm:h-11 sm:w-11" style={{ animationDelay: "-1.6s" }}><Candy sym="redBear" /></div>
                </>
              ) : (
                <span className="text-3xl">{game.icon}{game.icon}</span>
              )}
            </div>
            <div className="cb-case-shelf" />
            <div className="cb-case-reflect" />
          </div>

          {/* balcão de madeira com etiqueta */}
          <div className="cb-case-base">
            {game.tag && (
              <span className="cb-case-tag font-display">
                <small>até</small> {game.tag}
              </span>
            )}
            <span className="cb-case-play font-display">▶ Jogar</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <div>
          <div className="font-display text-xl font-black leading-tight">{game.name}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-cream/60">{game.tagline}</div>
        </div>
        <span className="cb-arrow mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm">→</span>
      </div>
    </Link>
  );
}

// Card "em breve": fogão retrô esmaltado com o doce assando na grade
function OvenCard({ game }: { game: GameInfo }) {
  return (
    <div className="cb-oven-card" aria-label={`${game.name} — em breve`}>
      <div className="cb-oven" style={{ "--enamel": game.accent[0] } as React.CSSProperties}>
        {/* Painel traseiro: botões + visor */}
        <div className="cb-oven-panel-top">
          <span className="cb-knob" style={{ "--rot": "-40deg" } as React.CSSProperties} />
          <span className="cb-knob hidden sm:block" style={{ "--rot": "25deg" } as React.CSSProperties} />
          <span className="cb-display">
            <span className="cb-display-dot" />
            EM BREVE
          </span>
          <span className="cb-knob hidden sm:block" style={{ "--rot": "70deg" } as React.CSSProperties} />
          <span className="cb-knob" style={{ "--rot": "-10deg" } as React.CSSProperties} />
        </div>

        {/* Porta */}
        <div className="cb-door">
          <div className="cb-handle" />
          <div className="cb-window">
            {/* resistência em brasa */}
            <svg className="cb-coil" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
              <polyline points="4,3 12,8 20,3 28,8 36,3 44,8 52,3 60,8 68,3 76,8 84,3 92,8 96,5" />
            </svg>
            <div className="cb-glow" />
            {/* fumacinha */}
            <span className="cb-steam" style={{ left: "38%" }} />
            <span className="cb-steam" style={{ left: "52%", animationDelay: "-0.9s" }} />
            <span className="cb-steam" style={{ left: "62%", animationDelay: "-1.7s" }} />
            <span className="cb-baking">{game.icon}</span>
            {/* grade */}
            <div className="cb-rack" />
            <div className="cb-glass-streak" />
          </div>
          <div className="cb-badge font-display">{game.name}</div>
        </div>

        {/* Rodapé com saída de ar */}
        <div className="cb-kick" />
        <span className="cb-foot left-[10%]" />
        <span className="cb-foot right-[10%]" />
      </div>
      <div className="cb-counter" />
      <p className="mt-2 line-clamp-2 px-1 text-xs text-cream/55">{game.tagline}</p>
    </div>
  );
}
