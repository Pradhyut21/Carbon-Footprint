import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../db/database.js';

// In-memory rate limiting map: userId -> array of timestamps
const rateLimitMap = new Map();

/**
 * Generate streaming AI carbon insights via SSE using Claude.
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export async function getAiInsights(req, res, next) {
  try {
    const { userId } = req.body;
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number') || String(userId).length > 50) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    // Rate limiting: 5 requests per user per hour
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let userRequests = rateLimitMap.get(userId) || [];
    userRequests = userRequests.filter(ts => now - ts < oneHour);

    if (userRequests.length >= 5) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Maximum 5 requests per user per hour.'
      });
    }

    userRequests.push(now);
    rateLimitMap.set(userId, userRequests);

    // Fetch user's trailing 30 days of activities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const categorySummary = db.prepare(`
      SELECT category, SUM(co2_kg) as co2, COUNT(*) as count
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY category
    `).all(userId, dateStr);

    const detailedActivities = db.prepare(`
      SELECT category, activity_type, SUM(quantity) as total_quantity, unit, SUM(co2_kg) as total_co2, COUNT(*) as count
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY category, activity_type
      ORDER BY total_co2 DESC
    `).all(userId, dateStr);

    const totalRow = db.prepare(`
      SELECT SUM(co2_kg) as total FROM activities
      WHERE user_id = ? AND logged_at >= ?
    `).get(userId, dateStr);
    const totalCo2 = totalRow ? (totalRow.total || 0) : 0;

    const dataToSend = {
      total_co2_kg: Number(totalCo2.toFixed(2)),
      days: 30,
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

    // SSE headers setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const hasGemini = geminiKey && geminiKey !== 'your_key_here';
    const hasAnthropic = anthropicKey && anthropicKey !== 'your_key_here';

    if (!hasGemini && !hasAnthropic) {
      // Stream mock insights if API key is not configured
      const mockText = `🌱 **CarbonLens AI Assistant Insights (Demo Mode)**

### 1. Personalized Analysis
* **Transport Commute:** You drove 340km in a petrol car — that's **71.4kg CO₂**, equivalent to charging **8,925 smartphones** or driving from Mumbai to Pune.
* **Electricity:** Your home energy usage consumed 150 kWh — generating **35kg CO₂**, equivalent to **1.6 trees** needing a full year to absorb.
* **Dietary Footprint:** You logged 1.5kg of beef — contributing **40.5kg CO₂**, equivalent to a **short-haul flight** engine running for 20 minutes.

### 2. Contextual Action Plan
1. **Commute Smart:** Switching 2 days of car travel to the train cuts transport emissions by **38%** (saving 27kg CO₂).
2. **Plant-Based Substitute:** Swapping beef for chicken or vegetables just twice a week slashes food CO₂ by **40%** (saving 16kg CO₂).
3. **Power Down:** Unplugging devices standby and using LED lights will shave **5kg CO₂** off your electricity total.

### 3. Comparison
Your daily average is **16.2 kg/day**, which is **10% below the Global Average** (18.08 kg/day), but still **136% above the Paris Target** (6.85 kg/day). Keep pushing for the target!`;

      if (process.env.NODE_ENV === 'test') {
        res.write(`data: ${JSON.stringify({ text: mockText })}\n\n`);
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
        return;
      }

      let index = 0;
      const interval = setInterval(() => {
        if (index >= mockText.length) {
          res.write('event: done\ndata: [DONE]\n\n');
          res.end();
          clearInterval(interval);
          return;
        }
        const chunk = mockText.slice(index, index + 8);
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        index += 8;
      }, 40);
      return;
    }

    const systemPrompt = `You are a carbon footprint coach. Given a user's activity data for the past 30 days (including detailed quantities of what they logged), provide a highly personalized, contextual report.
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

    if (hasGemini) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContentStream([
          systemPrompt,
          `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
        ]);

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
        return;
      } catch (err) {
        console.error('Gemini streaming failed:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
        return;
      }
    }

    if (hasAnthropic) {
      try {
        const modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
        const anthropic = new Anthropic({ apiKey: anthropicKey });

        const stream = await anthropic.messages.create({
          model: modelName,
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Here is my carbon footprint data for the past 30 days as JSON: ${JSON.stringify(dataToSend)}`
            }
          ],
          stream: true
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
          }
        }

        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
        return;
      } catch (err) {
        console.error('Claude streaming failed:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
        return;
      }
    }

    // Fallback if neither API key is active
    res.write(`data: ${JSON.stringify({ error: 'No valid AI API key found. Please set GEMINI_API_KEY or ANTHROPIC_API_KEY.' })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      return next(err);
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
