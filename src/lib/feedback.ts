// Sound + Haptics feedback helpers (localStorage-controlled)
const SOUND_KEY = "lt_sound";
const HAPTICS_KEY = "lt_haptics";

export const isSoundEnabled = () =>
  typeof window === "undefined" ? true : localStorage.getItem(SOUND_KEY) !== "0";
export const setSoundEnabled = (v: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, v ? "1" : "0");
};
export const isHapticsEnabled = () =>
  typeof window === "undefined" ? true : localStorage.getItem(HAPTICS_KEY) !== "0";
export const setHapticsEnabled = (v: boolean) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(HAPTICS_KEY, v ? "1" : "0");
};

let _ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { _ctx = null; }
  }
  return _ctx;
};

const beep = (freq: number, duration = 0.1, type: OscillatorType = "sine", vol = 0.15) => {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
};

export const playDice = () => beep(420, 0.08, "square", 0.12);
export const playMove = () => beep(660, 0.06, "sine", 0.1);
export const playWin = () => { beep(523, 0.12); setTimeout(() => beep(659, 0.12), 120); setTimeout(() => beep(784, 0.18), 240); };
export const playLose = () => { beep(330, 0.15, "triangle"); setTimeout(() => beep(220, 0.2, "triangle"), 150); };
export const playClick = () => beep(880, 0.04, "sine", 0.08);

export const vibrate = (pattern: number | number[]) => {
  if (!isHapticsEnabled()) return;
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
};
