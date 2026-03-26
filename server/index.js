// ============================================================
//  server/index.js  –  Express application entry point
// ============================================================
require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const { loginHandler } = require('./auth');
const ordersRouter   = require('./routes/orders');
const couponsRouter  = require('./routes/coupons');
const statsRouter    = require('./routes/stats');
const settingsRouter = require('./routes/settings');
const paymentsRouter = require('./routes/payments');
const usersRouter    = require('./routes/users');
const invoicesRouter = require('./routes/invoices');
const slotsRouter    = require('./routes/slots');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- global middlewares ----
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' })); // increased for base64 photos
app.use(express.static(path.join(__dirname, '../public')));

// ---- rate limiters ----
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again after an hour.' }
});

const connectDB = require('./db');

// ---- API Routes ----
app.post('/api/auth/login', authLimiter, loginHandler);
app.use('/api/orders',   apiLimiter, ordersRouter);
app.use('/api/coupons',  apiLimiter, couponsRouter);
app.use('/api/stats',    apiLimiter, statsRouter);
app.use('/api/settings', apiLimiter, settingsRouter);
app.use('/api/payments', apiLimiter, paymentsRouter);
app.use('/api/users',    apiLimiter, usersRouter);
app.use('/api/invoices', apiLimiter, invoicesRouter);
app.use('/api/slots',    apiLimiter, slotsRouter);

// ---- Fallback: serve index.html for unknown routes ----
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    next();
  }
});

// ---- Start ----
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🧺 FreshFold server running at http://localhost:${PORT}\n`);
    console.log(`   Features active:`);
    console.log(`   ✅ Slot Capacity Management  → /api/slots`);
    console.log(`   ✅ WhatsApp Notifications    → utils/whatsapp.js`);
    console.log(`   ✅ Before/After Photos       → /api/orders/:id/photos`);
    console.log(`   ✅ PDF Invoices              → /api/invoices/:orderId`);
    console.log(`   ✅ Loyalty Points            → auto on order create`);
    console.log(`   ✅ Agent Live Location       → /api/orders/:id/status\n`);
  });
});
