import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import db from './db/database.js';
import { seed } from './db/seed.js';

dotenv.config();

const app = express();

const originList = process.env.NODE_ENV === 'production' 
  ? [] 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || originList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Mount API routes
app.use('/api', apiRouter);

// Auto-seed if database is empty, but skip in test environment
try {
  if (process.env.NODE_ENV !== 'test') {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM activities').get();
    if (countRow && countRow.count === 0) {
      console.log('No activities found in DB. Seeding initial 30 days of data for "demo"...');
      seed();
    }
  }
} catch (err) {
  console.error('Auto-seeding check failed:', err.message);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  return res.status(err.status || 500).json({
    error: 'An internal server error occurred.'
  });
});

export default app;
