// ============================================================
//  server/routes/users.js  –  Customer User Authentication
// ============================================================
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Order   = require('../models/Order');
const Subscription = require('../models/Subscription');
const { requireCustomerAuth, requireAuth, SECRET } = require('../auth');

// ==============================
//  PUBLIC — Register Customer
// ==============================
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, referralCode } = req.body;
    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: 'Name, Phone, Email, and Password are required' });
    }

    const existing = await User.findOne({ $or: [{ phone }, { email }] });
    if (existing) {
      return res.status(409).json({ error: 'User with this phone number or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate unique referral code for the new user
    const myReferralCode = 'FF' + phone.slice(-4) + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const newUser = new User({
      name,
      phone,
      email: email || '',
      password: hashedPassword,
      referralCode: myReferralCode,
      referredBy: referralCode || null,
      addresses: []
    });

    await newUser.save();

    // Process referral reward: ₹50 to both users
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode });
      if (referrer) {
        referrer.walletBalance = (referrer.walletBalance || 0) + 50;
        await referrer.save();
        newUser.walletBalance = (newUser.walletBalance || 0) + 50;
        await newUser.save();
      }
    }

    const token = jwt.sign({ role: 'customer', id: newUser._id, phone: newUser.phone }, SECRET, { expiresIn: '30d' });

    // Send Welcome SMS (non-blocking)
    const { sendWelcomeSMS } = require('../utils/sms');
    sendWelcomeSMS(phone, name).catch(console.error);

    res.status(201).json({ message: 'User created successfully', token });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ==============================
