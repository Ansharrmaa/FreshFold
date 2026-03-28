const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  tag: { type: String, default: 'Home' }, // Home, Work, Other
  address: { type: String, required: true },
  pincode: { type: String, required: true }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
  walletBalance: { type: Number, default: 0 },
  loyaltyPoints: { type: Number, default: 0 },
  profilePhoto: { type: String, default: '' },
  language: { type: String, default: 'en' },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String, default: null },
  addresses: [{
    label:   { type: String },    // e.g., 'Home', 'Office'
    address: { type: String },
    pincode: { type: String }
  }],
  activePlan: { type: String, default: 'none' }, // 'none', 'starter', 'pro', 'family'
  planExpiry: { type: Date, default: null },
  lastSubscriptionTxn: { type: String, default: null },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  googleId: { type: String, default: null, sparse: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
