// ============================================================
//  js/auth.js  –  Customer Auth Logic (Register & Login)
// ============================================================

function toggleAuth() {
  document.getElementById('loginBox').classList.toggle('hidden');
  document.getElementById('registerBox').classList.toggle('hidden');
}

// Redirect if already logged in
if (localStorage.getItem('customerToken')) {
  window.location.href = 'index.html';
}

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value;
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
      localStorage.setItem('adminToken', data.token);
      window.location.href = 'admin.html';
    } else {
      localStorage.setItem('customerToken', data.token);
      window.location.href = 'index.html';
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Login failed', 'error');
    else alert(err.message || 'Server error');
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const phone = document.getElementById('regPhone').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const referralCode = document.getElementById('regReferral')?.value || '';
  
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
      localStorage.setItem('customerToken', data.token);
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

