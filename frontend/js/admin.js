// ============================================================
//  admin.js  –  admin.html dashboard (API-connected)
// ============================================================

let allOrders    = [];
let allCoupons   = [];
let editingOrderId = null;

// ---- AUTH ----
async function adminLogin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value;
  const err  = document.getElementById('loginError');
  err.textContent = '';

  try {
    await API.login(user, pass);
    document.getElementById('adminLogin').style.display    = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    initDashboard();
  } catch (e) {
    err.textContent = '❌ ' + (e.error || 'Invalid username or password.');
  }
}

['adminUser','adminPass'].forEach(id => {
  document.getElementById(id).addEventListener('keypress', e => { if (e.key === 'Enter') adminLogin(); });
});

function adminLogout() {
  API.logout();
  document.getElementById('adminLogin').style.display     = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
}

// ---- INIT ----
async function initDashboard() {
  try {
    const [stats, orders, coupons] = await Promise.all([
      API.authGet('/stats'),
      API.authGet('/orders'),
      API.authGet('/coupons')
    ]);
    allOrders  = orders;
    allCoupons = coupons;

    renderStats(stats);
    renderRevenueChart(stats.chartData);
    renderRecentOrders();
    renderAllOrders();
    renderCustomersFromAPI();
    renderCoupons();
  } catch (err) {
    if (err.status === 401) {
      alert('Session expired. Please login again.');
      adminLogout();
    }
  }
}

// ---- TABS ----
function showTab(tab, el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { overview:'Overview', orders:'All Orders', customers:'Customers', coupons:'Coupons', slots:'Slot Management', subscriptions: 'All Subscriptions', settings:'Settings' };
  document.getElementById('tabTitle').textContent = titles[tab] || tab;

  if (tab === 'subscriptions') loadSubscriptions();
}

// ---- STATS ----
function renderStats(stats) {
  document.getElementById('stat-total').textContent    = stats.total;
  document.getElementById('stat-revenue').textContent  = '₹' + stats.revenue.toLocaleString('en-IN');
  document.getElementById('stat-pending').textContent  = stats.pending;
  document.getElementById('stat-delivered').textContent = stats.delivered;
}

// ---- REVENUE CHART ----
function renderRevenueChart(chartData) {
  if (!chartData || chartData.length === 0) {
    document.getElementById('revenueChart').innerHTML = '<p style="color:#6b7280">No data yet</p>';
    return;
  }
  const maxRev = Math.max(...chartData.map(d => d.revenue), 1);
  document.getElementById('revenueChart').innerHTML = chartData.map(d =>
    '<div class="bar-col">' +
    '<div class="bar-val">₹' + (d.revenue/1000).toFixed(1) + 'k</div>' +
    '<div class="bar-fill" style="height:' + Math.round((d.revenue/maxRev)*140) + 'px"></div>' +
    '<div class="bar-label">' + d.day + '</div></div>'
  ).join('');
}

// ---- STATUS PILL ----
function statusPill(status) {
  const map = {
    'Pending':'sp-pending','Picked Up':'sp-picked','In Progress':'sp-progress',
    'Out for Delivery':'sp-delivery','Delivered':'sp-delivered','Cancelled':'sp-cancelled'
  };
  return '<span class="status-pill ' + (map[status]||'') + '">' + status + '</span>';
}

// ---- RECENT ORDERS ----
function renderRecentOrders() {
  document.getElementById('recentOrdersBody').innerHTML =
    allOrders.slice(0,6).map(o =>
      '<tr><td><strong>' + o.id + '</strong></td><td>' + o.customer + '</td><td>' + o.service +
      '</td><td>₹' + o.total + '</td><td>' + statusPill(o.status) +
      '</td><td><button class="btn-outline small" onclick="openStatusModal(\'' + o.id + '\')">Update</button></td></tr>'
    ).join('');
}

