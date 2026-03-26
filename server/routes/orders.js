// ============================================================
//  server/routes/orders.js  –  CRUD for orders (Mongoose)
// ============================================================
const express      = require('express');
const router       = express.Router();
const Order        = require('../models/Order');
const SlotCapacity = require('../models/SlotCapacity');
const { requireAuth, SECRET } = require('../auth');
const jwt          = require('jsonwebtoken');
const User         = require('../models/User');
const { sendOrderReceipt }  = require('../utils/email');
const { notifyOrderStatus, notifyOrderPlaced } = require('../utils/whatsapp');

// ---- helpers ----
async function generateOrderId() {
  const lastOrder = await Order.findOne().sort({ createdAt: -1 });
  if (!lastOrder || !lastOrder.orderId) return 'FF-2025-001';
  const parts = lastOrder.orderId.split('-');
  if (parts.length < 3) return 'FF-2025-001';
  const num = parseInt(parts[2], 10) + 1;
  return 'FF-2025-' + String(num).padStart(3, '0');
}

function buildTrackingSteps(status) {
  const all    = ['Pending', 'Picked Up', 'In Progress', 'Out for Delivery', 'Delivered'];
  const idx    = all.indexOf(status);
  const icons  = ['📋', '🚗', '✨', '📦', '🏠'];
  const labels = ['Order Placed', 'Picked Up', 'In Progress', 'Out for Delivery', 'Delivered'];
  return labels.map((label, i) => ({
    label,
    icon:   icons[i],
    time:   i <= idx ? 'Done' : 'Pending',
    done:   i <= idx,
    active: i === idx
  }));
}

function getDeliveryLabel(order) {
  const m = { express: '~2 hours from pickup', sameday: 'Same day delivery', nextday: 'Next day delivery' };
  return m[order.timelineKey] || 'Next day delivery';
}

// ==============================
//  PUBLIC — Create order
// ==============================
router.post('/', async (req, res) => {
  try {
    const b = req.body;

    if (!b.customer || !b.phone || !b.address || !b.service || !b.total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ---- Slot capacity check ----
    if (b.pickupDate && b.pickupSlot) {
      const slotDoc = await SlotCapacity.findOne({ date: b.pickupDate, slot: b.pickupSlot });
      if (slotDoc && slotDoc.bookedCount >= slotDoc.maxCapacity) {
        return res.status(409).json({ error: 'This pickup slot is fully booked. Please choose another slot or date.' });
      }
    }

    const newOrderId = await generateOrderId();

    // ---- Calculate loyalty points (1 point per ₹10 spent) ----
    const pointsEarned = Math.floor((b.total || 0) / 10);

    const order = new Order({
      orderId:     newOrderId,
      customer:    b.customer,
      phone:       b.phone,
      email:       b.email       || '',
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
      payment:     b.payment     || 'Cash on Delivery',
      status:      'Pending',
      agent:       'FreshFold Team',
      pointsEarned,
      // Garment itemization
      items:       b.items       || [],
      // GST / Corporate
      gstNumber:   b.gstNumber   || '',
      companyName: b.companyName || '',
      // Recurring
      isRecurring:         b.isRecurring || false,
      recurringFrequency:  b.recurringFrequency || '',
      recurringDay:        b.recurringDay || ''
    });

    // ---- Wallet payment ----
    if (b.payment === 'Wallet') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Auth required for Wallet payment' });
      const userId = jwt.verify(token, SECRET).id;
      const user   = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if ((user.walletBalance || 0) < b.total) {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }
      user.walletBalance -= b.total;
      await user.save();
      order.paymentStatus = 'Paid';
    }

    // ---- Loyalty points redemption ----
    if (b.pointsRedeemed && b.pointsRedeemed > 0) {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const userId = jwt.verify(token, SECRET).id;
          const user   = await User.findById(userId);
          if (user && user.loyaltyPoints >= b.pointsRedeemed) {
            user.loyaltyPoints -= b.pointsRedeemed;
            await user.save();
            order.pointsRedeemed = b.pointsRedeemed;
          }
        } catch(e) {}
      }
    }

    await order.save();

    // ---- Award loyalty points to user (by phone) ----
    if (pointsEarned > 0) {
      User.findOneAndUpdate(
        { phone: b.phone },
        { $inc: { loyaltyPoints: pointsEarned } }
      ).catch(console.error);
    }

    // ---- Increment slot count ----
    if (b.pickupDate && b.pickupSlot) {
      SlotCapacity.findOneAndUpdate(
        { date: b.pickupDate, slot: b.pickupSlot },
        { $inc: { bookedCount: 1 } },
        { upsert: true }
      ).catch(console.error);
    }

    // ---- Async notifications (non-blocking) ----
    sendOrderReceipt(order).catch(console.error);
    notifyOrderPlaced(order).catch(console.error);

    res.status(201).json({
      id:           order.orderId,
      pointsEarned,
      message:      'Order created successfully'
    });
  } catch (err) {
    console.error('Order Create Error:', err);
    res.status(500).json({ error: 'Server error creating order' });
  }
});

