/**
 * HIGHSCORE MODULE — Supabase Integration
 * Handles submitting and fetching top scores from Supabase.
 */

const SUPABASE_URL = 'https://jyoxxkngxxfmiskfxndp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b3h4a25neHhmbWlza2Z4bmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5Mjg4NTQsImV4cCI6MjEwMTUwNDg1NH0.g6iDSYtD9rCU8SMKdpqg8OTIK8VYueYbbXvQe2ouwXg';
const TABLE = 'highscores';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Prefer': 'return=representation'
};

/**
 * Submit a score to Supabase.
 * @param {string} name  Player name
 * @param {number} score Total score
 * @param {number} distance Distance in metres
 * @param {number} tricks  Tricks performed
 * @returns {Promise<object|null>}
 */
async function submitScore(name, score, distance, tricks) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: name.trim().slice(0, 30), score, distance, tricks })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase submit error:', err);
      return null;
    }
    const data = await res.json();
    return data[0] ?? null;
  } catch (e) {
    console.error('submitScore failed:', e);
    return null;
  }
}

/**
 * Fetch top N scores ordered by score descending.
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function fetchTopScores(limit = 10) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=name,score,distance,tricks,created_at&order=score.desc&limit=${limit}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase fetch error:', err);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.error('fetchTopScores failed:', e);
    return [];
  }
}

window.HighscoreDB = { submitScore, fetchTopScores };
