/* ── Multi-Source Sample Service ──
 * Unified sample search across 4 major web providers + Curated Studio Library:
 * 1. Openverse API (Massive CC index, commercial filter, no key required)
 * 2. Freesound API (Community drum loops, sfx, one-shots)
 * 3. Jamendo API (Full music & instrumental track stems)
 * 4. Wikimedia Commons (Public domain & CC-licensed audio)
 * 5. Curated Studio Library (Zero-latency Web Audio synthesized audio)
 */

import { generateCuratedSampleSet } from '../engine/drumSynthesizer';

// ── Helper to extract BPM from text or tags ──
function extractBpm(text, defaultBpm = null) {
  if (!text) return defaultBpm;
  const match = text.match(/(\d{2,3})\s*bpm/i);
  if (match) {
    const val = parseInt(match[1]);
    if (val >= 50 && val <= 220) return val;
  }
  return defaultBpm;
}

// ── Provider 1: Openverse API ──
export async function fetchOpenverseSamples(bpm, key, token = '') {
  try {
    const query = encodeURIComponent(`drum loop ${bpm} bpm`);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let res = await fetch(
      `https://api.openverse.org/v1/audio/?q=${query}&page_size=6&license_type=commercial`,
      { headers }
    );

    // If specific BPM query returned few results, broaden search
    if (!res.ok || res.status === 404) {
      res = await fetch(
        `https://api.openverse.org/v1/audio/?q=drum+loop&page_size=6&license_type=commercial`,
        { headers }
      );
    }

    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];

    return results.map(item => {
      const detectedBpm = extractBpm(
        `${item.title} ${item.tags?.map(t => t.name).join(' ')}`,
        bpm
      );

      return {
        id: `openverse-${item.id}`,
        name: item.title || 'Drum Loop',
        provider: 'openverse',
        providerName: 'Openverse',
        providerBadgeColor: '#c56cf0',
        type: 'loop',
        bpm: detectedBpm,
        duration: item.duration ? item.duration / 1000 : 4.0,
        previewUrl: item.url,
        sourceUrl: item.foreign_landing_url || item.url,
        license: (item.license || 'CC').toUpperCase(),
        artist: item.creator || 'Openverse Contributor',
        isCommercial: true,
        tags: item.tags?.slice(0, 4).map(t => t.name) || ['drum', 'loop'],
        description: item.attribution || 'Openverse Commercial-friendly Audio',
      };
    });
  } catch (err) {
    console.warn('[Openverse] fetch error:', err);
    return [];
  }
}

// ── Provider 2: Freesound API ──
export async function fetchFreesoundSamples(bpm, key, apiKey) {
  if (!apiKey) return [];

  try {
    const query = encodeURIComponent(`drum loop ${bpm} bpm ${key}`);
    const params = new URLSearchParams({
      query: `drum loop ${bpm} bpm`,
      token: apiKey,
      fields: 'id,name,tags,previews,duration,avg_rating,username,license,description',
      filter: 'duration:[0.5 TO 8]',
      sort: 'rating_desc',
      page_size: '5',
    });

    const res = await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
    if (!res.ok) {
      console.warn('[Freesound] API returned status:', res.status);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    const drumLoops = results.map(sound => {
      const allText = `${sound.name} ${sound.tags?.join(' ')} ${sound.description || ''}`;
      return {
        id: `freesound-${sound.id}`,
        name: sound.name,
        provider: 'freesound',
        providerName: 'Freesound',
        providerBadgeColor: '#ff7675',
        type: 'loop',
        bpm: extractBpm(allText, bpm),
        duration: sound.duration,
        previewUrl: sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'],
        sourceUrl: `https://freesound.org/people/${sound.username}/sounds/${sound.id}/`,
        license: sound.license?.includes('Zero') ? 'CC0' : 'CC-BY',
        artist: sound.username,
        isCommercial: true,
        tags: sound.tags?.slice(0, 4) || ['freesound', 'drums'],
        description: sound.description?.slice(0, 100) || 'Freesound drum loop',
      };
    });

    // Also fetch one-shot kicks/snares if key provided
    const oneShotParams = new URLSearchParams({
      query: 'snare kick hi-hat drum one-shot',
      token: apiKey,
      fields: 'id,name,tags,previews,duration,username,license',
      filter: 'duration:[0.05 TO 1.5]',
      sort: 'rating_desc',
      page_size: '3',
    });

    const oneShotRes = await fetch(`https://freesound.org/apiv2/search/text/?${oneShotParams}`);
    if (oneShotRes.ok) {
      const oneShotData = await oneShotRes.json();
      const hits = (oneShotData.results || []).map(hit => ({
        id: `freesound-hit-${hit.id}`,
        name: hit.name,
        provider: 'freesound',
        providerName: 'Freesound',
        providerBadgeColor: '#ff7675',
        type: 'one-shot',
        bpm: null,
        duration: hit.duration,
        previewUrl: hit.previews?.['preview-hq-mp3'] || hit.previews?.['preview-lq-mp3'],
        sourceUrl: `https://freesound.org/people/${hit.username}/sounds/${hit.id}/`,
        license: 'CC',
        artist: hit.username,
        isCommercial: true,
        tags: hit.tags?.slice(0, 3) || ['hit', 'drum'],
        description: 'Freesound individual hit',
      }));
      drumLoops.push(...hits);
    }

    return drumLoops;
  } catch (err) {
    console.warn('[Freesound] fetch error:', err);
    return [];
  }
}

// ── Provider 3: Jamendo API ──
export async function fetchJamendoSamples(bpm, key, clientId) {
  if (!clientId) return [];

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '5',
      search: `drum loop ${bpm}`,
      tags: 'drums+instrumental',
      audioformat: 'mp32',
      cc_clean: 'true',
    });

    let res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
    if (!res.ok) {
      // Fallback broader search
      params.set('search', 'drums');
      res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
    }

    if (!res.ok) return [];

    const data = await res.json();
    const tracks = data.results || [];

    return tracks.map(track => ({
      id: `jamendo-${track.id}`,
      name: track.name || 'Jamendo Drum Instrumental',
      provider: 'jamendo',
      providerName: 'Jamendo',
      providerBadgeColor: '#ff9f43',
      type: 'loop',
      bpm: extractBpm(track.name, bpm),
      duration: track.duration || 15,
      previewUrl: track.audio,
      sourceUrl: track.shareurl || track.prourl || 'https://www.jamendo.com',
      license: 'Creative Commons',
      artist: track.artist_name || 'Jamendo Artist',
      isCommercial: true,
      tags: ['jamendo', 'drums', 'instrumental'],
      description: `Track by ${track.artist_name} on Jamendo Music`,
    }));
  } catch (err) {
    console.warn('[Jamendo] fetch error:', err);
    return [];
  }
}

