import db from '../../db/database.js';
import { MS_PER_DAY } from '../../constants/config.js';

/**
 * Checks if transport challenge keyword matches.
 * @param {string} title - The challenge title
 * @param {string} desc - The challenge description
 * @returns {boolean} True if transport related
 */
function isTransportChallenge(title, desc) {
  return title.includes('car-free') || title.includes('transit') || title.includes('commute') || 
         title.includes('car') || desc.includes('car ') || desc.includes('drive');
}

/**
 * Checks if food challenge keyword matches.
 * @param {string} title - The challenge title
 * @param {string} desc - The challenge description
 * @returns {boolean} True if food related
 */
function isFoodChallenge(title, desc) {
  return title.includes('plant') || title.includes('vegetarian') || title.includes('vegan') || 
         title.includes('food') || desc.includes('beef') || desc.includes('lamb') || desc.includes('meat');
}

/**
 * Checks if energy challenge keyword matches.
 * @param {string} title - The challenge title
 * @param {string} desc - The challenge description
 * @returns {boolean} True if energy related
 */
function isEnergyChallenge(title, desc) {
  return title.includes('energy') || title.includes('saver') || title.includes('electr') || 
         title.includes('power') || desc.includes('electricity') || desc.includes('power');
}

/**
 * Checks if waste challenge keyword matches.
 * @param {string} title - The challenge title
 * @param {string} desc - The challenge description
 * @returns {boolean} True if waste related
 */
function isWasteChallenge(title, desc) {
  return title.includes('waste') || title.includes('trash') || title.includes('landfill') || 
         desc.includes('recycle') || desc.includes('landfill');
}

/**
 * Calculates progress for transport challenge.
 * @param {Object} challenge - Database challenge record
 * @param {number} elapsed - Days elapsed
 * @param {number} total - Total duration days
 * @returns {number} Progress percentage
 * @throws {Error} If database execution fails
 */
function calculateTransportProgress(challenge, elapsed, total) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM activities
    WHERE user_id = ? 
      AND logged_at BETWEEN ? AND ?
      AND category = 'transport'
      AND activity_type IN ('car_petrol', 'car_diesel', 'car_electric', 'motorcycle')
  `).get(challenge.user_id, challenge.start_date, challenge.end_date);

  if (result.count > 0) return 0;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

/**
 * Calculates progress for food challenge.
 * @param {Object} challenge - Database challenge record
 * @param {number} elapsed - Days elapsed
 * @param {number} total - Total duration days
 * @returns {number} Progress percentage
 * @throws {Error} If database execution fails
 */
function calculateFoodProgress(challenge, elapsed, total) {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM activities
    WHERE user_id = ? 
      AND logged_at BETWEEN ? AND ?
      AND category = 'food'
      AND activity_type IN ('beef', 'lamb')
  `).get(challenge.user_id, challenge.start_date, challenge.end_date);

  if (result.count > 0) return 0;
  return Math.min(100, Math.round((elapsed / total) * 100));
}

/**
 * Helper to fetch sum of electricity quantity.
 * @param {string|number} userId - The user identifier
 * @param {string} startStr - Start date YYYY-MM-DD
 * @param {string} endStr - End date YYYY-MM-DD
 * @returns {number} Quantity sum
 * @throws {Error} If database execution fails
 */
function getElectricityQty(userId, startStr, endStr) {
  const row = db.prepare(`
    SELECT SUM(quantity) as total FROM activities
    WHERE user_id = ? 
      AND logged_at BETWEEN ? AND ?
      AND category = 'energy'
      AND activity_type = 'electricity'
  `).get(userId, startStr, endStr);
  return row ? (row.total || 0) : 0;
}

/**
 * Calculates progress for energy challenge.
 * @param {Object} challenge - Database challenge record
 * @returns {number} Progress percentage
 * @throws {Error} If database execution fails
 */
function calculateEnergyProgress(challenge) {
  const start = new Date(challenge.start_date);
  const preStart = new Date(start);
  preStart.setDate(preStart.getDate() - 7);
  const preStartStr = preStart.toISOString().split('T')[0];
  const preEndStr = new Date(start.getTime() - MS_PER_DAY).toISOString().split('T')[0];

  const prevTotal = getElectricityQty(challenge.user_id, preStartStr, preEndStr);
  const currTotal = getElectricityQty(challenge.user_id, challenge.start_date, challenge.end_date);

  if (prevTotal === 0) {
    return currTotal === 0 ? 100 : 0;
  }

  const reduction = (prevTotal - currTotal) / prevTotal;
  if (reduction >= 0.20) return 100;
  return Math.max(0, Math.min(100, Math.round((reduction / 0.20) * 100)));
}

/**
 * Calculates progress for waste challenge.
 * @param {Object} challenge - Database challenge record
 * @returns {number} Progress percentage
 * @throws {Error} If database execution fails
 */
function calculateWasteProgress(challenge) {
  const landfill = db.prepare(`
    SELECT COUNT(*) as count FROM activities
    WHERE user_id = ? AND logged_at = ? AND category = 'waste' AND activity_type = 'landfill'
  `).get(challenge.user_id, challenge.start_date);

  if (landfill.count > 0) return 0;

  const successLogs = db.prepare(`
    SELECT COUNT(*) as count FROM activities
    WHERE user_id = ? AND logged_at = ? AND category = 'waste' AND activity_type IN ('recycled', 'composted')
  `).get(challenge.user_id, challenge.start_date);

  return successLogs.count > 0 ? 100 : 0;
}

/**
 * Dispatches progress check to matched category algorithm.
 * @param {Object} challenge - Database challenge record
 * @param {number} elapsedDays - Days elapsed
 * @param {number} totalDays - Total duration days
 * @returns {number} Progress percentage
 * @throws {Error} If database execution fails
 */
function dispatchCategoryProgress(challenge, elapsedDays, totalDays) {
  const titleLower = challenge.title.toLowerCase();
  const descLower = challenge.description.toLowerCase();

  if (isTransportChallenge(titleLower, descLower)) {
    return calculateTransportProgress(challenge, elapsedDays, totalDays);
  }
  if (isFoodChallenge(titleLower, descLower)) {
    return calculateFoodProgress(challenge, elapsedDays, totalDays);
  }
  if (isEnergyChallenge(titleLower, descLower)) {
    return calculateEnergyProgress(challenge);
  }
  if (isWasteChallenge(titleLower, descLower)) {
    return calculateWasteProgress(challenge);
  }
  return 0;
}

/**
 * Helper to calculate challenge progress percentage dynamically.
 * @param {Object} challenge - Database challenge record
 * @returns {number} Progress percentage (0 - 100)
 * @throws {Error} If database execution fails
 */
export function calculateChallengeProgress(challenge) {
  if (challenge.status === 'completed') return 100;
  if (challenge.status === 'failed') return 0;

  const now = new Date();
  const start = new Date(challenge.start_date);
  const end = new Date(challenge.end_date);

  const elapsedDays = Math.max(0, Math.floor((now - start) / MS_PER_DAY) + 1);
  const totalDays = Math.max(1, Math.floor((end - start) / MS_PER_DAY) + 1);

  return dispatchCategoryProgress(challenge, elapsedDays, totalDays);
}
