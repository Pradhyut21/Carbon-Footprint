import {
  getTodayCo2,
  getThisMonthCo2,
  getStreak,
  getCategoryCo2,
  getPeriodTotalCo2
} from './stats/statsSummary.js';
import { getDailyCo2 } from './stats/statsChart.js';
import { getStatsCompare as crudGetStatsCompare } from './stats/statsCompare.js';

/**
 * Fetch carbon footprint stats and aggregation data.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If calculations or DB queries fail
 */
export async function getStats(req, res, next) {
  try {
    const userId = req.query.userId || req.signedCookies.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thirtyDaysAgoStr = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return res.json({
      todayCo2: getTodayCo2(userId, todayStr),
      thisMonthCo2: getThisMonthCo2(userId, firstOfMonthStr),
      streak: getStreak(userId, todayStr, yesterdayStr),
      dailyCo2: getDailyCo2(userId, thirtyDaysAgoStr),
      categoryCo2: getCategoryCo2(userId, firstOfMonthStr),
      periodTotalCo2: getPeriodTotalCo2(userId, req.query.period)
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Fetch comparison statistics (user footprint vs regional/global/target).
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If query processing fails
 */
export async function getStatsCompare(req, res, next) {
  return crudGetStatsCompare(req, res, next);
}
