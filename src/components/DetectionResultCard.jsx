/* ── Module 1.2: DetectionResultCard Component ──
 * Shows detected BPM, Key, Time Signature
 * Powered by Essentia.js WebAssembly (Tunebat-grade)
 * Manual override controls & Tap Tempo fallback
 */

import { useState, useCallback } from 'react';
import useStore, { PHASES, KEYS, TIME_SIGNATURES } from '../store/useStore';

export default function DetectionResultCard() {
  const {
    detectedBpm, detectedKey, detectedTimeSig,
    bpmConfidence, keyConfidence,
    confirmedBpm, confirmedKey, confirmedTimeSig,
    setConfirmedBpm, setConfirmedKey, setConfirmedTimeSig,
    showTapTempo, setShowTapTempo,
    setPhase,
  } = useStore();

  const [tapTimes, setTapTimes] = useState([]);
  const [tapBpm, setTapBpm] = useState(null);

  // BPM slider range: ±20%
  const bpmMin = Math.max(40, Math.round((detectedBpm || 120) * 0.8));
  const bpmMax = Math.round((detectedBpm || 120) * 1.2);

  // Tap Tempo Logic
  const handleTap = useCallback(() => {
    const now = performance.now();
    setTapTimes(prev => {
      const newTaps = [...prev, now].slice(-8);
      if (newTaps.length >= 2) {
        const intervals = [];
        for (let i = 1; i < newTaps.length; i++) {
          intervals.push(newTaps[i] - newTaps[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        if (bpm >= 40 && bpm <= 300) {
          setTapBpm(bpm);
          setConfirmedBpm(bpm);
        }
      }
      return newTaps;
    });
  }, [setConfirmedBpm]);

  const resetTapTempo = useCallback(() => {
    setTapTimes([]);
    setTapBpm(null);
  }, []);

  const handleConfirm = useCallback(() => {
    setPhase(PHASES.FETCHING_DRUMS);
  }, [setPhase]);

  const confColor = (val) => {
    if (val >= 0.7) return 'var(--success)';
    if (val >= 0.45) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="detection-result fade-in">
      <div className="section-title">🔍 Analysis Complete</div>
      <div className="section-subtitle">
        Tunebat-grade Essentia.js WebAssembly analysis of tempo, key, and meter. Adjust if desired, then confirm.
      </div>

      {/* ── Result Card ── */}
      <div className="result-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Detected Properties
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-secondary)', background: 'rgba(0, 206, 201, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0, 206, 201, 0.2)' }}>
            ⚡ Essentia.js WASM
          </span>
        </div>

        <div className="result-values">
          <div className="result-item">
            <span className="result-label">Tempo</span>
            <span className="result-value">{confirmedBpm} <span style={{ fontSize: '16px', fontWeight: '400' }}>BPM</span></span>
            <span style={{ fontSize: '11px', color: confColor(bpmConfidence) }}>
              {Math.round(bpmConfidence * 100)}% confidence
            </span>
          </div>

          <div className="result-item">
            <span className="result-label">Key Center</span>
            <span className="result-value key">{confirmedKey}</span>
            <span style={{ fontSize: '11px', color: confColor(keyConfidence) }}>
              {Math.round(keyConfidence * 100)}% confidence
            </span>
          </div>

          <div className="result-item">
            <span className="result-label">Time Signature</span>
            <span className="result-value time-sig">{confirmedTimeSig}</span>
          </div>
        </div>

        {/* ── Override Controls ── */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Manual Fine-Tuning
          </div>

          <div className="override-controls">
            {/* BPM Slider */}
            <div className="control-group">
              <label>BPM ({bpmMin}–{bpmMax})</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={bpmMin}
                  max={bpmMax}
                  value={confirmedBpm || 120}
                  onChange={(e) => setConfirmedBpm(parseInt(e.target.value))}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', minWidth: '40px' }}>
                  {confirmedBpm}
                </span>
              </div>
            </div>

            {/* Key Selector */}
            <div className="control-group">
              <label>Key</label>
              <select
                value={confirmedKey || 'C Major'}
                onChange={(e) => setConfirmedKey(e.target.value)}
              >
                {KEYS.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* Time Signature */}
            <div className="control-group">
              <label>Time Signature</label>
              <select
                value={confirmedTimeSig || '4/4'}
                onChange={(e) => setConfirmedTimeSig(e.target.value)}
              >
                {TIME_SIGNATURES.map(ts => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Tap Tempo Section ── */}
        {(bpmConfidence < 0.6 || showTapTempo) && (
          <div style={{
            marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '24px',
          }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '8px' }}>
                ⚠️ Need manual tempo verification?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Tap the button to the beat. 8 taps for highest precision.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button className="tap-tempo-btn" onClick={handleTap}>
                <span style={{ fontSize: '20px' }}>👆</span>
                <span>TAP</span>
              </button>
              {tapBpm && (
                <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: '600' }}>
                  {tapBpm} BPM
                </div>
              )}
              {tapTimes.length > 0 && (
                <button className="btn btn-sm" onClick={resetTapTempo}>
                  Reset ({tapTimes.length}/8)
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Show/hide tap tempo toggle ── */}
        {bpmConfidence >= 0.6 && !showTapTempo && (
          <button
            className="btn btn-sm"
            style={{ marginTop: '12px' }}
            onClick={() => setShowTapTempo(true)}
          >
            🎵 Use Tap Tempo Instead
          </button>
        )}
      </div>

      {/* ── Confirm Button ── */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <button className="btn btn-lg btn-primary" onClick={handleConfirm}>
          ✅ Confirm & Find Drum Samples
        </button>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          {confirmedBpm} BPM · {confirmedKey} · {confirmedTimeSig}
        </div>
      </div>
    </div>
  );
}
