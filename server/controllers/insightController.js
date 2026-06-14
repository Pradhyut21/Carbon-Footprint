import { validateAndRateLimit } from './insights/insightRateLimit.js';
import { fetchInsightData, getSystemPrompt } from './insights/insightPrompt.js';
import { streamMockInsights, streamGemini, streamClaude } from './insights/insightStream.js';

/**
 * Helper to set standard SSE response headers.
 * @param {import('express').Response} res - Express response object
 */
function setSseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

/**
 * Generate streaming AI carbon insights via SSE using Claude or Gemini.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 * @throws {Error} If rate limit checking or DB aggregation throws
 */
export async function getAiInsights(req, res, next) {
  try {
    const userId = req.body.userId || req.signedCookies.userId;
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
