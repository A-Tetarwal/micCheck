/* ── BeatCraft AI — Global State (Zustand) ── */
import { create } from 'zustand';

export const PHASES = {
  INTAKE: 'intake',
  ANALYZING: 'analyzing',
  DETECTION_RESULT: 'detection_result',
  FETCHING_DRUMS: 'fetching_drums',
  DRUM_SELECT: 'drum_select',
  LOCKED: 'locked',
};

export const KEYS = [
  'C Major', 'C Minor', 'C# Major', 'C# Minor',
  'D Major', 'D Minor', 'D# Major', 'D# Minor',
  'E Major', 'E Minor',
  'F Major', 'F Minor', 'F# Major', 'F# Minor',
  'G Major', 'G Minor', 'G# Major', 'G# Minor',
  'A Major', 'A Minor', 'A# Major', 'A# Minor',
  'B Major', 'B Minor',
];

export const TIME_SIGNATURES = ['4/4', '3/4', '6/8'];

const useStore = create((set, get) => ({
  // ── Phase state ──
  phase: PHASES.INTAKE,
  setPhase: (phase) => set({ phase }),

  // ── Audio buffer ──
  audioBuffer: null,
  audioUrl: null,
  audioDuration: 0,
  fileName: null,
  setAudio: (audioBuffer, audioUrl, duration, fileName) =>
    set({ audioBuffer, audioUrl, audioDuration: duration, fileName }),

  // ── Detection results ──
  detectedBpm: null,
  detectedKey: null,
  detectedTimeSig: '4/4',
  bpmConfidence: 0,
  keyConfidence: 0,

  // ── User overrides ──
  confirmedBpm: null,
  confirmedKey: null,
  confirmedTimeSig: '4/4',

  setDetectionResults: (bpm, key, timeSig, bpmConf, keyConf) =>
    set({
      detectedBpm: bpm,
      detectedKey: key,
      detectedTimeSig: timeSig,
      bpmConfidence: bpmConf,
      keyConfidence: keyConf,
      confirmedBpm: bpm,
      confirmedKey: key,
      confirmedTimeSig: timeSig,
      phase: PHASES.DETECTION_RESULT,
    }),

  setConfirmedBpm: (bpm) => set({ confirmedBpm: bpm }),
  setConfirmedKey: (key) => set({ confirmedKey: key }),
  setConfirmedTimeSig: (ts) => set({ confirmedTimeSig: ts }),

  // ── Tap tempo ──
  showTapTempo: false,
  setShowTapTempo: (show) => set({ showTapTempo: show }),

  // ── Drum samples ──
  drumSamples: [],
  selectedDrumId: null,
  setDrumSamples: (samples) => set({ drumSamples: samples }),
  setSelectedDrumId: (id) => set({ selectedDrumId: id }),

  // ── Locked state (persists to Phase 2 & 3) ──
  lockedFoundation: null,
  lockDrumFoundation: () => {
    const s = get();
    const selected = s.drumSamples.find(d => d.id === s.selectedDrumId);
    if (!selected) return;
    set({
      lockedFoundation: {
        sampleId: selected.id,
        sampleName: selected.name,
        sampleUrl: selected.previewUrl || selected.url,
        sampleBpm: selected.bpm,
        sourceUrl: selected.sourceUrl,
        bpm: s.confirmedBpm,
        key: s.confirmedKey,
        timeSig: s.confirmedTimeSig,
      },
      phase: PHASES.LOCKED,
    });
  },

  // ── Recording state ──
  isRecording: false,
  recordingDuration: 0,
  setIsRecording: (val) => set({ isRecording: val }),
  setRecordingDuration: (d) => set({ recordingDuration: d }),

  // ── Error handling ──
  error: null,
  setError: (err) => set({ error: err }),
  clearError: () => set({ error: null }),

  // ── Reset ──
  reset: () => set({
    phase: PHASES.INTAKE,
    audioBuffer: null, audioUrl: null, audioDuration: 0, fileName: null,
    detectedBpm: null, detectedKey: null, detectedTimeSig: '4/4',
    bpmConfidence: 0, keyConfidence: 0,
    confirmedBpm: null, confirmedKey: null, confirmedTimeSig: '4/4',
    showTapTempo: false,
    drumSamples: [], selectedDrumId: null,
    lockedFoundation: null,
    isRecording: false, recordingDuration: 0,
    error: null,
  }),
}));

export default useStore;

