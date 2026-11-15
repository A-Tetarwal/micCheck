/* ── Audio Utilities — normalization, resampling, LUFS ── */

/**
 * Downmix to mono and resample to 44100Hz
 * Returns a new AudioBuffer (mono, 44100Hz)
 */
export async function normalizeAudioBuffer(audioBuffer) {
  const targetSampleRate = 44100;
  const numChannels = audioBuffer.numberOfChannels;

  // Downmix to mono
  const length = audioBuffer.length;
  const monoData = new Float32Array(length);

  if (numChannels === 1) {
    monoData.set(audioBuffer.getChannelData(0));
  } else {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoData[i] += channelData[i] / numChannels;
      }
    }
  }

  // Resample to 44100Hz if needed
  if (audioBuffer.sampleRate === targetSampleRate) {
    const offCtx = new OfflineAudioContext(1, length, targetSampleRate);
    const buf = offCtx.createBuffer(1, length, targetSampleRate);
    buf.getChannelData(0).set(monoData);
    return buf;
  }

  // Use OfflineAudioContext to resample
  const duration = audioBuffer.duration;
  const newLength = Math.ceil(duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, newLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();

  // Create buffer with original sample rate
  const tempCtx = new OfflineAudioContext(1, length, audioBuffer.sampleRate);
  const tempBuf = tempCtx.createBuffer(1, length, audioBuffer.sampleRate);
  tempBuf.getChannelData(0).set(monoData);

  source.buffer = tempBuf;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Measure integrated LUFS of an audio buffer (simplified)
 * Uses ITU-R BS.1770-4 simplified approach
 */
export function measureLUFS(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const blockSize = Math.floor(0.4 * sampleRate); // 400ms blocks
  const stepSize = Math.floor(0.1 * sampleRate);   // 100ms hop

  let sumSquares = 0;
  let count = 0;

  for (let i = 0; i + blockSize <= data.length; i += stepSize) {
    let blockPower = 0;
    for (let j = i; j < i + blockSize; j++) {
      blockPower += data[j] * data[j];
    }
    blockPower /= blockSize;
    sumSquares += blockPower;
    count++;
  }

  if (count === 0) return -70; // silence
  const meanPower = sumSquares / count;
  return -0.691 + 10 * Math.log10(meanPower + 1e-10);
}

/**
 * Normalize audio buffer to target LUFS (-18 LUFS default)
 */
export function normalizeLUFS(audioBuffer, targetLUFS = -18) {
  const currentLUFS = measureLUFS(audioBuffer);
  const gainDB = targetLUFS - currentLUFS;
  const gainLinear = Math.pow(10, gainDB / 20);

  // Clamp gain to avoid extreme amplification
  const clampedGain = Math.min(Math.max(gainLinear, 0.01), 10);

  const data = audioBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] *= clampedGain;
    // Soft clip to prevent distortion
    if (data[i] > 1) data[i] = 1;
    if (data[i] < -1) data[i] = -1;
  }

  return audioBuffer;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const length = buffer.length;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write samples
  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Format seconds to mm:ss
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Get file size string
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