//  PUBLIC — Login Customer
// ==============================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Email/Phone and password required' });

    // Find by phone or email
    const user = await User.findOne({ $or: [{ phone: phone }, { email: phone }] });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid phone or password' });

    const token = jwt.sign({ role: 'customer', id: user._id, phone: user.phone }, SECRET, { expiresIn: '30d' });
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ==============================
//  PRIVATE — Get Profile (Me)
// ==============================
router.get('/me', requireCustomerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// ==============================
//  PRIVATE — Get My Orders (Paginated & Searchable)
// ==============================
router.get('/my-orders', requireCustomerAuth, async (req, res) => {
  try {
    const { page = 1, limit = 5, search = '' } = req.query;
    const skip = (page - 1) * Number(limit);

    let filter = { phone: req.user.phone };
    if (search) {
      filter.$or = [
        { orderId: new RegExp(search, 'i') },
        { service: new RegExp(search, 'i') }
      ];
    }

    const totalDocCount = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formattedOrders = orders.map(o => ({ ...o, id: o.orderId }));
    res.json({
      orders: formattedOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalDocCount / Number(limit)),
      totalOrders: totalDocCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching user orders' });
  }
});

// ==============================
//  PRIVATE — Get My Subscriptions
// ==============================
router.get('/my-subscriptions', requireCustomerAuth, async (req, res) => {
  try {
    const subs = await Subscription.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(subs.map(s => ({ ...s, id: s.subId })));
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching user subscriptions' });
  }
});

// ==============================
//  ADMIN — Get All Subscriptions
// ==============================
router.get('/admin/subscriptions', requireAuth, async (req, res) => {
  try {
    const subs = await Subscription.find().populate('user', 'name phone email').sort({ createdAt: -1 }).lean();
    res.json(subs.map(s => ({ 
      ...s, 
      id: s.subId,
      customerName: s.user ? s.user.name : 'Unknown',
      customerPhone: s.user ? s.user.phone : 'Unknown',
      customerEmail: s.user ? s.user.email : ''
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching all subscriptions' });
  }
});

// ==============================
//  PRIVATE — Add Address
// ==============================
router.post('/addresses', requireCustomerAuth, async (req, res) => {
  try {
    const { label, address, pincode } = req.body;
    if (!address) return res.status(400).json({ error: 'Address string is required' });

    const user = await User.findById(req.user.id);
    user.addresses.push({ label: label || 'Home', address, pincode: pincode || '' });
    await user.save();

    res.status(201).json({ message: 'Address added', addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ error: 'Server error adding address' });
  }
});

// ==============================
//  PRIVATE — Delete Address
// ==============================
router.delete('/addresses/:id', requireCustomerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.id);
    await user.save();
    res.json({ message: 'Address deleted', addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ error: 'Server error deleting address' });
  }
});

// ==============================
//  PRIVATE — Recharge Wallet
// ==============================
router.post('/wallet/recharge', requireCustomerAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const user = await User.findById(req.user.id);
    user.walletBalance = (user.walletBalance || 0) + Number(amount);
    await user.save();

    res.json({ message: 'Recharge successful', balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ error: 'Wallet recharge failed' });
  }
});

// ==============================
//  PRIVATE — Upload Profile Photo
// ==============================
const { upload } = require('../utils/cloudinary');
router.post('/photo', requireCustomerAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo file required' });

    const user = await User.findById(req.user.id);
    user.profilePhoto = req.file.path; // Cloudinary URL
    await user.save();

    res.json({ message: 'Photo updated', profilePhoto: user.profilePhoto });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ==============================
//  PRIVATE — User Spending Analytics
// ==============================
router.get('/stats', requireCustomerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const orders = await Order.find({ phone: user.phone }).sort({ createdAt: -1 });
    
    // Monthly spend (last 6 months)
    const monthlySpend = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      monthlySpend[key] = 0;
    }
    
    orders.forEach(o => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (monthlySpend[key] !== undefined) monthlySpend[key] += o.total;
    });

    // Favorite service
    const serviceCounts = {};
    orders.forEach(o => {
      serviceCounts[o.service] = (serviceCounts[o.service] || 0) + 1;
    });
    const favoriteService = Object.keys(serviceCounts).sort((a, b) => serviceCounts[b] - serviceCounts[a])[0] || 'None yet';

    // Total items
    const totalItems = orders.reduce((sum, o) => sum + (o.qty || 0), 0);
    
    // Money saved
    const moneySaved = orders.reduce((sum, o) => sum + (o.discount || 0), 0);
    
    // Active orders
    const activeOrders = orders.filter(o => ['Pending', 'In Progress', 'Out for Delivery'].includes(o.status)).length;

    res.json({
      monthlySpend,
      favoriteService,
      totalItems,
      totalOrders: orders.length,
      activeOrders,
      totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
      moneySaved,
      loyaltyPoints: user.loyaltyPoints || 0,
      totalPointsEarned: orders.reduce((sum, o) => sum + (o.pointsEarned || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ==============================
//  PUBLIC — Forgot Password
// ==============================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ $or: [{ email }, { phone: email }] });
    if (!user) {
      // Don't reveal whether the email exists
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    // Generate reset token (random hex)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Build reset URL
    const baseUrl = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${baseUrl}/reset-password.html?token=${resetToken}`;

    // Send email
    const { sendPasswordResetEmail } = require('../utils/email');
    await sendPasswordResetEmail(user.email, resetLink);

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// ==============================
//  PUBLIC — Reset Password
// ==============================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new reset link.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// ==============================
//  PUBLIC — Google OAuth
// ==============================
router.post('/google-auth', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential is required' });

    // Verify Google ID token
    const axios = require('axios');
    const googleResp = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = googleResp.data;

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const { email, name, sub: googleId, picture } = payload;

    // Check if user exists by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user (no password needed for Google users)
      const myReferralCode = 'FF' + Math.random().toString(36).substring(2, 10).toUpperCase();
      user = new User({
        name: name || 'Google User',
        phone: 'google_' + googleId, // placeholder phone
        email,
        password: await bcrypt.hash(googleId + Date.now(), 10), // random password
        googleId,
        profilePhoto: picture || '',
        referralCode: myReferralCode,
        addresses: []
      });
      await user.save();
    }

    const token = jwt.sign({ role: 'customer', id: user._id, phone: user.phone }, SECRET, { expiresIn: '30d' });
    res.json({ message: 'Google login successful', token });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

module.exports = router;
