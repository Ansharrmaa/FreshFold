// ============================================================
//  server/utils/email.js  –  Automated HTML Email Receipts
// ============================================================
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail', // Standard configuration for Gmail
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

async function sendOrderReceipt(order) {
  if (!order.email) {
    console.log(`[Email] No email provided for order ${order.orderId}, skipping receipt.`);
    return;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1a6b4a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FreshFold Laundry</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="margin-top: 0; color: #1a1a2e;">Your Order is Confirmed! 🎉</h2>
        <p>Hi ${order.customer},</p>
        <p>Thank you for choosing FreshFold! We have successfully received your booking. Here are your order details:</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 5px 0;"><strong>Service:</strong> ${order.service}</p>
          <p style="margin: 5px 0;"><strong>Quantity:</strong> ${order.qty} ${order.unit}</p>
          <p style="margin: 5px 0;"><strong>Timeline:</strong> ${order.timeline}</p>
          ${order.pickupDate ? `<p style="margin: 5px 0;"><strong>Pickup:</strong> ${order.pickupDate} (${order.pickupSlot})</p>` : ''}
          <p style="margin: 5px 0;"><strong>Payment Status:</strong> ${order.paymentStatus} (${order.payment})</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
          <h3 style="margin: 5px 0; color: #1a6b4a;">Total: ₹${order.total}</h3>
        </div>

        <p>Our delivery agent will be in touch shortly for pickup.</p>
        <p style="margin-bottom: 0;">Warm regards,</p>
        <p style="margin-top: 5px; font-weight: bold;">The FreshFold Team</p>
      </div>
      <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        FreshFold Laundry · Gomti Nagar, Lucknow · hello@freshfold.in
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"FreshFold Laundry" <${EMAIL_USER}>`,
    to: order.email,
    subject: `Order Confirmed: ${order.orderId} - FreshFold Laundry`,
    html: htmlContent
  };

  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log(`[Email-Simulated] Would send email to ${order.email} for ${order.orderId}. Configure .env to send real emails.`);
      return true;
    }
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Receipt sent to ${order.email}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Error sending receipt to ${order.email}:`, err.message);
    return false;
  }
}

module.exports = { sendOrderReceipt };
