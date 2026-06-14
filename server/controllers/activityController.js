import db from '../db/database.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';

/**
 * Fetch activities for a user, optionally filtered by days.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If DB query execution fails
 */
export async function getActivities(req, res, next) {
  try {
    const userId = req.query.userId || req.signedCookies.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const daysLimit = parseInt(req.query.days, 10) || 30;
    const dateStr = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const activities = db.prepare(`
      SELECT * FROM activities WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at DESC, id DESC
    `).all(userId, dateStr);
    return res.json(activities);
  } catch (err) {
    return next(err);
  }
}

/**
 * Validates input parameters for createActivity.
 * @param {string} category - Footprint category
 * @param {string} activityType - Emission type
 * @param {number|string} quantity - Input number
 * @returns {Object} Cleaned quantity and configuration
 * @throws {Error} If validations fail
 */
function validateActivityInput(category, activityType, quantity) {
  const qty = parseFloat(quantity);
  if (isNaN(qty) || qty <= 0 || qty > 100000) {
    throw new Error('Quantity must be between 0 and 100,000');
  }
  if (!EMISSION_FACTORS[category]) {
    throw new Error('Invalid category');
  }
  const typeConfig = EMISSION_FACTORS[category][activityType];
  if (!typeConfig) {
    throw new Error('Invalid activity type for category');
  }
  return { qty, typeConfig };
}

/**
 * Inserts a carbon activity into database.
 * @param {string|number} userId - User identifier
 * @param {string} category - Aggregation category
 * @param {string} activityType - Specific type
 * @param {number} qty - Quantity value
 * @param {Object} typeConfig - Config factors
 * @param {string} loggedAt - Log date YYYY-MM-DD
 * @param {string} notes - Extra annotations
 * @returns {Object} Inserted database record
 * @throws {Error} If DB insertion fails
 */
function insertActivity(userId, category, activityType, qty, typeConfig, loggedAt, notes) {
  const co2 = qty * typeConfig.factor;
  const sanitizedNotes = notes ? notes.replace(/<[^>]*>/g, '') : null;
  const finalDate = loggedAt || new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(userId, category, activityType, qty, typeConfig.unit, co2, finalDate, sanitizedNotes);

  return {
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
}

/**
 * Create a new carbon activity, computing CO2 emissions.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If input verification or DB execution fails
 */
export async function createActivity(req, res, next) {
  try {
    const userId = req.body.userId || req.signedCookies.userId;
    const { category, activityType, quantity, loggedAt, notes } = req.body;
    if (!userId || !category || !activityType || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required activity fields' });
    }
    const { qty, typeConfig } = validateActivityInput(category, activityType, quantity);
    const newActivity = insertActivity(userId, category, activityType, qty, typeConfig, loggedAt, notes);
    return res.status(201).json(newActivity);
  } catch (err) {
    if (err.message.includes('Quantity') || err.message.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * Delete a logged activity by ID.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If DB deletion query fails
 */
export async function deleteActivity(req, res, next) {
  try {
    const { id } = req.params;
    const parsedId = Number(id);
    if (isNaN(parsedId) || !Number.isInteger(parsedId)) {
      return res.status(400).json({ error: 'ID must be an integer' });
    }

    const stmt = db.prepare('DELETE FROM activities WHERE id = ?');
    const result = stmt.run(parsedId);

    if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });

    return res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (err) {
    return next(err);
  }
}
