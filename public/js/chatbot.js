// ============================================================
//  js/chatbot.js — AI Garment Care Chatbot (Local Knowledge Base)
// ============================================================

const GARMENT_KB = [
  { patterns: ['silk', 'saree', 'silk saree'], answer: '🧵 **Silk Sarees** should be dry-cleaned only. Avoid washing at home as water can damage the fabric. We use specialized solvent-based cleaning that preserves the sheen and embroidery. Express dry cleaning available!' },
  { patterns: ['cotton', 'shrink', 'shrinking'], answer: '👕 **Cotton Shrinkage** happens when washed in hot water. We wash cotton at controlled temperatures (30°C max) and air-dry to prevent shrinking. Pro tip: Always choose "Wash & Fold" for cotton garments.' },
  { patterns: ['stain', 'remove stain', 'oil stain', 'ink'], answer: '🧴 **Stain Removal**: Don\'t rub stains — it spreads them! For oil stains, apply talcum powder immediately. For ink, use rubbing alcohol. Or just send it to us — our professional stain treatment has 95% success rate!' },
  { patterns: ['wool', 'sweater', 'woolen', 'winter'], answer: '🧣 **Wool & Sweaters** need cold water and gentle handling. Machine washing can cause pilling and shrinkage. Our dry cleaning process keeps woolen garments soft and in shape. Ideal for winter jackets too!' },
  { patterns: ['white', 'whiten', 'yellowing', 'bright'], answer: '✨ **Whitening Tips**: Add a cup of baking soda to your wash. For stubborn yellowing, soak in a mix of hydrogen peroxide and water. Our professional laundry includes optical brighteners that keep whites sparkling!' },
  { patterns: ['iron', 'ironing', 'wrinkle', 'press'], answer: '👔 **Ironing Tips**: Always iron cotton at high heat, silk at low heat with a cloth barrier. Our express ironing service (2-hour turnaround) uses steam pressing that\'s gentler than home irons. Starting at just ₹25/item!' },
  { patterns: ['denim', 'jeans'], answer: '👖 **Denim Care**: Wash jeans inside-out in cold water to preserve color. Avoid the dryer — hang dry instead. We recommend dry cleaning for premium denim. Our service preserves the original wash and fit.' },
  { patterns: ['leather', 'jacket', 'bag'], answer: '🧥 **Leather** should never be machine washed. Wipe with a damp cloth and use leather conditioner. For deep cleaning, our specialized leather care service uses pH-balanced solutions. Priced from ₹499.' },
  { patterns: ['curtain', 'upholstery', 'sofa'], answer: '🪟 **Curtains & Upholstery** collect dust and allergens. We recommend professional cleaning every 3-6 months. Our pickup service includes curtain removal and re-hanging. Starting at ₹249/panel!' },
  { patterns: ['price', 'pricing', 'cost', 'rate', 'charge'], answer: '💰 **Pricing**: Ironing from ₹25/item, Laundry from ₹79/kg, Dry Cleaning from ₹149/item. Express (2hr) costs more, Next Day is cheapest. Use code FRESH20 for 20% off your first order! Check our Services page for full pricing.' },
  { patterns: ['pickup', 'delivery', 'time', 'slot', 'schedule'], answer: '🚗 **Pickup & Delivery**: We offer 3 slots — Morning (7-11am), Afternoon (12-4pm), Evening (5-9pm). Free delivery on orders above ₹499. Express delivery available in 2 hours! Book from our Schedule Pickup page.' },
  { patterns: ['subscription', 'plan', 'monthly', 'subscribe'], answer: '💳 **Subscription Plans**: Starter (₹499/mo, 4 pickups), Pro (₹999/mo, 10 pickups + express), Family (₹1,499/mo, unlimited). Subscribe & Save 10% on recurring orders! Check your profile for upgrade options.' },
  { patterns: ['hello', 'hi', 'hey', 'help'], answer: '👋 Hi! I\'m FreshFold\'s garment care assistant. Ask me about:\n• Fabric care (silk, cotton, wool, denim)\n• Stain removal tips\n• Pricing & services\n• Pickup slots & delivery\n• Subscription plans\n\nHow can I help you today?' },
];

function chatbotReply(message) {
  const lower = message.toLowerCase().trim();
  for (const entry of GARMENT_KB) {
    if (entry.patterns.some(p => lower.includes(p))) {
      return entry.answer;
    }
  }
  return '🤔 I\'m not sure about that. Try asking about:\n• Fabric care (silk, cotton, wool)\n• Stain removal\n• Pricing & services\n• Pickup & delivery slots\n\nOr visit our **Services** page for full details!';
}

// Build the chatbot widget
function initChatbot() {
  // Floating button
  const btn = document.createElement('div');
  btn.id = 'chatbotBtn';
  btn.innerHTML = '<i class="fa-solid fa-message-bot" style="font-size:20px;"></i>💬';
  btn.style.cssText = 'position:fixed;bottom:90px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,#1a6b4a,#2ecc71);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 24px rgba(26,107,74,0.35);z-index:9998;font-size:24px;transition:transform 0.3s;color:#fff;';
  btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
  btn.onmouseleave = () => btn.style.transform = 'scale(1)';

  // Chat panel
  const panel = document.createElement('div');
  panel.id = 'chatPanel';
  panel.style.cssText = 'position:fixed;bottom:160px;right:24px;width:360px;max-height:480px;background:#fff;border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,0.15);z-index:9999;display:none;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;';
  
  panel.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a6b4a,#2ecc71);padding:16px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <strong style="font-size:16px;">🤖 FreshFold Care Bot</strong>
        <div style="font-size:12px;opacity:0.85;margin-top:2px;">Garment care expert</div>
      </div>
      <button id="chatClose" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:0.8;">✕</button>
    </div>
    <div id="chatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;max-height:320px;"></div>
    <div style="padding:12px;border-top:1px solid #e5e7eb;display:flex;gap:8px;">
      <input id="chatInput" type="text" placeholder="Ask about garment care..." style="flex:1;padding:10px 14px;border:1px solid #d1d5db;border-radius:50px;font-size:14px;outline:none;font-family:inherit;">
      <button id="chatSend" style="background:#1a6b4a;color:#fff;border:none;border-radius:50px;width:40px;height:40px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-paper-plane" style="font-size:14px;color:#fff;">➤</i></button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  // Add welcome message
  addBotMessage('👋 Hi! I\'m FreshFold\'s garment care assistant. Ask me about fabric care, stain removal, pricing, or delivery!');

  btn.onclick = () => {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  };

  document.getElementById('chatClose').onclick = () => {
    panel.style.display = 'none';
  };

  document.getElementById('chatSend').onclick = sendChat;
  document.getElementById('chatInput').onkeydown = (e) => {
    if (e.key === 'Enter') sendChat();
  };
}

function addBotMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.style.cssText = 'background:#f0fdf4;padding:12px 16px;border-radius:16px 16px 16px 4px;font-size:13px;line-height:1.5;color:#333;max-width:85%;align-self:flex-start;';
  div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.style.cssText = 'background:#1a6b4a;color:#fff;padding:10px 16px;border-radius:16px 16px 4px 16px;font-size:13px;max-width:85%;align-self:flex-end;';
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addUserMessage(text);
  input.value = '';
  setTimeout(() => {
    addBotMessage(chatbotReply(text));
  }, 500);
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}
