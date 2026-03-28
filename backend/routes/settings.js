// ============================================================
//  server/routes/settings.js  –  Business settings (Mongoose)
// ============================================================
const express      = require('express');
const router       = express.Router();
const Setting      = require('../models/Setting');
const { requireAuth } = require('../auth');

// ==============================
//  ADMIN — Get all settings
// ==============================
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await Setting.find().lean();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Update settings
// ==============================
router.put('/', requireAuth, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    if (entries.length === 0) return res.status(400).json({ error: 'No settings provided' });

    const bulkOps = entries.map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { value: String(value) },
        upsert: true
      }
    }));

    await Setting.bulkWrite(bulkOps);

    res.json({ message: 'Settings saved', count: entries.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
