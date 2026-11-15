/* ── API Keys Configuration Modal ──
 * Allows users to input and manage API keys for Freesound, Jamendo, and Openverse.
 * Displays connection status for all 4 web providers.
 */

import { useState } from 'react';
import { getApiKeys, saveApiKeys } from '../services/apiKeysStore';

export default function ApiKeysModal({ isOpen, onClose, onKeysUpdated }) {
  const [keys, setKeys] = useState(getApiKeys());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setKeys(prev => ({ ...prev, [field]: value.trim() }));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    saveApiKeys(keys);
    setSavedSuccess(true);
    if (onKeysUpdated) {
      onKeysUpdated(keys);
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    const empty = { freesoundKey: '', jamendoClientId: '', openverseToken: '' };
    setKeys(empty);
    saveApiKeys(empty);
    if (onKeysUpdated) {
      onKeysUpdated(empty);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }}>
      <div className="card fade-in" style={{
        maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-secondary)', border: '1px solid var(--accent)',
        boxShadow: '0 0 32px var(--accent-glow)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700' }}>API Provider Connections</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Connect multiple web audio libraries to stream real drum loops & samples.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* ── Status Grid ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
          marginBottom: '24px'
        }}>
          {/* Openverse */}
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#c56cf0' }}>Openverse</span>
              <span style={{ fontSize: '11px', color: 'var(--success)' }}>● Active</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Free public access (No key required)
            </div>
          </div>

          {/* Wikimedia */}
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#00cec9' }}>Wikimedia</span>
              <span style={{ fontSize: '11px', color: 'var(--success)' }}>● Active</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Public domain & CC open audio
            </div>
          </div>

          {/* Freesound */}
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#ff7675' }}>Freesound</span>
              <span style={{ fontSize: '11px', color: keys.freesoundKey ? 'var(--success)' : 'var(--warning)' }}>
                {keys.freesoundKey ? '● Connected' : '○ Key Needed'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Loops, drum kits & one-shots
            </div>
          </div>

          {/* Jamendo */}
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#ff9f43' }}>Jamendo</span>
              <span style={{ fontSize: '11px', color: keys.jamendoClientId ? 'var(--success)' : 'var(--warning)' }}>
                {keys.jamendoClientId ? '● Connected' : '○ Client ID Needed'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Instrumental & music stems
            </div>
          </div>
        </div>

        {/* ── Key Inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {/* Freesound */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Freesound API Key
              </label>
              <a
                href="https://freesound.org/apiv2/apply/"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                Get free key ↗
              </a>
            </div>
            <input
              type="text"
              placeholder="Paste Freesound API Token"
              value={keys.freesoundKey}
              onChange={(e) => handleChange('freesoundKey', e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--bg-primary)',
                border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '13px'
              }}
            />
          </div>

          {/* Jamendo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Jamendo Client ID
              </label>
              <a
                href="https://developer.jamendo.com/v3.0"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                Get free client ID ↗
              </a>
            </div>
            <input
              type="text"
              placeholder="Paste Jamendo Client ID"
              value={keys.jamendoClientId}
              onChange={(e) => handleChange('jamendoClientId', e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--bg-primary)',
                border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '13px'
              }}
            />
          </div>

          {/* Openverse (Optional) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Openverse OAuth Token (Optional)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Already works without key
              </span>
            </div>
            <input
              type="text"
              placeholder="Optional OAuth Bearer Token (higher rate limits)"
              value={keys.openverseToken}
              onChange={(e) => handleChange('openverseToken', e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: 'var(--bg-primary)',
                border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: '13px'
              }}
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-sm" onClick={handleClear} style={{ color: 'var(--danger)' }}>
            Clear Keys
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {savedSuccess ? '✓ Saved & Applied!' : 'Save & Refresh Sources'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

