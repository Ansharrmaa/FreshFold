// ============================================================
//  server/routes/stats.js  –  Dashboard stats & customers (Mongoose)
// ============================================================
const express      = require('express');
const router       = express.Router();
const Order        = require('../models/Order');
const { requireAuth } = require('../auth');

// ==============================
//  ADMIN — Dashboard overview stats
// ==============================
router.get('/', requireAuth, async (req, res) => {
  try {
    const total = await Order.countDocuments();
    
    const revenueAgg = await Order.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const revenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
    
    const pending = await Order.countDocuments({ status: { $in: ['Pending', 'Picked Up', 'In Progress'] } });
    const delivered = await Order.countDocuments({ status: 'Delivered' });

    // Revenue per day of week (for chart)
    const weekRevenueAgg = await Order.aggregate([
      { 
        $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' },
          total: 1
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // MongoDB $dayOfWeek returns 1 for Sunday, 7 for Saturday
    const chartData = days.map((day, index) => {
      const match = weekRevenueAgg.find(r => r._id === index + 1);
      return { day, revenue: match ? match.revenue : 0 };
    });

    res.json({ total, revenue, pending, delivered, chartData });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==============================
//  ADMIN — Customer list (aggregated)
// ==============================
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const customers = await Order.aggregate([
      {
        $group: {
          _id: '$customer',
          phone: { $first: '$phone' },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          lastOrder: { $max: '$createdAt' }
        }
      },
      { $sort: { totalSpent: -1 } },
      {
        $project: {
          _id: 0,
          name: '$_id',
          phone: 1,
          totalOrders: 1,
          totalSpent: 1,
          lastOrder: 1
        }
      }
    ]);

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
