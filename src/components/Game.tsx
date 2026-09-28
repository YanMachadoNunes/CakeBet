"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useAnimationControls } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Candy, CandyDefs } from "./Candy";
import FxCanvas, { fx } from "./FxCanvas";
import { sfx } from "@/lib/sfx";
import Link from "next/link";
import { START_BALANCE, readBalance, writeBalance } from "@/lib/wallet";
import { CakeLogo } from "./Brand";
import {
  BUY_COST,
  COLS,
  MAX_WIN,
  REGULAR,
  ROWS,
  emptyMarks,
  freeSpinsFor,
  payFor,
  resolveSpin,
  rollBuyScatters,
  round2,
  type Cluster,
  type Grid,
  type Marks,
} from "@/lib/game";
import { DEMO_TIERS, findSeed, mulberry32, type DemoTier } from "@/lib/demo";

const BETS = [0.2, 0.4, 0.6, 0.8, 1, 2, 3, 5, 10, 20, 50, 100];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (c: number, r: number) => `${c},${r}`;

// Valor flutuando em cima de um cluster vencedor
type Popup = { id: number; x: number; y: number; baseWin: number; mult: number; win: number };

// Banners de combo: aparecem quando o ganho da rodada passa de N x a aposta
const COMBO_TIERS = [
  { x: 10, label: "SUPER!" },
  { x: 25, label: "MEGA!" },
  { x: 50, label: "INCRÍVEL!" },
  { x: 100, label: "SUGAR RUSH!" },
];

// Ponto do cluster mais perto do centro dele (em % do tabuleiro)
function clusterAnchor(cells: [number, number][]) {
  const cx = cells.reduce((a, [c]) => a + c, 0) / cells.length;
  const cy = cells.reduce((a, [, r]) => a + r, 0) / cells.length;
  const [c, r] = cells.reduce((best, p) =>
    (p[0] - cx) ** 2 + (p[1] - cy) ** 2 < (best[0] - cx) ** 2 + (best[1] - cy) ** 2 ? p : best,
  );
  return { x: ((c + 0.5) / COLS) * 100, y: ((r + 0.5) / ROWS) * 100 };
}

let popupId = 1;

// Cor da explosão de cada doce
const SYM_COLOR: Record<string, string> = {
  heart: "#ff7a1a",
  candy: "#2f8cff",
  star: "#3fd43a",
  bean: "#f040c8",
  orangeBear: "#ff9a1f",
  purpleBear: "#9b4dff",
  redBear: "#ff2d3d",
  scatter: "#ff5cc8",
};

const countScatters = (g: Grid) => g.flat().filter((c) => c.sym === "scatter").length;

type Overlay =
  | { kind: "fsWon"; spins: number; retrigger: boolean }
  | { kind: "fsEnd"; total: number; label: string }
  | { kind: "bigWin"; amount: number; label: string }
  | null;

// Grade inicial "parada": sem vitórias nem scatters suficientes pro bônus.
function idleGrid(): Grid {
  for (;;) {
    const r = resolveSpin({ bet: 1, marks: emptyMarks() });
    if (r.steps.length === 1 && r.scatters < 3) return r.steps[0].grid;
  }
}

