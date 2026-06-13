import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { login } from '../controllers/userController.js';
import { getActivities, createActivity, deleteActivity } from '../controllers/activityController.js';
import { getStats, getStatsCompare } from '../controllers/statsController.js';
import { getChallenges, joinChallenge, updateChallengeStatus, getChallengesTemplates } from '../controllers/challengeController.js';
import { getAiInsights } from '../controllers/insightController.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';

const router = express.Router();

// Validation result handler middleware
const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
  }
  return next();
};

// --- USER ROUTES ---
router.post(
  '/users/login',
  [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ max: 50 }).withMessage('Username must be under 50 characters')
  ],
  validateResult,
  login
);

// --- ACTIVITY ROUTES ---
router.get(
  '/activities',
  [
    query('userId').notEmpty().withMessage('userId is required'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365')
  ],
  validateResult,
  getActivities
);

router.post(
  '/activities',
  [
    body('userId').notEmpty().withMessage('userId is required'),
    body('category')
      .notEmpty().withMessage('category is required')
      .isIn(Object.keys(EMISSION_FACTORS)).withMessage('Category is not whitelisted'),
    body('activityType')
      .notEmpty().withMessage('activityType is required'),
    body('quantity')
      .notEmpty().withMessage('quantity is required')
      .isFloat({ gt: 0, max: 100000 }).withMessage('Quantity must be between 0 and 100,000'),
    body('loggedAt').optional().isDate().withMessage('loggedAt must be a valid date YYYY-MM-DD'),
    body('notes').optional().isString().withMessage('notes must be a string')
  ],
  validateResult,
  createActivity
);

router.delete(
  '/activities/:id',
  [
    param('id').isInt().withMessage('id must be an integer')
  ],
  validateResult,
  deleteActivity
);

// --- STATS ROUTES ---
router.get(
  '/stats',
  [
    query('userId').notEmpty().withMessage('userId is required'),
    query('period').optional().isIn(['week', 'month', 'year']).withMessage('period must be week, month, or year')
  ],
  validateResult,
  getStats
);

router.get(
  '/stats/compare',
  [
    query('userId').notEmpty().withMessage('userId is required')
  ],
  validateResult,
  getStatsCompare
);

// --- CHALLENGES ROUTES ---
router.get(
  '/challenges',
  [
    query('userId').notEmpty().withMessage('userId is required')
  ],
  validateResult,
  getChallenges
);

router.get(
  '/challenges/templates',
  [
    query('userId').notEmpty().withMessage('userId is required')
  ],
  validateResult,
  getChallengesTemplates
);

router.post(
  '/challenges',
  [
    body('userId').notEmpty().withMessage('userId is required'),
    body('title').notEmpty().withMessage('Challenge title is required'),
    body('description').optional().isString().withMessage('description must be a string'),
    body('target_reduction_kg').optional().isFloat({ min: 0 }).withMessage('target_reduction_kg must be positive number'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('duration_days must be positive integer')
  ],
  validateResult,
  joinChallenge
);

router.put(
  '/challenges/:id',
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('status').isIn(['active', 'completed', 'failed']).withMessage('status must be active, completed, or failed')
  ],
  validateResult,
  updateChallengeStatus
);

// --- INSIGHTS ROUTES ---
router.post(
  '/insights',
  [
    body('userId').notEmpty().withMessage('userId is required')
  ],
  validateResult,
  getAiInsights
);

export default router;
