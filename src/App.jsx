/* ── BeatCraft AI — Main Application Shell ── */

import { useState } from 'react';
import useStore, { PHASES } from './store/useStore';
import AudioIntake from './components/AudioIntake';
import AnalyzingView from './components/AnalyzingView';
import DetectionResultCard from './components/DetectionResultCard';
import MiniDAWArranger from './components/MiniDAWArranger';
import LockedFoundationCard from './components/LockedFoundationCard';
import ApiKeysModal from './components/ApiKeysModal';

export default function App() {
  const { phase, error, clearError, reset, confirmedBpm, confirmedKey } = useStore();
  const [showKeysModal, setShowKeysModal] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ApiKeysModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
      />

      {/* ── App Header ── */}
      <header className="app-header">
        <div className="app-logo">
          <span>BeatCraft AI</span>
          <span style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Mini DAW Arranger & Tunebat Engine
          </span>
        </div>

        {confirmedBpm && confirmedKey && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
              {confirmedBpm} BPM
            </span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: '600' }}>
              {confirmedKey}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-sm"
            onClick={() => setShowKeysModal(true)}
            title="Configure API Keys for Openverse, Freesound, Jamendo & Wikimedia"
          >
            🔑 API Providers
          </button>
          <button className="btn btn-sm" onClick={reset} title="Reset session">
            ↺ Reset
          </button>
        </div>
      </header>

      {/* ── Progress Stepper ── */}
      <div className="phase-bar" style={{ overflowX: 'auto' }}>
        <div className={`phase-step ${phase === PHASES.INTAKE ? 'active' : ''} ${phase !== PHASES.INTAKE ? 'completed' : ''}`}>
          <span>1.1 Audio Intake</span>
        </div>
        <div className={`phase-connector ${phase !== PHASES.INTAKE ? 'completed' : ''}`} />

        <div className={`phase-step ${phase === PHASES.ANALYZING || phase === PHASES.DETECTION_RESULT ? 'active' : ''} ${[PHASES.FETCHING_DRUMS, PHASES.DRUM_SELECT, PHASES.LOCKED].includes(phase) ? 'completed' : ''}`}>
          <span>1.2 BPM & Key Engine</span>
        </div>
        <div className={`phase-connector ${[PHASES.FETCHING_DRUMS, PHASES.DRUM_SELECT, PHASES.LOCKED].includes(phase) ? 'completed' : ''}`} />

        <div className={`phase-step ${[PHASES.FETCHING_DRUMS, PHASES.DRUM_SELECT].includes(phase) ? 'active' : ''} ${phase === PHASES.LOCKED ? 'completed' : ''}`}>
          <span>1.3 Mini DAW & Drum Anchor</span>
        </div>
        <div className={`phase-connector ${phase === PHASES.LOCKED ? 'completed' : ''}`} />

        <div className="phase-step" style={{ opacity: 0.4 }} title="Coming in Phase 2">
          <span>Phase 2: Full Arranger</span>
        </div>
      </div>

      {/* ── Error Notification ── */}
      {error && (
        <div style={{
          padding: '12px 24px', background: 'rgba(225, 112, 85, 0.15)',
          borderBottom: '1px solid var(--danger)', color: 'var(--danger)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button className="btn btn-sm" onClick={clearError} style={{ background: 'transparent', border: 'none', color: 'var(--danger)' }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Main View Container ── */}
      <main className="main-content" style={{ maxWidth: '100%', padding: '24px 32px' }}>
        {phase === PHASES.INTAKE && <AudioIntake />}
        {phase === PHASES.ANALYZING && <AnalyzingView />}
        {phase === PHASES.DETECTION_RESULT && <DetectionResultCard />}
        {([PHASES.FETCHING_DRUMS, PHASES.DRUM_SELECT].includes(phase)) && <MiniDAWArranger />}
        {phase === PHASES.LOCKED && <LockedFoundationCard />}
      </main>
    </div>
  );
}
