/* ── Mini DAW Multitrack Arranger Component ──
 * Provides a professional DAW timeline interface matching Image 2:
 * - Multitrack header controls (Volume fader, Pan dial, Mute, Solo, +Fx)
 * - Draggable audio waveform clips on timeline grid
 * - Interactive playhead scrubber with timeline ruler
 * - Vocal slip/nudge against drum foundation
 * - Snap-to-grid & zoom controls
 * - Sample browser drawer for swapping drum loops from all 4 providers
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import useStore from '../store/useStore';
import { syncEngine } from '../engine/syncEngine';
import { drawWaveformToCanvas, drawProceduralWaveform } from '../utils/waveformDrawer';
import { fetchAllDrumSamples } from '../services/multiSourceSampleService';
import { getApiKeys } from '../services/apiKeysStore';
import ApiKeysModal from './ApiKeysModal';

export default function MiniDAWArranger() {
  const {
    confirmedBpm,
    confirmedKey,
    confirmedTimeSig,
    audioBuffer,
    fileName,
    drumSamples,
    setDrumSamples,
    selectedDrumId,
    setSelectedDrumId,
    lockDrumFoundation,
    setError,
  } = useStore();

  // Playback & timeline states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [playbackBars, setPlaybackBars] = useState('1:1:0');
  const [zoom, setZoom] = useState(90); // pixels per bar (default: 90px per bar)
  const [snapGrid, setSnapGrid] = useState('1/16'); // '1/16', '1/8', '1/4', '1/1', 'free'
  const [totalBars, setTotalBars] = useState(8);

  // Track 1: Vocal
  const [vocalOffset, setVocalOffset] = useState(0); // in seconds
  const [vocalVol, setVocalVol] = useState(0.85);
  const [vocalPan, setVocalPan] = useState(0);
  const [vocalMuted, setVocalMuted] = useState(false);
  const [vocalSolo, setVocalSolo] = useState(false);

  // Track 2: Drums
  const [drumOffset, setDrumOffset] = useState(0);
  const [drumVol, setDrumVol] = useState(0.9);
  const [drumPan, setDrumPan] = useState(0);
  const [drumMuted, setDrumMuted] = useState(false);
  const [drumSolo, setDrumSolo] = useState(false);
  const [drumLoopBars, setDrumLoopBars] = useState(8);

  // Dragging clip state
  const [isDraggingVocal, setIsDraggingVocal] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, initialOffset: 0 });

  // UI Drawers & Modals
  const [showSampleDrawer, setShowSampleDrawer] = useState(false);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState('all');

  // Canvas Refs
  const vocalCanvasRef = useRef(null);
  const drumCanvasRef = useRef(null);
  const timelineRulerRef = useRef(null);
  const tracksContainerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Time conversion helpers
  const secondsPerBeat = 60 / confirmedBpm;
  const secondsPerBar = secondsPerBeat * 4; // assuming 4/4
  const pixelsPerSecond = zoom / secondsPerBar;

  // Selected drum sample
  const selectedDrum = drumSamples.find(s => s.id === selectedDrumId) || drumSamples[0];

  // ── Initial load of audio & drum samples ──
  useEffect(() => {
    async function initDAW() {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        syncEngine.setTargetBpm(confirmedBpm);

        if (audioBuffer) {
          await syncEngine.setUserAudio(audioBuffer);
        }

        // Fetch samples across providers if empty
        if (drumSamples.length === 0) {
          const keys = getApiKeys();
          const { samples } = await fetchAllDrumSamples({
            bpm: confirmedBpm,
            key: confirmedKey,
            audioContext: audioContextRef.current,
            apiKeys: keys,
          });
          setDrumSamples(samples);
          if (samples.length > 0 && !selectedDrumId) {
            setSelectedDrumId(samples[0].id);
            await syncEngine.loadDrumSample(samples[0]);
          }
        } else if (selectedDrum) {
          await syncEngine.loadDrumSample(selectedDrum);
        }
      } catch (err) {
        console.error('DAW init error:', err);
      }
    }

    initDAW();

    syncEngine.setProgressCallback(({ seconds, position, isPlaying: playing }) => {
      setPlaybackSeconds(seconds);
      setPlaybackBars(position);
      setIsPlaying(playing);
    });

    return () => {
      syncEngine.stop();
    };
  }, [confirmedBpm, confirmedKey, audioBuffer, drumSamples.length, selectedDrumId, setDrumSamples, setSelectedDrumId]);

  // ── Render Waveforms on Canvas ──
  useEffect(() => {
    // Vocal Waveform
    if (vocalCanvasRef.current) {
      if (audioBuffer) {
        drawWaveformToCanvas(vocalCanvasRef.current, audioBuffer, '#ff4757', 'rgba(255, 71, 87, 0.2)');
      } else {
        drawProceduralWaveform(vocalCanvasRef.current, '#ff4757', 'rgba(255, 71, 87, 0.2)', 'vocal');
      }
    }

    // Drum Waveform
    if (drumCanvasRef.current) {
      if (selectedDrum?.buffer) {
        drawWaveformToCanvas(drumCanvasRef.current, selectedDrum.buffer, '#e67e22', 'rgba(230, 126, 34, 0.2)');
      } else {
        drawProceduralWaveform(drumCanvasRef.current, '#e67e22', 'rgba(230, 126, 34, 0.2)', 'drums');
      }
    }
  }, [audioBuffer, selectedDrum, zoom]);

  // ── Transport controls ──
  const handleTogglePlay = async () => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (e) {}

    const playing = await syncEngine.togglePlay();
    setIsPlaying(playing);
  };

  const handleStop = () => {
    syncEngine.stop();
    setPlaybackSeconds(0);
    setPlaybackBars('1:1:0');
  };

  const handleReturnToZero = () => {
    syncEngine.seek(0);
    setPlaybackSeconds(0);
  };

  // ── Snap to Grid calculation ──
  const getSnapIncrement = useCallback(() => {
    switch (snapGrid) {
      case '1/16': return secondsPerBeat / 4;
      case '1/8': return secondsPerBeat / 2;
      case '1/4': return secondsPerBeat;
      case '1/1': return secondsPerBar;
      case 'free':
      default: return 0.005;
    }
  }, [snapGrid, secondsPerBeat, secondsPerBar]);

  const snapTime = useCallback((time) => {
    const inc = getSnapIncrement();
    return Math.max(0, Math.round(time / inc) * inc);
  }, [getSnapIncrement]);

  // ── Vocal Clip Dragging & Nudging ──
  const handleVocalMouseDown = (e) => {
    e.stopPropagation();
    setIsDraggingVocal(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      initialOffset: vocalOffset,
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (isDraggingVocal) {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newRawOffset = dragStartRef.current.initialOffset + deltaTime;
      const snapped = snapTime(newRawOffset);
      setVocalOffset(snapped);
      syncEngine.setVocalOffset(snapped);
    } else if (isDraggingPlayhead && tracksContainerRef.current) {
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const clickX = Math.max(0, e.clientX - rect.left);
      const targetTime = clickX / pixelsPerSecond;
      syncEngine.seek(targetTime);
    }
  }, [isDraggingVocal, isDraggingPlayhead, pixelsPerSecond, snapTime]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingVocal(false);
    setIsDraggingPlayhead(false);
  }, []);

  useEffect(() => {
    if (isDraggingVocal || isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVocal, isDraggingPlayhead, handleMouseMove, handleMouseUp]);

  // ── Timeline Scrubbing ──
  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, e.clientX - rect.left);
    const targetTime = clickX / pixelsPerSecond;
    syncEngine.seek(targetTime);
  };

  // ── Nudge vocal timing ──
  const nudgeVocal = (deltaSeconds) => {
    const newOffset = Math.max(0, vocalOffset + deltaSeconds);
    setVocalOffset(newOffset);
    syncEngine.setVocalOffset(newOffset);
  };

  // ── Track controls ──
  const handleVocalVolChange = (val) => {
    setVocalVol(val);
    syncEngine.setUserVolume(val);
  };

  const handleDrumVolChange = (val) => {
    setDrumVol(val);
    syncEngine.setDrumVolume(val);
  };

  const handleVocalPanChange = (val) => {
    setVocalPan(val);
    syncEngine.setUserPan(val);
  };

  const handleDrumPanChange = (val) => {
    setDrumPan(val);
    syncEngine.setDrumPan(val);
  };

  const handleVocalMuteToggle = () => {
    const next = !vocalMuted;
    setVocalMuted(next);
    syncEngine.toggleMute('vocal', next);
  };

  const handleDrumMuteToggle = () => {
    const next = !drumMuted;
    setDrumMuted(next);
    syncEngine.toggleMute('drum', next);
  };

  const handleVocalSoloToggle = () => {
    const next = !vocalSolo;
    setVocalSolo(next);
    syncEngine.toggleSolo('vocal', next);
  };

  const handleDrumSoloToggle = () => {
    const next = !drumSolo;
    setDrumSolo(next);
    syncEngine.toggleSolo('drum', next);
  };

  // Swap drum sample from browser
  const handleSelectDrumSample = async (sample) => {
    setSelectedDrumId(sample.id);
    await syncEngine.loadDrumSample(sample);
  };

  // Calculate durations & widths
  const vocalDuration = audioBuffer ? audioBuffer.duration : 6.0;
  const drumDuration = selectedDrum?.duration || secondsPerBar;
  const vocalClipWidth = vocalDuration * pixelsPerSecond;
  const drumClipWidth = Math.min(totalBars * zoom, (selectedDrum?.duration || secondsPerBar) * pixelsPerSecond * (selectedDrum?.type === 'loop' ? drumLoopBars : 1));
  const timelineTotalWidth = Math.max(totalBars * zoom, (vocalOffset + vocalDuration) * pixelsPerSecond + 150);
  const playheadX = playbackSeconds * pixelsPerSecond;

  return (
    <div className="mini-daw-container fade-in" style={{ width: '100%', maxWidth: '1240px', margin: '0 auto' }}>
      <ApiKeysModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onKeysUpdated={() => {}}
      />

      {/* ── Top DAW Master Header Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: '14px', padding: '12px 18px', background: '#12131a', border: '1px solid #232533',
        borderRadius: '10px 10px 0 0', borderBottom: '2px solid #2a2d3d'
      }}>
        {/* Transport Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleReturnToZero}
            className="btn btn-sm"
            title="Return to Zero (|◀)"
            style={{ padding: '8px 10px', fontSize: '13px' }}
          >
            |◀
          </button>
          <button
            onClick={handleStop}
            className="btn btn-sm"
            title="Stop (⏹)"
            style={{ padding: '8px 10px', fontSize: '13px' }}
          >
            ⏹
          </button>
          <button
            onClick={handleTogglePlay}
            className="btn btn-sm btn-primary"
            style={{ padding: '8px 18px', fontSize: '15px', fontWeight: '700', minWidth: '90px' }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        {/* Counter Display (Bars : Beats : 16ths & Time) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px', padding: '6px 14px',
          background: '#090a0f', borderRadius: '6px', border: '1px solid #1c1d28',
          fontFamily: 'var(--font-mono)'
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Position</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: isPlaying ? '#00cec9' : '#e8e8f0' }}>
              {playbackBars}
            </div>
          </div>
          <div style={{ height: '22px', width: '1px', background: '#222' }} />
          <div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Time</div>
            <div style={{ fontSize: '14px', color: '#aaa' }}>
              {playbackSeconds.toFixed(2)}s
            </div>
          </div>
          <div style={{ height: '22px', width: '1px', background: '#222' }} />
          <div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Tempo</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#6c5ce7' }}>
              {confirmedBpm} BPM
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>Key</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ff7675' }}>
              {confirmedKey}
            </div>
          </div>
        </div>

        {/* Snap & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase' }}>Snap:</span>
            <select
              value={snapGrid}
              onChange={(e) => setSnapGrid(e.target.value)}
              style={{
                padding: '4px 8px', background: '#1c1e29', border: '1px solid #2e3244',
                color: '#ddd', borderRadius: '4px', fontSize: '12px'
              }}
            >
              <option value="1/16">1/16 Beat</option>
              <option value="1/8">1/8 Beat</option>
              <option value="1/4">1/4 Beat</option>
              <option value="1/1">1 Bar</option>
              <option value="free">Free (Off)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              className="btn btn-sm"
              onClick={() => setZoom(Math.max(50, zoom - 15))}
              title="Zoom Out"
              style={{ padding: '4px 8px' }}
            >
              -
            </button>
            <span style={{ fontSize: '11px', color: '#777', padding: '0 4px' }}>Zoom</span>
            <button
              className="btn btn-sm"
              onClick={() => setZoom(Math.min(200, zoom + 15))}
              title="Zoom In"
              style={{ padding: '4px 8px' }}
            >
              +
            </button>
          </div>
        </div>

        {/* Nudge vocal buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#777', textTransform: 'uppercase' }}>Nudge Vocal:</span>
          <button className="btn btn-sm" onClick={() => nudgeVocal(-0.01)} title="Nudge back 10ms" style={{ padding: '4px 6px', fontSize: '11px' }}>
            ◀ -10ms
          </button>
          <button className="btn btn-sm" onClick={() => nudgeVocal(-secondsPerBeat / 4)} title="Nudge back 1/16th" style={{ padding: '4px 6px', fontSize: '11px' }}>
            ◀ 1/16
          </button>
          <button className="btn btn-sm" onClick={() => nudgeVocal(secondsPerBeat / 4)} title="Nudge forward 1/16th" style={{ padding: '4px 6px', fontSize: '11px' }}>
            1/16 ▶
          </button>
          <button className="btn btn-sm" onClick={() => nudgeVocal(0.01)} title="Nudge forward 10ms" style={{ padding: '4px 6px', fontSize: '11px' }}>
            +10ms ▶
          </button>
        </div>

        {/* Drawer & Lock Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${showSampleDrawer ? 'btn-primary' : ''}`}
            onClick={() => setShowSampleDrawer(!showSampleDrawer)}
            style={{ borderColor: '#6c5ce7' }}
          >
            🥁 Swap Drum Sample {showSampleDrawer ? '▲' : '▼'}
          </button>
          <button
            className="btn btn-sm btn-success"
            onClick={() => {
              syncEngine.stop();
              lockDrumFoundation();
            }}
          >
            🔒 Lock Arrangement
          </button>
        </div>
      </div>

      {/* ── Sample Browser Slide-Over Panel (if opened) ── */}
      {showSampleDrawer && (
        <div style={{
          background: '#161722', border: '1px solid #2e3244', borderTop: 'none',
          padding: '16px', maxHeight: '260px', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0' }}>
              Select Drum Sample to Anchor Track 01 (Openverse, Freesound, Jamendo, Wikimedia, Studio)
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'openverse', 'freesound', 'jamendo', 'wikimedia', 'studio'].map(prov => (
                <button
                  key={prov}
                  className={`btn btn-sm ${activeProvider === prov ? 'btn-primary' : ''}`}
                  onClick={() => setActiveProvider(prov)}
                  style={{ textTransform: 'capitalize', fontSize: '11px', padding: '2px 8px' }}
                >
                  {prov}
                </button>
              ))}
              <button
                className="btn btn-sm"
                onClick={() => setShowKeysModal(true)}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                🔑 Keys
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {drumSamples
              .filter(s => activeProvider === 'all' || s.provider === activeProvider)
              .map(sample => {
                const isSelected = sample.id === selectedDrumId;
                return (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectDrumSample(sample)}
                    style={{
                      padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                      background: isSelected ? 'rgba(230, 126, 34, 0.2)' : '#101118',
                      border: isSelected ? '1px solid #e67e22' : '1px solid #232533',
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sample.name}
                      </span>
                      <span style={{
                        fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                        background: `${sample.providerBadgeColor || '#6c5ce7'}25`,
                        color: sample.providerBadgeColor || '#6c5ce7',
                        border: `1px solid ${sample.providerBadgeColor || '#6c5ce7'}50`,
                        fontWeight: '700', textTransform: 'uppercase'
                      }}>
                        {sample.providerName}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{sample.bpm ? `${sample.bpm} BPM` : 'One-Shot'}</span>
                      <span>{sample.license}</span>
                      <span style={{ color: isSelected ? '#e67e22' : '#555', fontWeight: '600' }}>
                        {isSelected ? '✓ Loaded' : 'Load'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Main DAW Multitrack Viewport (Matching Image 2) ── */}
      <div style={{
        display: 'flex', width: '100%', minHeight: '340px', background: '#0e0f15',
        border: '1px solid #232533', borderTop: 'none', borderRadius: '0 0 10px 10px',
        overflow: 'hidden'
      }}>
        {/* ── Left Column: Track Headers ── */}
        <div style={{ width: '220px', minWidth: '220px', background: '#12131a', borderRight: '2px solid #222533', zIndex: 10 }}>
          {/* Header spacer for timeline ruler */}
          <div style={{
            height: '32px', background: '#161822', borderBottom: '1px solid #262938',
            display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '11px',
            color: '#777', fontWeight: '700', letterSpacing: '0.5px'
          }}>
            TRACKS
          </div>

          {/* Track 01: Drums (Matching Image 2) */}
          <div style={{
            height: '110px', padding: '10px 12px', borderBottom: '1px solid #202330',
            borderLeft: '4px solid #e67e22', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', background: drumSolo ? 'rgba(230, 126, 34, 0.08)' : 'transparent'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#e67e22', fontSize: '13px' }}>🥁</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0' }}>01 Drums</span>
                <span style={{ fontSize: '10px', color: '#888' }}>▾</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={handleDrumMuteToggle}
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #333',
                    background: drumMuted ? '#ff4757' : '#1c1e28', color: drumMuted ? '#fff' : '#aaa',
                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                  }}
                  title="Mute Track"
                >
                  M
                </button>
                <button
                  onClick={handleDrumSoloToggle}
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #333',
                    background: drumSolo ? '#f1c40f' : '#1c1e28', color: drumSolo ? '#000' : '#aaa',
                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                  }}
                  title="Solo Track"
                >
                  S
                </button>
              </div>
            </div>

            {/* Volume slider & Pan dial */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={drumMuted ? 0 : drumVol}
                  onChange={(e) => handleDrumVolChange(parseFloat(e.target.value))}
                  style={{ width: '100%', height: '4px', accentColor: '#e67e22', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '9px', color: '#777', textAlign: 'right' }}>
                  {Math.round(drumVol * 100)}%
                </span>
              </div>

              {/* Pan dial */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={drumPan}
                  onChange={(e) => handleDrumPanChange(parseFloat(e.target.value))}
                  style={{ width: '42px', height: '3px', accentColor: '#aaa' }}
                  title={`Pan: ${drumPan === 0 ? 'C' : drumPan < 0 ? `L${Math.abs(Math.round(drumPan * 50))}` : `R${Math.round(drumPan * 50)}`}`}
                />
                <span style={{ fontSize: '8px', color: '#666' }}>L-C-R</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {selectedDrum?.name || 'Drum Loop'}
              </span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: '#1c1e29', color: '#e67e22' }}>
                +Fx
              </span>
            </div>
          </div>

          {/* Track 02: Lead Vocal Take (Matching Image 2) */}
          <div style={{
            height: '110px', padding: '10px 12px', borderBottom: '1px solid #202330',
            borderLeft: '4px solid #ff4757', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', background: vocalSolo ? 'rgba(255, 71, 87, 0.08)' : 'transparent'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#ff4757', fontSize: '13px' }}>🎙️</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0' }}>02 Vocal</span>
                <span style={{ fontSize: '10px', color: '#888' }}>▾</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={handleVocalMuteToggle}
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #333',
                    background: vocalMuted ? '#ff4757' : '#1c1e28', color: vocalMuted ? '#fff' : '#aaa',
                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                  }}
                  title="Mute Track"
                >
                  M
                </button>
                <button
                  onClick={handleVocalSoloToggle}
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #333',
                    background: vocalSolo ? '#f1c40f' : '#1c1e28', color: vocalSolo ? '#000' : '#aaa',
                    fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                  }}
                  title="Solo Track"
                >
                  S
                </button>
              </div>
            </div>

            {/* Volume slider & Pan dial */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={vocalMuted ? 0 : vocalVol}
                  onChange={(e) => handleVocalVolChange(parseFloat(e.target.value))}
                  style={{ width: '100%', height: '4px', accentColor: '#ff4757', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '9px', color: '#777', textAlign: 'right' }}>
                  {Math.round(vocalVol * 100)}%
                </span>
              </div>

              {/* Pan dial */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={vocalPan}
                  onChange={(e) => handleVocalPanChange(parseFloat(e.target.value))}
                  style={{ width: '42px', height: '3px', accentColor: '#aaa' }}
                  title={`Pan: ${vocalPan === 0 ? 'C' : vocalPan < 0 ? `L${Math.abs(Math.round(vocalPan * 50))}` : `R${Math.round(vocalPan * 50)}`}`}
                />
                <span style={{ fontSize: '8px', color: '#666' }}>L-C-R</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {fileName || 'Raw Vocal Take.wav'}
              </span>
              <span style={{ padding: '1px 5px', borderRadius: '3px', background: '#1c1e29', color: '#ff4757' }}>
                +Fx
              </span>
            </div>
          </div>

          {/* Track 03: Bass (Phase 2 Arranger Preview) */}
          <div style={{
            height: '90px', padding: '10px 12px', borderBottom: '1px solid #202330',
            borderLeft: '4px solid #00cec9', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', opacity: 0.45
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#00cec9', fontSize: '13px' }}>🎸</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#e8e8f0' }}>03 Bass</span>
              </div>
              <span style={{ fontSize: '9px', background: '#1c1e28', padding: '2px 5px', borderRadius: '3px', color: '#888' }}>
                Phase 2
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              Multi-track slots unlocked in Phase 2
            </div>
          </div>
        </div>

        {/* ── Right Column: Interactive Multitrack Timeline Grid ── */}
        <div
          ref={tracksContainerRef}
          style={{
            flex: 1, overflowX: 'auto', position: 'relative', background: '#090a0f',
            userSelect: 'none'
          }}
        >
          {/* Timeline Inner Content with dynamic width */}
          <div style={{ width: `${timelineTotalWidth}px`, minWidth: '100%', position: 'relative' }}>
            {/* ── Timeline Ruler (Bars 1..N) ── */}
            <div
              ref={timelineRulerRef}
              onClick={handleTimelineClick}
              style={{
                height: '32px', background: '#141620', borderBottom: '1px solid #262938',
                display: 'flex', position: 'relative', cursor: 'pointer'
              }}
            >
              {Array.from({ length: Math.ceil(timelineTotalWidth / zoom) + 1 }).map((_, barIdx) => {
                const barNum = barIdx + 1;
                return (
                  <div
                    key={barIdx}
                    style={{
                      width: `${zoom}px`, height: '100%', borderRight: '1px solid #282c3f',
                      position: 'relative', display: 'flex', alignItems: 'flex-end', paddingBottom: '4px'
                    }}
                  >
                    <span style={{
                      fontSize: '11px', fontWeight: '700', color: '#8e92a8', paddingLeft: '6px',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {barNum}
                    </span>

                    {/* Quarter beat ticks */}
                    {[1, 2, 3].map((beat) => (
                      <div
                        key={beat}
                        style={{
                          position: 'absolute', left: `${(beat / 4) * 100}%`, bottom: 0,
                          height: '8px', width: '1px', background: '#303448'
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* ── Interactive Playhead Scrubber (White line + Circle pin) ── */}
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0, left: `${playheadX}px`,
                width: '2px', background: '#ffffff', zIndex: 30, pointerEvents: 'none',
                boxShadow: '0 0 8px rgba(255,255,255,0.7)',
                transition: isDraggingPlayhead ? 'none' : 'left 0.035s linear'
              }}
            >
              {/* Playhead Circle Pin at Top (Exact match to Image 2) */}
              <div
                style={{
                  position: 'absolute', top: '1px', left: '-6px', width: '14px', height: '14px',
                  borderRadius: '50%', background: '#ffffff', border: '2px solid #6c5ce7',
                  boxShadow: '0 0 10px #ffffff', pointerEvents: 'auto', cursor: 'ew-resize'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingPlayhead(true);
                }}
              />
            </div>

            {/* ── Lane 01: Drums Waveform Track ── */}
            <div style={{
              height: '110px', position: 'relative', borderBottom: '1px solid #1c1d28',
              background: '#0d0e14'
            }}>
              {/* Beat grid vertical lines */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                {Array.from({ length: Math.ceil(timelineTotalWidth / (zoom / 4)) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: `${i * (zoom / 4)}px`, top: 0, bottom: 0,
                      width: '1px', background: i % 4 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'
                    }}
                  />
                ))}
              </div>

              {/* Drums Audio Clip (Burnt Orange Waveform matching Image 2) */}
              <div
                style={{
                  position: 'absolute', left: `${drumOffset * pixelsPerSecond}px`,
                  top: '8px', height: '94px', width: `${drumClipWidth}px`,
                  borderRadius: '6px', background: '#2e190e', border: '1px solid #d35400',
                  boxShadow: '0 2px 10px rgba(211, 84, 0, 0.25)', overflow: 'hidden'
                }}
              >
                {/* Clip Title Header */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '20px',
                  background: 'rgba(211, 84, 0, 0.85)', padding: '0 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '11px', fontWeight: '700', color: '#fff', zIndex: 2
                }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedDrum?.name || 'PixelSkyV5_beat_hatsreversed_140'}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.85 }}>
                    {selectedDrum?.bpm || confirmedBpm} BPM (Loop x{drumLoopBars})
                  </span>
                </div>

                {/* Waveform Canvas */}
                <canvas
                  ref={drumCanvasRef}
                  width={Math.max(100, Math.floor(drumClipWidth))}
                  height={74}
                  style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '74px' }}
                />
              </div>
            </div>

            {/* ── Lane 02: Lead Vocal Waveform Track (Draggable & Re-arrangeable) ── */}
            <div style={{
              height: '110px', position: 'relative', borderBottom: '1px solid #1c1d28',
              background: '#0d0e14'
            }}>
              {/* Beat grid vertical lines */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                {Array.from({ length: Math.ceil(timelineTotalWidth / (zoom / 4)) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: `${i * (zoom / 4)}px`, top: 0, bottom: 0,
                      width: '1px', background: i % 4 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'
                    }}
                  />
                ))}
              </div>

              {/* Vocal Audio Clip (Draggable across timeline against sample) */}
              <div
                onMouseDown={handleVocalMouseDown}
                style={{
                  position: 'absolute', left: `${vocalOffset * pixelsPerSecond}px`,
                  top: '8px', height: '94px', width: `${vocalClipWidth}px`,
                  borderRadius: '6px', background: '#301317', border: '1px solid #ff4757',
                  boxShadow: isDraggingVocal ? '0 0 20px rgba(255, 71, 87, 0.6)' : '0 2px 10px rgba(255, 71, 87, 0.25)',
                  cursor: isDraggingVocal ? 'grabbing' : 'grab',
                  zIndex: isDraggingVocal ? 20 : 5,
                  overflow: 'hidden',
                  transition: isDraggingVocal ? 'none' : 'box-shadow 0.2s ease'
                }}
              >
                {/* Clip Title Header */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '20px',
                  background: 'rgba(255, 71, 87, 0.85)', padding: '0 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '11px', fontWeight: '700', color: '#fff', zIndex: 2
                }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fileName || 'AO_Vocbass_133_Cm_4bars'}
                  </span>
                  <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '3px' }}>
                    Offset: +{(vocalOffset * 1000).toFixed(0)}ms · Drag to Align
                  </span>
                </div>

                {/* Waveform Canvas */}
                <canvas
                  ref={vocalCanvasRef}
                  width={Math.max(100, Math.floor(vocalClipWidth))}
                  height={74}
                  style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '74px' }}
                />
              </div>
            </div>

            {/* ── Lane 03: Bass Track (Empty slot preview for Phase 2) ── */}
            <div style={{
              height: '90px', position: 'relative', borderBottom: '1px solid #1c1d28',
              background: '#090a0f', opacity: 0.4
            }}>
              <div style={{ padding: '24px', color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
                Drop bass or melody samples here in Phase 2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drag & Alignment Helper Bar ── */}
      <div style={{
        marginTop: '16px', padding: '12px 16px', background: '#12131a', borderRadius: '8px',
        border: '1px solid #232533', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#aaa' }}>
            🎯 <strong>Vocal Alignment:</strong> Click & drag the <strong>red Vocal clip</strong> along the timeline to sync its downbeats with the <strong>orange Drum loop</strong>.
          </span>
          <span style={{
            fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(255, 71, 87, 0.15)', color: '#ff4757',
            fontFamily: 'var(--font-mono)'
          }}>
            Vocal Start: Bar {(vocalOffset / secondsPerBar + 1).toFixed(2)} (+{(vocalOffset * 1000).toFixed(0)}ms)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm"
            onClick={() => {
              setVocalOffset(0);
              syncEngine.setVocalOffset(0);
            }}
          >
            Reset Vocal to Bar 1
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              syncEngine.stop();
              lockDrumFoundation();
            }}
          >
            🔒 Lock Vocal Alignment & Drum
          </button>
        </div>
      </div>
    </div>
  );
}

