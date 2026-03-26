// ============================================================
//  server/auth.js  –  JWT authentication middleware + login
// ============================================================
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'freshfold_secret_key_2025_change_in_production';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const adminHash = bcrypt.hashSync(ADMIN_PASS, 8);

// login handler for ADMIN
function loginHandler(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  if (username === ADMIN_USER && bcrypt.compareSync(password, adminHash)) {
    const token = jwt.sign({ role: 'admin', user: ADMIN_USER }, SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'admin' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

// verify ADMIN jwt
function requireAuth(req, res, next) {
  const code = req.headers.authorization;
  if (!code) return res.status(401).json({ error: 'Unauthorized' });
  const token = code.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch(err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// verify CUSTOMER jwt
function requireCustomerAuth(req, res, next) {
  const code = req.headers.authorization;
  if (!code) return res.status(401).json({ error: 'Unauthorized' });
  const token = code.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'customer') throw new Error('Not customer');
    req.user = decoded;
    next();
  } catch(err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  loginHandler,
  requireAuth,
  requireCustomerAuth,
  SECRET
};
