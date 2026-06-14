import db from '../../db/database.js';
import { calculateChallengeProgress } from './challengeProgress.js';
import { PREDEFINED_CHALLENGES } from '../../constants/config.js';

/**
 * Resolves user identity from cookie, body, or query params.
 * @param {import('express').Request} req - Express request
 * @returns {string|number|null} The resolved user ID
 */
function getUserId(req) {
  if (req.signedCookies && req.signedCookies.userId) {
    return req.signedCookies.userId;
  }
  if (req.body && req.body.userId) {
    return req.body.userId;
  }
  if (req.query && req.query.userId) {
    return req.query.userId;
  }
  return null;
}

/**
 * Helper to update and map a challenge's status and progress.
 * @param {Object} challenge - The challenge row
 * @param {string} nowStr - Current date string YYYY-MM-DD
 * @returns {Object} Updated challenge object
 * @throws {Error} If database updates fail
 */
function updateAndMapChallenge(challenge, nowStr) {
  let status = challenge.status;
  const progress = calculateChallengeProgress(challenge);

  if (status === 'active' && challenge.end_date < nowStr) {
    status = progress === 100 ? 'completed' : 'failed';
    db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run(status, challenge.id);
    challenge.status = status;
  }

  return { ...challenge, progress };
}

/**
 * Fetch all challenges for a user, dynamically updating status and calculating progress.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If query processing fails
 */
export async function getChallenges(req, res, next) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const dbChallenges = db.prepare('SELECT * FROM challenges WHERE user_id = ?').all(userId);
    const nowStr = new Date().toISOString().split('T')[0];
    const updated = dbChallenges.map(c => updateAndMapChallenge(c, nowStr));

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
}

/**
 * Helper to check if user already has an active challenge with a title.
 * @param {string|number} userId - The user ID
 * @param {string} title - The challenge title
 * @returns {Object|null} Matching challenge row if any
 * @throws {Error} If query fails
 */
function checkExistingActive(userId, title) {
  return db.prepare(`
    SELECT * FROM challenges WHERE user_id = ? AND title = ? AND status = 'active'
  `).get(userId, title);
}

/**
 * Helper to resolve challenge details from body or fallback template.
 * @param {string} title - Sanitize title
 * @param {string} description - Optional input desc
 * @param {number} target - Optional reduction target
 * @param {number} duration - Optional duration days
 * @returns {Object} Resolved properties
 * @throws {Error} If template or custom properties are missing
 */
function resolveChallengeDetails(title, description, target, duration) {
  let finalDescription = description ? String(description).trim().replace(/<[^>]*>/g, '') : description;
  let finalTarget = target;
  let finalDuration = duration;

  if (!finalDescription || finalTarget === undefined || !finalDuration) {
    const template = PREDEFINED_CHALLENGES.find(c => c.title === title);
    if (template) {
      finalDescription = template.description;
      finalTarget = template.target_reduction_kg;
      finalDuration = template.duration_days;
    } else {
      throw new Error('Invalid challenge title or missing challenge details');
    }
  }
  return { finalDescription, finalTarget, finalDuration };
}

/**
 * Helper to compute challenge start and end dates.
 * @param {number|string} durationDays - The duration
 * @returns {Object} Start and end date strings
 */
function getChallengeDates(durationDays) {
  const start = new Date();
  const startStr = start.toISOString().split('T')[0];
  const end = new Date();
  end.setDate(end.getDate() + Number(durationDays) - 1);
  const endStr = end.toISOString().split('T')[0];
  return { startStr, endStr };
}

/**
 * Helper to insert challenge record into DB.
 * @param {string|number} userId - The user ID
 * @param {string} title - The challenge title
 * @param {string} desc - Sanitized description
 * @param {number} target - CO2 target reduction in kg
 * @param {string} startStr - Start date YYYY-MM-DD
 * @param {string} endStr - End date YYYY-MM-DD
 * @returns {Object} Database run result
 * @throws {Error} If DB execution fails
 */
function insertChallenge(userId, title, desc, target, startStr, endStr) {
  return db.prepare(`
    INSERT INTO challenges (user_id, title, description, target_reduction_kg, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(userId, title, desc, Number(target), startStr, endStr);
}

/**
 * Join a new challenge.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If join operation fails
 */
export async function joinChallenge(req, res, next) {
  try {
    const userId = getUserId(req);
    const { title, description, target_reduction_kg, duration_days } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'userId and challenge title are required' });

    const cleanTitle = String(title).trim().replace(/<[^>]*>/g, '');
    if (!cleanTitle) return res.status(400).json({ error: 'Invalid challenge title' });
    if (checkExistingActive(userId, cleanTitle)) {
      return res.status(400).json({ error: 'You already have an active challenge with this title' });
    }

    const { finalDescription, finalTarget, finalDuration } = resolveChallengeDetails(
      cleanTitle, description, target_reduction_kg, duration_days
    );
    const { startStr, endStr } = getChallengeDates(finalDuration);
    const result = insertChallenge(userId, cleanTitle, finalDescription, finalTarget, startStr, endStr);
    return res.status(201).json({
      id: result.lastInsertRowid, user_id: Number(userId), title: cleanTitle,
      description: finalDescription, target_reduction_kg: Number(finalTarget),
      start_date: startStr, end_date: endStr, status: 'active', progress: 0
    });
  } catch (err) {
    if (err.message === 'Invalid challenge title or missing challenge details') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
}

/**
 * Update challenge status manually.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If DB execution fails
 */
export async function updateChallengeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const parsedId = Number(id);
    if (isNaN(parsedId) || !Number.isInteger(parsedId)) {
      return res.status(400).json({ error: 'ID must be an integer' });
    }
    if (!status || !['active', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const result = db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run(status, parsedId);
    if (result.changes === 0) return res.status(404).json({ error: 'Challenge not found' });

    return res.json({ success: true, message: 'Challenge status updated successfully' });
  } catch (err) {
    return next(err);
  }
}
