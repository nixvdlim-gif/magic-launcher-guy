// Lightweight Web Audio synth — no external files needed.
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    } catch { return null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("ludo-muted", m ? "1" : "0"); } catch {}
  }
}
export function isMuted() {
  if (typeof window !== "undefined") {
    try {
      const v = localStorage.getItem("ludo-muted");
      if (v !== null) muted = v === "1";
    } catch {}
  }
  return muted;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.18, slideTo?: number) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), c.currentTime + duration);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g); g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

function noise(duration: number, gain = 0.12, filterFreq = 2000) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = filterFreq;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start();
}

export const sfx = {
  click: () => tone(620, 0.06, "square", 0.08),
  diceRoll: () => { noise(0.35, 0.14, 1600); },
  diceLand: (val: number) => { tone(300 + val * 60, 0.12, "triangle", 0.2); },
  step: () => tone(880, 0.05, "sine", 0.12),
  tokenOut: () => { tone(520, 0.08, "triangle", 0.18); setTimeout(() => tone(780, 0.1, "triangle", 0.18), 70); },
  finish: () => { tone(660, 0.1, "triangle", 0.18); setTimeout(() => tone(880, 0.1, "triangle", 0.18), 90); setTimeout(() => tone(1175, 0.18, "triangle", 0.2), 180); },
  capture: () => { noise(0.18, 0.2, 800); setTimeout(() => tone(180, 0.18, "sawtooth", 0.22, 60), 30); },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.22), i * 140));
  },
  lose: () => {
    [440, 330, 247, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sawtooth", 0.18), i * 150));
  },
  turn: () => tone(740, 0.08, "sine", 0.14),
  miss: () => tone(220, 0.18, "sawtooth", 0.18, 110),
};