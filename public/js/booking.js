// ============================================================
//  booking.js  –  booking.html multi-step form (API-connected)
// ============================================================

let currentStep    = 1;
let bookService    = 'ironing';
let bookQty        = 3; // for laundry (kg)
let selectedItems  = {}; // for ironing/drycleaning
let bookCouponData = null;

// Map variables
let map, marker;
const DEFAULT_LAT = 26.8467; // Lucknow
const DEFAULT_LNG = 80.9462;

// set min date to today
const todayStr = new Date().toISOString().split('T')[0];
const dateInput = document.getElementById('pickupDate');
dateInput.min   = todayStr;
dateInput.value = todayStr;
dateInput.addEventListener('change', fetchSlotAvailability);

// Initialize Cashfree safely
let cashfree = null;
try {
  if (typeof Cashfree !== 'undefined') {
    cashfree = Cashfree({ mode: 'sandbox' });
  } else {
    console.warn('Cashfree SDK is not available.');
  }
} catch (e) {
  console.error('Error initializing Cashfree:', e);
}

// Check for returning from Cashfree Payment
window.addEventListener('DOMContentLoaded', async () => {
  // auto-fill details if logged in
  const token = localStorage.getItem('customerToken');
  if (token) {
    try {
      const resp = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) {
        const user = await resp.json();
        document.getElementById('fullName').value = user.name || '';
        document.getElementById('phone').value = user.phone || '';
        if(document.getElementById('email')) document.getElementById('email').value = user.email || '';
        
        // Populate Saved Addresses
        if (user.addresses && user.addresses.length > 0) {
          const wrap = document.getElementById('savedAddrWrap');
          const dropdown = document.getElementById('addrDropdown');
          wrap.classList.add('active');
          
          dropdown.innerHTML = user.addresses.map(a => `
            <div class="addr-item" onclick="selectSavedAddr('${a.address.replace(/'/g, "\\'")}', '${a.pincode || ''}')">
              <strong>${a.label || 'Home'}</strong>
              <p>${a.address}</p>
            </div>
          `).join('');
        }

        // Show loyalty & wallet points if available
        if (user.loyaltyPoints > 0) {
          const lSection = document.getElementById('loyaltySection');
          const lMsg = document.getElementById('loyaltyMsg');
          if (lSection && lMsg) {
            lSection.style.display = 'block';
            lMsg.textContent = `You have ${user.loyaltyPoints} points (₹${Math.floor(user.loyaltyPoints / 10)} value)`;
            lSection.dataset.points = user.loyaltyPoints;
          }
        }
        if (user.walletBalance > 0) {
          const wOpt = document.getElementById('walletPayOption');
          const wBal = document.getElementById('bookWalletBalance');
          if (wOpt && wBal) {
            wOpt.style.display = 'inline-flex';
            wBal.textContent = `₹${user.walletBalance}`;
            wOpt.dataset.balance = user.walletBalance;
          }
        }
      }
    } catch (e) { console.error('Error fetching user', e); }
  }

  // Check for reorder data from profile
  const reorderData = sessionStorage.getItem('reorderData');
  if (reorderData) {
    sessionStorage.removeItem('reorderData'); // clear immediately

    try {
      const rd = JSON.parse(reorderData);
      sessionStorage.removeItem('reorderData');
      
      // Set service
      const svcEl = document.querySelector(`.sp-item[data-val="${rd.service}"]`);
      if (svcEl) selectService(svcEl);
      
      // Set qty
      bookQty = rd.qty || 3;
      document.getElementById('bookingQty').textContent = bookQty;
      
      // Set timeline
      const tlMap = { express: 'express', sameday: 'sameday', nextday: 'nextday' };
      document.getElementById('timeline').value = tlMap[rd.timeline] || 'sameday';
      
      updateBookingPrice();
      if (typeof showToast === 'function') showToast('Reorder loaded! Review & confirm.', 'info');
    } catch(e) {}
  }

  const urlParams = new URLSearchParams(window.location.search);
  const cfOrderId = urlParams.get('cf_order_id');
  if (cfOrderId) {
    try {
      // Verify payment with our backend
      const res = await API.post('/payments/verify', { order_id: cfOrderId });
      
      // Clean up the URL so it doesn't trigger again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show Success Modal natively
      document.getElementById('modalOrderId').textContent = res.order_id;
      document.getElementById('trackOrderBtn').href = 'track.html?id=' + res.order_id;
      
      const successModal = document.getElementById('successModal');
      successModal.classList.add('open');
      
      if (res.status === 'Paid') {
        successModal.querySelector('h2').textContent = 'Payment Successful! 🎉';
        successModal.querySelector('p').textContent = `Your payment was completed and order #${res.order_id} is confirmed.`;
      } else {
        successModal.querySelector('h2').textContent = 'Payment Failed ❌';
        successModal.querySelector('p').textContent = `Your payment failed or was pending. We have saved your order #${res.order_id} as Cash on Delivery.`;
      }
    } catch (err) {
      console.error(err);
      alert('Error verifying payment. Check Tracking page for details.');
    }
  }

  // Initialize Map
  initMap();
  
  // Detect Location listener
  document.getElementById('btnDetectLoc')?.addEventListener('click', detectLocation);
});

