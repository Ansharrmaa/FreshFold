const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, uppercase: true },
  discount:  { type: Number, required: true },
  minOrder:  { type: Number, default: 0 },
  expiry:    { type: String, required: true },
  uses:      { type: Number, default: 0 }
});

module.exports = mongoose.model('Coupon', couponSchema);
