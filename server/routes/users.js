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
const { requireCustomerAuth, requireAuth } = require('../auth');

// ==============================
//  PUBLIC — Register Customer
// ==============================
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, referralCode } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, Phone, and Password are required' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ error: 'User with this phone number already exists' });
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
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: 'Invalid phone or password' });

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
//  PRIVATE — Get My Orders
// ==============================
router.get('/my-orders', requireCustomerAuth, async (req, res) => {
  try {
    // We link orders by phone number since orders don't currently have a userId reference
    const orders = await Order.find({ phone: req.user.phone }).sort({ createdAt: -1 }).lean();
    // For frontend compatibility
    const formattedOrders = orders.map(o => ({ ...o, id: o.orderId }));
    res.json(formattedOrders);
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
router.post('/photo', requireCustomerAuth, async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'Photo data required' });
    
    // Limit to ~2MB base64
    if (photo.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Photo too large. Max 2MB.' });
    }

    const user = await User.findById(req.user.id);
    user.profilePhoto = photo;
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

    res.json({
      monthlySpend,
      favoriteService,
      totalItems,
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
      moneySaved,
      loyaltyPoints: user.loyaltyPoints || 0,
      totalPointsEarned: orders.reduce((sum, o) => sum + (o.pointsEarned || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
