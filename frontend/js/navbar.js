// ============================================================
//  js/navbar.js  –  Dynamic Navbar (Guest vs Authenticated)
// ============================================================

(function () {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  function isActive(page) {
    return currentPage === page ? 'active' : '';
  }

  // Guest Navbar: Logo + Login + Create Account
  function guestNavbarHTML() {
    return `
    <nav class="navbar" id="navbar">
      <div class="nav-container" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:nowrap; width:100%; white-space:nowrap;">
        <a href="index.html" class="logo" style="flex-shrink:0;">
          <img src="img/logo.png" alt="FreshFold" class="logo-img" style="width:36px; height:36px; min-width:36px; object-fit:contain; border-radius:10px;">
          FreshFold
        </a>
        <ul class="nav-links">
          <li><a href="index.html" class="${isActive('index.html')}">Home</a></li>
        </ul>
        <div class="nav-right" style="display:flex; align-items:center; gap:12px; flex-wrap:nowrap; flex-shrink:0;">
          <button class="theme-toggle" onclick="toggleTheme()" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--text); display:flex; align-items:center;"><i class="fa-solid fa-moon"></i></button>
          <a href="login.html" class="btn-outline nav-auth-btn" id="navLoginBtn" style="padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">Login</a>
          <a href="login.html#register" class="btn-primary nav-auth-btn" id="navRegisterBtn" style="padding: 8px 20px; border-radius: 50px; font-size: 14px;">Create Account</a>
          <button class="hamburger" id="hamburger"><i class="fas fa-bars"></i></button>
        </div>
      </div>
      <div class="mobile-menu" id="mobileMenu">
        <a href="index.html">Home</a>
        <a href="login.html">Login</a>
        <a href="login.html#register">Create Account</a>
      </div>
    </nav>`;
  }

  // Authenticated Navbar: Full features
  function authNavbarHTML() {
    return `
    <nav class="navbar" id="navbar">
      <div class="nav-container" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:nowrap; width:100%; white-space:nowrap;">
        <a href="index.html" class="logo" style="flex-shrink:0;">
          <img src="img/logo.png" alt="FreshFold" class="logo-img" style="width:36px; height:36px; min-width:36px; object-fit:contain; border-radius:10px;">
          FreshFold
        </a>
        <ul class="nav-links">
          <li><a href="index.html" class="${isActive('index.html')}">Home</a></li>
          <li><a href="services.html" class="${isActive('services.html')}">Services</a></li>
          <li><a href="booking.html" class="${isActive('booking.html')}">Book Now</a></li>
          <li><a href="track.html" class="${isActive('track.html')}">Track Order</a></li>
        </ul>
        <div class="nav-right" style="display:flex; align-items:center; gap:16px; flex-wrap:nowrap; flex-shrink:0;">
          <button class="theme-toggle" onclick="toggleTheme()" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--text); display:flex; align-items:center;"><i class="fa-solid fa-moon"></i></button>
          <button id="langToggle" onclick="toggleLanguage()" style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:50px; padding:6px 14px; font-size:13px; font-weight:700; cursor:pointer; color:#166534; display:flex; align-items:center; justify-content:center; min-width:44px; height:36px;">हिं</button>
          <a href="booking.html" class="btn-primary nav-cta" data-i18n="schedulePkp">Schedule Pickup</a>
          <div class="nav-avatar-wrap" id="navAvatarWrap" style="display:block;">
            <div class="nav-avatar" id="navAvatar" onclick="toggleNavDropdown()"></div>
            <div class="nav-dropdown" id="navDropdown">
              <div class="nav-dropdown-header">
                <strong id="navUserName">User</strong>
                <span id="navUserPhone">Phone</span>
              </div>
              <a href="profile.html"><i class="fa-regular fa-user"></i> My Profile</a>
              <a href="profile.html"><i class="fa-solid fa-boxes-stacked"></i> My Orders</a>
              <a href="profile.html"><i class="fa-solid fa-wallet"></i> Wallet</a>
              <div class="divider"></div>
              <button class="logout-item" onclick="logoutUser()"><i class="fa-solid fa-right-from-bracket"></i> Log Out</button>
            </div>
          </div>
          <button class="hamburger" id="hamburger"><i class="fas fa-bars"></i></button>
        </div>
      </div>
      <div class="mobile-menu" id="mobileMenu">
        <a href="index.html">Home</a>
        <a href="services.html">Services</a>
        <a href="booking.html">Book Now</a>
        <a href="track.html">Track Order</a>
      </div>
    </nav>`;
  }

  // Populate user info into avatar + dropdown
  async function populateUserInfo() {
    const token = localStorage.getItem('ff_token');
    if (!token) return;

    const avatar = document.getElementById('navAvatar');
    const nameEl = document.getElementById('navUserName');
    const phoneEl = document.getElementById('navUserPhone');

    try {
      const resp = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const user = await resp.json();
        if (avatar) {
          if (user.profilePhoto) {
            avatar.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
          } else {
            const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            avatar.textContent = initials;
          }
        }
        if (nameEl) nameEl.textContent = user.name;
        if (phoneEl) phoneEl.textContent = user.phone;
      } else {
        // Token invalid — revert to guest
        localStorage.removeItem('ff_token');
        renderNavbar();
      }
    } catch (e) {
      console.warn('Navbar: Could not fetch user info.');
    }
  }

  // Attach event listeners
  function attachNavEvents() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');

    // Scroll effect
    window.addEventListener('scroll', () => {
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
    });

    // Hamburger toggle
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
    }
  }

  // Main render function
  function renderNavbar() {
    const root = document.getElementById('navbar-root');
    if (!root) return;

    const token = localStorage.getItem('ff_token');

    if (token) {
      root.innerHTML = authNavbarHTML();
      populateUserInfo();
    } else {
      root.innerHTML = guestNavbarHTML();
    }

    attachNavEvents();
  }

  // Global toggle for nav dropdown (used in onclick)
  window.toggleNavDropdown = function () {
    const dd = document.getElementById('navDropdown');
    if (dd) dd.classList.toggle('open');
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('navAvatarWrap');
    const dd = document.getElementById('navDropdown');
    if (wrap && dd && !wrap.contains(e.target)) {
      dd.classList.remove('open');
    }
  });

  // Global logout function
  window.logoutUser = function () {
    localStorage.removeItem('ff_token');
    window.location.href = 'login.html';
  };

  // Theme Toggle
  window.toggleTheme = function() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon();
  };

  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle i').forEach(icon => {
      icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      icon.style.color = isDark ? '#f0a500' : 'var(--text)';
    });
  }

  // Render on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderNavbar();
      updateThemeIcon();
    });
  } else {
    renderNavbar();
    updateThemeIcon();
  }

  // Handle login.html#register deep link
  if (currentPage === 'login.html' && window.location.hash === '#register') {
    window.addEventListener('DOMContentLoaded', () => {
      const loginBox = document.getElementById('loginBox');
      const registerBox = document.getElementById('registerBox');
      if (loginBox && registerBox) {
        loginBox.classList.add('hidden');
        registerBox.classList.remove('hidden');
      }
    });
  }
})();
