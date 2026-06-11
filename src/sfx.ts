/**
 * 极简程序化音效：用 WebAudio 振荡器与噪声缓冲现场合成，零音频资源。
 */
class Sfx {
  private ctx: AudioContext | null = null;

  private get audio(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, endFreq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const ctx = this.audio;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** 低通噪声爆破 */
  private noise(dur: number, cutoff: number, vol: number) {
    const ctx = this.audio;
    if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  /** 在用户手势内调用，提前创建并恢复 AudioContext（移动端浏览器要求） */
  unlock() {
    void this.audio;
  }

  launch() {
    this.tone(300, 760, 0.14, 'triangle', 0.12);
  }

  boost() {
    this.tone(220, 880, 0.22, 'sawtooth', 0.12);
    this.tone(440, 1320, 0.18, 'triangle', 0.08, 0.04);
  }

  capture() {
    this.tone(523, 523, 0.07, 'sine', 0.12);
    this.tone(784, 784, 0.1, 'sine', 0.1, 0.06);
  }

  comboBlip(n: number) {
    const f = Math.min(1200, 440 + n * 90);
    this.tone(f, f * 1.25, 0.1, 'triangle', 0.09);
  }

  star() {
    this.tone(880, 880, 0.07, 'square', 0.05);
    this.tone(1318, 1318, 0.1, 'square', 0.045, 0.07);
  }

  shield() {
    this.tone(392, 392, 0.09, 'sine', 0.1);
    this.tone(587, 587, 0.14, 'sine', 0.09, 0.08);
  }

  shieldBreak() {
    this.tone(660, 180, 0.25, 'square', 0.1);
    this.noise(0.18, 2400, 0.12);
  }

  warning() {
    this.tone(740, 740, 0.06, 'square', 0.08);
    this.tone(740, 740, 0.06, 'square', 0.08, 0.12);
  }

  explosion() {
    this.noise(0.5, 900, 0.4);
    this.tone(140, 30, 0.5, 'sine', 0.2);
  }

  death() {
    this.tone(220, 38, 0.65, 'sawtooth', 0.16);
    this.noise(0.4, 1200, 0.2);
  }

  click() {
    this.tone(440, 440, 0.05, 'sine', 0.08);
  }
}

export const sfx = new Sfx();