// ==============================
//  PUBLIC — Get single order (tracking)
// ==============================
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id.toUpperCase() }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.id = order.orderId;
    const statusKey = order.status.toLowerCase().replace(/ /g, '-');
    const agentInitialsMap = {
      'Vikram Singh': 'VS', 'Ravi Patel': 'RP', 'Deepak Yadav': 'DY', 'Amit Kumar': 'AK'
    };

    res.json({
      ...order,
      statusKey,
      agentInitials: agentInitialsMap[order.agent] || (order.agent || 'FF').split(' ').map(n => n[0]).join(''),
      steps:    buildTrackingSteps(order.status),
      delivery: getDeliveryLabel(order)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — List all orders
// ==============================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search, status } = req.query;
    let filter = {};
    if (search) {
      filter.$or = [
        { orderId:  new RegExp(search, 'i') },
        { customer: new RegExp(search, 'i') },
        { phone:    new RegExp(search, 'i') }
      ];
    }
    if (status) filter.status = status;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    res.json(orders.map(o => ({ ...o, id: o.orderId })));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Update order status + agent location
// ==============================
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, deliveryAgent, agentLat, agentLng } = req.body;
    const valid = ['Pending', 'Picked Up', 'In Progress', 'Out for Delivery', 'Delivered', 'Cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status value' });

    const updateFields = { status };
    if (deliveryAgent?.name) {
      updateFields.deliveryAgent = deliveryAgent;
      updateFields.agent = deliveryAgent.name;
    }
    // Update live location if provided
    if (agentLat !== undefined) updateFields.agentLat = Number(agentLat);
    if (agentLng !== undefined) updateFields.agentLng = Number(agentLng);

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.id },
      { $set: updateFields },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Send WhatsApp notification (non-blocking)
    notifyOrderStatus(order, status).catch(console.error);

    res.json({ message: 'Status updated', id: order.orderId, status: order.status });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Upload before/after photos
// ==============================
router.patch('/:id/photos', requireAuth, async (req, res) => {
  try {
    const { beforePhotos, afterPhotos } = req.body;
    const update = {};
    if (beforePhotos) update.beforePhotos = beforePhotos; // array of base64 strings
    if (afterPhotos)  update.afterPhotos  = afterPhotos;

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.id },
      { $set: update },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Photos updated', orderId: order.orderId });
  } catch (err) {
    res.status(500).json({ error: 'Server error uploading photos' });
  }
});

// ==============================
//  PUBLIC — Rate an Order
// ==============================
router.patch('/:id/rate', async (req, res) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const order = await Order.findOneAndUpdate(
      { orderId: req.params.id, status: 'Delivered' },
      { rating: Number(rating), review: review || '' },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found or not yet delivered' });
    res.json({ message: 'Rating submitted!', orderId: order.orderId, rating: order.rating });
  } catch (err) {
    res.status(500).json({ error: 'Server error submitting rating' });
  }
});

module.exports = router;
