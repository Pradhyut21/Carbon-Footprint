import db from '../db/database.js';
import { calculateChallengeProgress as calcProgress } from '../helpers/challengeProgress.js';
import {
  generateGeminiTemplates,
  generateClaudeTemplates,
  generateFallbackTemplates
} from '../helpers/challengeTemplates.js';

// Predefined challenges config
export const PREDEFINED_CHALLENGES = [
  {
    title: 'Car-Free Week',
    description: 'Log 0 car or motorcycle trips for 7 days. Opt for public transit, bike, or walk!',
    target_reduction_kg: 15.0,
    duration_days: 7
  },
  {
    title: 'Plant-Based Week',
    description: 'Eat zero beef or lamb for 7 days. Try delicious vegetarian meals!',
    target_reduction_kg: 20.0,
    duration_days: 7
  },
  {
    title: 'Energy Saver',
    description: 'Reduce electricity logs by 20% compared to your previous week.',
    target_reduction_kg: 10.0,
    duration_days: 7
  },
  {
    title: 'Zero Waste Day',
    description: 'Only compost or recycle waste (0 landfill waste logs) for 1 full day.',
    target_reduction_kg: 5.0,
    duration_days: 1
  }
];

/**
 * Helper to calculate challenge progress percentage dynamically.
 * @param {Object} challenge - Database challenge record
 * @returns {number} Progress percentage (0 - 100)
 */
export function calculateChallengeProgress(challenge) {
  return calcProgress(challenge);
}

/**
 * Helper to update and map a challenge's status and progress.
 */
function updateAndMapChallenge(challenge, nowStr) {
  let status = challenge.status;
  const progress = calculateChallengeProgress(challenge);

  if (status === 'active' && challenge.end_date < nowStr) {
    status = progress === 100 ? 'completed' : 'failed';
    db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run(status, challenge.id);
    challenge.status = status;
  }

  return {
    ...challenge,
    progress
  };
}

/**
 * Fetch all challenges for a user, dynamically updating status and calculating progress.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getChallenges(req, res, next) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const dbChallenges = db.prepare('SELECT * FROM challenges WHERE user_id = ?').all(userId);
    const nowStr = new Date().toISOString().split('T')[0];
    const updated = dbChallenges.map(c => updateAndMapChallenge(c, nowStr));

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
}

/**
 * Helper to check if user already has an active challenge with a title
 */
function checkExistingActive(userId, title) {
  return db.prepare(`
    SELECT * FROM challenges WHERE user_id = ? AND title = ? AND status = 'active'
  `).get(userId, title);
}

/**
 * Helper to resolve challenge details from body or fallback template
 */
function resolveChallengeDetails(title, description, target_reduction_kg, duration_days) {
  let finalDescription = description ? String(description).trim().replace(/<[^>]*>/g, '') : description;
  let finalTarget = target_reduction_kg;
  let finalDuration = duration_days;

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
 * Helper to compute challenge start and end dates
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
 * Helper to insert challenge record into DB
 */
function insertChallenge(userId, title, desc, target, startStr, endStr) {
  return db.prepare(`
    INSERT INTO challenges (user_id, title, description, target_reduction_kg, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(userId, title, desc, Number(target), startStr, endStr);
}

/**
 * Join a new challenge.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function joinChallenge(req, res, next) {
  try {
    const { userId, title, description, target_reduction_kg, duration_days } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and challenge title are required' });
    }
    const cleanTitle = String(title).trim().replace(/<[^>]*>/g, '');
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Invalid challenge title' });
    }
    if (checkExistingActive(userId, cleanTitle)) {
      return res.status(400).json({ error: 'You already have an active challenge with this title' });
    }
    const { finalDescription, finalTarget, finalDuration } = resolveChallengeDetails(
      cleanTitle, description, target_reduction_kg, duration_days
    );
    const { startStr, endStr } = getChallengeDates(finalDuration);
    const result = insertChallenge(userId, cleanTitle, finalDescription, finalTarget, startStr, endStr);
    return res.status(201).json({
      id: result.lastInsertRowid,
      user_id: Number(userId),
      title: cleanTitle,
      description: finalDescription,
      target_reduction_kg: Number(finalTarget),
      start_date: startStr,
      end_date: endStr,
      status: 'active',
      progress: 0
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
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function updateChallengeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const result = db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    return res.json({ success: true, message: 'Challenge status updated successfully' });
  } catch (err) {
    return next(err);
  }
}

/**
 * Helper to determine worst category and worst activity type in the last 30 days
 */
function getWorstCategoryAndType(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const catRow = db.prepare(`
    SELECT category, SUM(co2_kg) as co2 FROM activities
    WHERE user_id = ? AND logged_at >= ?
    GROUP BY category ORDER BY co2 DESC LIMIT 1
  `).get(userId, dateStr);

  const typeRow = db.prepare(`
    SELECT activity_type, SUM(co2_kg) as co2 FROM activities
    WHERE user_id = ? AND logged_at >= ?
    GROUP BY activity_type ORDER BY co2 DESC LIMIT 1
  `).get(userId, dateStr);

  return {
    worstCategory: catRow ? catRow.category : 'food',
    worstCo2: catRow ? Number(catRow.co2.toFixed(2)) : 0,
    worstType: typeRow ? typeRow.activity_type : 'beef'
  };
}

/**
 * Helper to fetch templates from AI or Fallback
 */
async function getPersonalizedTemplates(worstCategory, worstType, worstCo2) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_key_here') {
    const geminiRes = await generateGeminiTemplates(worstCategory, worstType, worstCo2, geminiKey);
    if (geminiRes) return geminiRes;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey !== 'your_key_here') {
    const claudeRes = await generateClaudeTemplates(worstCategory, worstType, worstCo2, apiKey);
    if (claudeRes) return claudeRes;
  }
  return generateFallbackTemplates(worstCategory, worstCo2);
}

/**
 * Generate personalized challenge templates based on user's worst emission category.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function getChallengesTemplates(req, res, next) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const { worstCategory, worstType, worstCo2 } = getWorstCategoryAndType(userId);
    const templates = await getPersonalizedTemplates(worstCategory, worstType, worstCo2);
    return res.json(templates);
  } catch (err) {
    return next(err);
  }
}
