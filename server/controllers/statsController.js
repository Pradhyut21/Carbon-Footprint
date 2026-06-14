import db from '../db/database.js';

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

    // 1. Calculate Today's CO2
    const todayRow = db.prepare(`
      SELECT SUM(co2_kg) as total FROM activities 
      WHERE user_id = ? AND logged_at = ?
    `).get(userId, todayStr);
    const todayCo2 = todayRow ? Number((todayRow.total || 0).toFixed(2)) : 0;

    // 2. Calculate This Month's CO2 (Calendar Month)
    const monthRow = db.prepare(`
      SELECT SUM(co2_kg) as total FROM activities 
      WHERE user_id = ? AND logged_at >= ?
    `).get(userId, firstOfMonthStr);
    const thisMonthCo2 = monthRow ? Number((monthRow.total || 0).toFixed(2)) : 0;

    // 3. Calculate Streak (consecutive days with activity logged)
    const activeDatesRows = db.prepare(`
      SELECT DISTINCT logged_at FROM activities 
      WHERE user_id = ? AND logged_at <= ?
      ORDER BY logged_at DESC
    `).all(userId, todayStr);

    const loggedDates = new Set(activeDatesRows.map(r => r.logged_at));
    let streak = 0;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

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

    // 4. Calculate Daily CO2 over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const dailyLogs = db.prepare(`
      SELECT logged_at as date, SUM(co2_kg) as co2
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY logged_at
      ORDER BY logged_at ASC
    `).all(userId, thirtyDaysAgoStr);

    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      dailyMap[dStr] = 0;
    }

    dailyLogs.forEach(row => {
      if (dailyMap[row.date] !== undefined) {
        dailyMap[row.date] = Number(row.co2.toFixed(2));
      }
    });

    const dailyCo2 = Object.keys(dailyMap).map(date => ({
      date,
      co2: dailyMap[date]
    }));

    // 5. Calculate CO2 breakdown by category this month
    const categoryLogs = db.prepare(`
      SELECT category, SUM(co2_kg) as co2
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY category
    `).all(userId, firstOfMonthStr);

    const categoryCo2 = categoryLogs.map(row => ({
      category: row.category,
      co2: Number(row.co2.toFixed(2))
    }));

    // 6. Calculate total for the requested period (week/month/year)
    let periodDays = 30;
    if (period === 'week') periodDays = 7;
    else if (period === 'year') periodDays = 365;

    const periodDate = new Date();
    periodDate.setDate(periodDate.getDate() - periodDays + 1);
    const periodDateStr = periodDate.toISOString().split('T')[0];

    const periodRow = db.prepare(`
      SELECT SUM(co2_kg) as total FROM activities 
      WHERE user_id = ? AND logged_at >= ?
    `).get(userId, periodDateStr);
    const periodTotalCo2 = periodRow ? Number((periodRow.total || 0).toFixed(2)) : 0;

    return res.json({
      todayCo2,
      thisMonthCo2,
      streak,
      dailyCo2,
      categoryCo2,
      periodTotalCo2
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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

    let diffDays = 30;
    if (oldestRow && oldestRow.oldest) {
      const oldestDate = new Date(oldestRow.oldest);
      const today = new Date();
      const diffTime = Math.abs(today - oldestDate);
      diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      diffDays = Math.min(30, diffDays);
    } else {
      diffDays = 1;
    }

    const dailyAverage = totalCo2 / diffDays;
    const userTonsPerYear = (dailyAverage * 365) / 1000;

    return res.json({
      user: Number(userTonsPerYear.toFixed(2)),
      india: 1.9,
      global: 6.6,
      paris: 2.5
    });
  } catch (err) {
    return next(err);
  }
}

