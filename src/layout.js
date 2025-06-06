class LayoutManager {
  constructor() {
    this.layoutState = {
      explorer: { visible: true, position: 'left' },
      chat: { visible: true, position: 'right' },
      terminal: { visible: true, position: 'bottom' }
    };
    
    this.isResizing = false;
    this.currentResizer = null;
    this.resizeFrame = null;
    this.resizeObservers = new Map();
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.resizeTimeout = null;
    
    this.initElements();
    this.setupEventListeners();
    this.loadLayout();
    this.updateLayout();
    this.setupResizers();
  }

  initElements() {
    this.elements = {
      layoutBtn: document.getElementById('layout-btn'),
      layoutDropdown: document.getElementById('layout-dropdown'),
      explorer: document.querySelector('.explorer'),
      chatPanel: document.querySelector('.chat-panel'),
      terminalContainer: document.querySelector('.terminal-container'),
      topArea: document.querySelector('.top-area'),
      app: document.querySelector('.app')
    };
  }


  setupEventListeners() {
    // Toggle dropdown
    this.elements.layoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.layoutDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.layout-controls')) {
        this.elements.layoutDropdown.classList.remove('show');
      }
    });

    // Panel toggles
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const panel = e.target.dataset.panel;
        this.togglePanel(panel, e.target.checked);
      });
    });

    // Panel position buttons
    document.querySelectorAll('.position-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const panel = e.target.closest('.position-btn').dataset.panel;
        const position = e.target.closest('.position-btn').dataset.position;
        this.setPanelPosition(panel, position);
      });
    });

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.applyPreset(preset);
      });
    });
  }


  togglePanel(panel, visible) {
    this.layoutState[panel].visible = visible;
    this.updateLayout();
    this.saveLayout();
  }

  setPanelPosition(panel, position) {
    this.layoutState[panel].position = position;
    this.updateLayout();
    this.saveLayout();
  }

  updateLayout() {
    // Update panel visibility
    Object.entries(this.layoutState).forEach(([panel, state]) => {
      const element = this.elements[panel === 'chat' ? 'chatPanel' : panel];
      if (!element) return;

      if (state.visible) {
        element.classList.remove('panel-hidden');
        
        // Update position classes
        element.classList.remove('panel-left', 'panel-right');
        element.classList.add(`panel-${state.position}`);
        
        // Update active state of position buttons
        document.querySelectorAll(`.position-btn[data-panel="${panel}"]`).forEach(btn => {
          btn.classList.toggle('active', btn.dataset.position === state.position);
        });
      } else {
        element.classList.add('panel-hidden');
      }
    });

    // Update checkboxes
    Object.entries(this.layoutState).forEach(([panel, state]) => {
      const checkbox = document.querySelector(`.panel-toggle[data-panel="${panel}"]`);
      if (checkbox) {
        checkbox.checked = state.visible;
      }
    });
  }

  applyPreset(preset) {
    switch (preset) {
      case 'default':
        this.layoutState = {
          explorer: { visible: true, position: 'left' },
          chat: { visible: true, position: 'right' },
          terminal: { visible: true, position: 'bottom' }
        };
        break;
      case 'full-editor':
        this.layoutState = {
          explorer: { visible: false, position: 'left' },
          chat: { visible: false, position: 'right' },
          terminal: { visible: false, position: 'bottom' }
        };
        break;
      case 'terminal-focus':
        this.layoutState = {
          explorer: { visible: true, position: 'left' },
          chat: { visible: false, position: 'right' },
          terminal: { visible: true, position: 'bottom' }
        };
        break;
    }
    this.updateLayout();
    this.saveLayout();
  }
  setupResizers() {
    const resizers = document.querySelectorAll('.resizer');
    resizers.forEach(resizer => {
      resizer.addEventListener('mousedown', (e) => {
        this.initResize(e, resizer);
      });
    });

    // Setup ResizeObserver for each panel
    const panels = ['explorer', 'chat', 'terminal'];
    panels.forEach(panel => {
      const element = document.getElementById(`${panel}-panel`);
      if (element) {
        const observer = new ResizeObserver(entries => {
          if (this.resizeFrame) {
            cancelAnimationFrame(this.resizeFrame);
          }
          this.resizeFrame = requestAnimationFrame(() => {
            entries.forEach(entry => {
              if (panel === 'terminal') {
                this.layoutState[panel].height = entry.contentRect.height;
                document.getElementById(`${panel}-panel`).style.height = `${entry.contentRect.height}px`;
              } else {
                this.layoutState[panel].width = entry.contentRect.width;
                document.getElementById(`${panel}-panel`).style.width = `${entry.contentRect.width}px`;
              }
            });
          });
        });
        observer.observe(element);
        this.resizeObservers.set(panel, observer);
      }
    });
  }

  initResize(e, resizer) {
    this.isResizing = true;
    this.currentResizer = resizer;
    this.startX = e.clientX;
    this.startY = e.clientY;
    
    if (resizer.classList.contains('resizer-v')) {
      this.startHeight = this.elements.terminalContainer.offsetHeight;
    } else {
      this.startWidth = resizer.getBoundingClientRect().width;
    }
    
    document.body.style.cursor = resizer.classList.contains('resizer-v') ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  handleMouseMove(e) {
    if (!this.isResizing || !this.currentResizer) return;

    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
    }

    this.resizeFrame = requestAnimationFrame(() => {
      const rect = this.currentResizer.getBoundingClientRect();
      const isVertical = this.currentResizer.classList.contains('resizer-v');
      
      if (isVertical) {
        const newHeight = e.clientY - rect.top;
        if (newHeight > 100) {
          this.layoutState.terminal.height = newHeight;
          document.getElementById('terminal-panel').style.height = `${newHeight}px`;
        }
      } else {
        const newWidth = e.clientX - rect.left;
        if (newWidth > 150) {
          if (this.currentResizer.classList.contains('resizer-r')) {
            this.layoutState.explorer.width = newWidth;
            document.getElementById('explorer-panel').style.width = `${newWidth}px`;
          } else {
            this.layoutState.chat.width = newWidth;
            document.getElementById('chat-panel').style.width = `${newWidth}px`;
          }
        }
      }
    });
  }

  stopResize() {
    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
    this.isResizing = false;
    this.currentResizer = null;
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Save the current dimensions
    this.saveLayout();
  }

  saveLayout() {
    // Save panel visibility and positions
    localStorage.setItem('app-layout', JSON.stringify(this.layoutState));
    
    // Save panel widths/heights if needed
    if (this.elements.explorer) {
      localStorage.setItem('explorer-width', this.elements.explorer.style.width);
    }
    if (this.elements.chatPanel) {
      localStorage.setItem('chat-width', this.elements.chatPanel.style.width);
    }
    if (this.elements.terminalContainer) {
      localStorage.setItem('terminal-height', this.elements.terminalContainer.style.height);
    }
  }
  loadLayout() {
    // Load panel visibility and positions
    const savedLayout = localStorage.getItem('app-layout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        this.layoutState = { ...this.layoutState, ...parsed };
      } catch (e) {
        console.error('Failed to load layout:', e);
      }
    }
    
    // Load saved dimensions
    if (this.elements.explorer) {
      const width = localStorage.getItem('explorer-width');
      if (width) this.elements.explorer.style.width = width;
    }
    if (this.elements.chatPanel) {
      const width = localStorage.getItem('chat-width');
      if (width) this.elements.chatPanel.style.width = width;
    }
    if (this.elements.terminalContainer) {
      const height = localStorage.getItem('terminal-height');
      if (height) this.elements.terminalContainer.style.height = height;
    }
  }

  cleanup() {
    // Cleanup ResizeObservers
    this.resizeObservers.forEach(observer => observer.disconnect());
    this.resizeObservers.clear();
    
    if (this.resizeFrame) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
  }
}

// Initialize layout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.layoutManager = new LayoutManager();
});
