import db from '../db/database.js';

/**
 * Login or register a user by username.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export async function login(req, res, next) {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const cleanUsername = username.trim().replace(/<[^>]*>/g, '');
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
    if (!user) {
      const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(cleanUsername);
      user = { id: result.lastInsertRowid, username: cleanUsername, created_at: new Date() };
    }
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}
