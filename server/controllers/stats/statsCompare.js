import { BENCHMARKS } from '../../constants/config.js';
import { calculateUserTons } from './statsSummary.js';

/**
 * Fetch comparison statistics (user footprint vs regional/global/target).
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If calculations or DB queries fail
 */
export async function getStatsCompare(req, res, next) {
  try {
    const userId = req.query.userId || req.signedCookies.userId;
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
