// ============================================================
//  server/utils/whatsapp.js  –  WhatsApp Notifications via Twilio
//  Requires: TWILIO_SID, TWILIO_AUTH, TWILIO_WHATSAPP_FROM in .env
//  From number format:  whatsapp:+14155238886  (Twilio sandbox)
// ============================================================
const https = require('https');
const querystring = require('querystring');

const SID  = process.env.TWILIO_SID;
const AUTH = process.env.TWILIO_AUTH;
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

/**
 * Send a WhatsApp message via Twilio REST API (no SDK dependency).
 * @param {string} toPhone  - customer phone, digits only e.g. "9876543210"
 * @param {string} message  - message body text
 */
async function sendWhatsApp(toPhone, message) {
  // Normalize to E.164 Indian number
  const digits = toPhone.replace(/\D/g, '');
  const e164 = digits.startsWith('91') ? '+' + digits : '+91' + digits;
  const to   = 'whatsapp:' + e164;

  if (!SID || !AUTH) {
    console.log(`[WhatsApp-Simulated] → ${to}: ${message}`);
    return true;
  }

  const body = querystring.stringify({ From: FROM, To: to, Body: message });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${SID}/Messages.json`,
      method: 'POST',
      auth: `${SID}:${AUTH}`,
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[WhatsApp] Sent to ${e164}`);
          resolve(true);
        } else {
          console.error(`[WhatsApp] Error ${res.statusCode}: ${data}`);
          resolve(false);
        }
      });
    });
    req.on('error', (e) => { console.error('[WhatsApp] Request error:', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

// Status-specific message templates
function buildStatusMessage(order, status) {
  const name = order.customer.split(' ')[0];
  const id   = order.orderId;

  const templates = {
    'Pending': `Hi ${name}! 🧺 Your FreshFold order *${id}* has been confirmed.\nService: ${order.service}\nPickup: ${order.pickupDate} (${order.pickupSlot})\nTotal: ₹${order.total}\n\nTrack your order: https://freshfold.in/track.html?id=${id}`,

    'Picked Up': `Hi ${name}! 🚗 Your clothes have been *picked up* for order *${id}*.\nOur team is heading to the facility now.\n\nTrack: https://freshfold.in/track.html?id=${id}`,

    'In Progress': `Hi ${name}! ✨ Great news — your clothes are being cleaned right now for order *${id}*.\nWe'll notify you when they're ready for delivery.\n\nTrack: https://freshfold.in/track.html?id=${id}`,

    'Out for Delivery': `Hi ${name}! 📦 Your order *${id}* is *out for delivery*!\nExpect your fresh clothes within the hour.\n\nAgent: ${order.agent || 'FreshFold Team'}\nTrack: https://freshfold.in/track.html?id=${id}`,

    'Delivered': `Hi ${name}! 🏠 Your order *${id}* has been *delivered*. Enjoy your fresh clothes!\n\nPlease rate your experience: https://freshfold.in/track.html?id=${id}\n\nThank you for choosing FreshFold! 💚`,

    'Cancelled': `Hi ${name}, your order *${id}* has been cancelled. If you have any questions, please contact us at +91 98765 43210.\n\nFreshFold Team`
  };

  return templates[status] || `Hi ${name}, your order *${id}* status has been updated to *${status}*.\n\nTrack: https://freshfold.in/track.html?id=${id}`;
}

/**
 * Notify customer of order status change
 */
async function notifyOrderStatus(order, status) {
  if (!order.phone) return;
  const message = buildStatusMessage(order, status);
  return sendWhatsApp(order.phone, message).catch(console.error);
}

/**
 * Send order confirmation on booking
 */
async function notifyOrderPlaced(order) {
  return notifyOrderStatus(order, 'Pending');
}

module.exports = { sendWhatsApp, notifyOrderStatus, notifyOrderPlaced };
