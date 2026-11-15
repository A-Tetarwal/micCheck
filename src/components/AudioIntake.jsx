/* ── Module 1.1: AudioIntake Component ──
 * Handles:
 * - Drag-and-drop file upload (.mp3, .wav, .m4a, .ogg, .webm)
 * - In-browser microphone recording (MediaRecorder API)
 * - Real-time visual waveform canvas while recording + WaveSurfer preview
 * - File size limit: 50MB; duration limit: 3 minutes
 * - AudioContext.createMediaStreamSource() mic input
 * - Mic options: { echoCancellation: false, noiseSuppression: false }
 * - Normalization to 44.1kHz mono WAV PCM & -18 LUFS gain normalization
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import useStore, { PHASES } from '../store/useStore';
import { normalizeAudioBuffer, normalizeLUFS, formatTime, formatFileSize } from '../utils/audioUtils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION = 180; // 3 minutes
const ACCEPTED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/m4a', 'audio/x-m4a', 'audio/mp4',
  'audio/ogg', 'audio/webm',
];
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm'];

export default function AudioIntake() {
  const { setAudio, setPhase, isRecording, setIsRecording, setError } = useStore();

  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loadedFile, setLoadedFile] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const waveformRef = useRef(null);
  const canvasRef = useRef(null);
  const wavesurferRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  // ── Initialize WaveSurfer ──
  useEffect(() => {
    if (waveformRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#6c5ce7',
        progressColor: '#00cec9',
        cursorColor: '#e8e8f0',
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        height: 120,
        responsive: true,
        normalize: true,
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ── Process audio file or recording ──
  const processAudioFile = useCallback(async (file) => {
    setError(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${formatFileSize(file.size)}) exceeds the 50MB limit.`);
      return;
    }

    // Validate file type
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported format (${ext}). Supported: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }

    setProcessing(true);
    setLoadedFile(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
        });
      }
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Validate duration
      if (audioBuffer.duration > MAX_DURATION) {
        setError(`Audio duration (${formatTime(audioBuffer.duration)}) exceeds 3 minute limit.`);
        setProcessing(false);
        return;
      }

      // Step 1: Normalize to mono 44100Hz
      const normalized = await normalizeAudioBuffer(audioBuffer);

      // Step 2: Normalize LUFS to -18 (Technical Note requirement)
      normalizeLUFS(normalized, -18);

      // Create URL for waveform and preview
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);

      // Display waveform in WaveSurfer
      if (wavesurferRef.current) {
        wavesurferRef.current.loadBlob(blob);
      }

      // Store in global state
      setAudio(normalized, url, normalized.duration, file.name);

      // Transition to analysis
      setPhase(PHASES.ANALYZING);
    } catch (err) {
      console.error('Audio processing error:', err);
      setError(`Audio ingestion error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }, [setAudio, setPhase, setError]);

  // ── Drag & Drop handlers ──
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processAudioFile(file);
  }, [processAudioFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) processAudioFile(file);
  }, [processAudioFile]);

  // ── Live Waveform Animation Loop ──
  const startLiveWaveform = (analyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#12121a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#00cec9';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  // ── In-Browser Microphone Recording ──
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      // TECHNICAL NOTE: Always request mic with { echoCancellation: false, noiseSuppression: false }
      // These filters corrupt musical content and voice harmonics
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // AudioContext.createMediaStreamSource() for mic input
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioCtx = audioContextRef.current;
      const mediaStreamSource = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      mediaStreamSource.connect(analyser);

      // Start live waveform canvas display
      startLiveWaveform(analyser);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `mic-take-${Date.now()}.webm`, { type: 'audio/webm' });
        await processAudioFile(file);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Timer with 3 min max constraint
      let elapsed = 0;
      recordingTimerRef.current = setInterval(() => {
        elapsed += 0.1;
        setRecordingTime(elapsed);
        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Microphone access denied or unequipped: ' + err.message);
    }
  }, [processAudioFile, setIsRecording, setError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  }, [setIsRecording]);

  return (
    <div className="audio-intake fade-in">
      <div className="section-title">🎤 Module 1.1: Audio Intake</div>
      <div className="section-subtitle">
        Upload a file or record your musical idea (hum, sing, beatbox, or voice memo).
      </div>

      <div className="tip-banner">
        <span className="tip-icon">💡</span>
        <span>
          <strong>Microphone Setting:</strong> Echo cancellation and noise suppression are automatically disabled to preserve natural harmonic timbre and vocal transients.
        </span>
      </div>

      {/* ── Drop Zone ── */}
      {!isRecording && !processing && (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-icon">📁</div>
          <div className="drop-zone-text">
            Drag & drop raw audio file here, or click to browse
          </div>
          <div className="drop-zone-hint">
            Supports .mp3, .wav, .m4a, .ogg, .webm · Max 50MB / 3 minutes
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* ── Divider ── */}
      {!isRecording && !processing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          margin: '24px 0', color: 'var(--text-muted)',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '13px', fontWeight: '600' }}>OR RECORD DIRECTLY</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
      )}

      {/* ── Recording Controls ── */}
      {!processing && (
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {!isRecording ? (
            <button className="btn btn-lg btn-danger" onClick={startRecording}>
              🎙️ Record Raw Vocal / Beatbox
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div className="recording-indicator" style={{ fontSize: '16px' }}>
                <span className="recording-dot" />
                Recording in Progress · {formatTime(recordingTime)} / 3:00
              </div>

              {/* Real-time live oscilloscope / waveform canvas */}
              <canvas
                ref={canvasRef}
                width={700}
                height={120}
                style={{
                  width: '100%', maxWidth: '700px', height: '120px',
                  borderRadius: 'var(--radius)', border: '1px solid var(--accent)',
                  background: 'var(--bg-secondary)', display: 'block'
                }}
              />

              <button
                className="btn btn-lg"
                onClick={stopRecording}
                style={{ borderColor: 'var(--recording)', color: 'var(--recording)' }}
              >
                ⏹️ Stop Recording & Analyze
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Processing State ── */}
      {processing && (
        <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'pulse 1s infinite' }}>
            🎚️
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Normalizing Audio Ingest
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Downmixing to mono 44.1kHz WAV PCM · Calibrating loudness to -18 LUFS
          </div>
          {loadedFile && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>{loadedFile}</div>}
        </div>
      )}

      {/* ── WaveSurfer Preview Container ── */}
      <div
        ref={waveformRef}
        className="waveform-container"
        style={{ display: isRecording || processing ? 'none' : 'block', marginTop: '16px' }}
      />
    </div>
  );
}
