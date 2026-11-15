/* ── Waveform Peak Extractor & Canvas Drawer ──
 * Renders DAW-quality waveforms for audio clips on the timeline canvas
 */

export function drawWaveformToCanvas(canvas, audioBuffer, color = '#ff7675', bgColor = 'rgba(255, 118, 117, 0.15)') {
  if (!canvas || !audioBuffer) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const channelData = audioBuffer.getChannelData(0);
  const step = Math.ceil(channelData.length / width);
  const amp = height / 2;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, amp);

  // Top half
  for (let i = 0; i < width; i++) {
    let max = 0;
    const start = i * step;
    for (let j = 0; j < step; j++) {
      const datum = Math.abs(channelData[start + j] || 0);
      if (datum > max) max = datum;
    }
    const h = Math.max(1, max * amp * 0.9);
    ctx.fillRect(i, amp - h, 1, h * 2);
  }

  // Center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();
}

/**
 * Generate dummy representative peaks if raw buffer is not directly accessible (e.g. external stream)
 */
export function drawProceduralWaveform(canvas, color = '#ff9f43', bgColor = 'rgba(255, 159, 67, 0.15)', pattern = 'drums') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const amp = height / 2;
  ctx.fillStyle = color;

  // Procedural rhythm spikes matching drum or bass pattern
  for (let i = 0; i < width; i++) {
    const norm = i / width;
    let h = 0;

    if (pattern === 'drums') {
      // 4/4 beats spikes at 0%, 25%, 50%, 75%
      const beatDist = (norm * 8) % 1.0;
      const kickSnare = Math.exp(-beatDist * 12);
      const hihat = Math.sin(norm * 64 * Math.PI) * 0.3;
      h = (kickSnare * 0.8 + Math.abs(hihat) * 0.3 + 0.05) * amp;
    } else {
      // Vocal / Melodic contours
      const wave = Math.sin(norm * 14 * Math.PI) * Math.cos(norm * 5 * Math.PI);
      h = (Math.abs(wave) * 0.7 + 0.1) * amp;
    }

    ctx.fillRect(i, amp - h, 1, h * 2);
  }

  // Center guide
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();
}

