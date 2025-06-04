class LayoutManager {
  constructor() {
    this.layoutState = {
      explorer: { visible: true, position: 'left' },
      chat: { visible: true, position: 'right' },
      terminal: { visible: true, position: 'bottom' }
    };
    
    this.isResizing = false;
    this.currentResizer = null;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    
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
    // Explorer-Editor resizer
    const explorerResizer = document.getElementById('gripper-explorer-editor');
    if (explorerResizer) {
      explorerResizer.addEventListener('mousedown', (e) => this.initResize(e, 'horizontal', this.elements.explorer));
    }

    // Editor-Chat resizer
    const chatResizer = document.getElementById('gripper-editor-chat');
    if (chatResizer) {
      chatResizer.addEventListener('mousedown', (e) => this.initResize(e, 'horizontal', this.elements.chatPanel, true));
    }

    // Terminal resizer
    const terminalResizer = document.getElementById('gripper-editor-terminal');
    if (terminalResizer) {
      terminalResizer.addEventListener('mousedown', (e) => this.initResize(e, 'vertical'));
    }

    // Global mouse up and move events
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));
  }


  initResize(e, type, element, isRight = false) {
    this.isResizing = true;
    this.currentResizer = type;
    this.startX = e.clientX;
    this.startY = e.clientY;
    
    if (type === 'horizontal') {
      this.startWidth = element.offsetWidth;
      this.isRightResize = isRight;
    } else {
      this.startHeight = this.elements.terminalContainer.offsetHeight;
    }
    
    document.body.style.cursor = type === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  handleMouseMove(e) {
    if (!this.isResizing) return;
    
    if (this.currentResizer === 'horizontal') {
      const dx = e.clientX - this.startX;
      const newWidth = this.isRightResize 
        ? this.startWidth - dx 
        : this.startWidth + dx;
      
      if (this.isRightResize && this.elements.chatPanel) {
        this.elements.chatPanel.style.width = `${Math.max(150, newWidth)}px`;
      } else if (this.elements.explorer) {
        this.elements.explorer.style.width = `${Math.max(150, newWidth)}px`;
      }
    } else {
      const dy = this.startY - e.clientY;
      const newHeight = this.startHeight + dy;
      
      if (this.elements.terminalContainer) {
        this.elements.terminalContainer.style.height = `${Math.max(100, newHeight)}px`;
      }
    }
  }

  stopResize() {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    this.currentResizer = null;
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
}

// Initialize layout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.layoutManager = new LayoutManager();
});
