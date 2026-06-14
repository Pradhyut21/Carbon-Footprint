import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../db/database.js';
import logger from '../utils/logger.js';

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
  if (challenge.status === 'completed') return 100;
  if (challenge.status === 'failed') return 0;

  const now = new Date();
  const start = new Date(challenge.start_date);
  const end = new Date(challenge.end_date);

  const elapsedDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
  const totalDays = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);

  const titleLower = challenge.title.toLowerCase();
  const descLower = challenge.description.toLowerCase();

  // 1. Transport / Car-Free logic
  if (
    titleLower.includes('car-free') || 
    titleLower.includes('transit') || 
    titleLower.includes('commute') || 
    titleLower.includes('car') || 
    descLower.includes('car ') || 
    descLower.includes('drive')
  ) {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE user_id = ? 
        AND logged_at BETWEEN ? AND ?
        AND category = 'transport'
        AND activity_type IN ('car_petrol', 'car_diesel', 'car_electric', 'motorcycle')
    `).get(challenge.user_id, challenge.start_date, challenge.end_date);

    if (result.count > 0) return 0;
    return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  }

  // 2. Food / Plant-Based logic
  if (
    titleLower.includes('plant') || 
    titleLower.includes('vegetarian') || 
    titleLower.includes('vegan') || 
    titleLower.includes('food') || 
    descLower.includes('beef') || 
    descLower.includes('lamb') || 
    descLower.includes('meat')
  ) {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE user_id = ? 
        AND logged_at BETWEEN ? AND ?
        AND category = 'food'
        AND activity_type IN ('beef', 'lamb')
    `).get(challenge.user_id, challenge.start_date, challenge.end_date);

    if (result.count > 0) return 0;
    return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  }

  // 3. Energy Saver logic
  if (
    titleLower.includes('energy') || 
    titleLower.includes('saver') || 
    titleLower.includes('electr') || 
    titleLower.includes('power') || 
    descLower.includes('electricity') || 
    descLower.includes('power')
  ) {
    const preStart = new Date(start);
    preStart.setDate(preStart.getDate() - 7);
    const preStartStr = preStart.toISOString().split('T')[0];
    const preEndStr = new Date(start.getTime() - 1000 * 60 * 60 * 24).toISOString().split('T')[0];

    const prevRow = db.prepare(`
      SELECT SUM(quantity) as total FROM activities
      WHERE user_id = ? 
        AND logged_at BETWEEN ? AND ?
        AND category = 'energy'
        AND activity_type = 'electricity'
    `).get(challenge.user_id, preStartStr, preEndStr);
    const prevTotal = prevRow ? (prevRow.total || 0) : 0;

    const currRow = db.prepare(`
      SELECT SUM(quantity) as total FROM activities
      WHERE user_id = ? 
        AND logged_at BETWEEN ? AND ?
        AND category = 'energy'
        AND activity_type = 'electricity'
    `).get(challenge.user_id, challenge.start_date, challenge.end_date);
    const currTotal = currRow ? (currRow.total || 0) : 0;

    if (prevTotal === 0) {
      return currTotal === 0 ? 100 : 0;
    }

    const reduction = (prevTotal - currTotal) / prevTotal;
    if (reduction >= 0.20) return 100;
    return Math.max(0, Math.min(100, Math.round((reduction / 0.20) * 100)));
  }

  // 4. Waste / Zero Waste logic
  if (
    titleLower.includes('waste') || 
    titleLower.includes('trash') || 
    titleLower.includes('landfill') || 
    descLower.includes('recycle') || 
    descLower.includes('landfill')
  ) {
    const landfill = db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE user_id = ? 
        AND logged_at = ?
        AND category = 'waste'
        AND activity_type = 'landfill'
    `).get(challenge.user_id, challenge.start_date);

    if (landfill.count > 0) return 0;

    const successLogs = db.prepare(`
      SELECT COUNT(*) as count FROM activities
      WHERE user_id = ? 
        AND logged_at = ?
        AND category = 'waste'
        AND activity_type IN ('recycled', 'composted')
    `).get(challenge.user_id, challenge.start_date);

    if (successLogs.count > 0) return 100;
    return 0;
  }

  return 0;
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

    const dbChallenges = db.prepare(`
      SELECT * FROM challenges WHERE user_id = ?
    `).all(userId);

    const nowStr = new Date().toISOString().split('T')[0];

    const updatedChallenges = dbChallenges.map(challenge => {
      let status = challenge.status;
      let progress = calculateChallengeProgress(challenge);

      // If active challenge has expired
      if (challenge.status === 'active' && challenge.end_date < nowStr) {
        status = progress === 100 ? 'completed' : 'failed';
        db.prepare(`
          UPDATE challenges SET status = ? WHERE id = ?
        `).run(status, challenge.id);
        challenge.status = status;
      }

      return {
        ...challenge,
        progress
      };
    });

    return res.json(updatedChallenges);
  } catch (err) {
    return next(err);
  }
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
    let { userId, title, description, target_reduction_kg, duration_days } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and challenge title are required' });
    }

    // Sanitize user inputs to prevent Stored XSS
    const cleanTitle = String(title).trim().replace(/<[^>]*>/g, '');
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Invalid challenge title' });
    }

    // Check if challenge is already active/completed for this user
    const existing = db.prepare(`
      SELECT * FROM challenges WHERE user_id = ? AND title = ? AND status = 'active'
    `).get(userId, cleanTitle);

    if (existing) {
      return res.status(400).json({ error: 'You already have an active challenge with this title' });
    }

    let finalDescription = description ? String(description).trim().replace(/<[^>]*>/g, '') : description;
    let finalTarget = target_reduction_kg;
    let finalDuration = duration_days;

    // Fallback to PREDEFINED_CHALLENGES if parameters not supplied
    if (!finalDescription || finalTarget === undefined || !finalDuration) {
      const template = PREDEFINED_CHALLENGES.find(c => c.title === cleanTitle);
      if (template) {
        finalDescription = template.description;
        finalTarget = template.target_reduction_kg;
        finalDuration = template.duration_days;
      } else {
        return res.status(400).json({ error: 'Invalid challenge title or missing challenge details' });
      }
    }

    const start = new Date();
    const startStr = start.toISOString().split('T')[0];
    
    const end = new Date();
    end.setDate(end.getDate() + Number(finalDuration) - 1);
    const endStr = end.toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO challenges (user_id, title, description, target_reduction_kg, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(userId, cleanTitle, finalDescription, Number(finalTarget), startStr, endStr);

    const newChallenge = {
      id: result.lastInsertRowid,
      user_id: Number(userId),
      title: cleanTitle,
      description: finalDescription,
      target_reduction_kg: Number(finalTarget),
      start_date: startStr,
      end_date: endStr,
      status: 'active',
      progress: 0
    };

    return res.status(201).json(newChallenge);
  } catch (err) {
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

    const result = db.prepare(`
      UPDATE challenges SET status = ? WHERE id = ?
    `).run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    return res.json({ success: true, message: 'Challenge status updated successfully' });
  } catch (err) {
    return next(err);
  }
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

    // 1. Determine worst category and worst activity type in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const worstCategoryRow = db.prepare(`
      SELECT category, SUM(co2_kg) as co2
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY category
      ORDER BY co2 DESC
      LIMIT 1
    `).get(userId, dateStr);

    const worstCategory = worstCategoryRow ? worstCategoryRow.category : 'food';
    const worstCo2 = worstCategoryRow ? Number(worstCategoryRow.co2.toFixed(2)) : 0;

    const worstTypeRow = db.prepare(`
      SELECT activity_type, SUM(co2_kg) as co2
      FROM activities
      WHERE user_id = ? AND logged_at >= ?
      GROUP BY activity_type
      ORDER BY co2 DESC
      LIMIT 1
    `).get(userId, dateStr);
    const worstType = worstTypeRow ? worstTypeRow.activity_type : 'beef';

    // 2. Try to generate using Claude or Gemini if API key is configured
    const geminiKey = process.env.GEMINI_API_KEY;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const prompt = `Generate 4 highly specific, personalized carbon reduction challenge templates for a user whose worst carbon category is "${worstCategory}" (specifically "${worstType}", which generated ${worstCo2} kg CO2 in the past 30 days).
Return EXACTLY a JSON array of 4 challenge objects, and nothing else. No markdown wrapping.
Each object MUST have:
1. "title": string, e.g. "Plant-Based 3-Day Challenge" or "Car-Free Commuting"
2. "description": string, detailing specific actions and highlighting the estimated savings (e.g. "Go car-free for 3 days and save 15kg CO2 by commuting via train or bus.")
3. "target_reduction_kg": number (float, estimated savings)
4. "duration_days": number (integer)

Ensure the challenges match the worst category or worst activity type. Use realistic savings numbers. Do not include formatting other than raw JSON array.`;

    if (geminiKey && geminiKey !== 'your_key_here') {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleanJson = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length === 4) {
          return res.json(parsed);
        }
      } catch (err) {
        logger.error('Gemini challenge generation failed:', err.message);
      }
    }

    if (apiKey && apiKey !== 'your_key_here') {
      try {
        const modelName = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
        const anthropic = new Anthropic({ apiKey });

        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 600,
          system: "You are a database helper that outputs raw JSON lists of challenge recommendations.",
          messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content[0].text.trim();
        const cleanJson = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length === 4) {
          return res.json(parsed);
        }
      } catch (err) {
        logger.error('Claude challenge generation failed, using rule-based fallback:', err);
      }
    }

    // 3. Fallback Rule-Based Generation based on worstCategory
    let templates = [];
    if (worstCategory === 'food') {
      templates = [
        {
          title: 'Plant-Based 3-Day Challenge',
          description: `Swap beef/lamb for chicken or veg meals for 3 days. Saves you 81.0kg CO₂ based on your beef consumption of ${worstCo2}kg.`,
          target_reduction_kg: 81.0,
          duration_days: 3
        },
        {
          title: 'Dairy-Free Transition',
          description: 'Swap dairy milk and cheese with plant-based alternatives for 5 days. Saves you 10.0kg CO₂.',
          target_reduction_kg: 10.0,
          duration_days: 5
        },
        {
          title: 'Zero Food Waste Week',
          description: 'Plan your meals, eat all leftovers, and buy zero excess food for 7 days. Saves you 15.0kg CO₂.',
          target_reduction_kg: 15.0,
          duration_days: 7
        },
        {
          title: 'Local & Seasonal Diet',
          description: 'Commit to buying only local produce and seasonal food for 7 days. Saves you 12.0kg CO₂.',
          target_reduction_kg: 12.0,
          duration_days: 7
        }
      ];
    } else if (worstCategory === 'transport') {
      templates = [
        {
          title: 'Car-Free Commute Week',
          description: 'Log 0 car or motorcycle trips for 7 days. Use public transit, cycling, or walking! Saves you 30.0kg CO₂.',
          target_reduction_kg: 30.0,
          duration_days: 7
        },
        {
          title: 'Public Transit Switch',
          description: 'Switch your commute to bus or train for 3 days this week. Saves you 15.0kg CO₂.',
          target_reduction_kg: 15.0,
          duration_days: 3
        },
        {
          title: 'Active Commute Weekend',
          description: 'Walk or cycle for all local trips under 5km this weekend. Saves you 8.0kg CO₂.',
          target_reduction_kg: 8.0,
          duration_days: 2
        },
        {
          title: 'Ride-Share & Carpool',
          description: 'Share your commute or carpool with a peer for 4 days. Saves you 12.0kg CO₂.',
          target_reduction_kg: 12.0,
          duration_days: 4
        }
      ];
    } else if (worstCategory === 'energy') {
      templates = [
        {
          title: 'Energy Saver Challenge',
          description: 'Unplug stand-by devices and turn off lights in empty rooms for 7 days. Saves you 15.0kg CO₂.',
          target_reduction_kg: 15.0,
          duration_days: 7
        },
        {
          title: 'Eco-Thermostat Week',
          description: 'Set your thermostat 2 degrees warmer/cooler and turn off empty room ACs for 5 days. Saves you 10.0kg CO₂.',
          target_reduction_kg: 10.0,
          duration_days: 5
        },
        {
          title: 'Unplugged Evening',
          description: 'Power down laptops, TVs, and non-essential devices for one whole evening. Saves you 3.5kg CO₂.',
          target_reduction_kg: 3.5,
          duration_days: 1
        },
        {
          title: 'Cold Wash & Line Dry',
          description: 'Wash all clothes on cold cycles and air-dry instead of machine-drying for 7 days. Saves you 6.0kg CO₂.',
          target_reduction_kg: 6.0,
          duration_days: 7
        }
      ];
    } else {
      templates = [
        {
          title: 'Zero Waste Challenge',
          description: 'Log 0 landfill waste. Recycle and compost everything for 5 days. Saves you 12.0kg CO₂.',
          target_reduction_kg: 12.0,
          duration_days: 5
        },
        {
          title: 'No New Clothes Month',
          description: 'Avoid buying any new clothing items for 30 days. Appreciate what you have! Saves you 40.0kg CO₂.',
          target_reduction_kg: 40.0,
          duration_days: 30
        },
        {
          title: 'Refuse Single-Use Plastic',
          description: 'Use reusable mugs, bottles, and grocery bags, logging zero packaging waste for 7 days. Saves you 8.0kg CO₂.',
          target_reduction_kg: 8.0,
          duration_days: 7
        },
        {
          title: 'Digital Purchase Freeze',
          description: 'Freeze all non-essential small electronics purchases for 14 days. Saves you 25.0kg CO₂.',
          target_reduction_kg: 25.0,
          duration_days: 14
        }
      ];
    }

    return res.json(templates);
  } catch (err) {
    return next(err);
  }
}