// ---- ALL ORDERS ----
function renderAllOrders() {
  const search  = (document.getElementById('orderSearch')?.value || '').toLowerCase();
  const statusF = document.getElementById('statusFilter')?.value || '';
  let orders = allOrders;
  if (search)  orders = orders.filter(o => o.id.toLowerCase().includes(search) || o.customer.toLowerCase().includes(search) || (o.phone||'').includes(search));
  if (statusF) orders = orders.filter(o => o.status === statusF);

  document.getElementById('allOrdersBody').innerHTML = orders.map(o =>
    '<tr><td><strong>' + o.id + '</strong></td><td>' + o.customer + '</td><td>' + (o.phone||'—') +
    '</td><td>' + o.service + '</td><td>' + o.timeline +
    '</td><td>₹' + o.total +
    '</td><td>' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—') +
    '</td><td>' + statusPill(o.status) +
    '</td><td><button class="btn-outline small" onclick="openStatusModal(\'' + o.id + '\')">Update</button></td></tr>'
  ).join('');
}

function filterOrders() { renderAllOrders(); }

// ---- CUSTOMERS ----
async function renderCustomersFromAPI() {
  try {
    const customers = await API.authGet('/stats/customers');
    document.getElementById('customersBody').innerHTML = customers.map(c =>
      '<tr><td><strong>' + c.name + '</strong></td><td>' + (c.phone||'—') + '</td><td>' + c.totalOrders +
      '</td><td>₹' + (c.totalSpent||0).toLocaleString('en-IN') +
      '</td><td>' + (c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('en-IN') : '—') + '</td></tr>'
    ).join('');
  } catch {
    document.getElementById('customersBody').innerHTML = '<tr><td colspan="5">Error loading customers</td></tr>';
  }
}

// ---- COUPONS ----
function renderCoupons() {
  document.getElementById('couponsBody').innerHTML = allCoupons.map(c =>
    '<tr><td><strong class="coupon-code">' + c.code + '</strong></td><td>' + c.discount + '%</td><td>₹' + c.minOrder +
    '</td><td>' + c.expiry + '</td><td>' + c.uses +
    '</td><td><button class="btn-outline small" style="color:#dc2626;border-color:#dc2626" onclick="deleteCoupon(' + c.id + ')">Delete</button></td></tr>'
  ).join('');
}

function showCouponForm()  { document.getElementById('couponForm').style.display = 'block'; }
function hideCouponForm()  { document.getElementById('couponForm').style.display = 'none';  }

async function addCoupon() {
  const code     = document.getElementById('newCode').value.trim().toUpperCase();
  const discount = parseInt(document.getElementById('newDiscount').value);
  const expiry   = document.getElementById('newExpiry').value;
  const min      = parseInt(document.getElementById('newMin').value) || 0;
  if (!code || !discount || !expiry) { alert('Please fill all coupon fields'); return; }

  try {
    await API.authPost('/coupons', { code, discount, minOrder: min, expiry });
    hideCouponForm();
    ['newCode','newDiscount','newExpiry','newMin'].forEach(id => document.getElementById(id).value = '');
    // Refresh coupons
    allCoupons = await API.authGet('/coupons');
    renderCoupons();
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to create coupon'));
  }
}

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon?')) return;
  try {
    await API.authDelete('/coupons/' + id);
    allCoupons = await API.authGet('/coupons');
    renderCoupons();
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to delete coupon'));
  }
}

// ---- STATUS MODAL ----
function openStatusModal(orderId) {
  editingOrderId = orderId;
  const order = allOrders.find(o => o.id === orderId);
  document.getElementById('modalOrderNum').textContent = orderId;
  document.getElementById('newStatus').value = order ? order.status : 'Pending';
  document.getElementById('agentName').value = order?.deliveryAgent?.name || '';
  document.getElementById('agentPhone').value = order?.deliveryAgent?.phone || '';
  document.getElementById('agentLat').value = order?.agentLat || '';
  document.getElementById('agentLng').value = order?.agentLng || '';
  switchModalTab('status');
  document.getElementById('statusModal').classList.add('open');
}

function closeStatusModal() {
  document.getElementById('statusModal').classList.remove('open');
  editingOrderId = null;
}

