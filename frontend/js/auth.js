// ============================================================
//  js/auth.js  –  Customer Auth Logic (Register, Login, Forgot Password, Google)
// ============================================================

function toggleAuth() {
  document.getElementById('loginBox').classList.toggle('hidden');
  document.getElementById('registerBox').classList.toggle('hidden');
  document.getElementById('forgotBox').classList.add('hidden');
}

function showForgotPassword() {
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('registerBox').classList.add('hidden');
  document.getElementById('forgotBox').classList.remove('hidden');
}

function showLoginFromForgot() {
  document.getElementById('forgotBox').classList.add('hidden');
  document.getElementById('loginBox').classList.remove('hidden');
}

let isPhoneVerified = false;

function sendOtp() {
  const phone = document.getElementById('regPhone').value.replace(/\D/g, '');
  if (phone.length < 10) {
    if (typeof showToast === 'function') return showToast('Enter a valid 10-digit phone number first', 'warning');
    else return alert('Enter a valid 10-digit phone number first');
  }
  document.getElementById('otpGroup').classList.remove('hidden');
  if (typeof showToast === 'function') showToast('OTP sent to ' + phone + ' (Use 123456)', 'info');
  else alert('OTP sent! Use 123456');
}

function verifyOtp() {
  const otp = document.getElementById('regOtp').value;
  if (otp === '123456') {
    isPhoneVerified = true;
    document.getElementById('regOtp').parentElement.classList.add('hidden');
    document.getElementById('verifyOtpBtn').classList.add('hidden');
    document.getElementById('otpSuccessMsg').classList.remove('hidden');
    document.getElementById('regPhone').setAttribute('readonly', true);
    document.getElementById('sendOtpBtn').classList.add('hidden');
    
    const regBtn = document.getElementById('registerBtn');
    regBtn.removeAttribute('disabled');
    regBtn.style.opacity = '1';
    regBtn.style.cursor = 'pointer';
    
    if (typeof showToast === 'function') showToast('Phone number verified successfully', 'success');
  } else {
    if (typeof showToast === 'function') showToast('Invalid OTP. Please use 123456.', 'error');
    else alert('Invalid OTP');
  }
}

// ============================================================
//  GOOGLE LOGIN
// ============================================================
function googleLogin() {
  // Try Google Identity Services (GIS) first
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.prompt(); // Shows the Google One Tap or popup
  } else {
    if (typeof showToast === 'function') {
      showToast('Google Sign-In is loading... Please try again in a moment.', 'info');
    }
    // Retry after a short delay
    setTimeout(() => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.prompt();
      } else {
        if (typeof showToast === 'function') {
          showToast('Google Sign-In requires a Google Client ID. See .env setup guide.', 'warning');
        }
      }
    }, 1500);
  }
}

// Handle Google credential response
async function handleGoogleCredential(response) {
  try {
    const res = await fetch('/api/users/google-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('ff_token', data.token);
      if (typeof showToast === 'function') showToast('Logged in with Google!', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Google login failed', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Google login error. Please try again.', 'error');
  }
}

// Initialize Google Identity Services when loaded
function initGoogleSignIn() {
  const clientId = ''; // Will be set from meta tag or config
  const metaTag = document.querySelector('meta[name="google-client-id"]');
  const gClientId = metaTag ? metaTag.content : clientId;

  if (gClientId && typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: gClientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
  }
}

// Try to init Google after the GIS script loads
window.addEventListener('load', () => {
  setTimeout(initGoogleSignIn, 500);
});

// ============================================================
//  REDIRECT IF ALREADY LOGGED IN
// ============================================================
if (localStorage.getItem('ff_token')) {
  window.location.href = 'index.html';
}

// Handle login.html#register deep link
if (window.location.hash === '#register') {
  window.addEventListener('DOMContentLoaded', () => {
    const loginBox = document.getElementById('loginBox');
    const registerBox = document.getElementById('registerBox');
    if (loginBox && registerBox) {
      loginBox.classList.add('hidden');
      registerBox.classList.remove('hidden');
    }
  });
}

// ============================================================
//  LOGIN FORM
// ============================================================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    let endpoint = '/api/users/login';
    let payload = { phone, password };
    let isAdmin = false;

    // Check if the input is meant for the Admin portal
    if (phone.toLowerCase() === 'admin') {
      endpoint = '/api/auth/login';
      payload = { username: phone, password };
      isAdmin = true;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    if (isAdmin) {
      localStorage.setItem('ff_token', data.token);
      window.location.href = 'admin.html';
    } else {
      localStorage.setItem('ff_token', data.token);
      window.location.href = 'index.html';
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Login failed', 'error');
    else alert(err.message || 'Server error');
  }
});

// ============================================================
//  REGISTER FORM
// ============================================================
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const phone = document.getElementById('regPhone').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const referralCode = document.getElementById('regReferral')?.value || '';
  
  if (!isPhoneVerified) {
    if (typeof showToast === 'function') return showToast('Please verify your phone number with OTP first', 'warning');
    else return alert('Please verify your phone number with OTP first');
  }

  if (phone.replace(/\D/g, '').length < 10) {
    if (typeof showToast === 'function') return showToast('Enter a valid 10-digit phone number', 'warning');
    else return alert('Enter a valid 10-digit phone number');
  }

  try {
    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, referralCode: referralCode || undefined })
    });
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('ff_token', data.token);
      window.location.href = 'index.html';
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Registration failed', 'error');
      else alert(data.error || 'Registration failed');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Server error. Please try again.', 'error');
    else alert('Server error. Please try again.');
  }
});

// ============================================================
//  FORGOT PASSWORD FORM
// ============================================================
document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  const btn = document.getElementById('forgotBtn');
  const successMsg = document.getElementById('forgotSuccessMsg');

  if (!email) {
    if (typeof showToast === 'function') showToast('Please enter your email or phone number', 'warning');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/users/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    successMsg.textContent = '✅ ' + (data.message || 'If an account exists, a reset link has been sent to your email.');
    successMsg.style.display = 'block';
    
    if (typeof showToast === 'function') showToast('Check your email for the reset link!', 'success');

    // Hide form after success
    document.getElementById('forgotForm').style.display = 'none';
  } catch (err) {
    if (typeof showToast === 'function') showToast('Server error. Please try again.', 'error');
  }

  btn.textContent = 'Send Reset Link';
  btn.disabled = false;
});
