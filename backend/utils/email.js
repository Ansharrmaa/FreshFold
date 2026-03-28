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

async function sendPasswordResetEmail(email, resetLink) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1a6b4a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FreshFold</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="margin-top: 0; color: #1a1a2e;">Reset Your Password</h2>
        <p>Hi there,</p>
        <p>We received a request to reset your FreshFold account password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #1a6b4a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1rem; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 0.9rem; color: #6b7280;">This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />
        <p style="font-size: 0.85rem; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 0.8rem; color: #9ca3af; word-break: break-all;">${resetLink}</p>
      </div>
      <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        FreshFold Laundry · Gomti Nagar, Lucknow · hello@freshfold.in
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"FreshFold" <${EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your FreshFold Password',
    html: htmlContent
  };

  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log(`[Email-Simulated] Password reset email for ${email}`);
      console.log(`[Email-Simulated] Reset Link: ${resetLink}`);
      return true;
    }
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset sent to ${email}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Error sending reset email to ${email}:`, err.message);
    return false;
  }
}

async function sendStatusUpdateEmail(order, status) {
  if (!order.email) return false;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #1a6b4a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FreshFold Laundry</h1>
      </div>
      <div style="padding: 30px;">
        <h2 style="margin-top: 0; color: #1a1a2e;">Your Order Status: ${status} 📦</h2>
        <p>Hi ${order.customer},</p>
        <p>Just a quick update! Your order <strong>#${order.orderId}</strong> is now marked as <strong>${status}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/track.html?id=${order.orderId}" style="background-color: #1a6b4a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Track Live</a>
        </div>
      </div>
      <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        FreshFold Laundry · Gomti Nagar, Lucknow · hello@freshfold.in
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"FreshFold Laundry" <${EMAIL_USER}>`,
    to: order.email,
    subject: `Order Update: ${order.orderId} is now ${status}`,
    html: htmlContent
  };

  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.log(`[Email-Simulated] Status update to ${order.email} for ${order.orderId}: ${status}`);
      return true;
    }
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Status update sent to ${order.email}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Error sending status update to ${order.email}:`, err.message);
    return false;
  }
}

module.exports = { sendOrderReceipt, sendPasswordResetEmail, sendStatusUpdateEmail };