async function updateStatus() {
  if (!editingOrderId) return;
  const newStatus = document.getElementById('newStatus').value;
  const agentName = document.getElementById('agentName').value.trim();
  const agentPhone = document.getElementById('agentPhone').value.trim();
  const agentLat = document.getElementById('agentLat').value.trim();
  const agentLng = document.getElementById('agentLng').value.trim();

  try {
    const payload = { status: newStatus };
    if (agentName || agentPhone) {
      payload.deliveryAgent = { name: agentName, phone: agentPhone };
    }
    if (agentLat) payload.agentLat = parseFloat(agentLat);
    if (agentLng) payload.agentLng = parseFloat(agentLng);

    await API.authPatch('/orders/' + editingOrderId + '/status', payload);
    // Update local data
    const order = allOrders.find(o => o.id === editingOrderId);
    if (order) {
      order.status = newStatus;
      if (payload.deliveryAgent) order.deliveryAgent = payload.deliveryAgent;
    }

    closeStatusModal();
    // Refresh stats
    const stats = await API.authGet('/stats');
    renderStats(stats);
    renderRecentOrders();
    renderAllOrders();
    renderCustomersFromAPI();
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to update status'));
  }
}

document.getElementById('statusModal').addEventListener('click', function(e) {
  if (e.target === this) closeStatusModal();
});

// ---- SETTINGS & PRICES ----
async function saveSettings() {
  const inputs = document.querySelectorAll('#tab-settings .input-field:not(.small)');
  const keys = ['businessName', 'phone', 'email', 'city', 'freeDeliveryAbove', 'deliveryFee'];
  const settings = {};
  inputs.forEach((inp, i) => { if (keys[i]) settings[keys[i]] = inp.value; });
  try {
    await API.authPut('/settings', settings);
    alert('General settings saved successfully!');
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to save'));
  }
}

