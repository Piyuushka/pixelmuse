/**
 * Multi-Sensory Navigation Module — Spatial Audio Engine
 * PathFinder Access
 *
 * Implements 3D spatial audio positioning using the Web Audio API's
 * AudioContext + PannerNode pipeline.
 *
 * Azimuth conventions (matching brief):
 *   turn_left   →  -90°   (hard left earbud)
 *   turn_right  →  +90°   (hard right earbud)
 *   straight    →    0°   (directly in front — or silent)
 *   arrived     →    0°   (centre, with rising pitch)
 *
 * The engine synthesises a "ping" tone using an OscillatorNode when
 * no audio asset is available, giving guaranteed low-latency output
 * without requiring a network fetch.  If a /sounds/nav-ping.wav asset
 * is present at runtime, the engine switches to AudioBuffer playback
 * for a warmer, more pleasant sound.
 *
 * Headphone detection uses the Web Audio API's AudioContext.destination
 * channel count and the MediaDevices API where available. The hook layer
 * (useMultiSensoryNav) owns the headphonesConnected flag; this engine
 * receives it as a parameter so audio can be suppressed gracefully.
 */

'use client';

import type { NavInstruction, SpatialAudioCue } from './types';

// ─────────────────────────────────────────────
// SPATIAL CUE DEFINITIONS
// ─────────────────────────────────────────────

export const SPATIAL_AUDIO_CUES: Record<NavInstruction, SpatialAudioCue> = {
  straight: {
    instruction: 'straight',
    azimuthDeg: null,       // silent — haptic is sufficient for straight
    distanceM: 1,
    gain: 0,
    spatialModel: 'omni',
  },
  turn_left: {
    instruction: 'turn_left',
    azimuthDeg: -90,
    distanceM: 1,
    gain: 0.75,
    spatialModel: 'HRTF',
  },
  turn_right: {
    instruction: 'turn_right',
    azimuthDeg: 90,
    distanceM: 1,
    gain: 0.75,
    spatialModel: 'HRTF',
  },
  arrived: {
    instruction: 'arrived',
    azimuthDeg: 0,
    distanceM: 1,
    gain: 0.9,
    spatialModel: 'equalpower',
  },
};

