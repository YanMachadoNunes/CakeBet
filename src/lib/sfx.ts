// Efeitos sonoros sintetizados com Web Audio — nenhum arquivo de áudio.
// O AudioContext só pode nascer depois de um clique (regra dos navegadores),
// por isso é criado de forma preguiçosa no primeiro som.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = localStorage.getItem("sugar-rush:muted") === "1";
} catch {}

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

type ToneOpts = {
  type?: OscillatorType;
  vol?: number;
  slide?: number; // multiplica a frequência até o fim do som
  delay?: number;
  attack?: number;
};

function tone(freq: number, dur: number, o: ToneOpts = {}) {
  if (muted || typeof window === "undefined") return;
  const c = ac();
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.25, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

// Buffer de ruído criado uma vez e reaproveitado (antes: um novo a cada som)
let noiseBuf: AudioBuffer | null = null;
function getNoise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(dur: number, o: { vol?: number; freq?: number; q?: number; delay?: number; sweep?: number } = {}) {
  if (muted || typeof window === "undefined") return;
  const c = ac();
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.freq ?? 1200, t);
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.freq! * o.sweep, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  // Começa num ponto aleatório do buffer pra não soar sempre igual
  src.start(t, Math.random() * Math.max(0, 2 - dur), dur);
}

// Escala pentatônica maior (sempre soa "feliz", nunca desafina)
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
const note = (i: number) => PENTA[Math.min(i, PENTA.length - 1)];

let lastTick = 0;

export const sfx = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem("sugar-rush:muted", m ? "1" : "0");
    } catch {}
  },
  /** Chamar num clique pra destravar o áudio */
  unlock() {
    if (!muted) ac();
  },

  spin() {
    noise(0.35, { vol: 0.12, freq: 400, sweep: 6, q: 0.8 });
    tone(220, 0.25, { type: "triangle", vol: 0.08, slide: 2 });
  },
  land(delay = 0) {
    tone(160, 0.09, { type: "triangle", vol: 0.12, slide: 0.55, delay });
    noise(0.05, { vol: 0.05, freq: 900, delay });
  },
  scatter() {
    tone(1046.5, 0.6, { type: "triangle", vol: 0.18 });
    tone(1567.98, 0.7, { type: "sine", vol: 0.12, delay: 0.06 });
    tone(2093, 0.8, { type: "sine", vol: 0.08, delay: 0.12 });
  },
  anticipation() {
    for (let i = 0; i < 6; i++) tone(note(i + 2), 0.18, { type: "square", vol: 0.04, delay: i * 0.09 });
  },
  /** Vitória: cada cascata sobe um degrau na escala */
  win(cascade: number) {
    const base = cascade * 2;
    [0, 1, 2].forEach((k) => tone(note(base + k), 0.25, { type: "triangle", vol: 0.16, delay: k * 0.06 }));
  },
  pop(i = 0) {
    tone(500 + i * 60, 0.14, { type: "sine", vol: 0.2, slide: 2.5 });
    noise(0.12, { vol: 0.1, freq: 2500, q: 2 });
  },
  mult() {
    for (let i = 0; i < 5; i++) tone(1800 + i * 350, 0.12, { type: "sine", vol: 0.09, delay: i * 0.04 });
    tone(880, 0.3, { type: "triangle", vol: 0.12, slide: 2 });
  },
  tick() {
    const now = performance.now();
    if (now - lastTick < 60) return;
    lastTick = now;
    tone(2400 + Math.random() * 400, 0.03, { type: "square", vol: 0.035 });
  },
  combo(tier: number) {
    const start = 2 + tier;
    [0, 2, 4, 5].forEach((k, i) => tone(note(start + k), 0.35, { type: "sawtooth", vol: 0.06, delay: i * 0.08 }));
    [0, 2, 4].forEach((k) => tone(note(start + k) / 2, 0.8, { type: "triangle", vol: 0.1, delay: 0.32 }));
    noise(0.6, { vol: 0.06, freq: 6000, delay: 0.3, q: 0.5 });
  },
  fanfare() {
    const seq = [0, 2, 4, 5, 7, 9];
    seq.forEach((k, i) => tone(note(k), 0.3, { type: "sawtooth", vol: 0.06, delay: i * 0.1 }));
    [5, 7, 9].forEach((k) => tone(note(k), 1.4, { type: "triangle", vol: 0.1, delay: 0.62 }));
    [0, 2, 4].forEach((k) => tone(note(k) / 2, 1.4, { type: "sine", vol: 0.12, delay: 0.62 }));
    noise(1.2, { vol: 0.07, freq: 7000, delay: 0.6, q: 0.4 });
  },
  click() {
    tone(900, 0.05, { type: "square", vol: 0.05 });
  },
};
