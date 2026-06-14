import { INSIGHTS_LIMIT_MS, INSIGHTS_LIMIT_MAX } from '../../constants/config.js';

// In-memory rate limiting map: userId -> array of timestamps
const rateLimitMap = new Map();

/**
 * Validates requests and logs rate limit timestamps.
 * @param {string|number} userId - User identifier
 * @returns {boolean} True if within limit, false if exceeded
 */
export function validateAndRateLimit(userId) {
  const now = Date.now();
  let userRequests = rateLimitMap.get(userId) || [];
  userRequests = userRequests.filter(ts => now - ts < INSIGHTS_LIMIT_MS);

  if (userRequests.length >= INSIGHTS_LIMIT_MAX) return false;

  userRequests.push(now);
  rateLimitMap.set(userId, userRequests);
  return true;
}
