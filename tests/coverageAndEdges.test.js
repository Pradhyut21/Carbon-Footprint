import request from 'supertest';
import app from '../server/app.js';
import db from '../server/db/database.js';
import { calculateChallengeProgress } from '../server/controllers/challengeController.js';

let testUser = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/users/login')
    .send({ username: 'coverage_user' });
  testUser = res.body;
});

describe('Additional Coverage and Edge Case Tests', () => {

  // --- 1. calculateChallengeProgress Edge Cases ---
  describe('calculateChallengeProgress unit tests', () => {
    test('should return 100 for completed challenge', () => {
      const p = calculateChallengeProgress({ status: 'completed' });
      expect(p).toBe(100);
    });

    test('should return 0 for failed challenge', () => {
      const p = calculateChallengeProgress({ status: 'failed' });
      expect(p).toBe(0);
    });

    test('should return 0 for transport challenge if car/motorcycle activity logged', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'transport', 'car_petrol', 10, 'km', 2.1, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 6);

      const challenge = {
        user_id: testUser.id,
        title: 'Car-Free Week',
        description: 'Log 0 car trips',
        status: 'active',
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      };

      const p = calculateChallengeProgress(challenge);
      expect(p).toBe(0);
    });

    test('should return 0 for food challenge if beef/lamb logged', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'food', 'beef', 1, 'kg', 27, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 6);

      const challenge = {
        user_id: testUser.id,
        title: 'Plant-Based Week',
        description: 'Eat no beef',
        status: 'active',
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      };

      const p = calculateChallengeProgress(challenge);
      expect(p).toBe(0);
    });

    test('should handle energy challenge with zero prev week consumption', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 6);

      const challenge = {
        user_id: testUser.id,
        title: 'Energy Saver',
        description: 'Reduce electricity',
        status: 'active',
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0]
      };

      let p = calculateChallengeProgress(challenge);
      expect(p).toBe(100);

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 10, 'kWh', 5.0, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      p = calculateChallengeProgress(challenge);
      expect(p).toBe(0);
    });

    test('should calculate reduction progress for energy challenge', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      
      const start = new Date();
      const startStr = start.toISOString().split('T')[0];
      const end = new Date();
      end.setDate(end.getDate() + 6);
      const endStr = end.toISOString().split('T')[0];

      const prevDate = new Date(start);
      prevDate.setDate(prevDate.getDate() - 3);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 100, 'kWh', 50.0, ?)
      `).run(testUser.id, prevDateStr);

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 90, 'kWh', 45.0, ?)
      `).run(testUser.id, startStr);

      const challenge = {
        user_id: testUser.id,
        title: 'Energy Saver',
        description: 'Reduce electricity',
        status: 'active',
        start_date: startStr,
        end_date: endStr
      };

      let p = calculateChallengeProgress(challenge);
      expect(p).toBe(50);

      db.prepare('DELETE FROM activities WHERE user_id = ? AND logged_at = ?').run(testUser.id, startStr);
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 80, 'kWh', 40.0, ?)
      `).run(testUser.id, startStr);

      p = calculateChallengeProgress(challenge);
      expect(p).toBe(100);
    });

    test('should return 0 for waste challenge if landfill logged', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      const start = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'waste', 'landfill', 5, 'kg', 10.0, ?)
      `).run(testUser.id, start);

      const challenge = {
        user_id: testUser.id,
        title: 'Zero Waste Day',
        description: 'No landfill waste',
        status: 'active',
        start_date: start,
        end_date: start
      };

      const p = calculateChallengeProgress(challenge);
      expect(p).toBe(0);
    });

    test('should return 100 for waste challenge if no landfill and recycled/composted logged', () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      const start = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'waste', 'recycled', 5, 'kg', 0.5, ?)
      `).run(testUser.id, start);

      const challenge = {
        user_id: testUser.id,
        title: 'Zero Waste Day',
        description: 'No landfill waste',
        status: 'active',
        start_date: start,
        end_date: start
      };

      const p = calculateChallengeProgress(challenge);
      expect(p).toBe(100);
    });

    test('should return 0 for unknown challenge title', () => {
      const challenge = {
        user_id: testUser.id,
        title: 'Some Crazy Challenge',
        description: 'Random',
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      };
      const p = calculateChallengeProgress(challenge);
      expect(p).toBe(0);
    });
  });

  // --- 2. challenge expiry logic ---
  describe('Challenge Expiry and Templates Fallback', () => {
    test('GET /api/challenges should update expired active challenge status to failed or completed', async () => {
      db.prepare('DELETE FROM challenges WHERE user_id = ?').run(testUser.id);
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);

      const start = new Date();
      start.setDate(start.getDate() - 10);
      const startStr = start.toISOString().split('T')[0];
      const end = new Date();
      end.setDate(end.getDate() - 3);
      const endStr = end.toISOString().split('T')[0];
      
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'transport', 'car_petrol', 10, 'km', 2.1, ?)
      `).run(testUser.id, startStr);

      db.prepare(`
        INSERT INTO challenges (user_id, title, description, target_reduction_kg, start_date, end_date, status)
        VALUES (?, 'Car-Free Week', 'Log 0 car trips', 15.0, ?, ?, 'active')
      `).run(testUser.id, startStr, endStr);

      const res = await request(app)
        .get('/api/challenges')
        .query({ userId: testUser.id });

      expect(res.status).toBe(200);
      expect(res.body[0].status).toBe('failed');
    });

    test('GET /api/challenges/templates fallback rule-based for energy and waste worst category', async () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 1000, 'kWh', 500.0, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      const res = await request(app)
        .get('/api/challenges/templates')
        .query({ userId: testUser.id });

      expect(res.status).toBe(200);
      expect(res.body[0].title).toContain('Energy');

      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'waste', 'landfill', 1000, 'kg', 2000.0, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      const resWaste = await request(app)
        .get('/api/challenges/templates')
        .query({ userId: testUser.id });

      expect(resWaste.status).toBe(200);
      expect(resWaste.body[0].title).toContain('Waste');
    });
  });

  // --- 3. Stats streak yesterday/checkDate edge cases ---
  describe('Stats Controller streak and compare edge cases', () => {
    test('should calculate streak correctly when user logged activity yesterday but not today', async () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 10, 'kWh', 5.0, ?)
      `).run(testUser.id, yesterdayStr);

      const res = await request(app)
        .get('/api/stats')
        .query({ userId: testUser.id, period: 'week' });

      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(1);
    });

    test('should handle stats compare with empty or single old activity', async () => {
      db.prepare('DELETE FROM activities WHERE user_id = ?').run(testUser.id);
      
      let res = await request(app)
        .get('/api/stats/compare')
        .query({ userId: testUser.id });
      
      expect(res.status).toBe(200);
      expect(res.body.user).toBe(0);

      db.prepare(`
        INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at)
        VALUES (?, 'energy', 'electricity', 10, 'kWh', 5.0, ?)
      `).run(testUser.id, new Date().toISOString().split('T')[0]);

      res = await request(app)
        .get('/api/stats/compare')
        .query({ userId: testUser.id });
      
      expect(res.status).toBe(200);
      expect(res.body.user).toBeGreaterThan(0);
    });
  });

  // --- 4. Insights Controller Edge Cases ---
  describe('Insights Rate Limiting and Validation', () => {
    test('POST /api/insights should reject invalid users', async () => {
      const res = await request(app)
        .post('/api/insights')
        .send({ userId: '' });
      expect(res.status).toBe(400);
    });

    test('POST /api/insights should return rate limit 429 when hit repeatedly', async () => {
      const userId = 'rate_limit_user_' + Date.now();
      
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/insights')
          .send({ userId });
        expect(res.status).toBe(200);
      }

      const res6 = await request(app)
        .post('/api/insights')
        .send({ userId });
      expect(res6.status).toBe(429);
      expect(res6.body.error).toContain('Rate limit');
    });
  });

  // --- 5. CORS and API Failure catch coverage ---
  describe('CORS and Claude Failure coverage', () => {
    test('should reject requests from invalid CORS origin', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'http://evil.com');
      
      expect(res.status).toBe(500);
    });

    test('should catch Claude template generation failure and return fallback', async () => {
      const origGemini = process.env.GEMINI_API_KEY;
      const origAnthropic = process.env.ANTHROPIC_API_KEY;
      
      process.env.GEMINI_API_KEY = 'your_key_here';
      process.env.ANTHROPIC_API_KEY = 'fake_key';
      
      const res = await request(app)
        .get('/api/challenges/templates')
        .query({ userId: testUser.id });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (origGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = origGemini;
      }
      if (origAnthropic === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = origAnthropic;
      }
    });

    test('should catch Claude stream insights failure', async () => {
      const origGemini = process.env.GEMINI_API_KEY;
      const origAnthropic = process.env.ANTHROPIC_API_KEY;
      
      process.env.GEMINI_API_KEY = 'your_key_here';
      process.env.ANTHROPIC_API_KEY = 'fake_key';
      
      const res = await request(app)
        .post('/api/insights')
        .send({ userId: testUser.id });

      expect(res.status).toBe(200);

      if (origGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = origGemini;
      }
      if (origAnthropic === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = origAnthropic;
      }
    });
  });
});
