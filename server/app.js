import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import apiRouter from './routes/api.js';
import db from './db/database.js';
import { seed } from './db/seed.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();

// Set security headers using Helmet with CSP directives
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));

// Set up cookies
app.use(cookieParser('carbonlens-signed-cookie-secret-key-12345'));

const csrfProtection = csurf({ cookie: { signed: true } });

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return csrfProtection(req, res, (err) => {
    if (err) return next(err);
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    next();
  });
});

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Apply global rate limiting to all /api routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api', globalLimiter);

// Root health check endpoint for Render / deployments
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CarbonLens API Server is running' });
});

// Mount API routes
app.use('/api', apiRouter);

// Auto-seed if database is empty, but skip in test environment
try {
  if (process.env.NODE_ENV !== 'test') {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM activities').get();
    if (countRow && countRow.count === 0) {
      logger.log('No activities found in DB. Seeding initial 30 days of data for "demo"...');
      seed();
    }
  }
} catch (err) {
  logger.error('Auto-seeding check failed:', err.message);
}

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Error:', err.message);
  return res.status(err.status || 500).json({
    error: 'An internal server error occurred.'
  });
});

export default app;
