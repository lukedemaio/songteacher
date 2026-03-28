import * as Tone from "tone";

export class PlaybackEngine {
  private player: Tone.GrainPlayer | null = null;
  private _isPlaying = false;
  private _duration = 0;
  private _playbackRate = 1;
  private startOffset = 0;
  private startWallTime = 0;
  private animFrame = 0;
  private onTimeUpdate: ((time: number) => void) | null = null;

  get isPlaying() {
    return this._isPlaying;
  }

  get duration() {
    return this._duration;
  }

  get playbackRate() {
    return this._playbackRate;
  }

  async loadAudio(url: string): Promise<number> {
    await Tone.start();

    if (this.player) {
      this.player.dispose();
    }

    return new Promise((resolve, reject) => {
      this.player = new Tone.GrainPlayer({
        url,
        grainSize: 0.1,
        overlap: 0.05,
        onload: () => {
          this._duration = this.player!.buffer.duration;
          this.player!.playbackRate = this._playbackRate;
          this.player!.toDestination();
          resolve(this._duration);
        },
        onerror: (err) => reject(err),
      });
    });
  }

  setTimeCallback(cb: (time: number) => void) {
    this.onTimeUpdate = cb;
  }

  setPlaybackRate(rate: number) {
    const wasPlaying = this._isPlaying;
    const currentPos = this.getCurrentTime();
    this._playbackRate = rate;

    if (this.player) {
      this.player.playbackRate = rate;
    }

    if (wasPlaying) {
      this.player?.stop();
      this.play(currentPos);
    }
  }

  private tick = () => {
    if (!this._isPlaying) return;
    const elapsed = (performance.now() - this.startWallTime) / 1000;
    const current = this.startOffset + elapsed * this._playbackRate;

    if (current >= this._duration) {
      this.pause();
      this.onTimeUpdate?.(this._duration);
      return;
    }

    this.onTimeUpdate?.(current);
    this.animFrame = requestAnimationFrame(this.tick);
  };

  play(fromTime?: number) {
    if (!this.player || !this.player.loaded) return;

    if (fromTime !== undefined) {
      this.startOffset = fromTime;
    }

    if (this._isPlaying) {
      this.player.stop();
    }

    const offset = Math.max(0, Math.min(this.startOffset, this._duration));
    this.player.playbackRate = this._playbackRate;
    this.player.start(Tone.now(), offset);
    this._isPlaying = true;
    this.startWallTime = performance.now();
    this.startOffset = offset;
    this.animFrame = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this._isPlaying) return;

    const elapsed = (performance.now() - this.startWallTime) / 1000;
    this.startOffset = this.startOffset + elapsed * this._playbackRate;

    this.player?.stop();
    this._isPlaying = false;
    cancelAnimationFrame(this.animFrame);
  }

  seek(time: number) {
    this.startOffset = Math.max(0, Math.min(time, this._duration));
    if (this._isPlaying) {
      this.player?.stop();
      this.play(this.startOffset);
    } else {
      this.onTimeUpdate?.(this.startOffset);
    }
  }

  getCurrentTime(): number {
    if (this._isPlaying) {
      const elapsed = (performance.now() - this.startWallTime) / 1000;
      return this.startOffset + elapsed * this._playbackRate;
    }
    return this.startOffset;
  }

  dispose() {
    cancelAnimationFrame(this.animFrame);
    this.player?.stop();
    this.player?.dispose();
    this.player = null;
    this._isPlaying = false;
  }
}
