import db from '../../db/database.js';
import { 
  DEFAULT_PERIOD_DAYS, 
  PERIOD_WEEK_DAYS, 
  PERIOD_YEAR_DAYS, 
  TONS_CONVERSION_FACTOR, 
  MS_PER_DAY 
} from '../../constants/config.js';

/**
 * Calculates total CO2 logged today.
 * @param {string|number} userId - User identifier
 * @param {string} todayStr - YYYY-MM-DD date string
 * @returns {number} Today's CO2 sum
 * @throws {Error} If DB query execution fails
 */
export function getTodayCo2(userId, todayStr) {
  const todayRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities 
    WHERE user_id = ? AND logged_at = ?
  `).get(userId, todayStr);
  return todayRow ? Number((todayRow.total || 0).toFixed(2)) : 0;
}

/**
 * Calculates total CO2 logged this calendar month.
 * @param {string|number} userId - User identifier
 * @param {string} firstOfMonthStr - YYYY-MM-DD date string
 * @returns {number} Month's CO2 sum
 * @throws {Error} If DB query execution fails
 */
export function getThisMonthCo2(userId, firstOfMonthStr) {
  const monthRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities 
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, firstOfMonthStr);
  return monthRow ? Number((monthRow.total || 0).toFixed(2)) : 0;
}

/**
 * Helper to extract unique active date strings.
 * @param {string|number} userId - User ID
 * @param {string} todayStr - YYYY-MM-DD
 * @returns {Set<string>} Set of logged date strings
 * @throws {Error} If DB execution fails
 */
function getActiveDates(userId, todayStr) {
  const rows = db.prepare(`
    SELECT DISTINCT logged_at FROM activities 
    WHERE user_id = ? AND logged_at <= ? ORDER BY logged_at DESC
  `).all(userId, todayStr);
  return new Set(rows.map(r => r.logged_at));
}

/**
 * Calculates consecutive logging streak in days.
 * @param {string|number} userId - User identifier
 * @param {string} todayStr - Today's date YYYY-MM-DD
 * @param {string} yesterdayStr - Yesterday's date YYYY-MM-DD
 * @returns {number} Streak count
 * @throws {Error} If database helper fails
 */
export function getStreak(userId, todayStr, yesterdayStr) {
  const loggedDates = getActiveDates(userId, todayStr);
  let streak = 0;
  let checkDate = new Date();

  if (loggedDates.has(todayStr)) {
    while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else if (loggedDates.has(yesterdayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
    while (loggedDates.has(checkDate.toISOString().split('T')[0])) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }
  return streak;
}

/**
 * Calculates calendar month breakdown by category.
 * @param {string|number} userId - User identifier
 * @param {string} firstOfMonthStr - Month start YYYY-MM-DD
 * @returns {Array<{category: string, co2: number}>} Grouped categories
 * @throws {Error} If DB query execution fails
 */
export function getCategoryCo2(userId, firstOfMonthStr) {
  const categoryLogs = db.prepare(`
    SELECT category, SUM(co2_kg) as co2 FROM activities
    WHERE user_id = ? AND logged_at >= ? GROUP BY category
  `).all(userId, firstOfMonthStr);

  return categoryLogs.map(row => ({
    category: row.category,
    co2: Number(row.co2.toFixed(2))
  }));
}

/**
 * Calculates period total CO2.
 * @param {string|number} userId - User ID
 * @param {string} period - week, month, or year
 * @returns {number} Total footprint in kg
 * @throws {Error} If query execution fails
 */
export function getPeriodTotalCo2(userId, period) {
  let periodDays = DEFAULT_PERIOD_DAYS;
  if (period === 'week') periodDays = PERIOD_WEEK_DAYS;
  else if (period === 'year') periodDays = PERIOD_YEAR_DAYS;

  const periodDate = new Date();
  periodDate.setDate(periodDate.getDate() - periodDays + 1);

  const periodRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities 
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, periodDate.toISOString().split('T')[0]);

  return periodRow ? Number((periodRow.total || 0).toFixed(2)) : 0;
}

/**
 * Helper to calculate number of days between oldest activity and today.
 * @param {Object} oldestRow - Row containing oldest date string
 * @returns {number} Count of days
 */
function getDiffDays(oldestRow) {
  if (oldestRow && oldestRow.oldest) {
    const oldestDate = new Date(oldestRow.oldest);
    const today = new Date();
    const diff = Math.max(1, Math.ceil(Math.abs(today - oldestDate) / MS_PER_DAY));
    return Math.min(DEFAULT_PERIOD_DAYS, diff);
  }
  return 1;
}

/**
 * Helper to calculate annualized user tons.
 * @param {string|number} userId - User identifier
 * @returns {number} Projected annual footprint in tons
 * @throws {Error} If DB queries fail
 */
export function calculateUserTons(userId) {
  const dateStr = new Date(Date.now() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const totalRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities WHERE user_id = ? AND logged_at >= ?
  `).get(userId, dateStr);
  const totalCo2 = totalRow ? (totalRow.total || 0) : 0;

  const oldestRow = db.prepare(`
    SELECT MIN(logged_at) as oldest FROM activities WHERE user_id = ? AND logged_at >= ?
  `).get(userId, dateStr);

  const diffDays = getDiffDays(oldestRow);
  const dailyAverage = totalCo2 / diffDays;
  return Number(((dailyAverage * PERIOD_YEAR_DAYS) / TONS_CONVERSION_FACTOR).toFixed(2));
}
