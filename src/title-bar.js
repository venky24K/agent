const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  // Title bar buttons
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');
  const layoutBtn = document.getElementById('layout-btn');
  const layoutDropdown = document.getElementById('layout-dropdown');
  
  // Window control buttons
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }

  // Toggle layout dropdown
  if (layoutBtn && layoutDropdown) {
    layoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layoutDropdown.classList.toggle('visible');
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (layoutDropdown && layoutDropdown.classList.contains('visible') && 
        !e.target.closest('.layout-dropdown') && e.target !== layoutBtn) {
      layoutDropdown.classList.remove('visible');
    }
  });

  // Handle layout toggles
  const panelToggles = document.querySelectorAll('.panel-toggle');
  panelToggles.forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const panel = e.target.dataset.panel;
      const isVisible = e.target.checked;
      // Dispatch custom event to notify layout changes
      document.dispatchEvent(new CustomEvent('panel-visibility-changed', {
        detail: { panel, isVisible }
      }));
    });
  });
});

// Update maximize/restore button based on window state
ipcRenderer.on('window-maximized', () => {
  const maximizeBtn = document.getElementById('maximize-btn');
  if (maximizeBtn) {
    maximizeBtn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path fill="none" stroke="currentColor" stroke-width="1.5" d="M2,2 L8,2 L8,8 L2,8 Z M4,4 L4,6 M6,4 L6,6"/>
      </svg>
    `;
    maximizeBtn.setAttribute('title', 'Restore');
  }
});

ipcRenderer.on('window-unmaximized', () => {
  const maximizeBtn = document.getElementById('maximize-btn');
  if (maximizeBtn) {
    maximizeBtn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path fill="none" stroke="currentColor" stroke-width="1.5" d="M1,1 L9,1 L9,9 L1,9 Z"/>
      </svg>
    `;
    maximizeBtn.setAttribute('title', 'Maximize');
  }
});
