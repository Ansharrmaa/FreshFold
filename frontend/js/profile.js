// ============================================================
//  js/profile.js  –  Customer Dashboard with Referral, Rating & Reorder
// ============================================================

const token = localStorage.getItem('ff_token');
if (!token) {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('ff_token');
  window.location.href = 'login.html';
}

let userReferralCode = '';
let lastSubTxnId = null;

let cashfree = null;
try {
  if (typeof Cashfree !== 'undefined') {
    cashfree = Cashfree({ mode: 'sandbox' });
  }
} catch (e) {
  console.log('Cashfree SDK not loaded');
}

async function fetchProfile() {
  try {
    const res = await fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Session Expired');
    const user = await res.json();
    
    const firstName = user.name.split(' ')[0];
    document.getElementById('welcomeTitle').textContent = `Welcome back, ${firstName} 👋`;
    document.getElementById('welcomeSubtitle').innerHTML = `<i class="fa-solid fa-phone"></i> ${user.phone} &nbsp; | &nbsp; <i class="fa-regular fa-envelope"></i> ${user.email || 'No email saved'}`;
    
    // Wallet Balance
    if (document.getElementById('statWallet')) {
      document.getElementById('statWallet').textContent = `₹${user.walletBalance || 0}`;
    }

    // Referral Code
    userReferralCode = user.referralCode || '';
    if (document.getElementById('referralCodeBox')) {
      document.getElementById('referralCodeBox').textContent = userReferralCode || 'N/A';
    }

    // Profile Photo Avatar
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
      if (user.profilePhoto) {
        avatarEl.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
      } else {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        avatarEl.textContent = initials;
      }
    }

    // Active Subscription Plan
    if (user.activePlan && user.activePlan !== 'none') {
      const badge = document.getElementById('proBadge');
      if (badge) badge.style.display = 'inline-block';
      
      const container = document.getElementById('activePlanContainer');
      const upgradeSection = document.getElementById('upgradePlanSection');
      if (container) {
        container.style.display = 'block';
        document.getElementById('activePlanName').textContent = user.activePlan.charAt(0).toUpperCase() + user.activePlan.slice(1) + ' Plan';
        
        if (user.planExpiry) {
          const d = new Date(user.planExpiry);
          document.getElementById('activePlanExpiry').textContent = d.toLocaleDateString();
        }
        
        if (user.lastSubscriptionTxn) {
          lastSubTxnId = user.lastSubscriptionTxn;
        } else {
          document.getElementById('downloadSubInvoiceBtn').style.display = 'none';
        }
      }
      
      // Optionally adjust Upgrade Plan wording
      if (upgradeSection) {
        upgradeSection.querySelector('.section-title').innerHTML = 'Change Your Plan 🚀';
      }
    }

  } catch (err) {
    logout();
  }
}

// ---- REFERRAL LOGIC ----
function copyReferral() {
  if (!userReferralCode) return;
  navigator.clipboard.writeText(userReferralCode).then(() => {
    showToast('Referral code copied! 📋', 'success');
  });
}

function shareReferral() {
  if (!userReferralCode) return;
  const msg = `Hey! Use my referral code *${userReferralCode}* to sign up on FreshFold and we both get ₹50 wallet credits! 🎁\nhttps://freshfold.in`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// ---- PROFILE PHOTO UPLOAD ----
async function uploadProfilePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    return showToast('Photo too large. Max 2MB.', 'warning');
  }

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const res = await fetch('/api/users/photo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      showToast('Profile photo updated! 📸', 'success');
      // Update profile avatar
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) avatarEl.innerHTML = `<img src="${data.profilePhoto}">`;
      // Update navbar avatar if present
      const navAvatar = document.getElementById('navAvatar');
      if (navAvatar) navAvatar.innerHTML = `<img src="${data.profilePhoto}">`;
    } else {
      const data = await res.json();
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast('Error uploading photo', 'error');
  }
}