// ---- map functions ----
function initMap() {
  const mapEl = document.getElementById('mapPicker');
  if (!mapEl) return;

  map = L.map('mapPicker').setView([DEFAULT_LAT, DEFAULT_LNG], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const ffIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  });

  marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], { draggable: true, icon: ffIcon }).addTo(map);

  marker.on('dragend', function(e) {
    const pos = marker.getLatLng();
    reverseGeocode(pos.lat, pos.lng);
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    reverseGeocode(e.latlng.lat, e.latlng.lng);
  });
}

async function detectLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  const btn = document.getElementById('btnDetectLoc');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 16);
      marker.setLatLng([lat, lng]);
      await reverseGeocode(lat, lng);
      btn.innerHTML = originalText;
      btn.disabled = false;
      showToast('Location detected!', 'success');
    },
    (err) => {
      console.error(err);
      btn.innerHTML = originalText;
      btn.disabled = false;
      showToast('Could not detect location. Please pick manually on map.', 'warning');
    },
    { enableHighAccuracy: true }
  );
}

async function reverseGeocode(lat, lng) {
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await resp.json();
    if (data && data.address) {
      const addr = data.address;
      // Zomato style: Area/Locality
      const area = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.town || addr.city || '';
      const pincode = addr.postcode || '';
      
      if (area) document.getElementById('addrArea').value = area;
      if (pincode) document.getElementById('pincode').value = pincode;
      
      // If house number exists
      if (addr.house_number) {
        document.getElementById('addrHouse').value = addr.house_number + (addr.road ? ', ' + addr.road : '');
      } else if (addr.road) {
        document.getElementById('addrArea').value = addr.road + (area ? ', ' + area : '');
      }
    }
  } catch (e) {
    console.error('Reverse geocode error', e);
  }
}

// ---- address selector helpers ----
function toggleAddrDropdown() {
  document.getElementById('addrDropdown').classList.toggle('open');
}

function selectSavedAddr(fullAddr, pin) {
  // Try to parse if it contains commas
  const parts = fullAddr.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    document.getElementById('addrHouse').value = parts[0];
    document.getElementById('addrArea').value = parts.slice(1).join(', ');
  } else {
    document.getElementById('addrArea').value = fullAddr;
  }
  
  document.getElementById('pincode').value = pin;
  document.getElementById('addrDropdown').classList.remove('open');
  updateSidebar();
}

// Close dropdown on click outside
window.addEventListener('click', (e) => {
  if (!e.target.closest('#savedAddrWrap')) {
    document.getElementById('addrDropdown')?.classList.remove('open');
  }
});

// ---- step navigation ----
function nextStep(step) {
  if (step > currentStep && !validateStep(currentStep)) return;

  document.getElementById('step' + currentStep).classList.remove('active');
  document.getElementById('dot' + currentStep).classList.remove('active');
  document.getElementById('dot' + currentStep).classList.add('done');

  currentStep = step;
  document.getElementById('step' + step).classList.add('active');
  document.getElementById('dot' + step).classList.add('active');

  ['line1','line2'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', i < step - 1);
  });

  if (step === 3) buildReview();
  updateSidebar();
}

function validateStep(step) {
  if (step === 1) {
    const n = document.getElementById('fullName').value.trim();
    const p = document.getElementById('phone').value.trim();
    const h = document.getElementById('addrHouse').value.trim();
    const a = document.getElementById('addrArea').value.trim();
    const z = document.getElementById('pincode').value.trim();
    if (!n || !p || !h || !a || !z) { alert('Please fill all required fields (*)'); return false; }
    if (p.replace(/\D/g,'').length < 10) { alert('Enter a valid 10-digit phone number'); return false; }
  }
  if (step === 2) {
    if (!document.getElementById('pickupDate').value) { alert('Please select a pickup date'); return false; }
  }
  return true;
}

