// ============================================================
//  main.js  –  shared across all pages (API-connected)
// ============================================================

// ----- NAVBAR scroll & hamburger — now handled by navbar.js -----

// ----- SHARED PRICING DATA (client-side for calculator, same as backend) -----
const PRICES = {
  ironing:     { express: 49,  sameday: 35,  nextday: 25  },
  laundry:     { express: 129, sameday: 99,  nextday: 79  },
  drycleaning: { express: 349, sameday: 249, nextday: 199 }
};

const TIMELINE_LABELS = {
  express: { ironing: '2 hrs', laundry: '4 hrs', drycleaning: '6 hrs'  },
  sameday: { ironing: '6 hrs', laundry: '8 hrs', drycleaning: '12 hrs' },
  nextday: { ironing: '24 hrs', laundry: '24 hrs', drycleaning: '24 hrs' }
};

let GARMENT_ITEMS = [
  { id: 'shirt', name: 'Shirt / T-Shirt', icon: '👔', multiplier: 1.0 },
  { id: 'trouser', name: 'Trousers / Jeans', icon: '👖', multiplier: 1.2 },
  { id: 'shorts', name: 'Shorts / Skirt', icon: '🩳', multiplier: 0.8 },
  { id: 'kurta', name: 'Kurta / Dress', icon: '👗', multiplier: 1.5 },
  { id: 'saree', name: 'Saree', icon: '👘', multiplier: 2.0 },
  { id: 'suit', name: 'Suit (2-Piece)', icon: '🕴️', multiplier: 3.0 },
  { id: 'jacket', name: 'Jacket / Coat', icon: '🧥', multiplier: 2.5 },
  { id: 'bedsheet', name: 'Bedsheet / Cover', icon: '🛏️', multiplier: 1.8 },
  { id: 'curtain', name: 'Curtains (Panel)', icon: '🪟', multiplier: 2.2 },
  { id: 'basics', name: 'Socks / Innerwear', icon: '🧦', multiplier: 0.5 },
  { id: 'other', name: 'Other / Custom', icon: '✨', multiplier: 1.0 }
];

// ----- DYNAMIC PRICING FETCH -----
async function fetchPrices() {
  try {
    const settings = await API.get('/settings');
    if (settings) {
      // Update PRICES
      const services = ['ironing', 'laundry', 'drycleaning'];
      const levels   = ['express', 'sameday', 'nextday'];
      services.forEach(s => {
        levels.forEach(l => {
          const key = `price_${s}_${l}`;
          if (settings[key]) PRICES[s][l] = parseInt(settings[key]);
        });
      });

      // Update GARMENT_ITEMS multipliers
      GARMENT_ITEMS.forEach(it => {
        const key = `multiplier_${it.id}`;
        if (settings[key]) it.multiplier = parseFloat(settings[key]);
      });
    }
  } catch (err) {
    console.warn('Could not fetch dynamic prices, using defaults.');
  }
}

// ----- API Helper -----
const API = {
  _baseUrl: '/api',

  _getToken() {
    return localStorage.getItem('ff_token');
  },

  _setToken(token) {
    localStorage.setItem('ff_token', token);
  },

  _clearToken() {
    localStorage.removeItem('ff_token');
  },

  async _request(method, path, body = null, auth = false) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (auth) {
      const token = this._getToken();
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    }
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this._baseUrl + path, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  },

  // Public
  get(path)         { return this._request('GET', path); },
  post(path, body)  { return this._request('POST', path, body); },

  // Authenticated
  authGet(path)          { return this._request('GET', path, null, true); },
  authPost(path, body)   { return this._request('POST', path, body, true); },
  authPatch(path, body)  { return this._request('PATCH', path, body, true); },
  authPut(path, body)    { return this._request('PUT', path, body, true); },
  authDelete(path)       { return this._request('DELETE', path, null, true); },

  // Auth
  async login(username, password) {
    const data = await this.post('/auth/login', { username, password });
    this._setToken(data.token);
    return data;
  },
  logout() { this._clearToken(); }
};

// ----- FAQ toggle (services page) -----
function toggleFaq(el) {
  const answer = el.nextElementSibling;
  const span   = el.querySelector('span');
  answer.classList.toggle('open');
  span.textContent = answer.classList.contains('open') ? '−' : '+';
}

// ============================================================
// GLOBAL AUTH NAVIGATION LOGIC — Now handled by navbar.js
// toggleNavDropdown(), logoutUser(), avatar population all in navbar.js
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {
  await fetchPrices(); // Get latest price config
});

// PWA Service Worker Registration
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW Registered'))
      .catch(err => console.log('SW Registration failed', err));
  });
}
*/

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwaBanner');
  if (banner) {
    setTimeout(() => banner.classList.add('show'), 3000);
  }
});

const pwaInstallBtn = document.getElementById('pwaInstallBtn');
if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted' && typeof showToast === 'function') {
      showToast('FreshFold installed! 📱', 'success');
    }
    deferredPrompt = null;
    document.getElementById('pwaBanner').classList.remove('show');
  });
}

