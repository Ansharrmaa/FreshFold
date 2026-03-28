// ============================================================
//  server/routes/coupons.js  –  CRUD for coupons (Mongoose)
// ============================================================
const express      = require('express');
const router       = express.Router();
const Coupon       = require('../models/Coupon');
const { requireAuth } = require('../auth');

// ==============================
//  PUBLIC — Validate coupon code
// ==============================
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }
    res.json({
      code:     coupon.code,
      discount: coupon.discount,
      minOrder: coupon.minOrder,
      desc:     `${coupon.discount}% off${coupon.minOrder > 0 ? ` on orders above ₹${coupon.minOrder}` : ' your order'}`
    });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — List all coupons
// ==============================
router.get('/', requireAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ _id: -1 }).lean();
    res.json(coupons.map(c => ({ ...c, id: c._id })));
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Create coupon
// ==============================
router.post('/', requireAuth, async (req, res) => {
  try {
    const { code, discount, minOrder, expiry } = req.body;
    if (!code || !discount || !expiry) {
      return res.status(400).json({ error: 'Code, discount, and expiry are required' });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(409).json({ error: 'Coupon code already exists' });

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discount,
      minOrder: minOrder || 0,
      expiry,
      uses: 0
    });
    
    await newCoupon.save();
    res.status(201).json({ id: newCoupon._id, message: 'Coupon created' });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Delete coupon
// ==============================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await Coupon.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
