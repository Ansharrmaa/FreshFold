// ============================================================
//  toast.js  –  Global Toast Notification System
// ============================================================

(function() {
  // Create container on load
  const container = document.createElement('div');
  container.id = 'toastContainer';
  document.body.appendChild(container);

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'success' | 'error' | 'info' | 'warning'
   * @param {number} duration - Auto-dismiss in ms (default 3500)
   */
  window.showToast = function(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      info:    'fa-circle-info',
      warning: 'fa-triangle-exclamation'
    };

    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info}"></i>
      <span>${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Trigger reflow for animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  };
})();
