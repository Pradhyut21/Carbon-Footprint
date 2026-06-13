import db from './database.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';

function getLocalDateString(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString().split('T')[0];
}

export function seed() {
  // 1. Create or get user 'demo'
  let user = db.prepare('SELECT id FROM users WHERE username = ?').get('demo');
  let userId;
  if (!user) {
    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run('demo');
    userId = result.lastInsertRowid;
  } else {
    userId = user.id;
  }

  // Clear existing activities and challenges for demo to make seed idempotent
  db.prepare('DELETE FROM activities WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM challenges WHERE user_id = ?').run(userId);

  // 2. Generate 30 days of realistic activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (user_id, category, activity_type, quantity, unit, co2_kg, logged_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 30; i >= 0; i--) {
    const dateStr = getLocalDateString(i);

    // Seed transport (most days)
    if (i % 7 !== 0) { // skip car some days
      const distance = Math.floor(Math.random() * 25) + 10; // 10-35 km
      const type = i % 3 === 0 ? 'car_petrol' : (i % 3 === 1 ? 'car_electric' : 'bus');
      const factor = EMISSION_FACTORS.transport[type].factor;
      const unit = EMISSION_FACTORS.transport[type].unit;
      const co2 = distance * factor;
      insertActivity.run(userId, 'transport', type, distance, unit, co2, dateStr, `Daily commute to work`);
    } else {
      // Train or walking
      const type = 'train';
      const distance = 40;
      const factor = EMISSION_FACTORS.transport[type].factor;
      const co2 = distance * factor;
      insertActivity.run(userId, 'transport', type, distance, 'km', co2, dateStr, `Weekend train trip`);
    }

    // Seed food (every day)
    const vegFactor = EMISSION_FACTORS.food.vegetables.factor;
    const vegQty = parseFloat((Math.random() * 1.5 + 0.5).toFixed(2)); // 0.5 - 2.0 kg
    insertActivity.run(userId, 'food', 'vegetables', vegQty, 'kg', vegQty * vegFactor, dateStr, null);

    const dairyFactor = EMISSION_FACTORS.food.dairy.factor;
    const dairyQty = parseFloat((Math.random() * 0.8 + 0.2).toFixed(2));
    insertActivity.run(userId, 'food', 'dairy', dairyQty, 'kg', dairyQty * dairyFactor, dateStr, null);

    // Meat/protein occasionally
    if (i % 3 === 0) {
      const beefFactor = EMISSION_FACTORS.food.beef.factor;
      const beefQty = 0.3; // 300g
      insertActivity.run(userId, 'food', 'beef', beefQty, 'kg', beefQty * beefFactor, dateStr, 'Steak dinner');
    } else if (i % 2 === 0) {
      const chickenFactor = EMISSION_FACTORS.food.chicken.factor;
      const chickenQty = 0.4;
      insertActivity.run(userId, 'food', 'chicken', chickenQty, 'kg', chickenQty * chickenFactor, dateStr, 'Chicken salad');
    }

    // Seed energy (every day)
    const elecFactor = EMISSION_FACTORS.energy.electricity.factor;
    const elecQty = parseFloat((Math.random() * 8 + 4).toFixed(2)); // 4 - 12 kWh
    insertActivity.run(userId, 'energy', 'electricity', elecQty, 'kWh', elecQty * elecFactor, dateStr, null);

    if (i % 2 === 0) {
      const gasFactor = EMISSION_FACTORS.energy.natural_gas.factor;
      const gasQty = parseFloat((Math.random() * 2 + 1).toFixed(2)); // 1-3 m3
      insertActivity.run(userId, 'energy', 'natural_gas', gasQty, 'cubic_meter', gasQty * gasFactor, dateStr, null);
    }

    // Seed waste (every 3 days)
    if (i % 3 === 0) {
      const lfFactor = EMISSION_FACTORS.waste.landfill.factor;
      const lfQty = parseFloat((Math.random() * 2 + 1).toFixed(2));
      insertActivity.run(userId, 'waste', 'landfill', lfQty, 'kg', lfQty * lfFactor, dateStr, 'Weekly trash');

      const rcFactor = EMISSION_FACTORS.waste.recycled.factor;
      const rcQty = parseFloat((Math.random() * 3 + 1).toFixed(2));
      insertActivity.run(userId, 'waste', 'recycled', rcQty, 'kg', rcQty * rcFactor, dateStr, 'Recyclables');
    }

    // Seed shopping occasionally (e.g. clothing once a week)
    if (i % 10 === 0) {
      const shopFactor = EMISSION_FACTORS.shopping.clothing.factor;
      insertActivity.run(userId, 'shopping', 'clothing', 1, 'item', shopFactor, dateStr, 'Bought a jacket');
    }
  }

  // 3. Seed some challenges
  const insertChallenge = db.prepare(`
    INSERT INTO challenges (user_id, title, description, target_reduction_kg, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Active challenge
  insertChallenge.run(
    userId,
    'Plant-Based Week',
    'Go plant-based for a week! No beef or lamb for 7 days.',
    30.0,
    getLocalDateString(5), // started 5 days ago
    getLocalDateString(-2), // ends in 2 days
    'active'
  );

  // Another active challenge
  insertChallenge.run(
    userId,
    'Energy Saver',
    'Reduce electricity logs by 20% compared to your weekly average.',
    15.0,
    getLocalDateString(1), // started yesterday
    getLocalDateString(-6), // ends in 6 days
    'active'
  );

  // Completed challenge
  insertChallenge.run(
    userId,
    'Zero Waste Day',
    'Log only composted or recycled waste (no landfill waste) for one day.',
    5.0,
    getLocalDateString(15),
    getLocalDateString(14),
    'completed'
  );

  console.log(`Database seeded successfully for user "demo"!`);
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
}