// ─────────────────────────────────────────────
// ENGINE CLASS
// ─────────────────────────────────────────────

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;

  /** Cached decoded buffer for the ping asset */
  private pingBuffer: AudioBuffer | null = null;

  /** Whether we have attempted to load the asset */
  private assetLoadAttempted = false;

  // ── Lifecycle ──────────────────────────────

  /**
   * Must be called inside a user-gesture handler (click / touch) to
   * satisfy browser autoplay policy requirements.
   */
  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    // Non-blocking asset pre-load
    this.preloadPingAsset().catch(() => {
      // Asset missing → synthesised ping will be used
    });
  }

  /**
   * Resume an AudioContext that was suspended by the browser (e.g. after
   * the page was backgrounded).  Call from a visibilitychange handler.
   */
  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** Release AudioContext resources — call on component unmount. */
  async destroy(): Promise<void> {
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
      this.pingBuffer = null;
      this.assetLoadAttempted = false;
    }
  }

  // ── Asset loading ──────────────────────────

  private async preloadPingAsset(): Promise<void> {
    if (this.assetLoadAttempted || !this.ctx) return;
    this.assetLoadAttempted = true;

    const ASSET_URL = '/sounds/nav-ping.wav';
    const response = await fetch(ASSET_URL);
    if (!response.ok) throw new Error(`Asset not found: ${ASSET_URL}`);
    const arrayBuffer = await response.arrayBuffer();
    this.pingBuffer = await this.ctx.decodeAudioData(arrayBuffer);
  }

  // ── Core playback ──────────────────────────

  /**
   * Play the spatial audio cue for a NavInstruction.
   *
   * @param instruction    - which cue to play
   * @param headphonesConnected - when false the panner model is switched
   *                             to 'equalpower' so mono speakers still
   *                             perceive the cue (directional pan).
   * @returns Promise resolving when the sound has finished playing.
   */
  async playCue(
    instruction: NavInstruction,
    headphonesConnected: boolean
  ): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const cue = SPATIAL_AUDIO_CUES[instruction];

    // 'straight' emits no audio by design
    if (cue.azimuthDeg === null) return;

    const pannerModel: PanningModelType =
      !headphonesConnected ? 'equalpower' :
      cue.spatialModel === 'omni' ? 'equalpower' :
      cue.spatialModel as PanningModelType;

    // ── Build graph: source → panner → gain → destination ──
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(cue.gain, this.ctx.currentTime);

    const panner = this.ctx.createPanner();
    panner.panningModel = pannerModel;
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;

    // Position audio source using Cartesian coordinates derived from azimuth
    const { x, y, z } = azimuthToCartesian(cue.azimuthDeg, cue.distanceM);
    panner.positionX.setValueAtTime(x, this.ctx.currentTime);
    panner.positionY.setValueAtTime(y, this.ctx.currentTime);
    panner.positionZ.setValueAtTime(z, this.ctx.currentTime);

    // Listener always faces forward (+Z axis)
    if (this.ctx.listener.forwardX !== undefined) {
      this.ctx.listener.forwardX.setValueAtTime(0, this.ctx.currentTime);
      this.ctx.listener.forwardY.setValueAtTime(0, this.ctx.currentTime);
      this.ctx.listener.forwardZ.setValueAtTime(-1, this.ctx.currentTime);
      this.ctx.listener.upX.setValueAtTime(0, this.ctx.currentTime);
      this.ctx.listener.upY.setValueAtTime(1, this.ctx.currentTime);
      this.ctx.listener.upZ.setValueAtTime(0, this.ctx.currentTime);
    }

    panner.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // ── Source: buffer or synthesised ping ──
    if (this.pingBuffer) {
      await this.playBufferSource(panner, this.pingBuffer);
    } else {
      await this.playSynthPing(panner, instruction);
    }

    // Cleanup graph nodes after playback
    panner.disconnect();
    gainNode.disconnect();
  }

  // ── Buffer source (asset playback) ─────────

  private playBufferSource(
    destination: AudioNode,
    buffer: AudioBuffer
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ctx) { resolve(); return; }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(destination);
      src.onended = () => resolve();
      src.start();
    });
  }

  // ── Synthesised ping (no asset) ─────────────

  /**
   * Generates a soft, pleasant ping tone using OscillatorNode.
   * Frequency and envelope vary per instruction for extra distinctiveness.
   *
   *   turn_left   → 660 Hz   (E5)
   *   turn_right  → 880 Hz   (A5)
   *   arrived     → 523 → 784 Hz glide (C5 → G5)
   *   straight    → (never called — audio is skipped)
   */
  private playSynthPing(
    destination: AudioNode,
    instruction: NavInstruction
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ctx) { resolve(); return; }
      const ctx = this.ctx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();

      osc.type = 'sine';
      osc.connect(envGain);
      envGain.connect(destination);

      // Per-instruction tuning
      switch (instruction) {
        case 'turn_left':
          osc.frequency.setValueAtTime(660, now);          // E5
          envGain.gain.setValueAtTime(0, now);
          envGain.gain.linearRampToValueAtTime(1, now + 0.01);
          envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.stop(now + 0.36);
          setTimeout(resolve, 360);
          break;

        case 'turn_right':
          osc.frequency.setValueAtTime(880, now);          // A5
          envGain.gain.setValueAtTime(0, now);
          envGain.gain.linearRampToValueAtTime(1, now + 0.01);
          envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.stop(now + 0.36);
          setTimeout(resolve, 360);
          break;

        case 'arrived':
          // Rising glide: C5 → G5, triumphant
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.linearRampToValueAtTime(784, now + 0.6);
          envGain.gain.setValueAtTime(0, now);
          envGain.gain.linearRampToValueAtTime(1, now + 0.02);
          envGain.gain.setValueAtTime(1, now + 0.5);
          envGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          osc.stop(now + 0.81);
          setTimeout(resolve, 820);
          break;

        default:
          osc.stop(now);
          resolve();
      }

      osc.start(now);
    });
  }

  // ── Headphone detection helpers ─────────────

  /**
   * Returns true when the AudioContext can confirm stereo output channels
   * (≥ 2 channels). This is a lightweight signal, not a guarantee that
   * physical earphones are worn, but it prevents spatial audio wasted on
   * a mono speaker scenario.
   */
  get hasStereoOutput(): boolean {
    return (this.ctx?.destination.maxChannelCount ?? 0) >= 2;
  }
}

// ─────────────────────────────────────────────
// UTILITY: azimuth → Cartesian XZ
// ─────────────────────────────────────────────

/**
 * Converts azimuth (degrees, listener-centric) to Cartesian X/Y/Z.
 * Listener faces -Z, up is +Y.
 *
 *   0°   → ( 0,  0, -d)   directly in front
 *  -90°  → (-d,  0,  0)   hard left
 *  +90°  → (+d,  0,  0)   hard right
 */
function azimuthToCartesian(
  azimuthDeg: number,
  distanceM: number
): { x: number; y: number; z: number } {
  const radians = (azimuthDeg * Math.PI) / 180;
  return {
    x: distanceM * Math.sin(radians),
    y: 0,
    z: -distanceM * Math.cos(radians),
  };
}

// ─────────────────────────────────────────────
// SINGLETON EXPORT (client-side only)
// ─────────────────────────────────────────────

let _engineInstance: SpatialAudioEngine | null = null;

/** Get (or lazily create) the shared SpatialAudioEngine instance. */
export function getSpatialAudioEngine(): SpatialAudioEngine {
  if (!_engineInstance) {
    _engineInstance = new SpatialAudioEngine();
  }
  return _engineInstance;
}
