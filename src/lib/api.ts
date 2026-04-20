import mockSeasonData from '../../public/mock/season.json';

export async function getCurrentSeason() {
  try {
    const res = await fetch('/api/seasons/current', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (e) {
    // Fallback to mock data during development
    console.warn('Using mock season data due to API error:', e);
    return mockSeasonData;
  }
}
