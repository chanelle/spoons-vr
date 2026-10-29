// Tiny synthesized sound kit. No audio files.
let ctx = null;
export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'sine', gain = 0.15, slide = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  pick: () => tone(1800, 0.08, { gain: 0.05 }),
  clink: () => { tone(2600, 0.25, { gain: 0.09 }); tone(3900, 0.18, { gain: 0.05, delay: 0.01 }); },
  done: () => { tone(660, 0.3, { gain: 0.1 }); tone(990, 0.4, { gain: 0.08, delay: 0.09 }); },
  defer: () => tone(300, 0.25, { type: 'triangle', gain: 0.1, slide: -80 }),
  drop: () => tone(220, 0.4, { type: 'triangle', gain: 0.1, slide: -120 }),
  missed: () => tone(150, 0.6, { type: 'sawtooth', gain: 0.04, slide: -40 }),
  flare: () => { tone(90, 0.9, { type: 'sawtooth', gain: 0.07 }); tone(1400, 0.5, { gain: 0.03, slide: -900 }); },
  rest: () => tone(440, 0.9, { gain: 0.06, slide: 220 }),
  borrow: () => { tone(520, 0.2, { gain: 0.07 }); tone(390, 0.3, { gain: 0.06, delay: 0.12 }); },
  reject: () => tone(180, 0.15, { type: 'square', gain: 0.04 }),
};
