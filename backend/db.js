// ============================================================
//  server/db.js  –  MongoDB database setup & seeding
// ============================================================
const mongoose = require('mongoose');
const Order = require('./models/Order');
const Coupon = require('./models/Coupon');
const Setting = require('./models/Setting');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/freshfold';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    await seedIfEmpty();
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
}

// ---- SEED DATA (only if collections are empty) ----
async function seedIfEmpty() {
  const orderCount = await Order.countDocuments();
  const couponCount = await Coupon.countDocuments();
  const settingCount = await Setting.countDocuments();

  if (orderCount === 0) {
    const seedOrders = [
      { orderId:'FF-2025-001', customer:'Rahul Sharma', phone:'9876543210', service:'Ironing', serviceKey:'ironing', qty:5, unit:'items', timeline:'Same Day', timelineKey:'sameday', total:175, status:'In Progress', agent:'Vikram Singh', address:'Gomti Nagar, Lucknow', payment:'Cash on Delivery', createdAt: new Date('2025-01-15T10:00:00') },
      { orderId:'FF-2025-002', customer:'Priya Gupta', phone:'8765432109', service:'Dry Cleaning', serviceKey:'drycleaning', qty:3, unit:'items', timeline:'Express', timelineKey:'express', total:1047, status:'Out for Delivery', agent:'Ravi Patel', address:'Hazratganj, Lucknow', payment:'UPI / Online', createdAt: new Date('2025-01-15T08:00:00') },
      { orderId:'FF-2025-003', customer:'Amit Kumar', phone:'7654321098', service:'Laundry', serviceKey:'laundry', qty:4, unit:'kg', timeline:'Next Day', timelineKey:'nextday', total:316, status:'Delivered', agent:'Deepak Yadav', address:'Aliganj, Lucknow', payment:'Cash on Delivery', createdAt: new Date('2025-01-14T10:00:00') },
      { orderId:'FF-2025-004', customer:'Sneha Joshi', phone:'9988776655', service:'Ironing', serviceKey:'ironing', qty:5, unit:'items', timeline:'Express', timelineKey:'express', total:245, status:'Pending', agent:'Amit Kumar', address:'Indira Nagar, Lucknow', payment:'Cash on Delivery', createdAt: new Date('2025-01-15T14:00:00') },
      { orderId:'FF-2025-005', customer:'Vikram Singh', phone:'8877665544', service:'Laundry', serviceKey:'laundry', qty:6, unit:'kg', timeline:'Same Day', timelineKey:'sameday', total:594, status:'Picked Up', agent:'Amit Kumar', address:'Mahanagar, Lucknow', payment:'UPI / Online', createdAt: new Date('2025-01-15T09:30:00') },
      { orderId:'FF-2025-006', customer:'Nisha Patel', phone:'7766554433', service:'Dry Cleaning', serviceKey:'drycleaning', qty:3, unit:'items', timeline:'Next Day', timelineKey:'nextday', total:797, status:'Delivered', agent:'Ravi Patel', address:'Alambagh, Lucknow', payment:'Cash on Delivery', createdAt: new Date('2025-01-13T11:00:00') },
      { orderId:'FF-2025-007', customer:'Rohit Verma', phone:'6655443322', service:'Ironing', serviceKey:'ironing', qty:3, unit:'items', timeline:'Same Day', timelineKey:'sameday', total:105, status:'Pending', agent:'Amit Kumar', address:'Aminabad, Lucknow', payment:'Cash on Delivery', createdAt: new Date('2025-01-15T16:00:00') },
      { orderId:'FF-2025-008', customer:'Anjali Mishra', phone:'5544332211', service:'Laundry', serviceKey:'laundry', qty:3, unit:'kg', timeline:'Express', timelineKey:'express', total:387, status:'Delivered', agent:'Deepak Yadav', address:'Rajajipuram, Lucknow', payment:'UPI / Online', createdAt: new Date('2025-01-12T09:00:00') }
    ];
    await Order.insertMany(seedOrders);
    console.log('✅ Seeded 8 demo orders');
  }

  if (couponCount === 0) {
    const seedCoupons = [
      { code:'FRESH20', discount:20, minOrder:0, expiry:'2025-12-31', uses:47 },
      { code:'SAVE10', discount:10, minOrder:300, expiry:'2025-06-30', uses:23 },
      { code:'BULK15', discount:15, minOrder:500, expiry:'2025-09-30', uses:12 }
    ];
    await Coupon.insertMany(seedCoupons);
    console.log('✅ Seeded 3 demo coupons');
  }

  if (settingCount === 0) {
    const defaults = {
      businessName: 'FreshFold Laundry',
      phone: '+91 98765 43210',
      email: 'hello@freshfold.in',
      city: 'Lucknow',
      freeDeliveryAbove: '499',
      deliveryFee: '49'
    };
    const ops = Object.entries(defaults).map(([k, v]) => ({
      key: k, value: String(v)
    }));
    await Setting.insertMany(ops);
    console.log('✅ Seeded default settings');
  }
}

module.exports = connectDB;
