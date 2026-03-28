// ============================================================
//  pricing.js  –  services.html interactive calculator (API-connected)
// ============================================================

let calcService  = 'ironing';
let calcQty      = 3; // For Laundry (KG)
let calcSelectedItems = {}; // For Ironing / Dry Cleaning
let calcTimeline = 'express';
let calcCoupon   = null;

// ---- Itemization Init ----
function initCalcItemized() {
  calcSelectedItems = {};
  GARMENT_ITEMS.forEach(it => calcSelectedItems[it.id] = 0);
  calcSelectedItems['shirt'] = 3; // Default
  renderCalcItemizedGrid();
}

function renderCalcItemizedGrid() {
  const container = document.getElementById('itemizedContainerCalc');
  if (!container) return;
  
  container.innerHTML = GARMENT_ITEMS.map(it => `
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
      <div style="font-size:24px;">${it.icon}</div>
      <div style="font-size:12px; font-weight:600; text-align:center;">${it.name}</div>
      <div class="qty-control" style="transform: scale(0.85); transform-origin: center; width:100%; display:flex; justify-content:space-between;">
        <button onclick="changeCalcItemQty('${it.id}', -1)">−</button>
        <span>${calcSelectedItems[it.id] || 0}</span>
        <button onclick="changeCalcItemQty('${it.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

// Global func for inline onclick
window.changeCalcItemQty = function(id, delta) {
  calcSelectedItems[id] = Math.max(0, (calcSelectedItems[id] || 0) + delta);
  // Ensure at least 1 overall item
  const total = Object.values(calcSelectedItems).reduce((sum, qty) => sum + qty, 0);
  if (total === 0) calcSelectedItems[id] = 1;
  
  renderCalcItemizedGrid();
  updateCalcPrice();
};

// service toggle buttons
document.querySelectorAll('.toggle-btn[data-service]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn[data-service]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calcService = btn.dataset.service;
    updateQtyLabel();
    updateCalcPrice();
  });
});

// qty controls
document.getElementById('qtyMinus').addEventListener('click', () => {
  if (calcQty > 1) { calcQty--; document.getElementById('qtyValue').textContent = calcQty; updateCalcPrice(); }
});
document.getElementById('qtyPlus').addEventListener('click', () => {
  calcQty++;
  document.getElementById('qtyValue').textContent = calcQty;
  updateCalcPrice();
});

// timeline radios
document.querySelectorAll('input[name="timeline"]').forEach(radio => {
  radio.addEventListener('change', () => { calcTimeline = radio.value; updateCalcPrice(); });
});

// coupon (now calls API)
document.getElementById('applyCoupon').addEventListener('click', applyCalcCoupon);

async function applyCalcCoupon() {
  const code  = document.getElementById('couponInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('couponMsg');
  if (!code) { msgEl.textContent = ''; calcCoupon = null; updateCalcPrice(); return; }

  try {
    const data = await API.post('/coupons/validate', { code });
    calcCoupon = { ...data, code: data.code };
    msgEl.textContent = '✅ ' + data.desc + ' applied!';
    msgEl.className   = 'coupon-msg success';
  } catch {
    calcCoupon = null;
    msgEl.textContent = '❌ Invalid coupon code.';
    msgEl.className   = 'coupon-msg error';
  }
  updateCalcPrice();
}

function updateQtyLabel() {
  const isLaundry = (calcService === 'laundry');
  document.getElementById('qtyLabel').textContent = isLaundry ? 'Weight (KG)' : 'Select Garments';
  
  const ic = document.getElementById('itemizedContainerCalc');
  const kc = document.getElementById('kgContainerCalc');
  if (ic) ic.style.display = isLaundry ? 'none' : 'grid';
  if (kc) kc.style.display = isLaundry ? 'flex' : 'none';
}

function updateCalcPrice() {
  const baseRate = PRICES[calcService][calcTimeline];
  let subtotal = 0;
  let breakdown = '';
  
  if (calcService === 'laundry') {
    subtotal = baseRate * calcQty;
    breakdown = `₹${baseRate}/kg × ${calcQty} kg = ₹${subtotal}`;
  } else {
    // Itemized pricing
    const lineItems = [];
    Object.keys(calcSelectedItems).forEach(id => {
      const qty = calcSelectedItems[id];
      if (qty > 0) {
        const def = GARMENT_ITEMS.find(it => it.id === id);
        const itemCost = Math.round(baseRate * (def ? def.multiplier : 1));
        const lineTotal = itemCost * qty;
        subtotal += lineTotal;
        lineItems.push(`₹${itemCost} × ${qty} ${def ? def.name : id} (₹${lineTotal})`);
      }
    });
    breakdown = lineItems.join('<br/>');
  }

  let discount = 0;
  if (calcCoupon) discount = Math.round(subtotal * calcCoupon.discount / 100);
  
  const delivery   = (subtotal - discount) >= 499 ? 0 : 49;
  const grandTotal = subtotal - discount + delivery;

  if (calcCoupon && discount > 0) {
    breakdown = `<div style="text-decoration:line-through;color:#9ca3af;font-size:0.9em;">Subtotal: ₹${subtotal}</div>` + breakdown;
    breakdown += `<br/><span style="color:#15803d;font-weight:600;">Discount (${calcCoupon.code}): −₹${discount}</span>`;
  }
  
  if (delivery > 0) {
    breakdown += `<br/><span style="color:#6b7280;font-size:0.9em;">Delivery: ₹${delivery}</span>`;
  } else {
    breakdown += `<br/><span style="color:#1a6b4a;font-weight:bold;font-size:0.9em;">Delivery: FREE</span>`;
  }

  document.getElementById('breakdown').innerHTML = breakdown;
  document.getElementById('totalPrice').textContent = '₹' + grandTotal;

  // update timeline time labels
  document.getElementById('tl-express-time').textContent = TIMELINE_LABELS.express[calcService];
  document.getElementById('tl-same-time').textContent    = TIMELINE_LABELS.sameday[calcService];
}

// init
initCalcItemized();
updateQtyLabel();
updateCalcPrice();
