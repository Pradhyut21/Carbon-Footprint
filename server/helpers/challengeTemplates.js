import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import { FALLBACK_TEMPLATES } from '../constants/appConstants.js';

/**
 * Formats fallback descriptions dynamically
 */
function formatDescription(title, category, worstCo2) {
  if (category === 'food' && title === 'Plant-Based 3-Day Challenge') {
    return `Swap beef/lamb for chicken or veg meals for 3 days. Saves you 81.0kg CO₂ based on your beef consumption of ${worstCo2}kg.`;
  }
  if (category === 'transport' && title === 'Car-Free Commute Week') {
    return `Log 0 car or motorcycle trips for 7 days. Use public transit, cycling, or walking! Saves you 30.0kg CO₂.`;
  }

  const staticDescs = {
    'Dairy-Free Transition': 'Swap dairy milk and cheese with plant-based alternatives for 5 days. Saves you 10.0kg CO₂.',
    'Zero Food Waste Week': 'Plan your meals, eat all leftovers, and buy zero excess food for 7 days. Saves you 15.0kg CO₂.',
    'Local & Seasonal Diet': 'Commit to buying only local produce and seasonal food for 7 days. Saves you 12.0kg CO₂.',
    'Public Transit Switch': 'Switch your commute to bus or train for 3 days this week. Saves you 15.0kg CO₂.',
    'Active Commute Weekend': 'Walk or cycle for all local trips under 5km this weekend. Saves you 8.0kg CO₂.',
    'Ride-Share & Carpool': 'Share your commute or carpool with a peer for 4 days. Saves you 12.0kg CO₂.',
    'Energy Saver Challenge': 'Unplug stand-by devices and turn off lights in empty rooms for 7 days. Saves you 15.0kg CO₂.',
    'Eco-Thermostat Week': 'Set your thermostat 2 degrees warmer/cooler and turn off empty room ACs for 5 days. Saves you 10.0kg CO₂.',
    'Unplugged Evening': 'Power down laptops, TVs, and non-essential devices for one whole evening. Saves you 3.5kg CO₂.',
    'Cold Wash & Line Dry': 'Wash all clothes on cold cycles and air-dry instead of machine-drying for 7 days. Saves you 6.0kg CO₂.',
    'Zero Waste Challenge': 'Log 0 landfill waste. Recycle and compost everything for 5 days. Saves you 12.0kg CO₂.',
    'No New Clothes Month': 'Avoid buying any new clothing items for 30 days. Appreciate what you have! Saves you 40.0kg CO₂.',
    'Refuse Single-Use Plastic': 'Use reusable mugs, bottles, and grocery bags, logging zero packaging waste for 7 days. Saves you 8.0kg CO₂.',
    'Digital Purchase Freeze': 'Freeze all non-essential small electronics purchases for 14 days. Saves you 25.0kg CO₂.'
  };
  return staticDescs[title] || '';
}

/**
 * Builds instructions prompt text
 */
function buildPromptText(worstCategory, worstType, worstCo2) {
  return `Generate 4 highly specific, personalized carbon reduction challenge templates for a user whose worst carbon category is "${worstCategory}" (specifically "${worstType}", which generated ${worstCo2} kg CO2 in the past 30 days).
Return EXACTLY a JSON array of 4 challenge objects, and nothing else. No markdown wrapping.
Each object MUST have:
1. "title": string, e.g. "Plant-Based 3-Day Challenge" or "Car-Free Commuting"
2. "description": string, detailing specific actions and highlighting the estimated savings (e.g. "Go car-free for 3 days and save 15kg CO2 by commuting via train or bus.")
3. "target_reduction_kg": number (float, estimated savings)
4. "duration_days": number (integer)

Ensure the challenges match the worst category or worst activity type. Use realistic savings numbers. Do not include formatting other than raw JSON array.`;
}

/**
 * Generates templates using Gemini
 * @param {string} worstCategory 
 * @param {string} worstType 
 * @param {number} worstCo2 
 * @param {string} key 
 * @returns {Promise<Array<Object>|null>}
 */
export async function generateGeminiTemplates(worstCategory, worstType, worstCo2, key) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(buildPromptText(worstCategory, worstType, worstCo2));
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length === 4) {
      return parsed;
    }
  } catch (err) {
    logger.error('Gemini challenge generation failed:', err.message);
  }
  return null;
}

/**
 * Generates templates using Claude
 * @param {string} worstCategory 
 * @param {string} worstType 
 * @param {number} worstCo2 
 * @param {string} key 
 * @returns {Promise<Array<Object>|null>}
 */
export async function generateClaudeTemplates(worstCategory, worstType, worstCo2, key) {
  try {
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
    const response = await new Anthropic({ apiKey: key }).messages.create({
      model, max_tokens: 600,
      system: "You are a database helper that outputs raw JSON lists of challenge recommendations.",
      messages: [{ role: 'user', content: buildPromptText(worstCategory, worstType, worstCo2) }]
    });
    const cleanJson = response.content[0].text.trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length === 4) return parsed;
  } catch (err) {
    logger.error('Claude challenge generation failed, using rule-based fallback:', err);
  }
  return null;
}

/**
 * Generates fallback rule-based templates
 * @param {string} worstCategory 
 * @param {number} worstCo2 
 * @returns {Array<Object>}
 */
export function generateFallbackTemplates(worstCategory, worstCo2) {
  const list = FALLBACK_TEMPLATES[worstCategory] || FALLBACK_TEMPLATES.default;
  return list.map(item => ({
    ...item,
    description: formatDescription(item.title, worstCategory, worstCo2)
  }));
}
