// ============================================================
//  server/utils/sms.js  –  Twilio SMS Integration
// ============================================================
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

async function sendWelcomeSMS(phone, name) {
  if (!client) {
    console.log(`[SMS-Simulated] Welcome to FreshFold, ${name}! (Configure Twilio in .env to send real SMS to ${phone})`);
    return true;
  }
  
  try {
    // Format phone number to E.164 if needed, assuming +91 for India if no country code provided
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone;
    }

    const message = await client.messages.create({
      body: `Welcome to FreshFold, ${name}! Your premium laundry journey starts here. Use code WELCOME50 for your first order.`,
      from: twilioNumber,
      to: formattedPhone
    });
    console.log(`[SMS] Sent welcome message to ${formattedPhone}, SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`[SMS] Failed to send SMS to ${phone}:`, error.message);
    return false;
  }
}

module.exports = { sendWelcomeSMS };
