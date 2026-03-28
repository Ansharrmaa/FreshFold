// ============================================================
//  server/routes/invoices.js — PDF Invoice (with GST support)
// ============================================================
const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Subscription = require('../models/Subscription');
const User    = require('../models/User');

// Helper: draw a horizontal line
function hLine(doc, y, color = '#e5e7eb', width = 1) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(width).stroke();
}

router.get('/:orderId', async (req, res) => {
  try {
    // Lazy-require pdfkit so server starts even if not installed yet
    let PDFDocument;
    try { PDFDocument = require('pdfkit'); }
    catch(e) { return res.status(500).json({ error: 'pdfkit not installed. Run: npm install pdfkit' }); }

    const order = await Order.findOne({ orderId: req.params.orderId.toUpperCase() });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const isGST     = !!order.gstNumber;
    const gstRate   = 0.05; // 5% GST on laundry services
    const taxAmount = isGST ? Math.round(order.total * gstRate) : 0;
    const grandTotal= isGST ? order.total + taxAmount : order.total;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=FreshFold_Invoice_${order.orderId}.pdf`);
    doc.pipe(res);

    // ── HEADER BAR ──────────────────────────────────────────
    doc.rect(0, 0, 595, 110).fill('#1a6b4a');
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff').text('FreshFold', 50, 30);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.8)').text('Premium Laundry & Dry Cleaning', 50, 62);
    doc.text('hello@freshfold.in  |  +91 98765 43210  |  Lucknow, UP', 50, 77);

    // INVOICE label on right
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#f0a500').text('INVOICE', 400, 32, { align: 'right', width: 145 });
    doc.fontSize(11).font('Helvetica').fillColor('#ffffff').text(`#${order.orderId}`, 400, 60, { align: 'right', width: 145 });
    doc.fontSize(9).text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, 400, 78, { align: 'right', width: 145 });

    // ── BILL TO / ORDER DETAILS ──────────────────────────────
    doc.fillColor('#1a1a2e');
    let y = 130;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#6b7280').text('BILL TO', 50, y);
    doc.text('ORDER DETAILS', 320, y);
    y += 16;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text(order.customer, 50, y);
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`Phone: ${order.phone}`, 50, y + 16);
    if (order.email) doc.text(`Email: ${order.email}`, 50, y + 32);
    doc.text(order.address, 50, y + 48, { width: 230 });

    // Corporate fields
    if (isGST) {
      const cY = y + 80;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a6b4a').text(`Company: ${order.companyName}`, 50, cY);
      doc.font('Helvetica').fillColor('#374151').text(`GSTIN: ${order.gstNumber}`, 50, cY + 16);
    }

    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`Service:   ${order.service}`, 320, y);
    doc.text(`Timeline:  ${order.timeline}`, 320, y + 16);
    doc.text(`Status:    ${order.status}`, 320, y + 32);
    if (order.pickupDate) doc.text(`Pickup:    ${order.pickupDate} (${order.pickupSlot || ''})`, 320, y + 48);
    doc.text(`Payment:   ${order.payment}`, 320, y + 64);

    // ── ITEMS TABLE ──────────────────────────────────────────
    y = isGST ? 290 : 268;
    hLine(doc, y, '#1a6b4a', 2);
    y += 2;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a6b4a');
    doc.text('ITEM DESCRIPTION', 55, y + 8);
    doc.text('QTY',   280, y + 8);
    doc.text('RATE',  340, y + 8);
    doc.text('AMOUNT',460, y + 8);
    y += 26;
    hLine(doc, y, '#e5e7eb');
    y += 8;

    doc.fontSize(10).font('Helvetica').fillColor('#374151');

    if (order.items && order.items.length > 0) {
      order.items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
        doc.rect(50, y - 4, 495, 22).fill(bg).stroke('white');
        doc.fillColor('#374151');
        doc.text(item.name,                  55, y);
        doc.text(String(item.qty),           280, y);
        doc.text(`₹${item.price}`,           340, y);
        doc.text(`₹${item.qty * item.price}`,460, y);
        y += 22;
      });
    } else {
      doc.rect(50, y - 4, 495, 22).fill('#f9fafb').stroke('white');
      doc.fillColor('#374151');
      const desc = `${order.service} (${order.qty} ${order.unit})`;
      const unitPrice = order.qty > 0 ? Math.round((order.total + order.discount - order.delivery) / order.qty) : order.total;
      doc.text(desc,                            55, y);
      doc.text(String(order.qty),              280, y);
      doc.text(`₹${unitPrice}`,                340, y);
      doc.text(`₹${order.total + order.discount - order.delivery}`, 460, y);
      y += 22;
    }

    y += 10;
    hLine(doc, y, '#e5e7eb');
    y += 14;

    // ── TOTALS ───────────────────────────────────────────────
    const col1 = 360, col2 = 490;
    function totalRow(label, val, bold = false, color = '#374151') {
      doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
      doc.text(label, col1, y, { width: 100 });
      doc.text(val,   col2, y, { width: 60, align: 'right' });
      y += 20;
    }

    const subtotal = order.total + order.discount - order.delivery;
    totalRow('Subtotal:',         `₹${subtotal}`);
    if (order.discount > 0)
      totalRow(`Discount (${order.coupon || 'Promo'}):`, `-₹${order.discount}`, false, '#15803d');
    if (order.pointsRedeemed > 0)
      totalRow('Points Redeemed:',`-₹${Math.floor(order.pointsRedeemed / 10)}`, false, '#4338ca');
    totalRow('Delivery Charges:', order.delivery > 0 ? `₹${order.delivery}` : 'FREE');
    if (isGST) totalRow(`GST (${gstRate * 100}%):`, `₹${taxAmount}`, false, '#374151');

    hLine(doc, y, '#1a6b4a', 1.5);
    y += 8;
    totalRow('TOTAL PAYABLE:', `₹${grandTotal}`, true, '#1a6b4a');

    // ── LOYALTY NOTE ─────────────────────────────────────────
    if (order.pointsEarned > 0) {
      y += 8;
      doc.rect(50, y, 495, 30).fill('#ede9fe').stroke('white');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#5b21b6').text(
        `🎁  You earned ${order.pointsEarned} FreshFold loyalty points from this order!`,
        60, y + 9
      );
      y += 40;
    }

    // ── FOOTER ───────────────────────────────────────────────
    const footerY = 750;
    hLine(doc, footerY, '#e5e7eb');
    doc.fontSize(9).font('Helvetica').fillColor('#9ca3af');
    doc.text('Thank you for choosing FreshFold! This is a computer-generated invoice.', 50, footerY + 10, { align: 'center', width: 495 });
    if (isGST) {
      doc.text(`GSTIN: ${order.gstNumber}  |  HSN Code: 9601  |  SAC: 996211`, 50, footerY + 26, { align: 'center', width: 495 });
    }

    doc.end();
  } catch (err) {
    console.error('Invoice error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate invoice' });
  }
});


