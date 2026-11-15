/* ── API Keys Storage & State Management ──
 * Persists user API keys in localStorage for seamless multi-source fetching
 */

const STORAGE_KEY = 'beatcraft_api_keys';

export function getApiKeys() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not read API keys from localStorage:', e);
  }
  return {
    freesoundKey: '',
    jamendoClientId: '',
    openverseToken: '',
  };
}

export function saveApiKeys(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.warn('Could not save API keys to localStorage:', e);
  }
}

