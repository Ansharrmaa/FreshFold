const mongoose = require('mongoose');

const slotCapacitySchema = new mongoose.Schema({
  date: { type: String, required: true },     // e.g. '2026-03-26'
  slot: { type: String, required: true },      // e.g. 'Morning (7-11am)'
  maxCapacity: { type: Number, default: 10 },
  bookedCount: { type: Number, default: 0 }
});

// Compound unique: one entry per date-slot combo
slotCapacitySchema.index({ date: 1, slot: 1 }, { unique: true });

module.exports = mongoose.model('SlotCapacity', slotCapacitySchema);
