// Sound effects system using Web Audio API
// Generates procedural sounds without external files

type SoundType = "bet" | "win" | "loss" | "hit" | "cancel" | "click" | "coin";

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio API not supported");
        return null;
      }
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    gainEnvelope?: { attack: number; decay: number; sustain: number; release: number }
  ): void {
    const ctx = this.getContext();
    if (!ctx || !this.enabled) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    const env = gainEnvelope || { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 };

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(this.volume, now + env.attack);
    gainNode.gain.linearRampToValueAtTime(this.volume * env.sustain, now + env.attack + env.decay);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  play(type: SoundType): void {
    if (!this.enabled) return;

    switch (type) {
      case "click":
        this.playTone(800, 0.05, "square");
        break;

      case "bet":
        this.playTone(440, 0.1, "sine");
        setTimeout(() => this.playTone(550, 0.1, "sine"), 50);
        break;

      case "hit":
        this.playTone(660, 0.15, "triangle");
        setTimeout(() => this.playTone(880, 0.2, "triangle"), 80);
        break;

      case "win":
        // Ascending arpeggio
        this.playTone(523, 0.15, "sine"); // C
        setTimeout(() => this.playTone(659, 0.15, "sine"), 100); // E
        setTimeout(() => this.playTone(784, 0.15, "sine"), 200); // G
        setTimeout(() => this.playTone(1047, 0.3, "sine"), 300); // C (octave)
        break;

      case "loss":
        // Descending minor
        this.playTone(400, 0.2, "sawtooth", { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 });
        setTimeout(() => this.playTone(350, 0.3, "sawtooth", { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 }), 150);
        break;

      case "cancel":
        this.playTone(300, 0.1, "square");
        setTimeout(() => this.playTone(250, 0.15, "square"), 80);
        break;

      case "coin":
        this.playTone(1200, 0.08, "sine");
        setTimeout(() => this.playTone(1400, 0.1, "sine"), 60);
        break;
    }
  }
}

export const soundManager = new SoundManager();

// Convenience functions
export const sounds = {
  click: () => soundManager.play("click"),
  bet: () => soundManager.play("bet"),
  hit: () => soundManager.play("hit"),
  win: () => soundManager.play("win"),
  loss: () => soundManager.play("loss"),
  cancel: () => soundManager.play("cancel"),
  coin: () => soundManager.play("coin"),
  setEnabled: (enabled: boolean) => soundManager.setEnabled(enabled),
  setVolume: (volume: number) => soundManager.setVolume(volume),
};
