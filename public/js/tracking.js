// ============================================================
//  tracking.js  –  track.html order tracker (API-connected)
// ============================================================

function trackOrder() {
  const id = document.getElementById('trackInput').value.trim().toUpperCase();
  if (!id) { alert('Please enter an Order ID'); return; }
  findAndDisplayOrder(id);
}

function loadDemo(id) {
  document.getElementById('trackInput').value = id;
  findAndDisplayOrder(id);
  document.querySelector('.track-section').scrollIntoView({ behavior: 'smooth' });
}

async function findAndDisplayOrder(id) {
  document.getElementById('trackResult').style.display   = 'none';
  document.getElementById('trackNotFound').style.display = 'none';

  try {
    const order = await API.get('/orders/' + id);
    renderOrder(order);
    document.getElementById('trackResult').style.display = 'block';
    document.getElementById('trackResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    document.getElementById('trackNotFound').style.display = 'block';
  }
}

const statusClassMap = {
  'pending': 'pending', 'picked-up': 'picked-up', 'in-progress': 'in-progress',
  'out-for-delivery': 'out-for-delivery', 'delivered': 'delivered'
};

function renderOrder(order) {
  document.getElementById('t-orderId').textContent   = order.id;
  document.getElementById('t-service').textContent   = order.service + ' · ' + order.qty + ' ' + order.unit;
  document.getElementById('t-customer').textContent  = order.customer;
  document.getElementById('t-amount').textContent    = '₹' + order.total;
  document.getElementById('t-delivery').textContent  = order.delivery;
  document.getElementById('t-agent').textContent     = order.agent;
  if (document.getElementById('t-agentInitials'))
    document.getElementById('t-agentInitials').textContent = order.agentInitials || 'AK';

  const statusEl = document.getElementById('t-status');
  statusEl.textContent = order.status;
  statusEl.className   = 'oib-val status-badge ' + (statusClassMap[order.statusKey] || '');

  document.getElementById('progressTimeline').innerHTML = order.steps.map(s =>
    '<div class="pt-step' + (s.done ? ' done' : '') + (s.active ? ' active' : '') + '">' +
    '<div class="pt-icon">' + (s.done || s.active ? s.icon : '○') + '</div>' +
    '<div class="pt-label">' + s.label + '</div>' +
    '<div class="pt-time">'  + s.time  + '</div></div>'
  ).join('');

  const agentBox = document.getElementById('t-agentBox');
  if (agentBox) agentBox.style.display = order.statusKey === 'delivered' ? 'none' : 'flex';

  // --- Agent Live Location Map ---
  const mapSection = document.getElementById('agentMapSection');
  if (mapSection) {
    if (order.agentLat && order.agentLng) {
      const mapFrame = document.getElementById('agentMapFrame');
      mapFrame.src = `https://maps.google.com/maps?q=${order.agentLat},${order.agentLng}&z=15&output=embed`;
      mapSection.style.display = 'block';
    } else {
      mapSection.style.display = 'none';
    }
  }

  // --- Before / After Photo Gallery ---
  const photoSection = document.getElementById('photoGallerySection');
  if (photoSection) {
    const beforeContainer = document.getElementById('photosBefore');
    const afterContainer  = document.getElementById('photosAfter');
    const hasPhotos = order.photos && (
      (order.photos.before && order.photos.before.length > 0) ||
      (order.photos.after && order.photos.after.length > 0)
    );

    if (hasPhotos) {
      photoSection.style.display = 'block';
      beforeContainer.innerHTML = (order.photos.before || []).map(url =>
        `<img src="${url}" alt="Before" style="width:100%; border-radius:8px; object-fit:cover; aspect-ratio:1; cursor:pointer;" onclick="window.open('${url}','_blank')" />`
      ).join('') || '<p style="font-size:0.8rem; color:#9ca3af;">No photos yet</p>';
      afterContainer.innerHTML = (order.photos.after || []).map(url =>
        `<img src="${url}" alt="After" style="width:100%; border-radius:8px; object-fit:cover; aspect-ratio:1; cursor:pointer;" onclick="window.open('${url}','_blank')" />`
      ).join('') || '<p style="font-size:0.8rem; color:#9ca3af;">No photos yet</p>';
    } else {
      photoSection.style.display = 'none';
    }
  }

  // --- Invoice Download ---
  const invoiceBtn = document.getElementById('invoiceDownloadBtn');
  if (invoiceBtn) {
    invoiceBtn.href = `/api/invoices/${order.id}`;
  }
}

// auto-load from URL ?id=
window.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    document.getElementById('trackInput').value = id;
    findAndDisplayOrder(id.toUpperCase());
  }
});

document.getElementById('trackInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') trackOrder();
});
