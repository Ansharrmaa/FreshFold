const mongoose = require('mongoose');

const subSchema = new mongoose.Schema({
  subId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true }, // 'starter', 'pro', 'family'
  amount: { type: Number, required: true },
  status: { type: String, default: 'Pending' }, // 'Pending', 'Paid', 'Failed'
  cfOrderId: { type: String }, // Cashfree order ID
  cfSessionId: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', subSchema);
