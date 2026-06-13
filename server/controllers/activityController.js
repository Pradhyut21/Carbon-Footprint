import db from '../db/database.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';

/**
 * Fetch activities for a user, optionally filtered by days.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getActivities(req, res, next) {
  try {
    const { userId, days } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const daysLimit = parseInt(days, 10) || 30;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysLimit);
    const dateStr = dateLimit.toISOString().split('T')[0];

    const activities = db.prepare(`
      SELECT * FROM activities 
      WHERE user_id = ? AND logged_at >= ?
      ORDER BY logged_at DESC, id DESC
    `).all(userId, dateStr);

    return res.json(activities);
  } catch (err) {
    return next(err);
  }
}

/**
 * Create a new carbon activity, computing CO2 emissions.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createActivity(req, res, next) {
  try {
    const { userId, category, activityType, quantity, loggedAt, notes } = req.body;

    if (!userId || !category || !activityType || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required activity fields' });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0 || qty > 100000) {
      return res.status(400).json({ error: 'Quantity must be between 0 and 100,000' });
    }

    // Whitelist check
    if (!EMISSION_FACTORS[category]) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const typeConfig = EMISSION_FACTORS[category][activityType];
    if (!typeConfig) {
      return res.status(400).json({ error: 'Invalid activity type for category' });
    }

    // Compute CO2
    const co2 = qty * typeConfig.factor;

    // Sanitize notes
    const sanitizedNotes = notes ? notes.replace(/<[^>]*>/g, '') : null;

    // Determine logged date
    const finalDate = loggedAt || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      category,
      activityType,
      qty,
      typeConfig.unit,
      co2,
      finalDate,
      sanitizedNotes
    );

    const newActivity = {
      id: result.lastInsertRowid,
      user_id: Number(userId),
      category,
      activity_type: activityType,
      quantity: qty,
      unit: typeConfig.unit,
      co2_kg: co2,
      logged_at: finalDate,
      notes: sanitizedNotes
    };

    return res.status(201).json(newActivity);
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete a logged activity by ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteActivity(req, res, next) {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM activities WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (err) {
    return next(err);
  }
}
