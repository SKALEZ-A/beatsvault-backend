// backend/src/index.js
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const beatsRouter = require('./routes/beats');
const ordersRouter = require('./routes/orders');
const paystackRouter = require('./routes/paystack');
const downloadRouter = require('./routes/download');
const adminRouter = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ── Body parsing ──────────────────────────────────────────
// NOTE: Paystack webhooks need raw body — must come BEFORE express.json()
app.use('/api/webhooks/paystack', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────
app.use('/api/beats', beatsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', paystackRouter);
app.use('/api/download', downloadRouter);
app.use('/api/admin', adminRouter);

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ BeatVault backend running on http://localhost:${PORT}`);
});