// ── Provider 4: Wikimedia Commons API ──
export async function fetchWikimediaSamples(bpm) {
  try {
    const query = encodeURIComponent('filetype:audio drum loop');
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&prop=imageinfo&iiprop=url|mime|extmetadata&format=json&origin=*`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const pages = data.query?.pages || {};

    const samples = [];
    for (const pageId in pages) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (!info || !info.url) continue;

      // Filter for audio formats
      const mime = info.mime || '';
      if (!mime.includes('audio') && !info.url.endsWith('.wav') && !info.url.endsWith('.mp3') && !info.url.endsWith('.ogg')) {
        continue;
      }

      const meta = info.extmetadata || {};
      const title = (meta.ObjectName?.value || page.title || 'Drum Audio')
        .replace('File:', '')
        .replace(/\.(wav|mp3|ogg|flac)$/i, '');

      const license = meta.LicenseShortName?.value || meta.License?.value || 'Public Domain / CC';
      const artist = meta.Artist?.value?.replace(/<[^>]*>/g, '') || 'Wikimedia Commons';
      const desc = meta.ImageDescription?.value?.replace(/<[^>]*>/g, '') || '';

      const detectedBpm = extractBpm(`${title} ${desc}`, bpm);

      samples.push({
        id: `wiki-${page.pageid}`,
        name: title,
        provider: 'wikimedia',
        providerName: 'Wikimedia Commons',
        providerBadgeColor: '#00cec9',
        type: 'loop',
        bpm: detectedBpm,
        duration: 4.0,
        previewUrl: info.url,
        sourceUrl: info.descriptionurl || 'https://commons.wikimedia.org',
        license: license,
        artist: artist,
        isCommercial: true,
        tags: ['wikimedia', 'public-domain', 'percussion'],
        description: desc.slice(0, 100) || 'Wikimedia Commons Public Domain Audio',
      });

      if (samples.length >= 4) break;
    }

    return samples;
  } catch (err) {
    console.warn('[Wikimedia] fetch error:', err);
    return [];
  }
}

// ── Unified Aggregator: Fetches across all active sources ──
export async function fetchAllDrumSamples({
  bpm,
  key,
  audioContext,
  apiKeys = {},
}) {
  const { freesoundKey, jamendoClientId, openverseToken } = apiKeys;

  // 1. Always generate the curated studio set (zero latency, offline resilient)
  let studioSamples = [];
  if (audioContext) {
    try {
      studioSamples = generateCuratedSampleSet(audioContext, bpm, key).map(s => ({
        ...s,
        provider: 'studio',
        providerName: 'Studio Engine',
        providerBadgeColor: '#6c5ce7',
        isCommercial: true,
        artist: 'BeatCraft Studio',
      }));
    } catch (e) {
      console.warn('Could not generate studio samples:', e);
    }
  }

  // 2. Fetch from all online APIs in parallel
  const [openverseList, freesoundList, jamendoList, wikimediaList] = await Promise.all([
    fetchOpenverseSamples(bpm, key, openverseToken),
    fetchFreesoundSamples(bpm, key, freesoundKey),
    fetchJamendoSamples(bpm, key, jamendoClientId),
    fetchWikimediaSamples(bpm),
  ]);

  // Merge results, prioritizing web providers when available
  const combined = [
    ...openverseList,
    ...freesoundList,
    ...jamendoList,
    ...wikimediaList,
    ...studioSamples,
  ];

  return {
    samples: combined,
    counts: {
      openverse: openverseList.length,
      freesound: freesoundList.length,
      jamendo: jamendoList.length,
      wikimedia: wikimediaList.length,
      studio: studioSamples.length,
      total: combined.length,
    },
  };
}

