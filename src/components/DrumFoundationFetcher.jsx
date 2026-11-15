/* ── Module 1.3: Drum Foundation Fetcher Component ──
 * Multi-Source Sample Browser & Synced Audition Engine:
 * - Aggregates Openverse, Freesound, Jamendo, Wikimedia Commons & Studio Library
 * - Commercial-use filters & license indicators
 * - One-click A/B sample toggling without stopping playback
 * - Time-stretch indicator (playbackRate = confirmedBpm / sampleBpm)
 * - Locks foundation state for Phase 2 & 3
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import useStore from '../store/useStore';
import { syncEngine } from '../engine/syncEngine';
import { fetchAllDrumSamples } from '../services/multiSourceSampleService';
import { getApiKeys } from '../services/apiKeysStore';
import ApiKeysModal from './ApiKeysModal';

export default function DrumFoundationFetcher() {
  const {
    confirmedBpm,
    confirmedKey,
    confirmedTimeSig,
    audioBuffer,
    audioUrl,
    drumSamples,
    setDrumSamples,
    selectedDrumId,
    setSelectedDrumId,
    lockDrumFoundation,
    setError,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState('0:0:0');
  const [vocalVol, setVocalVol] = useState(0.85);
  const [drumVol, setDrumVol] = useState(0.9);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState('all'); // 'all' | 'openverse' | 'freesound' | 'jamendo' | 'wikimedia' | 'studio'
  const [activeType, setActiveType] = useState('all'); // 'all' | 'loop' | 'one-shot'
  const [sourceCounts, setSourceCounts] = useState({});
  const audioContextRef = useRef(null);

  // ── Load audio & samples across all providers ──
  const loadSamples = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const keys = getApiKeys();

      const { samples, counts } = await fetchAllDrumSamples({
        bpm: confirmedBpm,
        key: confirmedKey,
        audioContext: audioContextRef.current,
        apiKeys: keys,
      });

      setDrumSamples(samples);
      setSourceCounts(counts);

      // Select first sample or AI suggested if none currently selected
      if (samples.length > 0) {
        const defaultPick = samples.find(s => s.isAiSuggested) || samples[0];
        if (defaultPick && !selectedDrumId) {
          setSelectedDrumId(defaultPick.id);
        }
      }

      // Prepare sync engine
      syncEngine.setTargetBpm(confirmedBpm);
      if (audioBuffer) {
        await syncEngine.setUserAudio(audioBuffer);
      } else if (audioUrl) {
        await syncEngine.setUserAudio(audioUrl);
      }
    } catch (err) {
      console.error('Failed to load multi-source samples:', err);
      setError('Error loading samples: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [confirmedBpm, confirmedKey, audioBuffer, audioUrl, selectedDrumId, setDrumSamples, setSelectedDrumId, setError]);

  useEffect(() => {
    loadSamples();

    syncEngine.setProgressCallback(({ position, isPlaying: playing }) => {
      setPlaybackTime(position);
      setIsPlaying(playing);
    });

    return () => {
      syncEngine.stop();
    };
  }, [loadSamples]);

  // ── One-click A/B toggle handler with user gesture ──
  const handleSelectSample = useCallback(async (sample) => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (e) {}

    setSelectedDrumId(sample.id);
    await syncEngine.loadDrumSample(sample);
  }, [setSelectedDrumId]);

  // ── Play / Pause toggle with user gesture ──
  const handleTogglePlay = useCallback(async () => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (e) {}

    const playing = await syncEngine.togglePlay();
    setIsPlaying(playing);
  }, []);

  const handleVocalVolChange = (val) => {
    setVocalVol(val);
    syncEngine.setUserVolume(val);
  };

  const handleDrumVolChange = (val) => {
    setDrumVol(val);
    syncEngine.setDrumVolume(val);
  };

  const handleLock = () => {
    syncEngine.stop();
    lockDrumFoundation();
  };

  // ── Filter samples ──
  const filteredSamples = drumSamples.filter(s => {
    const matchesProvider = activeProvider === 'all' || s.provider === activeProvider;
    const matchesType = activeType === 'all' || s.type === activeType;
    return matchesProvider && matchesType;
  });

  const selectedSample = drumSamples.find(s => s.id === selectedDrumId);
  const keys = getApiKeys();

  return (
    <div className="drum-foundation fade-in">
      {/* ── API Keys Modal ── */}
      <ApiKeysModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onKeysUpdated={loadSamples}
      />

      {/* ── Section Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div className="section-title">🥁 Module 1.3: Multi-Source Drum Foundation</div>
          <div className="section-subtitle">
            Audition real drum loops & one-shots sourced from <strong>Openverse</strong>, <strong>Freesound</strong>, <strong>Jamendo</strong>, <strong>Wikimedia Commons</strong>, and <strong>Studio</strong>.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowKeysModal(true)}
            title="Configure API Keys"
          >
            🔑 Manage API Providers
            {keys.freesoundKey || keys.jamendoClientId ? ' (Active)' : ''}
          </button>
          <button
            className="btn btn-sm"
            onClick={loadSamples}
            disabled={isLoading}
            title="Refresh sample queries"
          >
            {isLoading ? '⏳ Searching...' : '🔄 Re-fetch'}
          </button>
        </div>
      </div>

      {/* ── Synced Playback Master Bar ── */}
      <div className="playback-controls" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
        <button
          className="play-btn"
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause Synced Playback' : 'Start Synced Playback'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Tone.js Transport Sync
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '700', color: isPlaying ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
            {playbackTime} · {confirmedBpm} BPM ({confirmedKey})
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Vocal Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🎤 Vocal</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={vocalVol}
            onChange={(e) => handleVocalVolChange(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--accent)' }}
          />
        </div>

        {/* Drum Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>🥁 Drums</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={drumVol}
            onChange={(e) => handleDrumVolChange(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--accent-secondary)' }}
          />
        </div>

        {/* Lock Button */}
        <button
          className="btn btn-success"
          disabled={!selectedDrumId}
          onClick={handleLock}
          style={{ marginLeft: '12px' }}
        >
          🔒 Lock Foundation
        </button>
      </div>

      {/* ── Source Provider Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>
          Source:
        </span>
        <button
          className={`btn btn-sm ${activeProvider === 'all' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('all')}
        >
          All Sources ({drumSamples.length})
        </button>
        <button
          className={`btn btn-sm ${activeProvider === 'openverse' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('openverse')}
          style={{ borderColor: '#c56cf0' }}
        >
          🌐 Openverse {sourceCounts.openverse ? `(${sourceCounts.openverse})` : ''}
        </button>
        <button
          className={`btn btn-sm ${activeProvider === 'freesound' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('freesound')}
          style={{ borderColor: '#ff7675' }}
        >
          🔊 Freesound {sourceCounts.freesound ? `(${sourceCounts.freesound})` : ''}
        </button>
        <button
          className={`btn btn-sm ${activeProvider === 'jamendo' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('jamendo')}
          style={{ borderColor: '#ff9f43' }}
        >
          🎵 Jamendo {sourceCounts.jamendo ? `(${sourceCounts.jamendo})` : ''}
        </button>
        <button
          className={`btn btn-sm ${activeProvider === 'wikimedia' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('wikimedia')}
          style={{ borderColor: '#00cec9' }}
        >
          🏛️ Wikimedia {sourceCounts.wikimedia ? `(${sourceCounts.wikimedia})` : ''}
        </button>
        <button
          className={`btn btn-sm ${activeProvider === 'studio' ? 'btn-primary' : ''}`}
          onClick={() => setActiveProvider('studio')}
          style={{ borderColor: '#6c5ce7' }}
        >
          🎛️ Studio Synthesized {sourceCounts.studio ? `(${sourceCounts.studio})` : ''}
        </button>
      </div>

      {/* ── Type Filters ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn btn-sm ${activeType === 'all' ? 'btn-primary' : ''}`}
          onClick={() => setActiveType('all')}
        >
          All Types
        </button>
        <button
          className={`btn btn-sm ${activeType === 'loop' ? 'btn-primary' : ''}`}
          onClick={() => setActiveType('loop')}
        >
          🔄 Full Loops
        </button>
        <button
          className={`btn btn-sm ${activeType === 'one-shot' ? 'btn-primary' : ''}`}
          onClick={() => setActiveType('one-shot')}
        >
          💥 One-Shots (Kick / Snare / Hat)
        </button>
      </div>

      {/* ── Loading state ── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', animation: 'pulse 1s infinite' }}>🥁</div>
          <div style={{ marginTop: '10px' }}>Searching Openverse, Freesound, Jamendo, Wikimedia Commons & Studio...</div>
        </div>
      )}

      {/* ── Sample Cards Grid ── */}
      <div className="samples-grid">
        {filteredSamples.map((sample) => {
          const isSelected = sample.id === selectedDrumId;
          const isLoop = sample.type === 'loop';
          const playbackRate = isLoop && sample.bpm ? confirmedBpm / sample.bpm : 1;
          const timeStretched = Math.abs(playbackRate - 1.0) > 0.02;

          return (
            <div
              key={sample.id}
              className={`sample-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectSample(sample)}
            >
              {/* Header with Provider Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                <span className="sample-name" style={{ flex: 1, wordBreak: 'break-word' }}>
                  {sample.name}
                </span>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                    background: `${sample.providerBadgeColor || '#6c5ce7'}25`,
                    color: sample.providerBadgeColor || '#6c5ce7',
                    border: `1px solid ${sample.providerBadgeColor || '#6c5ce7'}50`,
                    fontWeight: '700', textTransform: 'uppercase'
                  }}>
                    {sample.providerName}
                  </span>
                  {sample.isAiSuggested && (
                    <span style={{
                      fontSize: '10px', background: 'var(--accent)', color: 'white',
                      padding: '2px 6px', borderRadius: '4px', fontWeight: '700'
                    }}>
                      AI PICK
                    </span>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="sample-meta" style={{ marginBottom: '8px' }}>
                <span>{sample.type === 'loop' ? '🔄 Loop' : '💥 One-Shot'}</span>
                {sample.bpm && <span>{sample.bpm} BPM</span>}
                {sample.duration && <span>{sample.duration.toFixed(1)}s</span>}
                <span title="License">{sample.license}</span>
                {sample.isCommercial && (
                  <span style={{ color: 'var(--success)' }} title="Safe for commercial use">
                    ✓ Commercial OK
                  </span>
                )}
              </div>

              {/* Time stretch badge */}
              {isLoop && timeStretched && (
                <div style={{
                  fontSize: '11px', color: 'var(--accent-secondary)', background: 'rgba(0, 206, 201, 0.1)',
                  padding: '3px 8px', borderRadius: '4px', marginBottom: '8px', display: 'inline-block'
                }}>
                  ⚡ Stretched to {confirmedBpm} BPM ({playbackRate.toFixed(2)}x)
                </div>
              )}

              {/* Artist / Attribution */}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                By: <span style={{ color: 'var(--text-primary)' }}>{sample.artist}</span>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                {sample.tags?.slice(0, 4).map((tag, i) => (
                  <span key={i} className="sample-tag">#{tag}</span>
                ))}
              </div>

              {/* Source link & Selected Status */}
              <div style={{
                marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '11px'
              }}>
                <a
                  href={sample.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  Source ↗
                </a>

                {isSelected && (
                  <span style={{ color: 'var(--success)', fontWeight: '600' }}>
                    {isPlaying ? '▶ Playing in Sync' : '✓ Selected'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Empty State ── */}
      {filteredSamples.length === 0 && !isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '15px', fontWeight: '600' }}>No samples found for this filter</div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Try selecting "All Sources" or connecting your API keys to query Freesound and Jamendo directly.
          </p>
        </div>
      )}

      {/* ── Bottom Action Card ── */}
      {selectedSample && (
        <div className="card" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Selected Anchor Foundation
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {selectedSample.name} · <span style={{ color: selectedSample.providerBadgeColor || 'var(--accent)' }}>[{selectedSample.providerName}]</span> · {confirmedBpm} BPM
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" onClick={handleTogglePlay}>
              {isPlaying ? '⏸ Pause' : '▶ Preview Synced'}
            </button>
            <button className="btn btn-primary" onClick={handleLock}>
              🔒 Lock & Complete Phase 1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