// ---- service picker & itemization ----
function initItemized() {
  selectedItems = {};
  GARMENT_ITEMS.forEach(it => selectedItems[it.id] = 0);
  selectedItems['shirt'] = 3; // Default
  renderItemizedGrid();
}

function renderItemizedGrid() {
  const container = document.getElementById('itemizedContainer');
  if (!container) return;
  
  container.innerHTML = GARMENT_ITEMS.map(it => `
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px 8px; display:flex; flex-direction:column; align-items:center; justify-content: space-between; gap:10px; height:100%;">
      <div style="font-size:28px;">${it.icon}</div>
      <div style="font-size:13px; font-weight:600; text-align:center; min-height: 38px; display: flex; align-items: center; justify-content: center; line-height: 1.2;">${it.name}</div>
      <div class="qty-control">
        <button onclick="changeItemQty('${it.id}', -1)">−</button>
        <span>${selectedItems[it.id] || 0}</span>
        <button onclick="changeItemQty('${it.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

function changeItemQty(id, delta) {
  selectedItems[id] = Math.max(0, (selectedItems[id] || 0) + delta);
  // Ensure at least 1 item total
  const totalItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  if (totalItems === 0) selectedItems[id] = 1;
  
  renderItemizedGrid();
  updateBookingPrice();
}

function selectService(el) {
  document.querySelectorAll('.sp-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  bookService = el.dataset.val;
  
  const isLaundry = (bookService === 'laundry');
  document.getElementById('bookingQtyLabel').textContent = isLaundry ? 'Weight (KG) *' : 'Select Garments *';
  
  document.getElementById('itemizedContainer').style.display = isLaundry ? 'none' : 'grid';
  document.getElementById('kgContainer').style.display = isLaundry ? 'flex' : 'none';
  
  updateBookingPrice();
}

// init
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initItemized);
} else {
  initItemized();
}

// ---- qty ----
function changeQty(delta) {
  bookQty = Math.max(1, bookQty + delta);
  document.getElementById('bookingQty').textContent = bookQty;
  updateBookingPrice();
}

// ---- timeline & date ----
document.getElementById('timeline').addEventListener('change', updateBookingPrice);
document.getElementById('pickupSlot').addEventListener('change', updateSidebar);

// ---- slot fetching (FOMO) ----
async function fetchSlotAvailability() {
  const date = document.getElementById('pickupDate').value;
  if (!date) return;
  try {
    const res = await API.get(`/orders/slot-availability?date=${date}`);
    const slotSelect = document.getElementById('pickupSlot');
    const slots = res.slots || {};
    
    Array.from(slotSelect.options).forEach(opt => {
      const dbKey = opt.value === 'morning' ? 'Morning (7-11am)' : opt.value === 'afternoon' ? 'Afternoon (12-4pm)' : 'Evening (5-9pm)';
      const slotData = slots[dbKey];
      
      opt.disabled = false;
      const baseText = opt.value === 'morning' ? 'Morning (7am – 11am)' : opt.value === 'afternoon' ? 'Afternoon (12pm – 4pm)' : 'Evening (5pm – 9pm)';
      
      if (slotData) {
        if (slotData.remaining === 0) {
          opt.textContent = `${baseText} ❌ Sold Out`;
          opt.disabled = true;
          if (slotSelect.value === opt.value) slotSelect.value = '';
        } else if (slotData.remaining <= 3) {
          opt.textContent = `${baseText} 🔥 Only ${slotData.remaining} slots left!`;
        } else {
          opt.textContent = `${baseText} ✅ Available`;
        }
      } else {
        opt.textContent = `${baseText}`;
      }
    });
    updateSidebar();

    // Update standalone FOMO badge
    const badge = document.getElementById('slotFomoBadge');
    if (badge) {
      const selectedSlot = slotSelect.value;
      const dbKeyMap = { morning: 'Morning (7-11am)', afternoon: 'Afternoon (12-4pm)', evening: 'Evening (5-9pm)' };
      const currentSlotData = slots[dbKeyMap[selectedSlot]];
      if (currentSlotData && currentSlotData.remaining > 0 && currentSlotData.remaining <= 5) {
        badge.textContent = `\uD83D\uDD25 Only ${currentSlotData.remaining} slot${currentSlotData.remaining > 1 ? 's' : ''} left for this time! Book now!`;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch(e) {}
}

// ---- corporate / GST toggle ----
function toggleCorporateFields() {
  const checked = document.getElementById('isCorporate').checked;
  document.getElementById('corporateFields').style.display = checked ? 'block' : 'none';
}

// ---- recurring ----
function toggleRecurringOptions() {
  const isRec = document.getElementById('isRecurring').checked;
  document.getElementById('recurringOptions').style.display = isRec ? 'flex' : 'none';
  if (isRec) {
    // Standardize timeline to nextday for recurring
    document.getElementById('timeline').value = 'nextday';
  }
  updateBookingPrice();
}

// ---- coupon (now calls API) ----
async function applyBookCoupon() {
  const code  = document.getElementById('bookCoupon').value.trim().toUpperCase();
  const msgEl = document.getElementById('bookCouponMsg');
  if (!code) { msgEl.textContent = ''; bookCouponData = null; updateBookingPrice(); return; }

  try {
    const data = await API.post('/coupons/validate', { code });
    bookCouponData = { ...data, code: data.code };
    msgEl.textContent = '✅ ' + data.desc + ' applied!';
    msgEl.className   = 'coupon-msg success';
  } catch {
    bookCouponData = null;
    msgEl.textContent = '❌ Invalid coupon code.';
    msgEl.className   = 'coupon-msg error';
  }
  updateBookingPrice();
}

function calcTotal() {
  const tl       = document.getElementById('timeline').value;
  const baseRate = PRICES[bookService][tl];
  let subtotal = 0;
  
  if (bookService === 'laundry') {
    subtotal = baseRate * bookQty;
  } else {
    // Itemized
    Object.keys(selectedItems).forEach(id => {
      const qty = selectedItems[id];
      if (qty > 0) {
        const itemDef = GARMENT_ITEMS.find(it => it.id === id);
        const itemCost = Math.round(baseRate * (itemDef ? itemDef.multiplier : 1));
        subtotal += (itemCost * qty);
      }
    });
  }

  let   discount = bookCouponData ? Math.round(subtotal * bookCouponData.discount / 100) : 0;
  
  // 10% discount for recurring orders
  const isRec = document.getElementById('isRecurring') && document.getElementById('isRecurring').checked;
  if (isRec) discount += Math.round(subtotal * 0.10);
  
  const delivery = (subtotal - discount) >= 499 ? 0 : 49;
  let total = subtotal - discount + delivery;

  // Loyalty Points logic
  let pointsRedeemed = 0;
  let pointsValue = 0;
  const redeemCb = document.getElementById('redeemLoyalty');
  const lSection = document.getElementById('loyaltySection');
  if (redeemCb && redeemCb.checked && lSection && lSection.dataset.points) {
    const maxPoints = parseInt(lSection.dataset.points, 10);
    // 100 points = Rs. 10 -> 1 point = Rs. 0.1
    const ptValue = Math.floor(maxPoints / 10);
    
    // Redeem up to total minus 1 rupee (can't make total 0 if choosing online payment typically, but let's allow 0 for simple logic)
    if (ptValue >= total) {
      pointsValue = total;
      pointsRedeemed = total * 10;
      total = 0;
    } else {
      pointsValue = ptValue;
      pointsRedeemed = maxPoints;
      total -= pointsValue;
    }
  }

  return { tl, baseRate, subtotal, discount, delivery, total, pointsRedeemed, pointsValue, isRec };
}

function updateBookingPrice() {
  const { total } = calcTotal();
  document.getElementById('livePrice').textContent = '₹' + total;
  updateSidebar();
}

// Check wallet vs total on payment selection
document.querySelectorAll('input[name="payment"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'wallet') {
      const { total } = calcTotal();
      const bal = parseInt(document.getElementById('walletPayOption').dataset.balance || '0');
      if (total > bal) {
        showToast('Insufficient wallet balance. Please choose another method.', 'warning');
        document.querySelector('input[name="payment"][value="cod"]').checked = true;
      }
    }
  });
});

function updateSidebar() {
  const name     = document.getElementById('fullName').value || '—';
  const phone    = document.getElementById('phone').value    || '—';
  const svcLabels = { ironing: 'Ironing', laundry: 'Laundry', drycleaning: 'Dry Cleaning' };
  const tlLabels  = { express: 'Express', sameday: 'Same Day', nextday: 'Next Day' };
  const slotLabels = { morning: 'Morning (7–11am)', afternoon: 'Afternoon (12–4pm)', evening: 'Evening (5–9pm)' };
  const { tl, total } = calcTotal();
  const unit  = bookService === 'laundry' ? 'kg' : 'items';
  const date  = document.getElementById('pickupDate').value || '—';
  const slot  = document.getElementById('pickupSlot').value;

  const h = document.getElementById('addrHouse').value.trim();
  const a = document.getElementById('addrArea').value.trim();
  const l = document.getElementById('addrLandmark').value.trim();
  const fullAddr = `${h}${h && a ? ', ' : ''}${a}${l ? ' (Landmark: ' + l + ')' : ''}`;

  document.getElementById('sidebarSummary').innerHTML =
    '<div style="font-size:14px;line-height:2;color:#6b7280">' +
    '<div><strong style="color:#1a1a2e">Customer:</strong> ' + name + '</div>' +
    '<div><strong style="color:#1a1a2e">Phone:</strong> ' + phone + '</div>' +
    '<div><strong style="color:#1a1a2e">Address:</strong> ' + (fullAddr || '—') + '</div>' +
    '<div><strong style="color:#1a1a2e">Service:</strong> ' + svcLabels[bookService] + '</div>' +
    '<div><strong style="color:#1a1a2e">Qty:</strong> ' + bookQty + ' ' + unit + '</div>' +
    '<div><strong style="color:#1a1a2e">Timeline:</strong> ' + tlLabels[tl] + '</div>' +
    '<div><strong style="color:#1a1a2e">Date:</strong> ' + date + '</div>' +
    '<div><strong style="color:#1a1a2e">Slot:</strong> ' + slotLabels[slot] + '</div>' +
    '<hr style="margin:8px 0;border-color:#e5e7eb"/>' +
    '<div style="font-size:16px"><strong style="color:#1a6b4a">Total: ₹' + total + '</strong></div>' +
    '</div>';
}

function buildReview() {
  const svcLabels  = { ironing: '👔 Ironing', laundry: '🫧 Laundry', drycleaning: '🧥 Dry Cleaning' };
  const tlLabels   = { express: '⚡ Express', sameday: '🌤 Same Day', nextday: '📅 Next Day' };
  const slotLabels = { morning: 'Morning (7–11am)', afternoon: 'Afternoon (12–4pm)', evening: 'Evening (5–9pm)' };
  const slot = document.getElementById('pickupSlot').value;
  const { tl, subtotal, discount, delivery, pointsValue, isRec, total } = calcTotal();
  const unit = bookService === 'laundry' ? 'kg' : 'items';
  
  const recFreq = isRec ? document.getElementById('recurringFrequency').value : '';

  let itemsStr = '';
  if (bookService === 'laundry') {
    itemsStr = `${bookQty} kg`;
  } else {
    itemsStr = Object.entries(selectedItems)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => {
        const itemDef = GARMENT_ITEMS.find(it => it.id === id);
        return `${qty}x ${itemDef ? itemDef.name : id}`;
      }).join(', ');
  }

  const h = document.getElementById('addrHouse').value.trim();
  const a = document.getElementById('addrArea').value.trim();
  const l = document.getElementById('addrLandmark').value.trim();
  const fullAddr = `${h}${h && a ? ', ' : ''}${a}${l ? ' (Landmark: ' + l + ')' : ''}`;

  document.getElementById('reviewBox').innerHTML =
    '<strong>Name:</strong> '    + document.getElementById('fullName').value + '<br/>' +
    '<strong>Phone:</strong> '   + document.getElementById('phone').value    + '<br/>' +
    '<strong>Address:</strong> ' + fullAddr + '<br/>' +
    '<strong>Service:</strong> ' + svcLabels[bookService] + '<br/>' +
    '<strong>Items:</strong> '   + itemsStr + '<br/>' +
    '<strong>Timeline:</strong> '+ tlLabels[tl]            + '<br/>' +
    '<strong>Pickup:</strong> '  + document.getElementById('pickupDate').value + ' · ' + slotLabels[slot] + '<br/>' +
    (isRec ? `<strong style="color:#166534;">Subscription:</strong> ${recFreq} pickup<br/>` : '') +
    (document.getElementById('notes').value ? '<strong>Notes:</strong> ' + document.getElementById('notes').value + '<br/>' : '') +
    (bookCouponData ? '<strong>Coupon:</strong> ' + bookCouponData.code + ' (−' + bookCouponData.discount + '%)<br/>' : '') +
    '<strong>Subtotal:</strong> ₹' + subtotal + '<br/>' +
    (discount > 0 ? '<strong>Discount/Save:</strong> −₹' + discount + '<br/>' : '') +
    (pointsValue > 0 ? `<strong style="color:#5b21b6;">Loyalty Redeemed:</strong> −₹${pointsValue}<br/>` : '') +
    '<strong>Delivery:</strong> ' + (delivery === 0 ? 'FREE' : '₹' + delivery) + '<br/>' +
    '<strong style="font-size:18px;color:var(--primary)">Total: ₹' + total + '</strong>';
}

// ---- Place order via API ----
async function placeOrder() {
  const { tl, subtotal, discount, delivery, total, pointsRedeemed, isRec } = calcTotal();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const svcLabels  = { ironing: 'Ironing', laundry: 'Laundry', drycleaning: 'Dry Cleaning' };
  const tlLabels   = { express: 'Express', sameday: 'Same Day', nextday: 'Next Day' };
  const slotLabels = { morning: 'Morning (7–11am)', afternoon: 'Afternoon (12–4pm)', evening: 'Evening (5–9pm)' };
  const slot = document.getElementById('pickupSlot').value;

  const dateD = new Date(document.getElementById('pickupDate').value);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  let finalQty = bookQty;
  let finalItems = [];
  if (bookService !== 'laundry') {
    finalQty = Object.values(selectedItems).reduce((s, a) => s + a, 0);
    finalItems = Object.entries(selectedItems)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => {
        const def = GARMENT_ITEMS.find(it => it.id === id);
        return { name: def ? def.name : id, qty, price: Math.round(calcTotal().baseRate * (def ? def.multiplier : 1)) };
      });
  }

  const h = document.getElementById('addrHouse').value.trim();
  const a = document.getElementById('addrArea').value.trim();
  const l = document.getElementById('addrLandmark').value.trim();
  const fullAddr = `${h}${h && a ? ', ' : ''}${a}${l ? ' (Landmark: ' + l + ')' : ''}`;

  const order = {
    customer:    document.getElementById('fullName').value,
    phone:       document.getElementById('phone').value,
    email:       document.getElementById('email').value,
    address:     fullAddr,
    pincode:     document.getElementById('pincode').value,
    service:     svcLabels[bookService],
    serviceKey:  bookService,
    qty:         finalQty,
    unit:        bookService === 'laundry' ? 'kg' : 'items',
    items:       finalItems,
    timeline:    tlLabels[tl],
    timelineKey: tl,
    pickupDate:  document.getElementById('pickupDate').value,
    pickupSlot:  slotLabels[slot],
    notes:       document.getElementById('notes').value,
    coupon:      bookCouponData ? bookCouponData.code : null,
    discount,
    delivery,
    total,
    pointsRedeemed,
    isRecurring: isRec,
    recurringFrequency: isRec ? document.getElementById('recurringFrequency').value : '',
    recurringDay: isRec ? days[dateD.getDay()] : '',
    payment:     payment === 'cod' ? 'Cash on Delivery' : (payment === 'wallet' ? 'Wallet' : 'UPI / Online')
  };

  // Corporate / GST fields
  const isCorp = document.getElementById('isCorporate') && document.getElementById('isCorporate').checked;
  if (isCorp) {
    order.corporate = {
      companyName:    document.getElementById('companyName').value.trim(),
      gstNumber:      document.getElementById('gstNumber').value.trim().toUpperCase(),
      billingAddress: document.getElementById('billingAddress').value.trim()
    };
  }

  try {
    const token = localStorage.getItem('customerToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (payment === 'cod' || payment === 'wallet') {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(order)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check details');

      document.getElementById('modalOrderId').textContent = data.id;
      document.getElementById('trackOrderBtn').href = 'track.html?id=' + data.id;
      document.getElementById('successModal').classList.add('open');
    } else {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(order)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      
      cashfree.checkout({ paymentSessionId: data.payment_session_id });
    }
  } catch (err) {
    alert('Error placing order: ' + err.message);
  }
}

// close modal on backdrop click
document.getElementById('successModal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});

// init
initItemized();
updateBookingPrice();
updateSidebar();
