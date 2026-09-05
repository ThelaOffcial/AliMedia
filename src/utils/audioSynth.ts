// Web Audio API sound synthesizer for Sri Lankan Ceremonial Hewisi & Elephant Trumpet Call

class CeremonialAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlayingAmbience: boolean = false;
  private timerId: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a soft ceremonial Geta Beraya / Daula drum sound
  public playDrumBeat(pitch: number = 130, duration: number = 0.25, gainLevel: number = 0.15) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Play subtle bell chime / mini ghanta
  public playBellChime(freq: number = 1200) {
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
    } catch {
      // ignore
    }
  }

  // Play gentle majestic elephant trumpet synth sound
  public playElephantTrumpet() {
    try {
      this.initContext();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc2.type = 'square';

      // Pitch glide like elephant trumpet (350Hz -> 650Hz -> 500Hz)
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(680, t + 0.35);
      osc.frequency.exponentialRampToValueAtTime(420, t + 1.1);

      osc2.frequency.setValueAtTime(325, t);
      osc2.frequency.linearRampToValueAtTime(690, t + 0.35);
      osc2.frequency.exponentialRampToValueAtTime(425, t + 1.1);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.linearRampToValueAtTime(2400, t + 0.35);
      filter.frequency.exponentialRampToValueAtTime(900, t + 1.1);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + 1.2);
      osc2.stop(t + 1.2);
    } catch {
      // ignore
    }
  }

  // Start ceremonial rhythm loop (gentle Perahera Hewisi rhythm pattern)
  public startAmbience() {
    if (this.isPlayingAmbience) return;
    this.isPlayingAmbience = true;

    let step = 0;
    const loop = () => {
      if (!this.isPlayingAmbience) return;

      // Pattern: Thit - Thit - Thith - Tha (traditional Perahera meter)
      if (step % 8 === 0) {
        this.playDrumBeat(160, 0.3, 0.12);
        this.playBellChime(1500);
      } else if (step % 8 === 2) {
        this.playDrumBeat(120, 0.2, 0.08);
      } else if (step % 8 === 4) {
        this.playDrumBeat(150, 0.25, 0.1);
      } else if (step % 8 === 6) {
        this.playDrumBeat(110, 0.35, 0.14);
      }

      step++;
      this.timerId = window.setTimeout(loop, 400);
    };

    loop();
  }

  public stopAmbience() {
    this.isPlayingAmbience = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public toggleAmbience(): boolean {
    if (this.isPlayingAmbience) {
      this.stopAmbience();
      return false;
    } else {
      this.startAmbience();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlayingAmbience;
  }
}

export const ceremonialAudio = new CeremonialAudioEngine();
