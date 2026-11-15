/* ── Tone.js Multitrack DAW Sync Engine ──
 * Powers multitrack timeline playback with clip offsets, panning, solo/mute,
 * sample-accurate scrubbing, and dynamic time-stretching.
 */

import * as Tone from 'tone';

class SyncPlaybackEngine {
  constructor() {
    this.isInitialized = false;
    this.isPlaying = false;
    this.targetBpm = 120;

    // Track players & nodes
    this.userPlayer = null;
    this.userGain = null;
    this.userPanner = null;
    this.userBuffer = null;
    this.vocalOffset = 0; // seconds

    this.drumPlayer = null;
    this.drumGain = null;
    this.drumPanner = null;
    this.drumBuffer = null;
    this.drumOffset = 0; // seconds
    this.drumLoops = 4; // number of loop repetitions
    this.fallbackAudio = null;

    // Track states
    this.vocalMuted = false;
    this.vocalSolo = false;
    this.drumMuted = false;
    this.drumSolo = false;

    this.currentSampleId = null;
    this.onProgressCallback = null;
    this.progressInterval = null;
  }

  /**
   * Initialize Tone.js routing graph
   */
  async init() {
    if (this.isInitialized) return;
    try {
      if (Tone.context && Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (e) {}

    // Vocal track chain: Player -> Panner -> Gain -> Master
    if (!this.userPanner) {
      this.userPanner = new Tone.Panner(0).toDestination();
    }
    if (!this.userGain) {
      this.userGain = new Tone.Gain(0.85).connect(this.userPanner);
    }

    // Drum track chain: Player -> Panner -> Gain -> Master
    if (!this.drumPanner) {
      this.drumPanner = new Tone.Panner(0).toDestination();
    }
    if (!this.drumGain) {
      this.drumGain = new Tone.Gain(0.9).connect(this.drumPanner);
    }

    this.isInitialized = true;
  }

  setTargetBpm(bpm) {
    this.targetBpm = bpm;
    try {
      Tone.getTransport().bpm.value = bpm;
    } catch (e) {}
    this.updateDrumPlaybackRate();
  }

  updateDrumPlaybackRate() {
    if (this.drumPlayer && this.drumPlayer.sampleBpm) {
      const rate = this.targetBpm / this.drumPlayer.sampleBpm;
      this.drumPlayer.playbackRate = Math.max(0.25, Math.min(4.0, rate));
    }
    if (this.fallbackAudio && this.fallbackAudio.sampleBpm) {
      const rate = this.targetBpm / this.fallbackAudio.sampleBpm;
      this.fallbackAudio.playbackRate = Math.max(0.25, Math.min(4.0, rate));
    }
  }

  /**
   * Set user vocal audio buffer
   */
  async setUserAudio(audioBufferOrUrl) {
    await this.init();

    try {
      if (typeof audioBufferOrUrl === 'string') {
        this.userBuffer = await new Tone.ToneAudioBuffer().load(audioBufferOrUrl);
      } else {
        this.userBuffer = new Tone.ToneAudioBuffer(audioBufferOrUrl);
      }
      this.rebuildVocalTrack();
    } catch (err) {
      console.warn('Error buffering user audio:', err);
    }
  }

  rebuildVocalTrack() {
    if (!this.userBuffer) return;

    if (this.userPlayer) {
      this.userPlayer.stop();
      this.userPlayer.dispose();
      this.userPlayer = null;
    }

    this.userPlayer = new Tone.Player({
      url: this.userBuffer,
      loop: false,
      autostart: false,
    }).connect(this.userGain);

    // Schedule vocal start at vocalOffset
    const startOffset = Math.max(0, this.vocalOffset);
    this.userPlayer.sync().start(startOffset);
  }

  /**
   * Set vocal clip offset (in seconds)
   * Allows dragging vocal across the timeline against the drums!
   */
  setVocalOffset(offsetSeconds) {
    this.vocalOffset = offsetSeconds;
    if (this.userPlayer) {
      this.userPlayer.unsync();
      const startOffset = Math.max(0, this.vocalOffset);
      this.userPlayer.sync().start(startOffset);
    }
  }

  /**
   * Set drum clip offset (in seconds)
   */
  setDrumOffset(offsetSeconds) {
    this.drumOffset = offsetSeconds;
    if (this.drumPlayer) {
      this.drumPlayer.unsync();
      const startOffset = Math.max(0, this.drumOffset);
      this.drumPlayer.sync().start(startOffset);
    }
  }

  /**
   * Load drum sample into track 2
   */
  async loadDrumSample(sample) {
    await this.init();
    if (!sample) return;

    this.currentSampleId = sample.id;
    const wasPlaying = Tone.getTransport().state === 'started' || this.isPlaying;

    if (this.drumPlayer) {
      this.drumPlayer.stop();
      this.drumPlayer.dispose();
      this.drumPlayer = null;
    }
    if (this.fallbackAudio) {
      this.fallbackAudio.pause();
      this.fallbackAudio = null;
    }

    const isLoop = sample.type === 'loop';
    let rate = 1.0;
    if (isLoop && sample.bpm && this.targetBpm) {
      rate = this.targetBpm / sample.bpm;
      rate = Math.max(0.25, Math.min(4.0, rate));
    }

    try {
      let toneBuffer;
      if (sample.buffer) {
        toneBuffer = new Tone.ToneAudioBuffer(sample.buffer);
      } else if (sample.previewUrl) {
        toneBuffer = await new Tone.ToneAudioBuffer().load(sample.previewUrl);
      }

      if (toneBuffer) {
        this.drumBuffer = toneBuffer;
        this.drumPlayer = new Tone.Player({
          url: toneBuffer,
          loop: isLoop,
          playbackRate: rate,
          autostart: false,
        }).connect(this.drumGain);

        this.drumPlayer.sampleBpm = sample.bpm;
        const startOffset = Math.max(0, this.drumOffset);
        this.drumPlayer.sync().start(startOffset);

        if (wasPlaying && Tone.getTransport().state !== 'started') {
          Tone.getTransport().start();
        }
        return;
      }
    } catch (e) {
      console.info('[SyncEngine] Fallback to HTML5 audio for CDN URL:', sample.previewUrl);
    }

    if (sample.previewUrl) {
      try {
        const audio = new Audio(sample.previewUrl);
        audio.crossOrigin = 'anonymous';
        audio.loop = isLoop;
        audio.playbackRate = rate;
        audio.volume = this.drumGain ? this.drumGain.gain.value : 0.9;
        audio.sampleBpm = sample.bpm;
        this.fallbackAudio = audio;

        if (wasPlaying) {
          audio.play().catch(() => {});
        }
      } catch (err) {}
    }
  }

  /**
   * Transport Play / Pause / Seek
   */
  async togglePlay() {
    await this.init();
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (Tone.getTransport().state === 'started') {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  play() {
    try {
      Tone.getTransport().start();
      if (this.fallbackAudio) {
        this.fallbackAudio.play().catch(() => {});
      }
      this.isPlaying = true;
      this.startProgressTracker();
    } catch (e) {
      console.warn('Transport play error:', e);
    }
  }

  pause() {
    try {
      Tone.getTransport().pause();
      if (this.fallbackAudio) {
        this.fallbackAudio.pause();
      }
      this.isPlaying = false;
      this.stopProgressTracker();
    } catch (e) {}
  }

  stop() {
    try {
      Tone.getTransport().stop();
      Tone.getTransport().seconds = 0;
      if (this.fallbackAudio) {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
      }
      this.isPlaying = false;
      this.stopProgressTracker();
      if (this.onProgressCallback) {
        this.onProgressCallback({
          seconds: 0,
          position: '0:0:0',
          isPlaying: false,
        });
      }
    } catch (e) {}
  }

  /**
   * Seek to specific timeline time (scrubbing)
   */
  seek(timeInSeconds) {
    try {
      const clamped = Math.max(0, timeInSeconds);
      Tone.getTransport().seconds = clamped;
      if (this.fallbackAudio) {
        this.fallbackAudio.currentTime = clamped;
      }
      if (this.onProgressCallback) {
        this.onProgressCallback({
          seconds: clamped,
          position: Tone.getTransport().position,
          isPlaying: this.isPlaying,
        });
      }
    } catch (e) {}
  }

  // ── Track Controls: Volume, Pan, Mute, Solo ──

  setUserVolume(volume) {
    if (this.userGain) {
      this.userGain.gain.rampTo(this.vocalMuted ? 0 : Math.max(0, Math.min(1, volume)), 0.05);
    }
  }

  setDrumVolume(volume) {
    const val = this.drumMuted ? 0 : Math.max(0, Math.min(1, volume));
    if (this.drumGain) {
      this.drumGain.gain.rampTo(val, 0.05);
    }
    if (this.fallbackAudio) {
      this.fallbackAudio.volume = val;
    }
  }

  setUserPan(pan) {
    // pan from -1.0 (Left) to +1.0 (Right)
    if (this.userPanner) {
      this.userPanner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.05);
    }
  }

  setDrumPan(pan) {
    if (this.drumPanner) {
      this.drumPanner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.05);
    }
  }

  toggleMute(trackId, isMuted) {
    if (trackId === 'vocal') {
      this.vocalMuted = isMuted;
      this.applyMuteSolo();
    } else if (trackId === 'drum') {
      this.drumMuted = isMuted;
      this.applyMuteSolo();
    }
  }

  toggleSolo(trackId, isSolo) {
    if (trackId === 'vocal') {
      this.vocalSolo = isSolo;
      this.applyMuteSolo();
    } else if (trackId === 'drum') {
      this.drumSolo = isSolo;
      this.applyMuteSolo();
    }
  }

  applyMuteSolo() {
    const anySolo = this.vocalSolo || this.drumSolo;

    // Vocal gain
    let vocalActive = true;
    if (this.vocalMuted) vocalActive = false;
    if (anySolo && !this.vocalSolo) vocalActive = false;

    if (this.userGain) {
      this.userGain.gain.rampTo(vocalActive ? 0.85 : 0, 0.05);
    }

    // Drum gain
    let drumActive = true;
    if (this.drumMuted) drumActive = false;
    if (anySolo && !this.drumSolo) drumActive = false;

    if (this.drumGain) {
      this.drumGain.gain.rampTo(drumActive ? 0.9 : 0, 0.05);
    }
    if (this.fallbackAudio) {
      this.fallbackAudio.volume = drumActive ? 0.9 : 0;
    }
  }

  // ── Progress Tracker ──

  setProgressCallback(cb) {
    this.onProgressCallback = cb;
  }

  startProgressTracker() {
    this.stopProgressTracker();
    this.progressInterval = setInterval(() => {
      if (this.onProgressCallback) {
        const seconds = Tone.getTransport().seconds;
        const position = Tone.getTransport().position;
        this.onProgressCallback({
          seconds,
          position: typeof position === 'string' ? position : '0:0:0',
          isPlaying: Tone.getTransport().state === 'started' || (this.fallbackAudio && !this.fallbackAudio.paused),
        });
      }
    }, 35);
  }

  stopProgressTracker() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  dispose() {
    this.stop();
    if (this.userPlayer) this.userPlayer.dispose();
    if (this.drumPlayer) this.drumPlayer.dispose();
    if (this.userGain) this.userGain.dispose();
    if (this.drumGain) this.drumGain.dispose();
    if (this.userPanner) this.userPanner.dispose();
    if (this.drumPanner) this.drumPanner.dispose();
    this.isInitialized = false;
  }
}

export const syncEngine = new SyncPlaybackEngine();