// ==============================
//  SUBSCRIPTION INVOICE
// ==============================
router.get('/subscription/:subId', async (req, res) => {
  try {
    let PDFDocument;
    try { PDFDocument = require('pdfkit'); }
    catch(e) { return res.status(500).json({ error: 'pdfkit not installed' }); }

    const subId = req.params.subId.toUpperCase();
    const sub = await Subscription.findOne({ subId });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const user = await User.findById(sub.user);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=FreshFold_Subscription_${subId}.pdf`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 595, 110).fill('#1a6b4a');
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff').text('FreshFold', 50, 30);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.8)').text('Premium Laundry & Dry Cleaning', 50, 62);
    doc.text('hello@freshfold.in  |  +91 98765 43210  |  Lucknow, UP', 50, 77);

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#f0a500').text('TAX INVOICE', 400, 32, { align: 'right', width: 145 });
    doc.fontSize(11).font('Helvetica').fillColor('#ffffff').text(`Receipt: #${sub.subId}`, 400, 60, { align: 'right', width: 145 });
    doc.fontSize(9).text(`Date: ${new Date(sub.createdAt).toLocaleDateString()}`, 400, 78, { align: 'right', width: 145 });

    // Bill To
    doc.fillColor('#1a1a2e');
    let y = 130;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#6b7280').text('BILL TO', 50, y);
    doc.text('SUBSCRIPTION DETAILS', 320, y);
    y += 16;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text(user.name, 50, y);
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`Phone: ${user.phone}`, 50, y + 16);
    if (user.email) doc.text(`Email: ${user.email}`, 50, y + 32);

    doc.text(`Plan Name: ${sub.plan.toUpperCase()}`, 320, y);
    doc.text(`Status:    ${sub.status}`, 320, y + 16);
    doc.text(`Payment:   Online (Cashfree)`, 320, y + 32);

    // Items Table
    y = 220;
    hLine(doc, y, '#1a6b4a', 2);
    y += 2;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a6b4a');
    doc.text('DESCRIPTION', 55, y + 8);
    doc.text('AMOUNT',460, y + 8);
    y += 26;
    hLine(doc, y, '#e5e7eb');
    y += 8;

    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.rect(50, y - 4, 495, 22).fill('#f9fafb').stroke('white');
    doc.fillColor('#374151');
    
    // Calculate basic GST math from total
    const totalAmount = sub.amount;
    const baseAmount = (totalAmount / 1.18).toFixed(2);
    const gstAmount = (totalAmount - baseAmount).toFixed(2);

    doc.text(`FreshFold ${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} Subscription Plan (30 Days)`, 55, y);
    doc.text(`₹${baseAmount}`, 460, y);
    y += 36;

    hLine(doc, y, '#e5e7eb');
    y += 14;

    doc.text('Subtotal:', 360, y, { width: 100 });
    doc.text(`₹${baseAmount}`, 490, y, { width: 60, align: 'right' });
    y += 20;

    doc.text('GST (18%):', 360, y, { width: 100 });
    doc.text(`₹${gstAmount}`, 490, y, { width: 60, align: 'right' });
    y += 20;

    hLine(doc, y, '#1a6b4a', 1.5);
    y += 8;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a6b4a');
    doc.text('TOTAL PAYABLE:', 360, y, { width: 100 });
    doc.text(`₹${totalAmount}`, 490, y, { width: 60, align: 'right' });

    doc.end();
  } catch (err) {
    console.error('Subscription Invoice Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
