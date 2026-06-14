import db from '../../db/database.js';
import { STREAK_LOOKBACK_DAYS } from '../../constants/config.js';

/**
 * Calculates daily CO2 list for the last 30 days.
 * @param {string|number} userId - User ID
 * @param {string} thirtyDaysAgoStr - Threshold date YYYY-MM-DD
 * @returns {Array<{date: string, co2: number}>} Daily footprint mapping
 * @throws {Error} If DB query execution fails
 */
export function getDailyCo2(userId, thirtyDaysAgoStr) {
  const dailyLogs = db.prepare(`
    SELECT logged_at as date, SUM(co2_kg) as co2 FROM activities
    WHERE user_id = ? AND logged_at >= ? GROUP BY logged_at ORDER BY logged_at ASC
  `).all(userId, thirtyDaysAgoStr);

  const dailyMap = {};
  for (let i = STREAK_LOOKBACK_DAYS; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyMap[d.toISOString().split('T')[0]] = 0;
  }

  dailyLogs.forEach(row => {
    if (dailyMap[row.date] !== undefined) {
      dailyMap[row.date] = Number(row.co2.toFixed(2));
    }
  });

  return Object.keys(dailyMap).map(date => ({ date, co2: dailyMap[date] }));
}
