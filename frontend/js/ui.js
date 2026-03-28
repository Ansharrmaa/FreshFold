// ============================================================
//  ui.js  –  Shared UI helpers and animations
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Reveal animations on scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

// Modal toggle helper
function toggleModal(id, show = true) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.toggle('open', show);
    }
}

// Global Toast fallback if toast.js is missing
if (typeof showToast === 'undefined') {
    window.showToast = function(msg, type = 'info') {
        console.log(`[Toast ${type}]: ${msg}`);
        alert(msg);
    };
}
