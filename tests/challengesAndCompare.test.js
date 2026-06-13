import request from 'supertest';
import app from '../server/app.js';
import db from '../server/db/database.js';

let testUser = null;

beforeAll(async () => {
  // Clear other test users to avoid interference
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM challenges').run();
  db.prepare('DELETE FROM users').run();

  const res = await request(app)
    .post('/api/users/login')
    .send({ username: 'pwa_test_user' });
  testUser = res.body;
});

afterAll(() => {
  db.close();
});

describe('CarbonLens Peer Comparison and Dynamic Challenges Tests', () => {

  // 1. GET /api/stats/compare validation
  test('GET /api/stats/compare should reject requests without userId', async () => {
    const res = await request(app).get('/api/stats/compare');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('userId');
  });

  // 2. GET /api/stats/compare success schema check
  test('GET /api/stats/compare should return peer comparison statistics', async () => {
    const res = await request(app)
      .get('/api/stats/compare')
      .query({ userId: testUser.id });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('india', 1.9);
    expect(res.body).toHaveProperty('global', 6.6);
    expect(res.body).toHaveProperty('paris', 2.5);
  });

  // 3. GET /api/challenges/templates validation
  test('GET /api/challenges/templates should reject requests without userId', async () => {
    const res = await request(app).get('/api/challenges/templates');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('userId');
  });

  // 4. GET /api/challenges/templates default category recommendations
  test('GET /api/challenges/templates should return default templates when user has no logged activities', async () => {
    const res = await request(app)
      .get('/api/challenges/templates')
      .query({ userId: testUser.id });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
    expect(res.body[0].title).toContain('Plant-Based');
  });

  // 5. GET /api/challenges/templates worst category food
  test('GET /api/challenges/templates should tailor templates to food category if beef generates the highest footprint', async () => {
    // Log a beef meal activity
    await request(app)
      .post('/api/activities')
      .send({
        userId: testUser.id,
        category: 'food',
        activityType: 'beef',
        quantity: 5, // 5 * 27 = 135 kg
        notes: 'Huge family roast'
      });

    const res = await request(app)
      .get('/api/challenges/templates')
      .query({ userId: testUser.id });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].title).toContain('Plant-Based');
  });

  // 6. GET /api/challenges/templates worst category transport
  test('GET /api/challenges/templates should tailor templates to transport category if transport logs generate the highest footprint', async () => {
    // Log a car_petrol activity that outweighs the beef food footprint
    await request(app)
      .post('/api/activities')
      .send({
        userId: testUser.id,
        category: 'transport',
        activityType: 'car_petrol',
        quantity: 1000 // 1000 * 0.21 = 210 kg > 135 kg
      });

    const res = await request(app)
      .get('/api/challenges/templates')
      .query({ userId: testUser.id });

    expect(res.status).toBe(200);
    expect(res.body[0].title).toContain('Car-Free');
  });

  // 7. POST /api/challenges dynamic join check
  test('POST /api/challenges should allow joining challenges with dynamic/custom parameters', async () => {
    const customChallenge = {
      userId: testUser.id,
      title: 'Custom Commuting Challenge',
      description: 'Avoid solo car travel and cycle to work instead.',
      target_reduction_kg: 18.5,
      duration_days: 10
    };

    const res = await request(app)
      .post('/api/challenges')
      .send(customChallenge);

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(customChallenge.title);
    expect(res.body.description).toBe(customChallenge.description);
    expect(res.body.target_reduction_kg).toBe(customChallenge.target_reduction_kg);
  });

  // 8. POST /api/challenges duplicate check
  test('POST /api/challenges should reject duplicate active challenge joining', async () => {
    const res = await request(app)
      .post('/api/challenges')
      .send({
        userId: testUser.id,
        title: 'Custom Commuting Challenge'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('active challenge');
  });

  // 9. POST /api/challenges invalid dynamic inputs
  test('POST /api/challenges should reject malformed dynamic parameters', async () => {
    const res = await request(app)
      .post('/api/challenges')
      .send({
        userId: testUser.id,
        title: 'Another Custom Challenge',
        target_reduction_kg: -5.0, // negative target should fail validation
        duration_days: 0 // zero duration should fail validation
      });

    expect(res.status).toBe(400);
  });

});
