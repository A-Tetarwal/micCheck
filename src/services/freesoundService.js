/* ── Freesound API Service ──
 * Fetches drum loops and one-shots from Freesound.org
 * Requires API key (uses demo/mock data if key not set)
 */

const FREESOUND_API_BASE = 'https://freesound.org/apiv2';

// ── Mock drum samples for development (when API key not available) ──
const MOCK_DRUM_SAMPLES = [
  {
    id: 'mock-loop-1',
    name: 'Boom Bap Drum Loop',
    type: 'loop',
    bpm: 90,
    duration: 3.2,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['drums', 'loop', 'boom-bap', 'hip-hop'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-loop-2',
    name: 'Trap Hi-Hat Pattern',
    type: 'loop',
    bpm: 140,
    duration: 2.8,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC-BY',
    tags: ['drums', 'trap', 'hi-hat', 'loop'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-loop-3',
    name: 'Lo-Fi Drum Break',
    type: 'loop',
    bpm: 85,
    duration: 3.5,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['drums', 'lofi', 'break', 'loop'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-loop-4',
    name: 'R&B Groove Loop',
    type: 'loop',
    bpm: 95,
    duration: 3.0,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC-BY',
    tags: ['drums', 'rnb', 'groove', 'loop'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-kick-1',
    name: '808 Kick (Deep)',
    type: 'one-shot',
    instrument: 'kick',
    bpm: null,
    duration: 0.8,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['kick', '808', 'deep'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-snare-1',
    name: 'Snappy Snare',
    type: 'one-shot',
    instrument: 'snare',
    bpm: null,
    duration: 0.5,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['snare', 'snappy', 'crisp'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-hihat-1',
    name: 'Closed Hi-Hat (Tight)',
    type: 'one-shot',
    instrument: 'hihat',
    bpm: null,
    duration: 0.2,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['hihat', 'closed', 'tight'],
    username: 'BeatCraft Demo',
  },
  {
    id: 'mock-ai-1',
    name: '⚡ AI Suggested: Perfect Match',
    type: 'loop',
    bpm: 92,
    duration: 3.0,
    previewUrl: null,
    sourceUrl: '#',
    license: 'CC0',
    tags: ['drums', 'ai-pick', 'matched'],
    username: 'BeatCraft AI',
    isAiSuggested: true,
  },
];

/**
 * Fetch drum samples from Freesound API
 * Falls back to mock data if API key is not set
 */
export async function fetchDrumSamples(bpm, key, apiKey = null) {
  if (!apiKey) {
    console.log('[Freesound] No API key — using demo samples');
    return adaptMockSamples(bpm, key);
  }

  try {
    const results = [];

    // Fetch drum loops
    const loopQuery = `drum loop ${bpm} bpm`;
    const loopResults = await searchFreesound(loopQuery, apiKey, {
      filter: 'duration:[0.5 TO 4]',
      sort: 'rating_desc',
      page_size: 4,
    });
    results.push(...loopResults.map(r => ({ ...r, type: 'loop' })));

    // Fetch individual hits
    for (const hitType of ['kick drum', 'snare drum', 'hi-hat']) {
      const hitResults = await searchFreesound(hitType, apiKey, {
        filter: 'duration:[0.05 TO 2]',
        sort: 'rating_desc',
        page_size: 1,
      });
      results.push(...hitResults.map(r => ({
        ...r,
        type: 'one-shot',
        instrument: hitType.split(' ')[0],
      })));
    }

    // Add AI-suggested match (best rated from all results)
    if (results.length > 0) {
      const aiPick = { ...results[0], isAiSuggested: true, name: `⚡ AI Suggested: ${results[0].name}` };
      results.push(aiPick);
    }

    return results;
  } catch (err) {
    console.warn('[Freesound] API error, falling back to demo samples:', err);
    return adaptMockSamples(bpm, key);
  }
}

/**
 * Search Freesound API
 */
async function searchFreesound(query, apiKey, options = {}) {
  const params = new URLSearchParams({
    query,
    token: apiKey,
    fields: 'id,name,tags,previews,duration,avg_rating,username,license,description',
    ...options,
  });

  const response = await fetch(`${FREESOUND_API_BASE}/search/text/?${params}`);
  if (!response.ok) throw new Error(`Freesound API error: ${response.status}`);

  const data = await response.json();

  return (data.results || []).map(sound => ({
    id: `fs-${sound.id}`,
    name: sound.name,
    bpm: extractBpmFromTags(sound.tags, sound.description),
    duration: sound.duration,
    previewUrl: sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'],
    sourceUrl: `https://freesound.org/people/${sound.username}/sounds/${sound.id}/`,
    license: sound.license,
    tags: sound.tags?.slice(0, 5) || [],
    username: sound.username,
    rating: sound.avg_rating,
  }));
}

/**
 * Try to extract BPM from Freesound tags or description
 */
function extractBpmFromTags(tags, description) {
  const allText = [...(tags || []), description || ''].join(' ');
  const match = allText.match(/(\d{2,3})\s*bpm/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Adapt mock samples to match detected BPM/key
 */
function adaptMockSamples(bpm, key) {
  return MOCK_DRUM_SAMPLES.map(sample => ({
    ...sample,
    bpm: sample.type === 'loop' ? (sample.bpm || bpm) : null,
    matchedKey: key,
    matchedBpm: bpm,
  }));
}

/**
 * Calculate playback rate to match target BPM
 */
export function calculatePlaybackRate(sampleBpm, targetBpm) {
  if (!sampleBpm || !targetBpm) return 1;
  return targetBpm / sampleBpm;
}

