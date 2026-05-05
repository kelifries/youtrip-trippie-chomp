/**
 * Audio system — SFX + background music via Web Audio API oscillators.
 * Three BGM tracks: lobby (Arpeggio Ambient), game (Happy Adventure Bounce).
 * Game over is a one-shot SFX (Quick Buzz).
 */
type BGMTrack = 'lobby' | 'game';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private currentBGM: BGMTrack | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimeout: number | null = null;
  private muted: boolean = false;

  init(): void {
    const isFirstInit = !this.ctx;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // iOS / Chrome iOS unlock — Apple's WebKit (which Chrome iOS also uses)
    // often ignores plain ctx.resume() even inside a user gesture. The
    // canonical workaround is to play a 1-sample silent buffer synchronously
    // — that forces the ctx into the running state for real, not just on
    // paper. Only needed once per AudioContext lifetime.
    if (isFirstInit) {
      try {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (e) {}
    }
    // Restore mute preference from localStorage
    try {
      this.muted = localStorage.getItem('chomp-muted') === '1';
    } catch (e) {}
  }

  // iOS Safari can re-suspend the AudioContext between scene transitions or
  // after backgrounding. Calling resume() defensively before any scheduling
  // prevents BGM from being scheduled with stale ctx.currentTime values that
  // resolve to "in the past" once the ctx finally wakes up — and silently get
  // dropped, which is the real-world failure mode on mobile.
  private resumeIfSuspended(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted(): boolean { return this.muted; }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem('chomp-muted', m ? '1' : '0'); } catch (e) {}
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(m ? 0 : 0.05, this.ctx.currentTime);
    }
  }

  play(type: 'dot' | 'power' | 'ghost' | 'die' | 'click' | 'levelup' | 'gameover' | 'tick' | 'pop' | 'whoosh'): void {
    if (!this.ctx || this.muted) return;
    this.resumeIfSuspended();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    switch (type) {
      case 'dot':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(784, now + 0.04);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;

      case 'power':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;

      case 'ghost':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;

      case 'die':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
        break;

      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1100, now + 0.03);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
        break;

      case 'levelup': {
        // Triumphant fanfare — fast ascending arpeggio + chord stab + sparkle
        // Lead: square wave melody (higher octave for brightness)
        const leadNotes = [
          { f: 523, t: 0 },     // C5
          { f: 659, t: 0.08 },  // E5
          { f: 784, t: 0.16 },  // G5
          { f: 1047, t: 0.24 }, // C6
          { f: 1319, t: 0.32 }, // E6 (peak)
          { f: 1568, t: 0.42 }, // G6 hold
        ];
        leadNotes.forEach(({ f, t }) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'square';
          o.frequency.value = f;
          o.connect(g); g.connect(this.ctx!.destination);
          g.gain.setValueAtTime(0.28, now + t);
          g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.25);
          o.start(now + t); o.stop(now + t + 0.3);
        });

        // Bass: triangle root notes
        const bassNotes = [
          { f: 131, t: 0 },     // C3
          { f: 165, t: 0.16 },  // E3
          { f: 196, t: 0.32 },  // G3
          { f: 262, t: 0.42 },  // C4 final
        ];
        bassNotes.forEach(({ f, t }) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          o.connect(g); g.connect(this.ctx!.destination);
          g.gain.setValueAtTime(0.22, now + t);
          g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.4);
          o.start(now + t); o.stop(now + t + 0.45);
        });

        // Sparkle: high-pitched sine bell on the resolution
        const sparkleNotes = [
          { f: 2093, t: 0.42 }, // C7
          { f: 2637, t: 0.54 }, // E7
          { f: 3136, t: 0.62 }, // G7
        ];
        sparkleNotes.forEach(({ f, t }) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          o.connect(g); g.connect(this.ctx!.destination);
          g.gain.setValueAtTime(0.15, now + t);
          g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.5);
          o.start(now + t); o.stop(now + t + 0.55);
        });

        // Final chord stab (C major triad held)
        const chordStabT = 0.42;
        const chordStabFreqs = [523, 659, 784, 1047]; // C E G C
        chordStabFreqs.forEach((f) => {
          const o = this.ctx!.createOscillator();
          const g = this.ctx!.createGain();
          o.type = 'square';
          o.frequency.value = f;
          o.connect(g); g.connect(this.ctx!.destination);
          g.gain.setValueAtTime(0.12, now + chordStabT);
          g.gain.exponentialRampToValueAtTime(0.001, now + chordStabT + 0.6);
          o.start(now + chordStabT); o.stop(now + chordStabT + 0.65);
        });
        break;
      }

      case 'gameover':
        // Quick buzz — descending sawtooth ~0.9s
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.start(now);
        osc.stop(now + 0.9);
        break;

      case 'tick':
        // Quiet ascending blip for stat counting — quick and light
        osc.type = 'square';
        osc.frequency.setValueAtTime(1320, now);
        osc.frequency.setValueAtTime(1760, now + 0.02);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;

      case 'pop': {
        // Satisfying coin/score pop — bright square stab + sub-bass thump
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1568, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(2093, now + 0.14);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
        // Sub-bass body
        const sub = this.ctx.createOscillator();
        const subG = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(196, now);
        sub.frequency.exponentialRampToValueAtTime(330, now + 0.08);
        sub.connect(subG); subG.connect(this.ctx.destination);
        subG.gain.setValueAtTime(0.18, now);
        subG.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        sub.start(now); sub.stop(now + 0.22);
        break;
      }

      case 'whoosh': {
        // Boarding pass slam — noisy descending whoosh + low impact thud,
        // timed to land at ~50ms (sync with the camera shake on stamp slam).
        // Noise burst (filtered to mid-band) for the "swoop"
        const bufferSize = this.ctx.sampleRate * 0.28;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2200, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.25);
        noiseFilter.Q.value = 1.2;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.18, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(this.ctx.destination);
        noise.start(now); noise.stop(now + 0.3);
        // Low impact thud to sync with shake
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.25);
        break;
      }
    }
  }

  startBGM(track: BGMTrack): void {
    if (!this.ctx) return;
    this.resumeIfSuspended();
    if (this.currentBGM === track) return; // already playing

    this.stopBGM();
    this.currentBGM = track;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.muted ? 0 : (track === 'lobby' ? 0.08 : 0.10);
    this.bgmGain.connect(this.ctx.destination);

    if (track === 'lobby') {
      this.lobbyLoop();
    } else {
      this.gameLoop();
    }
  }

  stopBGM(): void {
    if (this.bgmTimeout !== null) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    }
    this.bgmGain = null;
    this.currentBGM = null;
  }

  // ─── ARPEGGIO AMBIENT — Lobby ───
  // 90 BPM, dreamy arpeggios with soft triangle pad
  private lobbyLoop(): void {
    if (!this.ctx || this.currentBGM !== 'lobby' || !this.bgmGain) return;
    this.resumeIfSuspended();

    const bpm = 90;
    const sn = 60 / bpm / 4; // 16th note

    const arp = [
      523, 659, 784, 988, 1175, 988, 784, 659,
      494, 587, 698, 880, 1047, 880, 698, 587,
      440, 523, 659, 784, 988, 784, 659, 523,
      392, 494, 587, 740, 880, 740, 587, 494,
    ];
    const pad = [262, 262, 262, 262, 247, 247, 247, 247, 220, 220, 220, 220, 196, 196, 196, 196];

    const now = this.ctx.currentTime;

    // Arpeggio (sine)
    arp.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.bgmGain!);
      const t = now + i * sn;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + sn * 1.05);
      osc.start(t);
      osc.stop(t + sn * 1.1);
    });

    // Pad (triangle, held longer)
    pad.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.bgmGain!);
      const t = now + i * sn * 2;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + sn * 2.2);
      osc.start(t);
      osc.stop(t + sn * 2.3);
    });

    const loopDurationMs = arp.length * sn * 1000;
    this.bgmTimeout = window.setTimeout(() => this.lobbyLoop(), loopDurationMs);
  }

  // ─── HAPPY ADVENTURE BOUNCE — Gameplay ───
  // 160 BPM, bright major key with sparkly high notes
  private gameLoop(): void {
    if (!this.ctx || this.currentBGM !== 'game' || !this.bgmGain) return;
    this.resumeIfSuspended();

    const bpm = 160;
    const sn = 60 / bpm / 2; // 8th note

    const melody = [
      659, 784, 880, 1047, 880, 784, 880, 659,
      587, 659, 784, 880, 784, 659, 587, 523,
      659, 784, 988, 1175, 988, 784, 988, 659,
      1047, 988, 880, 784, 880, 659, 784, 880,
    ];
    const bass = [
      262, 262, 330, 330, 262, 262, 330, 330,
      196, 196, 262, 262, 196, 196, 262, 262,
      262, 262, 330, 330, 262, 262, 330, 330,
      349, 349, 330, 330, 262, 262, 196, 262,
    ];
    const sparkle = [
      1568, 0, 0, 2093, 0, 0, 1568, 0,
      0, 0, 1760, 0, 0, 0, 1568, 0,
      1568, 0, 0, 2349, 0, 0, 1976, 0,
      0, 0, 2093, 0, 0, 0, 1568, 0,
    ];

    const now = this.ctx.currentTime;

    // Melody (square)
    melody.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.bgmGain!);
      const t = now + i * sn;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + sn * 0.85);
      osc.start(t);
      osc.stop(t + sn * 0.9);
    });

    // Bass (triangle)
    bass.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.bgmGain!);
      const t = now + i * sn;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + sn * 0.8);
      osc.start(t);
      osc.stop(t + sn * 0.85);
    });

    // Sparkle (sine)
    sparkle.forEach((freq, i) => {
      if (freq === 0) return;
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(this.bgmGain!);
      const t = now + i * sn;
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + sn * 0.5);
      osc.start(t);
      osc.stop(t + sn * 0.55);
    });

    const loopDurationMs = melody.length * sn * 1000;
    this.bgmTimeout = window.setTimeout(() => this.gameLoop(), loopDurationMs);
  }
}

export const audioSystem = new AudioSystem();
