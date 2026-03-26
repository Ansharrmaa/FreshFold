const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId:      { type: String, required: true, unique: true },
  customer:     { type: String, required: true },
  phone:        { type: String, required: true },
  email:        { type: String, default: '' },
  address:      { type: String, required: true },
  pincode:      { type: String, default: '' },
  service:      { type: String, required: true },
  serviceKey:   { type: String, required: true },
  qty:          { type: Number, required: true, default: 1 },
  unit:         { type: String, required: true, default: 'items' },
  timeline:     { type: String, required: true },
  timelineKey:  { type: String, required: true },
  pickupDate:   { type: String },
  pickupSlot:   { type: String },
  notes:        { type: String, default: '' },
  coupon:       { type: String, default: null },
  discount:     { type: Number, default: 0 },
  delivery:     { type: Number, default: 0 },
  total:        { type: Number, required: true },
  payment:      { type: String, default: 'Cash on Delivery' },
  paymentStatus:{ type: String, default: 'Pending' },
  cfOrderId:    { type: String },
  status:       { type: String, default: 'Pending' },
  agent:        { type: String, default: 'FreshFold Team' },
  rating:       { type: Number, min: 1, max: 5, default: null },
  review:       { type: String, default: '' },

  // Delivery agent details
  deliveryAgent: {
    name:  { type: String, default: '' },
    phone: { type: String, default: '' }
  },

  // Live agent location for map tracking
  agentLat: { type: Number, default: null },
  agentLng: { type: Number, default: null },

  // Garment-by-garment itemization
  items: [{
    name:  { type: String },
    qty:   { type: Number },
    price: { type: Number }
  }],

  // Before & After photos (base64 strings, max 3 each)
  beforePhotos: { type: [String], default: [] },
  afterPhotos:  { type: [String], default: [] },

  // Loyalty points
  pointsEarned:   { type: Number, default: 0 },
  pointsRedeemed: { type: Number, default: 0 },

  // Recurring orders
  isRecurring:        { type: Boolean, default: false },
  recurringFrequency: { type: String, default: '' }, // weekly, biweekly, monthly
  recurringDay:       { type: String, default: '' }, // Monday, Tuesday, etc.

  // Corporate / GST billing
  gstNumber:   { type: String, default: '' },
  companyName: { type: String, default: '' }

}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
