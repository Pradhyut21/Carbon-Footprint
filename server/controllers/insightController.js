import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../db/database.js';
import logger from '../utils/logger.js';
import { 
  DEFAULT_PERIOD_DAYS, 
  INSIGHTS_LIMIT_MS, 
  INSIGHTS_LIMIT_MAX, 
  INSIGHTS_MOCK_TEXT 
} from '../constants/appConstants.js';

// In-memory rate limiting map: userId -> array of timestamps
const rateLimitMap = new Map();

/**
 * Validates requests and logs rate limit timestamps
 * @param {string|number} userId 
 * @returns {boolean}
 */
function validateAndRateLimit(userId) {
  const now = Date.now();
  let userRequests = rateLimitMap.get(userId) || [];
  userRequests = userRequests.filter(ts => now - ts < INSIGHTS_LIMIT_MS);

  if (userRequests.length >= INSIGHTS_LIMIT_MAX) return false;

  userRequests.push(now);
  rateLimitMap.set(userId, userRequests);
  return true;
}

/**
 * Builds data payload object
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
 * Aggregates database content for the last 30 days
 */
function fetchInsightData(userId) {
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
 * Returns system prompt instructions
 */
function getSystemPrompt() {
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

/**
 * Streams hardcoded fallback insights
 */
function streamMockInsights(res) {
  if (process.env.NODE_ENV === 'test') {
    res.write(`data: ${JSON.stringify({ text: INSIGHTS_MOCK_TEXT })}\n\n`);
    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
    return;
  }

  let index = 0;
  const interval = setInterval(() => {
    if (index >= INSIGHTS_MOCK_TEXT.length) {
      res.write('event: done\ndata: [DONE]\n\n');
      res.end();
      clearInterval(interval);
      return;
    }
    res.write(`data: ${JSON.stringify({ text: INSIGHTS_MOCK_TEXT.slice(index, index + 8) })}\n\n`);
    index += 8;
  }, 40);
}

/**
 * Streams Gemini AI responses
 */
async function streamGemini(res, dataToSend, systemPrompt, key) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContentStream([
      systemPrompt,
      `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
    ]);

    for await (const chunk of result.stream) {
      res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
    }
    res.write('event: done\ndata: [DONE]\n\n');
  } catch (err) {
    logger.error('Gemini streaming failed:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * Streams Anthropic Claude AI responses
 */
async function streamClaude(res, dataToSend, systemPrompt, key) {
  try {
    const modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
    const anthropic = new Anthropic({ apiKey: key });

    const stream = await anthropic.messages.create({
      model: modelName,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
      }],
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('event: done\ndata: [DONE]\n\n');
  } catch (err) {
    logger.error('Claude streaming failed:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
}

/**
 * Helper to set standard SSE response headers
 */
function setSseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

/**
 * Generate streaming AI carbon insights via SSE using Claude.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export async function getAiInsights(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number') || String(userId).length > 50) {
      return res.status(400).json({ error: 'Invalid user' });
    }
    if (!validateAndRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 5 requests per user per hour.' });
    }
    setSseHeaders(res);
    const dataToSend = fetchInsightData(userId);
    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (geminiKey && geminiKey !== 'your_key_here') {
      return streamGemini(res, dataToSend, getSystemPrompt(), geminiKey);
    }
    if (anthropicKey && anthropicKey !== 'your_key_here') {
      return streamClaude(res, dataToSend, getSystemPrompt(), anthropicKey);
    }
    return streamMockInsights(res);
  } catch (err) {
    if (!res.headersSent) return next(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
