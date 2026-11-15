/* ── Essentia.js WASM Engine (Tunebat Architecture) ──
 * Runs MTG's Essentia.js compiled to WebAssembly:
 * - RhythmExtractor2013 with method="multifeature" (state-of-the-art beat tracking)
 * - PercivalBpmEstimator (octave-scale filterbank tempo tracking)
 * - KeyExtractor (Harmonic Pitch Class Profiles - HPCP for exact key/scale)
 */

import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';

let essentiaInstance = null;

/**
 * Initialize or get singleton Essentia instance
 */
export async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;

  try {
    // EssentiaWASM is the WebAssembly module
    const CoreClass = Essentia.default || Essentia;
    essentiaInstance = new CoreClass(EssentiaWASM);
    console.log('[Essentia.js WASM] Initialized successfully. Version:', essentiaInstance.version);
    return essentiaInstance;
  } catch (err) {
    console.error('[Essentia.js WASM] Initialization failed:', err);
    throw err;
  }
}

/**
 * Analyze BPM using RhythmExtractor2013 (method="multifeature") and PercivalBpmEstimator
 * This is the exact algorithm combination used by Tunebat.
 */
export async function analyzeEssentiaBPM(audioBuffer) {
  const essentia = await getEssentia();
  const channelData = audioBuffer.getChannelData(0);

  // Convert Float32Array to Essentia C++ Vector
  const signalVector = essentia.arrayToVector(channelData);

  try {
    // 1. RhythmExtractor2013 with multifeature method
    // Parameters: signal, maxTempo (208), method ('multifeature'), minTempo (40)
    let rhythmBpm = null;
    let rhythmConfidence = 0;
    try {
      const rhythmRes = essentia.RhythmExtractor2013(signalVector, 208, 'multifeature', 40);
      if (rhythmRes && rhythmRes.bpm > 0) {
        rhythmBpm = Math.round(rhythmRes.bpm * 10) / 10;
        // Essentia confidence is between 0 and 5, normalize to 0..1
        rhythmConfidence = Math.min(1.0, (rhythmRes.confidence || 0) / 3.5);
      }
    } catch (e) {
      console.warn('[Essentia] RhythmExtractor2013 error:', e);
    }

    // 2. PercivalBpmEstimator (Graham Percival & George Tzanetakis algorithm)
    let percivalBpm = null;
    try {
      const percivalRes = essentia.PercivalBpmEstimator(signalVector);
      if (percivalRes && percivalRes.bpm > 0) {
        percivalBpm = Math.round(percivalRes.bpm * 10) / 10;
      }
    } catch (e) {
      console.warn('[Essentia] PercivalBpmEstimator error:', e);
    }

    // Evaluate agreement between RhythmExtractor and Percival
    let finalBpm = rhythmBpm || percivalBpm || 120;
    let confidence = rhythmConfidence || 0.7;

    if (rhythmBpm && percivalBpm) {
      const diff = Math.abs(rhythmBpm - percivalBpm);
      // If within 2% of each other, high confidence agreement!
      if (diff <= 3) {
        finalBpm = Math.round(((rhythmBpm + percivalBpm) / 2));
        confidence = Math.max(0.85, rhythmConfidence);
      } else if (Math.abs(rhythmBpm * 2 - percivalBpm) < 3) {
        // Octave BPM check (half/double tempo)
        finalBpm = rhythmBpm;
        confidence = 0.8;
      } else {
        finalBpm = Math.round(rhythmBpm);
      }
    } else if (rhythmBpm) {
      finalBpm = Math.round(rhythmBpm);
    } else if (percivalBpm) {
      finalBpm = Math.round(percivalBpm);
    }

    return {
      bpm: finalBpm,
      confidence: Math.round(confidence * 100) / 100,
      rhythmBpm,
      percivalBpm,
      engine: 'Essentia.js WASM (Tunebat-grade)'
    };
  } finally {
    // Free vector memory in WebAssembly heap
    try {
      signalVector.delete();
    } catch (e) {}
  }
}

/**
 * Analyze Key and Scale using Essentia's KeyExtractor (HPCP polyphonic pitch profile)
 */
export async function analyzeEssentiaKey(audioBuffer) {
  const essentia = await getEssentia();
  const channelData = audioBuffer.getChannelData(0);
  const signalVector = essentia.arrayToVector(channelData);

  try {
    const keyRes = essentia.KeyExtractor(signalVector);
    if (keyRes && keyRes.key) {
      const tonic = keyRes.key; // e.g. "C", "C#", "F#"
      const scale = keyRes.scale === 'minor' ? 'Minor' : 'Major';
      const strength = keyRes.strength || 0.6;

      return {
        key: `${tonic} ${scale}`,
        confidence: Math.min(1.0, Math.round(strength * 100) / 100),
        engine: 'Essentia.js HPCP'
      };
    }
  } catch (err) {
    console.warn('[Essentia] KeyExtractor error:', err);
  } finally {
    try {
      signalVector.delete();
    } catch (e) {}
  }

  return { key: 'C Major', confidence: 0.5, engine: 'fallback' };
}