async function loadPrices() {
  try {
    const settings = await API.authGet('/settings');
    
    // Load Service Prices
    const services = ['ironing', 'laundry', 'drycleaning'];
    const levels   = ['express', 'sameday', 'nextday'];
    
    services.forEach(s => {
      levels.forEach(l => {
        const val = settings[`price_${s}_${l}`] || PRICES[s][l];
        const input = document.getElementById(`p-${s}-${l}`);
        if (input) input.value = val;
      });
    });

    // Load Garment Multipliers
    const grid = document.getElementById('multipliersGrid');
    if (grid) {
      grid.innerHTML = GARMENT_ITEMS.map(it => {
        const val = settings[`multiplier_${it.id}`] || it.multiplier;
        return `<div class="form-group">
          <label>${it.icon} ${it.name}</label>
          <input type="number" step="0.1" class="input-field small p-mult" data-id="${it.id}" value="${val}">
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load prices', err);
  }
}

async function savePrices() {
  const settings = {};
  
  // Service Prices
  const services = ['ironing', 'laundry', 'drycleaning'];
  const levels   = ['express', 'sameday', 'nextday'];
  services.forEach(s => {
    levels.forEach(l => {
      const val = document.getElementById(`p-${s}-${l}`).value;
      settings[`price_${s}_${l}`] = val;
    });
  });

  // Multipliers
  document.querySelectorAll('.p-mult').forEach(inp => {
    settings[`multiplier_${inp.dataset.id}`] = inp.value;
  });

  try {
    await API.authPut('/settings', settings);
    alert('Pricing and multipliers updated successfully!');
    // Ideally we would trigger a refresh of the global PRICES object 
    // but that lives in main.js. For now, it will update on next page load.
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to save prices'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('ff_token')) {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    initDashboard();
    loadPrices(); // Load prices into settings tab
  }
});

// ---- MODAL TAB SWITCHING ----
function switchModalTab(tab) {
  const statusTab = document.getElementById('modalTabStatus');
  const photosTab = document.getElementById('modalTabPhotos');
  const statusContent = document.getElementById('modalStatusContent');
  const photosContent = document.getElementById('modalPhotosContent');

  if (tab === 'status') {
    statusContent.style.display = 'block';
    photosContent.style.display = 'none';
    statusTab.style.borderBottom = '2px solid #059669';
    statusTab.style.color = '#059669';
    photosTab.style.borderBottom = 'none';
    photosTab.style.color = '#6b7280';
  } else {
    statusContent.style.display = 'none';
    photosContent.style.display = 'block';
    photosTab.style.borderBottom = '2px solid #059669';
    photosTab.style.color = '#059669';
    statusTab.style.borderBottom = 'none';
    statusTab.style.color = '#6b7280';
  }
}

// ---- PHOTO UPLOAD ----
// File preview
['beforePhotos', 'afterPhotos'].forEach(inputId => {
  document.getElementById(inputId)?.addEventListener('change', function() {
    const previewId = inputId === 'beforePhotos' ? 'beforePhotoPreview' : 'afterPhotoPreview';
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    Array.from(this.files).forEach(file => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.style.cssText = 'width:60px; height:60px; object-fit:cover; border-radius:8px; border:2px solid #e5e7eb;';
      preview.appendChild(img);
    });
  });
});

async function uploadPhotos() {
  if (!editingOrderId) return;
  const beforeFiles = document.getElementById('beforePhotos').files;
  const afterFiles  = document.getElementById('afterPhotos').files;

  if (beforeFiles.length === 0 && afterFiles.length === 0) {
    alert('Please select at least one photo to upload.');
    return;
  }

  const formData = new FormData();
  Array.from(beforeFiles).forEach(f => formData.append('before', f));
  Array.from(afterFiles).forEach(f  => formData.append('after', f));

  try {
    const token = API._getToken();
    const res = await fetch(`/api/orders/${editingOrderId}/photos`, {
      method: 'PATCH',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: formData
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Upload failed');
    }
    alert('Photos uploaded successfully!');
    closeStatusModal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ---- SLOT MANAGEMENT ----
async function loadSlots() {
  const date = document.getElementById('slotMgmtDate').value;
  if (!date) return;

  const tbody = document.getElementById('slotsBody');
  tbody.innerHTML = '<tr><td colspan="5" style="color:#6b7280;">Loading...</td></tr>';

  try {
    const res = await API.authGet(`/orders/slot-availability?date=${date}`);
    const slots = res.slots || {};
    const slotNames = ['Morning (7-11am)', 'Afternoon (12-4pm)', 'Evening (5-9pm)'];

    tbody.innerHTML = slotNames.map(name => {
      const data = slots[name] || { capacity: 10, booked: 0, remaining: 10 };
      return `<tr>
        <td><strong>${name}</strong></td>
        <td><input type="number" class="input-field" value="${data.capacity}" min="0" style="width:80px; padding:6px 8px; text-align:center;" id="cap-${name.replace(/[^a-zA-Z]/g,'')}" /></td>
        <td>${data.booked}</td>
        <td><span style="font-weight:600; color:${data.remaining <= 3 ? '#dc2626' : '#059669'}">${data.remaining}</span></td>
        <td><button class="btn-outline small" onclick="updateSlotCapacity('${name}', '${date}')">Save</button></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#dc2626;">Error loading slots</td></tr>';
  }
}

async function updateSlotCapacity(slotName, date) {
  const inputId = 'cap-' + slotName.replace(/[^a-zA-Z]/g, '');
  const capacity = parseInt(document.getElementById(inputId).value);
  if (isNaN(capacity) || capacity < 0) { alert('Enter a valid capacity'); return; }

  try {
    await API.authPatch('/orders/slot-capacity', { date, slot: slotName, capacity });
    alert(`Capacity for ${slotName} updated to ${capacity}`);
    loadSlots();
  } catch (err) {
    alert('Error: ' + (err.error || 'Failed to update capacity'));
  }
}

// ---- SUBSCRIPTIONS ----
async function loadSubscriptions() {
  const tbody = document.getElementById('adminSubsBody');
  if (!tbody) return;
  try {
    const subs = await API.authGet('/users/admin/subscriptions');
    if (subs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:30px;">No subscription purchases yet.</td></tr>';
      return;
    }
    
    tbody.innerHTML = subs.map(s => {
      let badgeColor = s.status === 'Paid' ? '#10b981' : (s.status === 'Pending' ? '#f59e0b' : '#ef4444');
      return `<tr>
        <td><strong>#${s.subId}</strong></td>
        <td>${s.customerName}</td>
        <td>${s.customerPhone}</td>
        <td style="text-transform:capitalize;">${s.plan} Plan</td>
        <td><span class="badge" style="background:${badgeColor};color:white;">${s.status.toUpperCase()}</span></td>
        <td>₹${s.amount}</td>
        <td>${new Date(s.createdAt).toLocaleDateString()}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:red;text-align:center;">Failed to fetch subscriptions.</td></tr>';
  }
}
