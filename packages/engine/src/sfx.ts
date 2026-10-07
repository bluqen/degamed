/**
 * Procedural sound effects (no audio files needed). Each preset is a short synth recipe.
 * The full SFX designer arrives with the Composer; these cover the common game sounds.
 */

interface Recipe {
  wave: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume: number;
  /** Second note for arpeggio-style sounds (coin, win). */
  then?: { at: number; from: number; to: number };
  noise?: boolean;
}

const RECIPES: Record<string, Recipe> = {
  jump: { wave: 'square', from: 220, to: 520, duration: 0.14, volume: 0.12 },
  coin: { wave: 'square', from: 880, to: 880, duration: 0.18, volume: 0.1, then: { at: 0.06, from: 1320, to: 1320 } },
  stomp: { wave: 'square', from: 300, to: 80, duration: 0.15, volume: 0.15, noise: true },
  hurt: { wave: 'sawtooth', from: 400, to: 60, duration: 0.3, volume: 0.15, noise: true },
  win: { wave: 'triangle', from: 523, to: 523, duration: 0.6, volume: 0.18, then: { at: 0.15, from: 784, to: 1046 } },
  click: { wave: 'square', from: 1200, to: 900, duration: 0.05, volume: 0.06 },
};

export const SFX_NAMES = Object.keys(RECIPES);

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private context(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: string): boolean {
    const recipe = RECIPES[name];
    const ctx = recipe && this.context();
    if (!recipe || !ctx) return false;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(recipe.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + recipe.duration);
    gain.connect(ctx.destination);

    const tone = (start: number, from: number, to: number, end: number) => {
      const osc = ctx.createOscillator();
      osc.type = recipe.wave;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
      osc.connect(gain);
      osc.start(start);
      osc.stop(end);
    };

    if (recipe.then) {
      tone(t0, recipe.from, recipe.to, t0 + recipe.then.at);
      tone(t0 + recipe.then.at, recipe.then.from, recipe.then.to, t0 + recipe.duration);
    } else tone(t0, recipe.from, recipe.to, t0 + recipe.duration);

    if (recipe.noise) {
      const length = Math.floor(ctx.sampleRate * recipe.duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const ch = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.5;
      src.buffer = buffer;
      src.connect(noiseGain).connect(gain);
      src.start(t0);
    }
    return true;
  }
}
