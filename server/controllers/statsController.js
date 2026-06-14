import db from '../db/database.js';
import { 
  DEFAULT_PERIOD_DAYS, 
  PERIOD_WEEK_DAYS, 
  PERIOD_YEAR_DAYS, 
  STREAK_LOOKBACK_DAYS, 
  TONS_CONVERSION_FACTOR, 
  BENCHMARKS, 
  MS_PER_DAY 
} from '../constants/appConstants.js';

/**
 * Calculates total CO2 logged today
 * @param {string|number} userId 
 * @param {string} todayStr 
 * @returns {number}
 */
function getTodayCo2(userId, todayStr) {
  const todayRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities 
    WHERE user_id = ? AND logged_at = ?
  `).get(userId, todayStr);
  return todayRow ? Number((todayRow.total || 0).toFixed(2)) : 0;
}

/**
 * Calculates total CO2 logged this calendar month
 * @param {string|number} userId 
 * @param {string} firstOfMonthStr 
 * @returns {number}
 */
function getThisMonthCo2(userId, firstOfMonthStr) {
  const monthRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities 
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, firstOfMonthStr);
  return monthRow ? Number((monthRow.total || 0).toFixed(2)) : 0;
}

/**
 * Calculates consecutive logging streak in days
 * @param {string|number} userId 
 * @param {string} todayStr 
 * @param {string} yesterdayStr 
 * @returns {number}
 */
function getStreak(userId, todayStr, yesterdayStr) {
  const activeDatesRows = db.prepare(`
    SELECT DISTINCT logged_at FROM activities 
    WHERE user_id = ? AND logged_at <= ?
    ORDER BY logged_at DESC
  `).all(userId, todayStr);

  const loggedDates = new Set(activeDatesRows.map(r => r.logged_at));
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
 * Calculates daily CO2 list for the last 30 days
 * @param {string|number} userId 
 * @param {string} thirtyDaysAgoStr 
 * @returns {Array<{date: string, co2: number}>}
 */
function getDailyCo2(userId, thirtyDaysAgoStr) {
  const dailyLogs = db.prepare(`
    SELECT logged_at as date, SUM(co2_kg) as co2
    FROM activities
    WHERE user_id = ? AND logged_at >= ?
    GROUP BY logged_at
    ORDER BY logged_at ASC
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

  return Object.keys(dailyMap).map(date => ({
    date,
    co2: dailyMap[date]
  }));
}

/**
 * Calculates calendar month breakdown by category
 * @param {string|number} userId 
 * @param {string} firstOfMonthStr 
 * @returns {Array<{category: string, co2: number}>}
 */
function getCategoryCo2(userId, firstOfMonthStr) {
  const categoryLogs = db.prepare(`
    SELECT category, SUM(co2_kg) as co2
    FROM activities
    WHERE user_id = ? AND logged_at >= ?
    GROUP BY category
  `).all(userId, firstOfMonthStr);

  return categoryLogs.map(row => ({
    category: row.category,
    co2: Number(row.co2.toFixed(2))
  }));
}

/**
 * Calculates period total CO2
 * @param {string|number} userId 
 * @param {string} period 
 * @returns {number}
 */
function getPeriodTotalCo2(userId, period) {
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
 * Helper to calculate number of days between oldest activity and today
 * @param {Object} oldestRow 
 * @returns {number}
 */
function getDiffDays(oldestRow) {
  if (oldestRow && oldestRow.oldest) {
    const oldestDate = new Date(oldestRow.oldest);
    const today = new Date();
    const diffTime = Math.abs(today - oldestDate);
    const diff = Math.max(1, Math.ceil(diffTime / MS_PER_DAY));
    return Math.min(DEFAULT_PERIOD_DAYS, diff);
  }
  return 1;
}

/**
 * Helper to calculate annualized user tons
 * @param {string|number} userId 
 * @returns {number}
 */
function calculateUserTons(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DEFAULT_PERIOD_DAYS);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const totalRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, dateStr);
  const totalCo2 = totalRow ? (totalRow.total || 0) : 0;

  const oldestRow = db.prepare(`
    SELECT MIN(logged_at) as oldest FROM activities
    WHERE user_id = ? AND logged_at >= ?
  `).get(userId, dateStr);

  const diffDays = getDiffDays(oldestRow);
  const dailyAverage = totalCo2 / diffDays;
  return Number(((dailyAverage * PERIOD_YEAR_DAYS) / TONS_CONVERSION_FACTOR).toFixed(2));
}

/**
 * Fetch carbon footprint stats and aggregation data.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getStats(req, res, next) {
  try {
    const { userId, period } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - STREAK_LOOKBACK_DAYS);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return res.json({
      todayCo2: getTodayCo2(userId, todayStr),
      thisMonthCo2: getThisMonthCo2(userId, firstOfMonthStr),
      streak: getStreak(userId, todayStr, yesterdayStr),
      dailyCo2: getDailyCo2(userId, thirtyDaysAgoStr),
      categoryCo2: getCategoryCo2(userId, firstOfMonthStr),
      periodTotalCo2: getPeriodTotalCo2(userId, period)
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Fetch comparison statistics (user footprint vs regional/global/target).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getStatsCompare(req, res, next) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const userTons = calculateUserTons(userId);
    return res.json({
      user: userTons,
      india: BENCHMARKS.india,
      global: BENCHMARKS.global,
      paris: BENCHMARKS.paris
    });
  } catch (err) {
    return next(err);
  }
}
