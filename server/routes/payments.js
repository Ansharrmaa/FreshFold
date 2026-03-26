// ============================================================
//  server/routes/payments.js  –  Cashfree Payments Integration
// ============================================================
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const Order   = require('../models/Order');
const User    = require('../models/User');
const Subscription = require('../models/Subscription');
const { sendOrderReceipt } = require('../utils/email');
const { requireCustomerAuth } = require('../auth');

const CF_APP_ID = process.env.CASHFREE_APP_ID;
const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
const CF_ENV    = process.env.CASHFREE_ENV || 'SANDBOX';
const CF_URL    = CF_ENV === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

const headers = {
  'x-client-id': CF_APP_ID,
  'x-client-secret': CF_SECRET,
  'x-api-version': '2023-08-01',
  'Content-Type': 'application/json'
};

// ---- helpers ----
async function generateOrderId() {
  const lastOrder = await Order.findOne().sort({ orderId: -1 });
  if (!lastOrder || !lastOrder.orderId) return 'FF-2025-001';
  const parts = lastOrder.orderId.split('-');
  if (parts.length < 3) return 'FF-2025-001';
  const num = parseInt(parts[2], 10) + 1;
  return 'FF-2025-' + String(num).padStart(3, '0');
}

// ==============================
//  PUBLIC — Create Payment Session (Cashfree)
// ==============================
router.post('/create-order', async (req, res) => {
  try {
    const b = req.body;
    
    if (!b.customer || !b.phone || !b.address || !b.service || !b.total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newOrderId = await generateOrderId();

    // 1. Create the Order in MongoDB initially as Pending Payment
    const order = new Order({
      orderId:     newOrderId,
      customer:    b.customer,
      phone:       b.phone,
      email:       b.email       || 'customer@freshfold.in', // Cashfree requires email
      address:     b.address,
      pincode:     b.pincode     || '',
      service:     b.service,
      serviceKey:  b.serviceKey  || 'ironing',
      qty:         b.qty         || 1,
      unit:        b.unit        || 'items',
      timeline:    b.timeline,
      timelineKey: b.timelineKey || 'sameday',
      pickupDate:  b.pickupDate  || '',
      pickupSlot:  b.pickupSlot  || '',
      notes:       b.notes       || '',
      coupon:      b.coupon      || null,
      discount:    b.discount    || 0,
      delivery:    b.delivery    || 0,
      total:       b.total,
      payment:     'UPI / Online',
      paymentStatus: 'Pending',
      status:      'Pending',
      agent:       'Amit Kumar'
    });

    // 2. Ask Cashfree to generate a payment session
    const cfPayload = {
      order_id: newOrderId,
      order_amount: b.total,
      order_currency: 'INR',
      customer_details: {
        customer_id: order.phone,
        customer_phone: order.phone,
        customer_name: order.customer,
        customer_email: order.email || 'customer@freshfold.in'
      },
      order_meta: {
        return_url: `http://localhost:3000/booking.html?cf_order_id={order_id}`
      }
    };

    const resp = await axios.post(`${CF_URL}/orders`, cfPayload, { headers });
    
    // Save to DB
    order.cfOrderId = resp.data.cf_order_id;
    await order.save();
    
    // Return session to frontend so they can open Drop-in Checkout
    res.json({
      payment_session_id: resp.data.payment_session_id,
      order_id: newOrderId,
      cf_order_id: resp.data.cf_order_id
    });

  } catch (err) {
    console.error('Cashfree Create Order Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Server error creating payment session' });
  }
});

// ==============================
//  PUBLIC — Verify Payment
// ==============================
router.post('/verify', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    // Find the order in our DB
    const order = await Order.findOne({ orderId: order_id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Call Cashfree API to check real status securely server-side
    const resp = await axios.get(`${CF_URL}/orders/${order_id}`, { headers });
    
    if (resp.data.order_status === 'PAID') {
      order.paymentStatus = 'Paid';
      order.status = 'Pending'; // Confirmed to go to laundry handlers
      await order.save();
      
      // Send receipt to customer
      sendOrderReceipt(order).catch(console.error);
      
      return res.json({ success: true, order_id: order.orderId, status: 'Paid' });
    } else {
      order.paymentStatus = 'Failed';
      await order.save();
      return res.json({ success: false, order_id: order.orderId, status: resp.data.order_status });
    }

  } catch (err) {
    console.error('Cashfree Verify Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Server error verifying payment' });
  }
});

// ==============================
//  PRIVATE — Create Subscription Session (Cashfree)
// ==============================
router.post('/subscribe', requireCustomerAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['starter', 'pro', 'family'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planPrices = { starter: 499, pro: 999, family: 1499 };
    const amount = planPrices[plan];

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate SUB ID
    const lastSub = await Subscription.findOne().sort({ createdAt: -1 });
    let subNum = 1;
    if (lastSub && lastSub.subId && lastSub.subId.startsWith('SUB-2025-')) {
      subNum = parseInt(lastSub.subId.split('-')[2], 10) + 1;
    }
    const newSubId = 'SUB-2025-' + String(subNum).padStart(3, '0');

    // 1. Create Subscription in DB
    const sub = new Subscription({
      subId: newSubId,
      user: user._id,
      plan,
      amount,
      status: 'Pending'
    });

    // 2. CF Payload
    const cfPayload = {
      order_id: newSubId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: user.phone,
        customer_phone: user.phone,
        customer_name: user.name,
        customer_email: user.email || 'customer@freshfold.in'
      },
      order_meta: {
        return_url: `http://localhost:3000/profile.html?cf_sub_id={order_id}`
      }
    };

    const resp = await axios.post(`${CF_URL}/orders`, cfPayload, { headers });
    
    sub.cfOrderId = resp.data.cf_order_id;
    sub.cfSessionId = resp.data.payment_session_id;
    await sub.save();
    
    res.json({
      payment_session_id: resp.data.payment_session_id,
      order_id: newSubId,
      cf_order_id: resp.data.cf_order_id
    });

  } catch (err) {
    console.error('Subscription Create Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Server error creating subscription session' });
  }
});

// ==============================
//  PRIVATE — Verify Subscription Payment
// ==============================
router.post('/verify-subscription', requireCustomerAuth, async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    const sub = await Subscription.findOne({ subId: order_id });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    // Call Cashfree API to check real status securely server-side
    const resp = await axios.get(`${CF_URL}/orders/${order_id}`, { headers });
    
    if (resp.data.order_status === 'PAID') {
      sub.status = 'Paid';
      await sub.save();
      
      // Update User Plan
      const user = await User.findById(sub.user);
      if (user) {
        user.activePlan = sub.plan;
        // Expiry in 30 days
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        user.planExpiry = expiry;
        user.lastSubscriptionTxn = sub.subId;
        await user.save();
      }
      
      return res.json({ success: true, sub_id: sub.subId, status: 'Paid', plan: sub.plan });
    } else if (resp.data.order_status === 'ACTIVE') {
      // Sometimes Cashfree Sandbox resolves drop-in while payment is still processing in background
      return res.json({ success: false, sub_id: sub.subId, status: 'Processing Delay - Please refresh shortly' });
    } else {
      sub.status = 'Failed';
      await sub.save();
      return res.json({ success: false, sub_id: sub.subId, status: resp.data.order_status });
    }

  } catch (err) {
    console.error('Subscription Verify Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Server error verifying subscription' });
  }
});

module.exports = router;
