// ============================================================
//  server/routes/slots.js  –  Slot Capacity Management
// ============================================================
const express = require('express');
const router  = express.Router();
const SlotCapacity = require('../models/SlotCapacity');
const { requireAuth } = require('../auth');

const SLOT_LABELS = [
  'Morning (7am – 11am)',
  'Afternoon (12pm – 4pm)',
  'Evening (5pm – 9pm)'
];
const DEFAULT_CAPACITY = 10;

// ==============================
//  PUBLIC — Get slot availability for a date
//  GET /api/slots?date=2026-03-26
// ==============================
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    // Upsert all 3 slots if they don't exist yet
    const slots = await Promise.all(SLOT_LABELS.map(async (slot) => {
      const doc = await SlotCapacity.findOneAndUpdate(
        { date, slot },
        { $setOnInsert: { date, slot, maxCapacity: DEFAULT_CAPACITY, bookedCount: 0 } },
        { upsert: true, new: true }
      );
      return {
        slot,
        maxCapacity: doc.maxCapacity,
        bookedCount: doc.bookedCount,
        available:   doc.maxCapacity - doc.bookedCount,
        full:        doc.bookedCount >= doc.maxCapacity
      };
    }));

    res.json(slots);
  } catch (err) {
    console.error('Slots GET error:', err);
    res.status(500).json({ error: 'Server error fetching slots' });
  }
});

// ==============================
//  INTERNAL — Increment booked count (called by orders.js on create)
//  POST /api/slots/book
// ==============================
router.post('/book', async (req, res) => {
  try {
    const { date, slot } = req.body;
    if (!date || !slot) return res.status(400).json({ error: 'date and slot required' });

    const doc = await SlotCapacity.findOneAndUpdate(
      { date, slot, bookedCount: { $lt: DEFAULT_CAPACITY } },
      { $inc: { bookedCount: 1 } },
      { new: true }
    );

    if (!doc) {
      return res.status(409).json({ error: 'Slot is fully booked. Please choose another slot.' });
    }

    res.json({ message: 'Slot booked', available: doc.maxCapacity - doc.bookedCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error booking slot' });
  }
});

// ==============================
//  ADMIN — Set max capacity for a slot
//  PATCH /api/slots/capacity
// ==============================
router.patch('/capacity', requireAuth, async (req, res) => {
  try {
    const { date, slot, maxCapacity } = req.body;
    if (!date || !slot || !maxCapacity) return res.status(400).json({ error: 'date, slot, maxCapacity required' });

    const doc = await SlotCapacity.findOneAndUpdate(
      { date, slot },
      { $set: { maxCapacity: Number(maxCapacity) } },
      { upsert: true, new: true }
    );
    res.json({ message: 'Capacity updated', doc });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating capacity' });
  }
});

// ==============================
//  ADMIN — Get all slots for a date range (for admin dashboard)
//  GET /api/slots/admin?from=2026-03-01&to=2026-03-31
// ==============================
router.get('/admin', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from && to) filter.date = { $gte: from, $lte: to };
    const slots = await SlotCapacity.find(filter).sort({ date: 1, slot: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
