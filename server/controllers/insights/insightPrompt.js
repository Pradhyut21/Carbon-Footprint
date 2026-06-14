import db from '../../db/database.js';
import { DEFAULT_PERIOD_DAYS } from '../../constants/config.js';

/**
 * Builds data payload object.
 * @param {number} totalCo2 - Total emissions in kg
 * @param {Array<Object>} categorySummary - Array of category aggregates
 * @param {Array<Object>} detailedActivities - Array of specific activity logs
 * @returns {Object} Structured data payload
 */
function buildDataPayload(totalCo2, categorySummary, detailedActivities) {
  return {
    total_co2_kg: Number(totalCo2.toFixed(2)),
    days: DEFAULT_PERIOD_DAYS,
    activities_by_category: categorySummary.map(row => ({
      category: row.category,
      co2_kg: Number(row.co2.toFixed(2)),
      count: row.count
    })),
    detailed_activities: detailedActivities.map(row => ({
      category: row.category,
      activity_type: row.activity_type,
      quantity: Number(row.total_quantity.toFixed(2)),
      unit: row.unit,
      co2_kg: Number(row.total_co2.toFixed(2)),
      count: row.count
    }))
  };
}

/**
 * Aggregates database content for the last 30 days.
 * @param {string|number} userId - The user ID
 * @returns {Object} Data payload
 * @throws {Error} If DB query execution fails
 */
export function fetchInsightData(userId) {
  const dateStr = new Date(Date.now() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const categorySummary = db.prepare(`
    SELECT category, SUM(co2_kg) as co2, COUNT(*) as count FROM activities
    WHERE user_id = ? AND logged_at >= ? GROUP BY category
  `).all(userId, dateStr);

  const detailedActivities = db.prepare(`
    SELECT category, activity_type, SUM(quantity) as total_quantity, unit, SUM(co2_kg) as total_co2, COUNT(*) as count
    FROM activities WHERE user_id = ? AND logged_at >= ?
    GROUP BY category, activity_type ORDER BY total_co2 DESC
  `).all(userId, dateStr);

  const totalRow = db.prepare(`
    SELECT SUM(co2_kg) as total FROM activities WHERE user_id = ? AND logged_at >= ?
  `).get(userId, dateStr);

  return buildDataPayload(totalRow ? (totalRow.total || 0) : 0, categorySummary, detailedActivities);
}

/**
 * Returns system prompt instructions.
 * @returns {string} Text instructions
 */
export function getSystemPrompt() {
  return `You are a carbon footprint coach. Given a user's activity data for the past 30 days (including detailed quantities of what they logged), provide a highly personalized, contextual report.
CRITICAL: Do NOT just list or summarize the data generically. You MUST calculate and output concrete, memorable equivalences for their highest emission sources.
Use these conversion factors for equivalences:
- 1 tree absorbs ~22kg of CO2 per year.
- 1 smartphone charge is ~0.008kg of CO2 (or 125 charges per 1kg CO2).
- 1 short-haul flight (e.g. New York to London) is ~500kg of CO2.
- 1 km driving an average petrol car is ~0.21kg of CO2.

For example, instead of saying: "Your transport emissions are 71kg CO2 from driving 340km," say: "You drove 340km in a petrol car this month — that's 71kg CO2, equivalent to charging 8,875 smartphones. Switching 2 days to train cuts this by 38%."

Format your response exactly as follows:
1. **Personalized Analysis**: Highlighting their top emissions with vivid, memorable equivalences (like trees, smartphone charges, or flights).
2. **Contextual Action Plan**: 3 highly specific, quantified tips (e.g., "Replacing beef with chicken for 3 meals cuts food footprint by 15kg CO2, equivalent to planting 0.7 trees").
3. **Motivating Peer Comparison**: Compare their daily average to the Global Average (18.08 kg/day), India Average (5.2 kg/day), or the Paris Target (6.85 kg/day).

Be concise, engaging, and professional. Respond in under 250 words.`;
}
