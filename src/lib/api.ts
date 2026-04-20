export async function getCurrentSeason() {
  try {
    const res = await fetch('/api/seasons/current', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (e) {
    // Fallback to mock data during development
    const mockRes = await fetch('/mock/season.json', { cache: 'no-store' });
    return await mockRes.json();
  }
}
