/* ── Module 1.3 Output: LockedFoundationCard ──
 * Displays the locked drum foundation, confirmed BPM, Key, Time Signature,
 * and confirms ready status for Phase 2 (Beat Building).
 */

import { useState } from 'react';
import useStore from '../store/useStore';
import { syncEngine } from '../engine/syncEngine';

export default function LockedFoundationCard() {
  const { lockedFoundation, reset } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);

  if (!lockedFoundation) return null;

  const handleTogglePlay = async () => {
    const playing = await syncEngine.togglePlay();
    setIsPlaying(playing);
  };

  return (
    <div className="card fade-in" style={{
      maxWidth: '720px', margin: '0 auto', textAlign: 'center',
      border: '1px solid var(--success)', boxShadow: '0 0 24px rgba(0, 184, 148, 0.2)'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>
        🔒
      </div>

      <div style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '16px',
        background: 'rgba(0, 184, 148, 0.15)', color: 'var(--success)',
        fontSize: '12px', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '1px', marginBottom: '12px'
      }}>
        Phase 1 Complete · Foundation Locked
      </div>

      <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '12px' }}>
        Drum Foundation Anchored
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>
        Your musical blueprint is locked. This anchor persists through Phase 2 (Arranger) and Phase 3 (Vocal Layer & Mastering).
      </p>

      {/* ── Metadata Grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '16px', padding: '20px', background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        marginBottom: '28px', textAlign: 'left'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tempo</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            {lockedFoundation.bpm} BPM
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Key Center</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-secondary)' }}>
            {lockedFoundation.key}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Signature</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
            {lockedFoundation.timeSig}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Drum Sample</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px' }}>
            {lockedFoundation.sampleName}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button className="btn" onClick={handleTogglePlay}>
          {isPlaying ? '⏸ Pause Synced Preview' : '▶ Play Synced Preview'}
        </button>

        <button className="btn btn-primary" onClick={() => alert('Phase 1 is complete! Ready to begin Phase 2: Beat Building (Arranger & Sample Browser).')}>
          🚀 Proceed to Phase 2 (Beat Building)
        </button>

        <button className="btn" onClick={reset} style={{ color: 'var(--text-muted)' }}>
          🔄 Start Over
        </button>
      </div>
    </div>
  );
}

