"use client";

import { useEffect, useRef } from "react";

// Sistema de partículas num <canvas> fixo por cima de tudo.
// O Game chama `fx.burst(...)` etc. de qualquer lugar (API imperativa),
// sem precisar de estado React — 60fps com centenas de partículas.

type Shape = "dot" | "star" | "confetti" | "coin";
type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: Shape;
  rot: number;
  vr: number;
};

const MAX = 900;
const particles: P[] = [];
let wake: (() => void) | null = null;

const CONFETTI = ["#ff4fb8", "#ffd21a", "#3fd43a", "#2f8cff", "#9b4dff", "#ff7a1a", "#ffffff"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function add(p: Partial<P> & { x: number; y: number }) {
  if (particles.length >= MAX) return; // no limite, ignora (shift() seria O(n))
  particles.push({
    vx: 0,
    vy: 0,
    g: 0.25,
    life: 0,
    max: 60,
    size: 6,
    color: "#fff",
    shape: "dot",
    rot: rand(0, Math.PI * 2),
    vr: rand(-0.2, 0.2),
    ...p,
  });
  wake?.();
}

export const fx = {
  /** Explosão de um doce: gotas da cor dele + faíscas brancas */
  burst(x: number, y: number, color: string, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(2, 7);
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, size: rand(3, 7), color, max: rand(30, 50) });
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      add({ x, y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, g: 0.05, size: rand(5, 9), color: "#fff", shape: "star", max: 30 });
    }
  },
  /** Faíscas douradas (multiplicador) */
  sparkle(x: number, y: number, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = rand(3, 6);
      add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: 0.02,
        size: rand(5, 10),
        color: i % 3 ? "#ffd21a" : "#fff6a8",
        shape: "star",
        max: rand(35, 55),
      });
    }
  },
  /** Chuva de confete saindo de um ponto (combo) */
  confetti(x: number, y: number, n = 80) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = rand(6, 16);
      add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: 0.28,
        size: rand(6, 11),
        color: CONFETTI[i % CONFETTI.length],
        shape: "confetti",
        vr: rand(-0.3, 0.3),
        max: rand(90, 140),
      });
    }
  },
  /** Chuva de moedas e confete caindo do topo da tela */
  rain(ms = 2500, density = 6) {
    const end = performance.now() + ms;
    const drop = () => {
      if (performance.now() > end) return;
      for (let i = 0; i < density; i++) {
        const coin = Math.random() < 0.55;
        add({
          x: rand(0, window.innerWidth),
          y: -20,
          vx: rand(-1.5, 1.5),
          vy: rand(2, 6),
          g: 0.15,
          size: coin ? rand(10, 16) : rand(6, 10),
          color: coin ? "#ffc21a" : CONFETTI[Math.floor(rand(0, CONFETTI.length))],
          shape: coin ? "coin" : "confetti",
          vr: rand(-0.25, 0.25),
          max: 220,
        });
      }
      requestAnimationFrame(drop);
    };
    drop();
  },
};

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.35 : r;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export default function FxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let running = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.vy += p.g;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.life > p.max || p.y > h + 40) {
          // Remoção O(1): troca com o último e tira do fim (ordem não importa)
          particles[i] = particles[particles.length - 1];
          particles.pop();
          continue;
        }
        const t = p.life / p.max;
        ctx.save();
        ctx.globalAlpha = p.shape === "coin" || p.shape === "confetti" ? Math.min(1, (1 - t) * 3) : 1 - t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        switch (p.shape) {
          case "dot":
            ctx.beginPath();
            ctx.arc(0, 0, p.size * (1 - t * 0.5), 0, Math.PI * 2);
            ctx.fill();
            break;
          case "star": {
            // Halo translúcido no lugar de shadowBlur (que é bem caro no canvas)
            const r = p.size * (1 - t * 0.4);
            ctx.globalAlpha *= 0.35;
            drawStar(ctx, r * 1.8);
            ctx.globalAlpha /= 0.35;
            drawStar(ctx, r);
            break;
          }
          case "confetti":
            ctx.scale(1, Math.cos(p.life * 0.2));
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            break;
          case "coin": {
            // "Gira" achatando no eixo X
            ctx.scale(Math.cos(p.life * 0.15), 1);
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#c27a00";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#fff6a8";
            ctx.beginPath();
            ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
        ctx.restore();
      }
      if (particles.length) raf = requestAnimationFrame(frame);
      else running = false;
    };

    // Só roda o loop quando há partículas (economiza CPU parado)
    wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    return () => {
      wake = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />;
}