export default function Game() {
  const [balance, setBalance] = useState(START_BALANCE);
  const [betIdx, setBetIdx] = useState(4);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [marks, setMarks] = useState<Marks>(emptyMarks);
  const [hot, setHot] = useState<Set<string>>(new Set());
  const [spinWin, setSpinWin] = useState(0);
  const [log, setLog] = useState<(Cluster & { id: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const [inBonus, setInBonus] = useState(false);
  const [fsLeft, setFsLeft] = useState(0);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [auto, setAuto] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demo, setDemo] = useState(false);
  const [exitMode, setExitMode] = useState<"fall" | "pop">("pop");
  const [stagger, setStagger] = useState(true);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [anticipation, setAnticipation] = useState(false);
  const [muted, setMuted] = useState(false);
  const shake = useAnimationControls();
  const boardRef = useRef<HTMLDivElement>(null);
  const [combo, setCombo] = useState<{ label: string; from: number; to: number; key: number } | null>(null);

  // Refs: o fluxo da rodada é assíncrono (await sleep...), então lê
  // valores daqui pra não pegar estado "velho" de closures.
  const balanceRef = useRef(balance);
  const busyRef = useRef(false);
  const marksRef = useRef<Marks>(emptyMarks());
  const turboRef = useRef(turbo);
  const overlayDone = useRef<(() => void) | null>(null);
  turboRef.current = turbo;

  const bet = BETS[betIdx];

  // Carrega saldo salvo + grade inicial (só no cliente, evita erro de hidratação)
  useEffect(() => {
    // Saldo vem da carteira do CakeBet (compartilhada entre os jogos)
    const saved = readBalance();
    balanceRef.current = saved;
    setBalance(saved);
    setGrid(idleGrid());
    setMuted(sfx.isMuted());
  }, []);

  // Centro de uma célula em coordenadas da tela (pras partículas)
  const cellPoint = (c: number, r: number) => {
    const b = boardRef.current!.getBoundingClientRect();
    return { x: b.left + ((c + 0.5) / COLS) * b.width, y: b.top + ((r + 0.5) / ROWS) * b.height };
  };
  const boardPoint = (fx01: number, fy01: number) => {
    const b = boardRef.current!.getBoundingClientRect();
    return { x: b.left + fx01 * b.width, y: b.top + fy01 * b.height };
  };

  const doShake = (power: number) =>
    shake.start({
      x: [0, -power, power, -power * 0.7, power * 0.7, -power * 0.3, 0],
      y: [0, power * 0.5, -power * 0.5, power * 0.3, -power * 0.3, 0],
      transition: { duration: 0.5 },
    });

  const changeBalance = useCallback((delta: number) => {
    const next = round2(balanceRef.current + delta);
    balanceRef.current = next;
    setBalance(next);
    writeBalance(next);
  }, []);

  const wait = (ms: number) => sleep(turboRef.current ? ms * 0.4 : ms);

  // Mostra um overlay e espera o clique ou o tempo acabar
  const showOverlay = (o: Overlay, ms: number) =>
    new Promise<void>((resolve) => {
      setOverlay(o);
      overlayFx(o);
      const done = () => {
        overlayDone.current = null;
        setOverlay(null);
        resolve();
      };
      overlayDone.current = done;
      setTimeout(() => overlayDone.current === done && done(), ms);
    });

  // Efeitos de cada tela cheia (fanfarra, confete, chuva de moedas)
  function overlayFx(o: Overlay) {
    if (!o) return;
    const cx = window.innerWidth / 2;
    const bottom = window.innerHeight;
    if (o.kind === "bigWin") {
      sfx.fanfare();
      fx.rain(2600, 6);
      doShake(10);
    } else if (o.kind === "fsWon") {
      sfx.fanfare();
      fx.confetti(cx * 0.3, bottom, 90);
      fx.confetti(cx * 1.7, bottom, 90);
    } else if (o.kind === "fsEnd") {
      const jackpot = o.label.startsWith("JACKPOT");
      sfx.fanfare();
      if (jackpot) setTimeout(() => sfx.fanfare(), 1600);
      fx.rain(jackpot ? 7000 : 3000, jackpot ? 12 : 6);
      fx.confetti(cx * 0.3, bottom, jackpot ? 160 : 70);
      fx.confetti(cx * 1.7, bottom, jackpot ? 160 : 70);
      doShake(jackpot ? 18 : 8);
    }
  }

  // Reproduz os passos de uma rodada já resolvida pelo motor
  async function playSpin(
    mode: "base" | "bonus" | "buy",
    betValue: number,
    rng: () => number = Math.random,
  ) {
    const bonus = mode === "bonus";
    const startMarks = bonus ? marksRef.current : emptyMarks();
    const res = resolveSpin({
      bet: betValue,
      marks: startMarks,
      inBonus: bonus,
      forceScatters: mode === "buy" ? rollBuyScatters(rng) : 0,
      rng,
    });

    setHot(new Set());
    setLog([]);
    setSpinWin(0);
    setAnticipation(false);
    sfx.spin();
    setExitMode("fall");
    setGrid(null);
    await wait(320);

    marksRef.current = startMarks;
    setMarks(startMarks);
    setStagger(true);

    let acc = 0;
    let comboTier = -1;
    let pendingCombo: { tier: number; from: number; to: number } | null = null;
    let scattersSeen = 0;
    const speed = turboRef.current ? 0.4 : 1;

    for (const [i, step] of res.steps.entries()) {
      setGrid(step.grid);
      // Som de "tuc" de cada coluna chegando
      if (i === 0) for (let c = 0; c < COLS; c++) sfx.land((c * 0.05 + 0.16) * speed);
      else sfx.land(0.14 * speed);
      await wait(i === 0 ? 700 : 450);
      setStagger(false);

      // Pirulito novo na tela: sino + brilho; 2 na tela = antecipação
      const sc = countScatters(step.grid);
      if (sc > scattersSeen) {
        sfx.scatter();
        step.grid.forEach((col, c) =>
          col.forEach((cell, r) => {
            if (cell.sym !== "scatter") return;
            const pt = cellPoint(c, r);
            fx.sparkle(pt.x, pt.y, 10);
          }),
        );
        if (sc === 2) sfx.anticipation();
      }
      scattersSeen = sc;
      setAnticipation(sc === 2);

      // Banner de combo aparece depois que os doces novos caíram
      if (pendingCombo) {
        const pc: { tier: number; from: number; to: number } = pendingCombo;
        pendingCombo = null;
        setCombo({ label: COMBO_TIERS[pc.tier].label, from: pc.from, to: pc.to, key: popupId++ });
        sfx.combo(pc.tier);
        doShake(6 + pc.tier * 4);
        const l = boardPoint(0.1, 1);
        const rr = boardPoint(0.9, 1);
        fx.confetti(l.x, l.y, 50 + pc.tier * 20);
        fx.confetti(rr.x, rr.y, 50 + pc.tier * 20);
        await wait(1700);
        setCombo(null);
        await wait(150);
      }

      if (!step.clusters.length) break;

      setHot(new Set(step.clusters.flatMap((cl) => cl.cells.map(([c, r]) => key(c, r)))));
      setLog((prev) => [...prev, ...step.clusters.map((cl) => ({ ...cl, id: popupId++ }))]);
      setPopups(
        step.clusters.map((cl) => ({
          id: popupId++,
          ...clusterAnchor(cl.cells),
          baseWin: round2(cl.base * betValue),
          mult: cl.mult,
          win: cl.win,
        })),
      );
      const hasMult = step.clusters.some((cl) => cl.mult > 1);
      sfx.win(i);
      if (hasMult) setTimeout(() => sfx.mult(), 450 * speed);
      const prevAcc = acc;
      acc = round2(acc + step.stepWin);
      // Com multiplicador a animação tem mais uma etapa (valor -> x mult -> total)
      await wait(hasMult ? 1500 : 900);
      setSpinWin(acc);

      // Explosão: partículas da cor de cada doce
      step.clusters.forEach((cl) =>
        cl.cells.forEach(([c, r]) => {
          const pt = cellPoint(c, r);
          fx.burst(pt.x, pt.y, SYM_COLOR[cl.sym], 10);
        }),
      );
      sfx.pop(i);
      if (step.stepWin >= 5 * betValue) doShake(4);

      // Multiplicador subiu (x2, x4...): faíscas douradas na casa
      let upgraded = false;
      step.marksAfter.forEach((col, c) =>
        col.forEach((m, r) => {
          if (m >= 2 && m > marksRef.current[c][r]) {
            upgraded = true;
            const pt = cellPoint(c, r);
            fx.sparkle(pt.x, pt.y, m >= 16 ? 24 : 12);
          }
        }),
      );
      if (upgraded) setTimeout(() => sfx.mult(), 120);

      marksRef.current = step.marksAfter;
      setMarks(step.marksAfter);
      setExitMode("pop");
      setHot(new Set());
      setPopups([]);

      // Passou de um novo patamar? Guarda o banner pra depois da cascata
      const tier = COMBO_TIERS.findLastIndex((t) => acc >= t.x * betValue);
      if (tier > comboTier) {
        comboTier = tier;
        pendingCombo = { tier, from: prevAcc, to: acc };
      }
    }
    setAnticipation(false);

    // Destaca os pirulitos se deu bônus
    if (res.scatters >= 3) {
      const last = res.steps[res.steps.length - 1].grid;
      const s = new Set<string>();
      last.forEach((col, c) => col.forEach((cell, r) => cell.sym === "scatter" && s.add(key(c, r))));
      setHot(s);
      sfx.scatter();
      s.forEach((k) => {
        const [c, r] = k.split(",").map(Number);
        const pt = cellPoint(c, r);
        fx.sparkle(pt.x, pt.y, 26);
      });
      doShake(6);
      await wait(1400);
      setHot(new Set());
    }
    return res;
  }

  async function celebrate(win: number, betValue: number) {
    const x = win / betValue;
    if (x < 15) return;
    const label = x >= 100 ? "SUGAR RUSH!" : x >= 50 ? "MEGA GANHO" : "GRANDE GANHO";
    await showOverlay({ kind: "bigWin", amount: win, label }, 3000);
  }

  // `demo` = não mexe no saldo (bônus de roteiro)
  async function runBonus(
    spins: number,
    betValue: number,
    rng: () => number = Math.random,
    demo = false,
  ) {
    await showOverlay({ kind: "fsWon", spins, retrigger: false }, 3000);
    setInBonus(true);
    setBonusTotal(0);
    marksRef.current = emptyMarks(); // marcas persistem durante o bônus todo
    const cap = MAX_WIN * betValue;
    let left = spins;
    let total = 0;

    while (left > 0) {
      left--;
      setFsLeft(left);
      const res = await playSpin("bonus", betValue, rng);
      const w = Math.min(res.totalWin, cap - total);
      total = round2(total + w);
      if (!demo) changeBalance(w);
      setBonusTotal(total);
      if (total >= cap) break;

      const extra = freeSpinsFor(res.scatters);
      if (extra) {
        left += extra;
        setFsLeft(left);
        await showOverlay({ kind: "fsWon", spins: extra, retrigger: true }, 2500);
      }
      await wait(400);
    }

    const x = total / betValue;
    const label =
      total >= cap ? "JACKPOT MÁXIMO!" : x >= 1000 ? "MEGA BÔNUS!" : x >= 100 ? "SUGAR RUSH!" : "FIM DO BÔNUS";
    await showOverlay({ kind: "fsEnd", total, label }, total >= cap ? 8000 : 4000);
    setInBonus(false);
    marksRef.current = emptyMarks();
    setMarks(emptyMarks());
  }

  async function spin(): Promise<boolean> {
    if (busyRef.current) return true;
    const betValue = BETS[betIdx];
    if (balanceRef.current < betValue) return false;

    busyRef.current = true;
    setBusy(true);
    changeBalance(-betValue);

    const res = await playSpin("base", betValue);
    const win = Math.min(res.totalWin, MAX_WIN * betValue);
    changeBalance(win);
    await celebrate(win, betValue);

    const fs = freeSpinsFor(res.scatters);
    if (fs) {
      setAuto(0); // para o automático ao entrar no bônus
      await runBonus(fs, betValue);
    }

    busyRef.current = false;
    setBusy(false);
    return true;
  }

  async function buyBonus() {
    setConfirmBuy(false);
    const betValue = BETS[betIdx];
    const cost = BUY_COST * betValue;
    if (busyRef.current || balanceRef.current < cost) return;

    busyRef.current = true;
    setBusy(true);
    setAuto(0);
    changeBalance(-cost);

    const res = await playSpin("buy", betValue);
    changeBalance(res.totalWin);
    await runBonus(freeSpinsFor(res.scatters), betValue);

    busyRef.current = false;
    setBusy(false);
  }

  // Demo: acha uma seed que dá o resultado pedido e reproduz o bônus inteiro
  async function demoBonus(tier: DemoTier) {
    setShowDemo(false);
    if (busyRef.current) return;
    const seed = findSeed(tier);
    if (seed === null) return;
    const betValue = BETS[betIdx];
    const rng = mulberry32(seed);

    busyRef.current = true;
    setBusy(true);
    setAuto(0);
    setDemo(true);

    const res = await playSpin("buy", betValue, rng);
    await runBonus(freeSpinsFor(res.scatters), betValue, rng, true);

    setDemo(false);
    busyRef.current = false;
    setBusy(false);
  }

  // Jogo automático: dispara a próxima rodada quando a atual termina
  useEffect(() => {
    if (busy || auto <= 0 || overlay) return;
    const t = setTimeout(async () => {
      setAuto((a) => a - 1);
      const ok = await spin();
      if (!ok) setAuto(0);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, auto, overlay]);

  // Teclado: espaço = girar / pular tela; Esc = fechar janela.
  // O handler fica num ref pra registrar o listener uma vez só.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (e.code === "Escape") {
      setConfirmBuy(false);
      setShowInfo(false);
      setShowDemo(false);
      return;
    }
    if (e.code !== "Space" || e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    if (e.repeat) return; // segurar espaço não dispara vários giros
    sfx.unlock();
    if (overlayDone.current) overlayDone.current();
    else if (!confirmBuy && !showInfo && !showDemo) spin();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const broke = !busy && balance < BETS[0] && !inBonus;

  // Uma máscara de bits por coluna (primitivo = memo funciona)
  const hotMasks = useMemo(() => {
    const m = Array<number>(COLS).fill(0);
    hot.forEach((k) => {
      const [c, r] = k.split(",").map(Number);
      m[c] |= 1 << r;
    });
    return m;
  }, [hot]);

  return (
    // LazyMotion + `m`: só as features de animação que usamos (sem layout/drag)
    <LazyMotion features={domAnimation} strict>
    <div className="sugar-page relative flex min-h-dvh flex-col items-center justify-center px-3 pb-4 pt-16 lg:pt-4">
      <CandyDefs />
      <BgCandies />
      <div className={`bonus-bg ${inBonus ? "opacity-100" : "opacity-0"}`} aria-hidden />
      <FxCanvas />

      {/* Voltar pro lobby */}
      <Link
        href="/"
        className={`back-btn fixed left-3 top-3 z-30 flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 ${busy ? "pointer-events-none opacity-50" : ""}`}
        aria-disabled={busy}
        title={busy ? "Espere a rodada terminar" : "Voltar ao lobby"}
      >
        <span className="text-lg">←</span>
        <CakeLogo className="h-6 w-6" />
        <span className="text-candy text-sm">
          Cake<span className="text-[#ff7ac8]">Bet</span>
        </span>
      </Link>

      {/* Só o jogo treme — os elementos fixed ficam fora do transform */}
      <m.div animate={shake} className="relative z-10 flex w-full flex-col items-center gap-3">
      {/* No mobile esta div vira "contents": os filhos entram na ordem do wrapper (tabuleiro → controles → painéis) */}
      <div className="contents lg:flex lg:w-full lg:max-w-6xl lg:flex-row lg:items-start lg:justify-center lg:gap-3">
        {/* Logo (mobile em cima) */}
        <Logo className="lg:hidden" />

        {/* Painel esquerdo */}
        <aside className="order-4 flex w-full max-w-[560px] flex-row flex-wrap gap-3 lg:order-none lg:w-44 lg:flex-col lg:flex-nowrap">
          <button
            onClick={() => setConfirmBuy(true)}
            disabled={busy || inBonus || balance < BUY_COST * bet}
            className="buy-btn flex-1 rounded-2xl p-3 text-center text-white disabled:opacity-50 lg:flex-none"
          >
            <div className="text-candy text-base leading-tight lg:text-lg">
              COMPRAR
              <br />
              RODADAS
              <br />
              GRÁTIS
            </div>
            <div className="mt-2 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-2 py-1 text-candy text-sm text-white shadow-inner lg:text-base">
              {brl(BUY_COST * bet)}
            </div>
          </button>

          <div className="panel flex-1 rounded-2xl p-2 lg:flex-none">
            <div className="mb-1 text-center text-candy text-xs text-fuchsia-700">GANHOS</div>
            <div className="flex min-h-24 flex-col gap-1">
              {log.length === 0 && (
                <div className="py-6 text-center text-xs text-fuchsia-400">—</div>
              )}
              {log.slice(-6).map((cl) => (
                <m.div
                  key={cl.id}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-center gap-1 rounded-lg bg-fuchsia-600/90 px-2 py-0.5 text-xs font-bold text-white"
                >
                  <span className="w-5 text-right">{cl.cells.length}</span>
                  <span className="h-5 w-5">
                    <Candy sym={cl.sym} />
                  </span>
                  {cl.mult > 1 && <span className="text-amber-300">x{cl.mult}</span>}
                  <span className="ml-auto">{brl(cl.win)}</span>
                </m.div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowDemo(true)}
            disabled={busy}
            className="demo-btn basis-full rounded-2xl px-3 py-2 text-candy text-sm text-white disabled:opacity-50"
          >
            🎬 VER BÔNUS (DEMO)
          </button>
        </aside>

        {/* Tabuleiro */}
        <main
          className={`board-frame order-1 lg:order-none relative w-full max-w-[560px] rounded-3xl p-2 sm:p-3 ${inBonus ? "bonus-frame" : ""} ${anticipation ? "anticipation" : ""}`}
        >
          <div
            ref={boardRef}
            className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100/80 to-pink-100/80"
          >
            <MarksLayer marks={marks} />

            {/* Colunas com os doces (memo: só re-renderiza a coluna que mudou) */}
            <div className="absolute inset-0 grid grid-cols-7">
              {Array.from({ length: COLS }).map((_, c) => (
                <CandyColumn
                  key={c}
                  col={c}
                  cells={grid?.[c]}
                  hotMask={hotMasks[c]}
                  exitMode={exitMode}
                  stagger={stagger}
                />
              ))}
            </div>

            {/* Valores flutuando em cima dos clusters */}
            <div className="pointer-events-none absolute inset-0 z-10">
              <AnimatePresence>
                {popups.map((p) => (
                  <WinPopup key={p.id} popup={p} speed={turbo ? 0.4 : 1} />
                ))}
              </AnimatePresence>
            </div>

            {/* Banner de combo */}
            <AnimatePresence>
              {combo && (
                <m.div
                  key={combo.key}
                  className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-fuchsia-900/25"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <m.div
                    className="text-center"
                    initial={{ scale: 0.2, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 1.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 12 }}
                  >
                    <div className="big-title text-candy text-6xl sm:text-7xl">{combo.label}</div>
                    <div className="combo-value text-candy mt-1 text-4xl sm:text-5xl">
                      <CountUp from={combo.from} to={combo.to} duration={turbo ? 0.4 : 1} />
                    </div>
                  </m.div>
                </m.div>
              )}
            </AnimatePresence>

            <MultLabels marks={marks} />
          </div>
        </main>

        {/* Painel direito */}
        <aside className="order-4 hidden w-44 flex-col items-center gap-3 lg:order-none lg:flex">
          <Logo />
          {inBonus && <BonusPanel left={fsLeft} total={bonusTotal} />}
          {demo && <DemoBadge />}
        </aside>
        {inBonus && (
          <div className="order-2 w-full max-w-[560px] lg:hidden">
            <BonusPanel left={fsLeft} total={bonusTotal} />
            {demo && <DemoBadge />}
          </div>
        )}
      </div>

      {/* Barra inferior */}
      <footer className="control-bar order-3 flex w-full max-w-[560px] flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-3 text-white sm:gap-3 sm:px-4 lg:order-none lg:max-w-6xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInfo(true)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 font-serif text-lg font-bold italic hover:bg-white/25"
            aria-label="Regras e tabela de pagamento"
          >
            i
          </button>
          <div className="text-sm leading-tight">
            <div>
              <span className="text-amber-300">CRÉDITO</span>{" "}
              <span className="font-bold">{brl(balance)}</span>
            </div>
            <div>
              <span className="text-amber-300">APOSTA</span>{" "}
              <span className="font-bold">{brl(bet)}</span>
            </div>
          </div>
        </div>

        <div className="order-first w-full text-center text-candy text-2xl sm:order-none sm:w-auto sm:text-3xl">
          {inBonus ? (
            <>
              <span className="text-amber-300">GANHO</span> <Money value={spinWin} />
            </>
          ) : spinWin > 0 ? (
            <>
              <span className="text-amber-300">PRÊMIO</span> <Money value={spinWin} />
            </>
          ) : (
            <span className="text-white/80">
              {busy ? (
                "BOA SORTE!"
              ) : (
                <>
                  <span className="sm:hidden">TOQUE PARA GIRAR</span>
                  <span className="hidden sm:inline">ESPAÇO PARA GIRAR</span>
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              sfx.setMuted(!muted);
              setMuted(!muted);
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-base"
            aria-label={muted ? "Ligar som" : "Desligar som"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => {
              sfx.click();
              setTurbo((t) => !t);
            }}
            className={`h-9 rounded-full px-3 text-xs font-bold ${turbo ? "bg-amber-400 text-fuchsia-900" : "bg-white/15"}`}
            title="Giro rápido"
          >
            ⚡<span className="hidden sm:inline"> TURBO</span>
          </button>
          <button
            onClick={() => {
              sfx.click();
              setBetIdx((i) => Math.max(0, i - 1));
            }}
            disabled={busy || betIdx === 0}
            className="round-btn"
            aria-label="Diminuir aposta"
          >
            −
          </button>
          <button
            onClick={() => {
              sfx.unlock();
              if (auto > 0) setAuto(0);
              else spin();
            }}
            disabled={(busy && auto === 0) || broke}
            className={`spin-btn grid h-16 w-16 place-items-center rounded-full ${busy ? "" : "spin-idle"}`}
            aria-label="Girar"
          >
            <m.svg
              viewBox="0 0 24 24"
              className="h-8 w-8"
              animate={{ rotate: busy ? 360 : 0 }}
              transition={busy ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
            >
              <path
                fill="currentColor"
                d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"
              />
            </m.svg>
          </button>
          <button
            onClick={() => {
              sfx.click();
              setBetIdx((i) => Math.min(BETS.length - 1, i + 1));
            }}
            disabled={busy || betIdx === BETS.length - 1}
            className="round-btn"
            aria-label="Aumentar aposta"
          >
            +
          </button>
          <button
            onClick={() => setAuto((a) => (a > 0 ? 0 : 50))}
            disabled={inBonus}
            className={`h-9 rounded-full px-3 text-xs font-bold ${auto > 0 ? "bg-fuchsia-500" : "bg-white/15"}`}
          >
            {auto > 0 ? `■ ${auto}` : "AUTO"}
          </button>
        </div>
      </footer>

      <p className="order-5 text-center text-xs text-fuchsia-900/70">
        Fan-made para estudo · créditos fictícios, sem dinheiro real ·{" "}
        {broke && (
          <button
            className="font-bold underline"
            onClick={() => changeBalance(START_BALANCE - balanceRef.current)}
          >
            recarregar créditos
          </button>
        )}
      </p>
      </m.div>

      {/* Overlays */}
      <AnimatePresence>
        {overlay && (
          <m.div
            className="fixed inset-0 z-50 grid place-items-center bg-fuchsia-950/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => overlayDone.current?.()}
          >
            <div className="sunburst" aria-hidden />
            <m.div
              initial={{ scale: 0.3, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="text-center"
            >
              {overlay.kind === "bigWin" && (
                <>
                  <div className="big-title text-candy text-5xl sm:text-7xl">{overlay.label}</div>
                  <div className="mt-4 text-candy text-4xl text-white sm:text-5xl"><CountUp from={0} to={overlay.amount} duration={2.2} tick /></div>
                </>
              )}
              {overlay.kind === "fsWon" && (
                <>
                  <div className="big-title text-candy text-4xl sm:text-6xl">
                    {overlay.retrigger ? "+ RODADAS!" : "PARABÉNS!"}
                  </div>
                  <div className="mt-4 text-candy text-2xl text-white sm:text-3xl">VOCÊ GANHOU</div>
                  <div className="big-title text-candy text-7xl sm:text-8xl">{overlay.spins}</div>
                  <div className="text-candy text-2xl text-white sm:text-3xl">RODADAS GRÁTIS</div>
                </>
              )}
              {overlay.kind === "fsEnd" && (
                <>
                  <div className="big-title text-candy text-4xl sm:text-6xl">{overlay.label}</div>
                  <div className="mt-4 text-candy text-2xl text-white">TOTAL GANHO</div>
                  <div className="big-title text-candy text-6xl sm:text-7xl">{brl(overlay.total)}</div>
                </>
              )}
              <div className="mt-6 text-sm text-white/70">clique para continuar</div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {showDemo && (
        <Modal onClose={() => setShowDemo(false)}>
          <div className="text-candy text-2xl text-fuchsia-700">VER BÔNUS (DEMO)</div>
          <p className="mt-1 text-sm text-fuchsia-900">
            Roda um bônus completo com a aposta atual ({brl(bet)}). É de graça e <b>não mexe no seu saldo</b>.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {DEMO_TIERS.map((t) => (
              <button
                key={t.id}
                onClick={() => demoBonus(t)}
                className={`rounded-2xl px-4 py-3 text-left text-white ${t.id === "max" ? "bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500" : "bg-gradient-to-r from-fuchsia-500 to-purple-600"}`}
              >
                <div className="text-candy text-lg">{t.label}</div>
                <div className="text-xs opacity-90">
                  {t.desc} · até {brl(Math.min(t.max, MAX_WIN) * bet)}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-fuchsia-500">Dica: ligue o ⚡ TURBO — o jackpot tem muitas rodadas.</p>
        </Modal>
      )}

      {confirmBuy && (
        <Modal onClose={() => setConfirmBuy(false)}>
          <div className="text-candy text-2xl text-fuchsia-700">COMPRAR RODADAS GRÁTIS?</div>
          <p className="mt-2 text-fuchsia-900">
            Custa <b>{brl(BUY_COST * bet)}</b> ({BUY_COST}x a aposta) e começa o bônus com pelo
            menos 10 rodadas grátis.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => setConfirmBuy(false)} className="rounded-full bg-fuchsia-200 px-5 py-2 font-bold text-fuchsia-800">
              Cancelar
            </button>
            <button onClick={buyBonus} className="rounded-full bg-gradient-to-b from-lime-400 to-green-600 px-5 py-2 font-bold text-white">
              Comprar
            </button>
          </div>
        </Modal>
      )}

      {showInfo && (
        <Modal onClose={() => setShowInfo(false)}>
          <div className="text-candy text-2xl text-fuchsia-700">COMO FUNCIONA</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-left text-sm text-fuchsia-900">
            <li>Grupos de <b>5+ doces iguais</b> ligados na horizontal/vertical pagam.</li>
            <li>Doces vencedores explodem e novos caem no lugar (cascata).</li>
            <li>Posição que explode fica <b>marcada</b>; explodir de novo cria <b>x2</b>, e cada nova vitória dobra até <b>x1024</b>.</li>
            <li>Multiplicadores dentro do mesmo grupo são <b>somados</b>.</li>
            <li><b>3+ pirulitos</b> = 10 a 30 rodadas grátis; no bônus os multiplicadores não somem.</li>
            <li>Ganho máximo: {MAX_WIN}x a aposta. RTP simulado ≈ 96%.</li>
          </ul>
          <div className="mt-4 text-candy text-lg text-fuchsia-700">PAGAMENTOS (aposta {brl(bet)})</div>
          <table className="mt-1 w-full text-xs text-fuchsia-900">
            <thead>
              <tr className="text-fuchsia-500">
                <th />
                {[5, 8, 10, 12, 15].map((n) => (
                  <th key={n}>{n === 15 ? "15+" : n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REGULAR.map((s) => (
                <tr key={s}>
                  <td className="h-8 w-8 py-0.5">
                    <Candy sym={s} />
                  </td>
                  {[5, 8, 10, 12, 15].map((n) => (
                    <td key={n} className="text-center font-bold">
                      {brl(payFor(s, n) * bet)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
    </LazyMotion>
  );
}

// ===== Camadas do tabuleiro (memo) =====

const MarksLayer = memo(function MarksLayer({ marks }: { marks: Marks }) {
  return (
    <div className="absolute inset-0 grid grid-cols-7 grid-rows-7">
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((_, c) => {
          const mv = marks[c][r];
          return (
            <div key={key(c, r)} className="p-[3px]">
              <div
                className={`h-full w-full rounded-lg transition-colors duration-300 ${
                  mv === 0 ? "bg-white/25" : mv === 1 ? "mark-1" : "mark-x"
                }`}
              />
            </div>
          );
        }),
      )}
    </div>
  );
});

type ExitMode = "fall" | "pop";

const cellVariants = {
  exit: (mode: ExitMode) =>
    mode === "fall"
      ? { y: `${(ROWS + 1) * 100}%`, transition: { duration: 0.3, ease: "easeIn" as const } }
      : { scale: [1.2, 0], opacity: 0, transition: { duration: 0.25 } },
};

const CandyColumn = memo(function CandyColumn({
  col,
  cells,
  hotMask,
  exitMode,
  stagger,
}: {
  col: number;
  cells: Grid[number] | undefined;
  hotMask: number;
  exitMode: ExitMode;
  stagger: boolean;
}) {
  return (
    <div className="relative h-full">
      <AnimatePresence custom={exitMode}>
        {cells?.map((cell, r) => {
          const isHot = (hotMask & (1 << r)) !== 0;
          return (
            <m.div
              key={cell.id}
              custom={exitMode}
              className="absolute left-0 top-0 w-full p-[6%]"
              style={{ height: `${100 / ROWS}%`, zIndex: isHot ? 5 : 1 }}
              initial={{ y: `${(r - ROWS - 1) * 100}%` }}
              animate={{ y: `${r * 100}%`, scale: isHot ? [1, 1.18, 1] : 1 }}
              variants={cellVariants}
              exit="exit"
              transition={{
                y: {
                  type: "spring",
                  stiffness: 420,
                  damping: 30,
                  delay: stagger ? col * 0.05 + (ROWS - r) * 0.02 : 0,
                },
                scale: isHot ? { duration: 0.45, repeat: Infinity } : { duration: 0.2 },
              }}
            >
              <div className={`h-full w-full ${isHot ? "hot" : ""}`}>
                <Candy sym={cell.sym} />
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

const MultLabels = memo(function MultLabels({ marks }: { marks: Marks }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-7">
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((_, c) => {
          const mv = marks[c][r];
          return (
            <div key={key(c, r)} className="relative">
              <AnimatePresence>
                {mv >= 2 && (
                  <m.span
                    key={mv}
                    initial={{ scale: 3, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className={`mult-label absolute bottom-0.5 right-1 text-candy text-[clamp(10px,2.6vw,17px)] ${mv >= 64 ? "mult-hot" : ""}`}
                  >
                    x{mv}
                  </m.span>
                )}
                {mv >= 2 && (
                  <m.span
                    key={`ring-${mv}`}
                    className="mult-ring absolute inset-1 rounded-lg"
                    initial={{ scale: 0.4, opacity: 1 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        }),
      )}
    </div>
  );
});

// Número subindo de `from` até `to`, formatado em R$
function CountUp({
  from,
  to,
  duration,
  tick = false,
}: {
  from: number;
  to: number;
  duration: number;
  tick?: boolean;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    // Tween próprio (easeOut cúbico) — evita puxar o animate() completo do motion
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      setValue(from + (to - from) * (1 - (1 - p) ** 3));
      if (tick && p < 1) sfx.tick();
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration, tick]);
  return <>{brl(value)}</>;
}

// Valor que "rola" do anterior até o novo e dá um pulinho
function Money({ value }: { value: number }) {
  const prev = useRef(0);
  const from = value === 0 ? 0 : prev.current;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <m.span
      key={value}
      className="inline-block"
      initial={{ scale: value ? 1.35 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 12 }}
    >
      <CountUp from={from} to={value} duration={0.6} tick={value > 0} />
    </m.span>
  );
}

// Doces grandes e desfocados flutuando no fundo
const BG_CANDIES = [
  { sym: "heart", x: 4, y: 12, s: 90, d: 7 },
  { sym: "scatter", x: 88, y: 8, s: 120, d: 9 },
  { sym: "star", x: 92, y: 55, s: 80, d: 6 },
  { sym: "purpleBear", x: 3, y: 60, s: 100, d: 8 },
  { sym: "bean", x: 45, y: 88, s: 70, d: 7.5 },
  { sym: "candy", x: 70, y: 82, s: 90, d: 10 },
  { sym: "redBear", x: 25, y: 85, s: 60, d: 6.5 },
] as const;

function BgCandies() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      {BG_CANDIES.map((b, i) => (
        <div
          key={i}
          className="bg-candy absolute"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: b.s,
            height: b.s,
            animationDuration: `${b.d}s`,
            animationDelay: `${-i * 1.3}s`,
          }}
        >
          <Candy sym={b.sym} />
        </div>
      ))}
    </div>
  );
}

// Etapas: 0 = valor base, 1 = "valor x mult", 2 = total multiplicado
function WinPopup({ popup, speed }: { popup: Popup; speed: number }) {
  const [phase, setPhase] = useState(0);
  const hasMult = popup.mult > 1;

  useEffect(() => {
    if (!hasMult) return;
    const t1 = setTimeout(() => setPhase(1), 450 * speed);
    const t2 = setTimeout(() => setPhase(2), 950 * speed);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hasMult, speed]);

  return (
    <m.div
      className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
      style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
      initial={{ scale: 0, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 400, damping: 15 }}
    >
      <AnimatePresence mode="popLayout">
        {phase < 2 ? (
          <m.div
            key="base"
            className="flex items-center gap-1"
            exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15 } }}
          >
            <span className="win-popup text-candy text-[clamp(16px,4vw,28px)]">{brl(popup.baseWin)}</span>
            {phase === 1 && (
              <m.span
                className="mult-popup text-candy text-[clamp(18px,4.5vw,32px)]"
                initial={{ scale: 3, opacity: 0, x: 30 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                x{popup.mult}
              </m.span>
            )}
          </m.div>
        ) : (
          <m.span
            key="total"
            className="win-popup win-popup-big text-candy block text-[clamp(20px,5vw,36px)]"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: [2, 0.9, 1.1, 1], opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {brl(popup.win)}
          </m.span>
        )}
      </AnimatePresence>
    </m.div>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`logo logo-bob text-candy text-center leading-[0.85] ${className}`}>
      <div className="text-5xl lg:text-6xl">Sugar</div>
      <div className="text-5xl lg:text-6xl">Rush</div>
    </div>
  );
}

function BonusPanel({ left, total }: { left: number; total: number }) {
  return (
    <div className="panel w-full rounded-2xl p-3 text-center">
      <div className="text-candy text-xs text-fuchsia-700">RODADAS GRÁTIS</div>
      <div className="text-candy text-4xl text-fuchsia-600">{left}</div>
      <div className="mt-1 text-candy text-xs text-fuchsia-700">GANHO TOTAL</div>
      <div className="text-candy text-xl text-fuchsia-600">{brl(total)}</div>
    </div>
  );
}

function DemoBadge() {
  return (
    <div className="mt-2 rounded-full bg-amber-400 px-3 py-1 text-center text-candy text-xs text-fuchsia-900">
      MODO DEMO · saldo não é alterado
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-fuchsia-950/50 p-4" onClick={onClose}>
      <div
        className="panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