// ---- ANALYTICS & LOYALTY ----
async function fetchAnalytics() {
  try {
    const res = await fetch('/api/users/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const stats = await res.json();

    // Loyalty points
    const loyaltyEl = document.getElementById('statLoyalty');
    if (loyaltyEl) loyaltyEl.textContent = stats.loyaltyPoints || 0;

    // Spending chart
    const chart = document.getElementById('spendChart');
    if (chart && stats.monthlySpend) {
      const values = Object.values(stats.monthlySpend);
      const max = Math.max(...values, 1);
      chart.innerHTML = Object.entries(stats.monthlySpend).map(([month, amount]) => {
        const pct = Math.max(5, (amount / max) * 100);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:11px;font-weight:600;color:#1a6b4a;">₹${amount}</span>
          <div style="width:100%;height:${pct}%;background:linear-gradient(to top,#1a6b4a,#2ecc71);border-radius:8px 8px 0 0;min-height:4px;transition:height 0.5s;"></div>
          <span style="font-size:10px;color:#6b7280;">${month}</span>
        </div>`;
      }).join('');
    }

    // Summary cards
    if (document.getElementById('analyticsFavService')) document.getElementById('analyticsFavService').textContent = stats.favoriteService;
    if (document.getElementById('analyticsSaved')) document.getElementById('analyticsSaved').textContent = `₹${stats.moneySaved}`;
    if (document.getElementById('analyticsItems')) document.getElementById('analyticsItems').textContent = stats.totalItems;
    if (document.getElementById('analyticsPtsEarned')) document.getElementById('analyticsPtsEarned').textContent = stats.totalPointsEarned;
    
    // Top stat cards
    if (document.getElementById('statTotalOrders')) document.getElementById('statTotalOrders').textContent = stats.totalOrders || 0;
    if (document.getElementById('statActiveOrders')) document.getElementById('statActiveOrders').textContent = stats.activeOrders || 0;
    if (document.getElementById('statTotalSpent')) document.getElementById('statTotalSpent').textContent = stats.totalSpent || 0;
  } catch (e) {}
}

function downloadInvoice(orderId) {
  window.open(`/api/invoices/${orderId}`, '_blank');
}

// ---- WALLET LOGIC ----
function openWalletModal() {
  document.getElementById('walletModal').classList.add('open');
}
function closeWalletModal() {
  document.getElementById('walletModal').classList.remove('open');
  document.getElementById('rechargeAmount').value = '';
}

async function rechargeWallet() {
  const amt = document.getElementById('rechargeAmount').value;
  if (!amt || amt < 100) return showToast('Minimum recharge amount is ₹100', 'warning');

  try {
    const res = await fetch('/api/users/wallet/recharge', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: amt })
    });
    
    if (res.ok) {
      showToast('Wallet recharged successfully! 🎉', 'success');
      closeWalletModal();
      fetchProfile();
    } else {
      const data = await res.json();
      showToast(data.error || 'Recharge failed', 'error');
    }
  } catch (err) {
    showToast('Server error recharging wallet', 'error');
  }
}

// ---- ORDER HISTORY WITH PAGINATION & SEARCH ----
let currentOrderPage = 1;
let currentOrderSearch = '';

async function fetchOrders(page = 1, append = false) {
  const container = document.getElementById('ordersList');
  const loadMoreBtn = document.getElementById('loadMoreSection');
  
  if (!append) {
    container.innerHTML = '<p style="color: #6b7280;">Loading orders...</p>';
    currentOrderPage = 1;
  }

  try {
    const res = await fetch('/api/users/my-orders?page=' + page + '&limit=5&search=' + encodeURIComponent(currentOrderSearch), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const orders = data.orders || [];

    if (!append) container.innerHTML = ''; // Clear loading text

    if (orders.length === 0 && !append) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-basket-shopping"></i>
          <h3>No orders found</h3>
          <p>We couldn't find any orders matching your criteria.</p>
          <a href="booking.html" class="btn-primary" style="margin-top:15px; display:inline-block;">Book Now</a>
        </div>
      `;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      fetchAnalytics();
      return;
    }

    const html = orders.map(o => {
      let statusGroup = 'Pending';
      if (['In Progress', 'Out for Delivery'].includes(o.status)) statusGroup = 'Progress';
      if (o.status === 'Delivered') statusGroup = 'Delivered';

      const iconMap = { 'Ironing': 'fa-shirt', 'Laundry': 'fa-jug-detergent', 'Dry Cleaning': 'fa-user-tie' };
      const icon = iconMap[o.service] || 'fa-box';

      // Rating stars for delivered orders
      let ratingHtml = '';
      if (o.status === 'Delivered') {
        if (o.rating) {
          ratingHtml = `<div class="star-rating" style="pointer-events:none;">`;
          for (let i = 1; i <= 5; i++) {
            ratingHtml += `<i class="fa-solid fa-star ${i <= o.rating ? 'active' : ''}"></i>`;
          }
          ratingHtml += `</div>`;
        } else {
          ratingHtml = `<div class="star-rating" id="stars-${o.orderId}">`;
          for (let i = 1; i <= 5; i++) {
            ratingHtml += `<i class="fa-solid fa-star" data-val="${i}" onclick="rateOrder('${o.orderId}', ${i})" onmouseover="hoverStars('${o.orderId}', ${i})" onmouseout="resetStars('${o.orderId}')"></i>`;
          }
          ratingHtml += `</div>`;
        }
      }

      // Reorder + Invoice buttons for delivered orders
      const reorderBtn = o.status === 'Delivered' ? 
        `<button onclick="reorder('${o.service}', ${o.qty}, '${o.timeline}')" class="btn-track" style="background:#ecfdf5; color:#059669; margin-top:8px;"><i class="fa-solid fa-rotate-right"></i> Reorder</button>` : '';
      const invoiceBtn = o.status === 'Delivered' ?
        `<button onclick="downloadInvoice('${o.orderId}')" class="btn-track" style="background:#ede9fe; color:#7c3aed; margin-top:8px;"><i class="fa-solid fa-file-pdf"></i> Invoice</button>` : '';

      return `
        <div class="order-card status-${statusGroup}">
          <div class="order-info">
            <div class="order-id">
              <span class="badge badge-${statusGroup}">${o.status}</span>
              #${o.orderId}
            </div>
            <div class="order-meta">
              <span><i class="fa-solid ${icon}"></i> ${o.service} (${o.qty} ${o.unit})</span>
              <span><i class="fa-regular fa-calendar"></i> Placed: ${new Date(o.createdAt).toLocaleDateString()}</span>
              <span><i class="fa-solid fa-bolt"></i> Speed: ${o.timeline}</span>
            </div>
            ${ratingHtml}
          </div>
          <div class="order-actions">
            <div class="order-price">₹${o.total}</div>
            <a href="track.html?id=${o.orderId}" class="btn-track"><i class="fa-solid fa-location-crosshairs"></i> Track</a>
            ${reorderBtn}
            ${invoiceBtn}
          </div>
        </div>
      `;
    }).join('');

    if (append) {
      container.insertAdjacentHTML('beforeend', html);
    } else {
      container.innerHTML = html;
    }

    currentOrderPage = data.currentPage;
    if (loadMoreBtn) {
      if (data.currentPage < data.totalPages) {
        loadMoreBtn.style.display = 'block';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }

  } catch (err) {
    container.innerHTML = '<p style="color:red;">Error loading orders.</p>';
  }

  // Load analytics after orders
  fetchAnalytics();
}

window.handleOrderSearch = function() {
  const searchInput = document.getElementById('orderSearch');
  if (searchInput) {
    currentOrderSearch = searchInput.value.trim();
    fetchOrders(1, false);
  }
};

window.loadMoreOrders = function() {
  fetchOrders(currentOrderPage + 1, true);
};

// ---- STAR RATING HELPERS ----
function hoverStars(orderId, val) {
  const container = document.getElementById(`stars-${orderId}`);
  if (!container) return;
  container.querySelectorAll('i').forEach((star, i) => {
    star.classList.toggle('active', i < val);
  });
}

function resetStars(orderId) {
  const container = document.getElementById(`stars-${orderId}`);
  if (!container) return;
  container.querySelectorAll('i').forEach(star => star.classList.remove('active'));
}

async function rateOrder(orderId, rating) {
  try {
    const res = await fetch(`/api/orders/${orderId}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    });
    if (res.ok) {
      showToast(`Thanks for rating! ⭐ ${rating}/5`, 'success');
      fetchOrders(); // re-render
    } else {
      const data = await res.json();
      showToast(data.error || 'Rating failed', 'error');
    }
  } catch (err) {
    showToast('Error submitting rating', 'error');
  }
}

// ---- ONE-TAP REORDER ----
function reorder(service, qty, timeline) {
  const svcMap = { 'Ironing': 'ironing', 'Laundry': 'laundry', 'Dry Cleaning': 'drycleaning' };
  const tlMap = { 'Express': 'express', 'Same Day': 'sameday', 'Next Day': 'nextday' };
  
  sessionStorage.setItem('reorderData', JSON.stringify({
    service: svcMap[service] || 'ironing',
    qty: qty,
    timeline: tlMap[timeline] || 'sameday'
  }));
  
  showToast('Redirecting to booking with your preferences...', 'info');
  setTimeout(() => window.location.href = 'booking.html', 800);
}

// ---- ADDRESS BOOK LOGIC ----
function openAddressModal() {
  document.getElementById('addressModal').classList.add('open');
}

function closeAddressModal() {
  document.getElementById('addressModal').classList.remove('open');
  ['addrLabel', 'addrText', 'addrPin'].forEach(id => document.getElementById(id).value = '');
}

async function fetchAddresses() {
  const container = document.getElementById('addressList');
  try {
    const res = await fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const user = await res.json();
    const addresses = user.addresses || [];

    if (addresses.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; font-size: 0.95rem;">No addresses saved yet.</p>';
      return;
    }

    container.innerHTML = addresses.map(a => `
      <div class="address-card">
        <span class="address-label">${a.label || 'Home'}</span>
        <div class="address-text">
          ${a.address}<br>
          <span class="address-pin">PIN: ${a.pincode || 'N/A'}</span>
        </div>
        <div class="address-actions">
          <button class="btn-delete-addr" onclick="deleteAddress('${a._id}')">
            <i class="fa-solid fa-trash-can"></i> Remove
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p style="color:red;">Error loading addresses.</p>';
  }
}

async function saveAddress() {
  const label = document.getElementById('addrLabel').value;
  const address = document.getElementById('addrText').value;
  const pincode = document.getElementById('addrPin').value;

  if (!address) return showToast('Please enter address details', 'warning');

  try {
    const res = await fetch('/api/users/addresses', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ label, address, pincode })
    });
    
    if (res.ok) {
      showToast('Address saved! 📍', 'success');
      closeAddressModal();
      fetchAddresses();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to save address', 'error');
    }
  } catch (err) {
    showToast('Server error saving address', 'error');
  }
}

async function deleteAddress(id) {
  if (!confirm('Are you sure you want to remove this address?')) return;
  try {
    const res = await fetch(`/api/users/addresses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showToast('Address removed', 'info');
      fetchAddresses();
    }
  } catch (err) {
    showToast('Error deleting address', 'error');
  }
}

// ---- SUBSCRIPTION LOGIC ----
async function buySubscription(plan) {
  if (!cashfree) return showToast('Payment system unavailable. Please disable adblock.', 'error');
  
  showToast('Starting secure payment...', 'info');
  
  try {
    const res = await fetch('/api/payments/subscribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to initialize subscription');
    }
    
    const data = await res.json();
    
    // Open Cashfree Checkout Modal
    cashfree.checkout({
      paymentSessionId: data.payment_session_id
    }).then(function(result) {
      if (result.error) {
        showToast(result.error.message || 'Payment cancelled or failed', 'error');
      } else {
        // Payment successful on gateway; verify backend
        verifySubscriptionPayment(data.order_id);
      }
    });

  } catch (err) {
    showToast(err.message || 'Error occurred during payment setup', 'error');
  }
}

async function verifySubscriptionPayment(order_id) {
  showToast('Verifying payment...', 'info');
  try {
    const res = await fetch('/api/payments/verify-subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ order_id })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Subscription to ${data.plan} activated! 🎉`, 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(data.error || data.status || 'Verification failed', 'error');
    }
  } catch (err) {
    showToast('Failed to verify payment', 'error');
  }
}

function downloadSubscriptionInvoice() {
  if (!lastSubTxnId) return showToast('Invoice not available', 'error');
  window.open(`/api/invoices/subscription/${lastSubTxnId}`, '_blank');
}

// ---- SUBSCRIPTION HISTORY ----
async function fetchSubscriptions() {
  const container = document.getElementById('subsList');
  if (!container) return;
  try {
    const res = await fetch('/api/users/my-subscriptions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const subs = await res.json();
    
    if (subs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <i class="fa-solid fa-crown" style="font-size: 2.5rem; color: #d1d5db; margin-bottom: 15px;"></i>
          <h3 style="font-family: var(--font-heading); color: #1a1a2e; margin:0 0 5px 0;">No subscriptions</h3>
          <p style="margin:0;">Upgrade your plan below for recurring benefits!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subs.map(s => {
      let icon = 'fa-star';
      if (s.plan === 'starter') icon = 'fa-paper-plane';
      if (s.plan === 'pro') icon = 'fa-bolt';
      if (s.plan === 'family') icon = 'fa-users';

      let bdrColor = s.status === 'Paid' ? '#10b981' : (s.status === 'Pending' ? '#f59e0b' : '#ef4444');
      
      return `
        <div class="order-card" style="border-left-color: ${bdrColor};">
          <div class="order-info">
            <div class="order-id">
              <span class="badge" style="background: ${bdrColor}; color: white;">${s.status.toUpperCase()}</span>
              #${s.subId}
            </div>
            <div class="order-meta">
              <span><i class="fa-solid ${icon}"></i> ${s.plan.toUpperCase()} Plan</span>
              <span><i class="fa-regular fa-calendar"></i> Purchased: ${new Date(s.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div class="order-actions">
            <div class="order-price">₹${s.amount}</div>
            <button onclick="window.open('/api/invoices/subscription/${s.subId}', '_blank')" class="btn-track" style="background:#ede9fe; color:#7c3aed; margin-top:8px;"><i class="fa-solid fa-file-pdf"></i> Invoice</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = '<p style="color:red;">Error loading subscriptions.</p>';
  }
}

// ---- INIT ----
fetchProfile();
fetchOrders();
fetchSubscriptions();
fetchAddresses();

// ---- CASHFREE REDIRECT VERIFICATION ----
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const cfSubId = urlParams.get('cf_sub_id');
  if (cfSubId) {
    if (typeof showToast !== 'undefined') showToast('Verifying your subscription securely...', 'info');
    window.history.replaceState({}, document.title, window.location.pathname);
    verifySubscriptionPayment(cfSubId);
  }
});
