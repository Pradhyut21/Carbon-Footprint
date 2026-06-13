import request from 'supertest';
import app from '../server/app.js';
import db from '../server/db/database.js';

let testUser = null;
let testActivity = null;
let testChallenge = null;

beforeAll(() => {
  // Clear any existing test data
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM challenges').run();
  db.prepare('DELETE FROM users').run();
});

afterAll(() => {
  db.close();
});

describe('CarbonLens API Integration Tests', () => {
  
  // --- 1. User Login Route Tests ---
  describe('POST /api/users/login', () => {
    test('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ username: 'test_user' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe('test_user');
      testUser = res.body;
    });

    test('should retrieve the same user on subsequent logins', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ username: 'test_user' });
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testUser.id);
    });

    test('should return 400 if username is missing or empty', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ username: '' });
      expect(res.status).toBe(400);
    });
  });

  // --- 2. Activity Routes Tests ---
  describe('POST & GET & DELETE /api/activities', () => {
    test('should log a new activity and compute co2_kg server-side', async () => {
      const res = await request(app)
        .post('/api/activities')
        .send({
          userId: testUser.id,
          category: 'transport',
          activityType: 'car_petrol',
          quantity: 100,
          notes: 'Commute to test lab'
        });

      expect(res.status).toBe(201);
      expect(res.body.co2_kg).toBeCloseTo(21.0); // 100 * 0.21
      expect(res.body.unit).toBe('km');
      testActivity = res.body;
    });

    test('should fetch activities for a given user', async () => {
      const res = await request(app)
        .get('/api/activities')
        .query({ userId: testUser.id, days: 30 });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].id).toBe(testActivity.id);
    });

    test('should return 400 when fetching activities without userId', async () => {
      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(400);
    });
  });

  // --- 3. Stats Route Tests ---
  describe('GET /api/stats', () => {
    test('should calculate aggregated stats and streaks correctly', async () => {
      const res = await request(app)
        .get('/api/stats')
        .query({ userId: testUser.id, period: 'month' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('todayCo2');
      expect(res.body).toHaveProperty('thisMonthCo2');
      expect(res.body).toHaveProperty('streak');
      expect(res.body.thisMonthCo2).toBeCloseTo(21.0);
      expect(Array.isArray(res.body.dailyCo2)).toBe(true);
      expect(res.body.dailyCo2.length).toBe(30);
    });
  });

  // --- 4. Challenges Route Tests ---
  describe('POST & GET & PUT /api/challenges', () => {
    test('should accept/join a new challenge successfully', async () => {
      const res = await request(app)
        .post('/api/challenges')
        .send({
          userId: testUser.id,
          title: 'Car-Free Week'
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Car-Free Week');
      expect(res.body.status).toBe('active');
      testChallenge = res.body;
    });

    test('should fetch user challenges along with dynamic progress', async () => {
      const res = await request(app)
        .get('/api/challenges')
        .query({ userId: testUser.id });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      // Since they logged a car_petrol ride during this week, progress must be 0%
      expect(res.body[0].progress).toBe(0);
    });

    test('should update challenge status manually', async () => {
      const res = await request(app)
        .put(`/api/challenges/${testChallenge.id}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- 5. AI Insights Route Rate-Limiting Tests ---
  describe('POST /api/insights (Security & Rate Limit)', () => {
    test('should enforce rate limits (reject 6th request with 429)', async () => {
      const userLimiterId = 999; // isolate rate limits

      // Call 5 times - should succeed (SSE content-type or status 200)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/insights')
          .send({ userId: userLimiterId });
        expect(res.status).toBe(200);
      }

      // 6th call should trigger rate limit
      const limitRes = await request(app)
        .post('/api/insights')
        .send({ userId: userLimiterId });

      expect(limitRes.status).toBe(429);
      expect(limitRes.body).toHaveProperty('error');
      expect(limitRes.body.error).toContain('Rate limit exceeded');
    });
  });

  // Cleanup activity to test DELETE route
  describe('DELETE /api/activities/:id', () => {
    test('should delete activity log', async () => {
      const res = await request(app)
        .delete(`/api/activities/${testActivity.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

});
