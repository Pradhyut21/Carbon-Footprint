import {
  getChallenges as crudGetChallenges,
  joinChallenge as crudJoinChallenge,
  updateChallengeStatus as crudUpdateChallengeStatus
} from './challenges/challengeCrud.js';
import {
  getWorstCategoryAndType,
  getPersonalizedTemplates
} from './challenges/challengeTemplates.js';
import { calculateChallengeProgress as calcProgress } from './challenges/challengeProgress.js';

/**
 * Helper to calculate challenge progress percentage dynamically.
 * @param {Object} challenge - Database challenge record
 * @returns {number} Progress percentage (0 - 100)
 * @throws {Error} If calculation fails
 */
export function calculateChallengeProgress(challenge) {
  return calcProgress(challenge);
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
  return crudGetChallenges(req, res, next);
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
  return crudJoinChallenge(req, res, next);
}

/**
 * Update challenge status manually.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If status update fails
 */
export async function updateChallengeStatus(req, res, next) {
  return crudUpdateChallengeStatus(req, res, next);
}

/**
 * Generate personalized challenge templates based on user's worst emission category.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 * @returns {Promise<void>}
 * @throws {Error} If template generation fails
 */
export async function getChallengesTemplates(req, res, next) {
  try {
    const userId = req.query.userId || req.signedCookies.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const { worstCategory, worstType, worstCo2 } = getWorstCategoryAndType(userId);
    const templates = await getPersonalizedTemplates(worstCategory, worstType, worstCo2);
    return res.json(templates);
  } catch (err) {
    return next(err);
  }
}
