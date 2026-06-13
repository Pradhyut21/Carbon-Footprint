import request from 'supertest';
import app from '../server/app.js';
import db from '../server/db/database.js';

let validUser = null;

beforeAll(async () => {
  db.prepare('DELETE FROM activities').run();
  db.prepare('DELETE FROM users').run();

  const res = await request(app)
    .post('/api/users/login')
    .send({ username: 'validation_tester' });
  validUser = res.body;
});

afterAll(() => {
  db.close();
});

describe('CarbonLens Input Validation Edge Cases', () => {

  test('should reject negative quantities', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'transport',
        activityType: 'car_petrol',
        quantity: -15,
        notes: 'Negative value test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Quantity');
  });

  test('should reject zero quantity', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'transport',
        activityType: 'car_petrol',
        quantity: 0,
        notes: 'Zero quantity test'
      });

    expect(res.status).toBe(400);
  });

  test('should reject quantities exceeding 100,000', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'transport',
        activityType: 'car_petrol',
        quantity: 100001,
        notes: 'Excessive value test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Quantity');
  });

  test('should reject invalid/non-whitelisted categories', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'space_travel',
        activityType: 'rocket',
        quantity: 50,
        notes: 'Invalid category test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Category');
  });

  test('should reject non-whitelisted activity types in valid categories', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'transport',
        activityType: 'jetpack',
        quantity: 10,
        notes: 'Invalid type test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('activity type');
  });

  test('should reject invalid formatted dates', async () => {
    const res = await request(app)
      .post('/api/activities')
      .send({
        userId: validUser.id,
        category: 'food',
        activityType: 'beef',
        quantity: 1,
        loggedAt: '12-34-5678',
        notes: 'Malformed date test'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('loggedAt');
  });

});
