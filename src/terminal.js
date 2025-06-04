class Terminal {
  constructor() {
    this.terminalContainer = document.querySelector('.terminal-container');
    this.terminalOutput = document.getElementById('terminal-output');
    this.terminalInput = document.getElementById('terminal-input');
    this.terminalStatus = document.getElementById('terminal-status');
    this.currentCommandEl = document.getElementById('current-command');
    this.terminalCwd = document.getElementById('terminal-cwd');
    this.suggestions = document.getElementById('command-suggestions');
    this.gripper = document.getElementById('gripper-editor-terminal');
    
    // Terminal state
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentInput = '';
    this.currentPath = '~';
    this.isProcessing = false;
    this.suggestionIndex = -1;
    this.availableCommands = [
      { name: 'clear', description: 'Clear terminal screen' },
      { name: 'help', description: 'Show available commands' },
      { name: 'ls', description: 'List directory contents' },
      { name: 'cd', description: 'Change directory' },
      { name: 'pwd', description: 'Print working directory' },
      { name: 'mkdir', description: 'Create a new directory' },
      { name: 'rm', description: 'Remove files or directories' },
      { name: 'cat', description: 'Display file contents' },
      { name: 'echo', description: 'Display a message' },
      { name: 'exit', description: 'Close the terminal' }
    ];

    // Initialize terminal
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.appendToTerminal('Terminal initialized. Type `help` to see available commands.', 'info');
    this.updateStatus('idle');
    this.updateCwd();
  }

  setupEventListeners() {
    // Handle terminal resizing
    this.gripper.addEventListener('mousedown', this.handleResizeStart.bind(this));
    
    // Terminal input handling
    this.terminalInput.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.terminalInput.addEventListener('input', this.handleInput.bind(this));
    this.terminalInput.addEventListener('focus', () => this.terminalContainer.classList.add('focused'));
    this.terminalInput.addEventListener('blur', () => this.terminalContainer.classList.remove('focused'));
    
    // Button handlers
    document.getElementById('terminal-clear').addEventListener('click', () => this.clearTerminal());
    document.getElementById('new-terminal-tab').addEventListener('click', () => this.createNewTab());
    document.getElementById('terminal-settings').addEventListener('click', (e) => this.showSettings(e));
    
    // Click outside to hide suggestions
    document.addEventListener('click', (e) => {
      if (!this.terminalContainer.contains(e.target)) {
        this.hideSuggestions();
      }
    });
  }

  handleResizeStart(e) {
    e.preventDefault();
    this.isResizing = true;
    this.startY = e.clientY;
    this.startHeight = this.terminalContainer.offsetHeight;
    
    const handleMouseMove = (e) => {
      if (!this.isResizing) return;
      const deltaY = this.startY - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, this.startHeight + deltaY));
      this.terminalContainer.style.height = `${newHeight}px`;
      this.scrollToBottom();
    };

    const handleMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      this.gripper.classList.remove('resizing');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, { once: true });
    document.body.style.cursor = 'row-resize';
    this.gripper.classList.add('resizing');
  }

  handleKeyDown(e) {
    if (this.isProcessing) {
      e.preventDefault();
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.executeCommand(this.terminalInput.value);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.navigateHistory('up');
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.navigateHistory('down');
        break;
        
      case 'Tab':
        e.preventDefault();
        this.handleTabComplete();
        break;
        
      case 'Escape':
        this.hideSuggestions();
        break;
    }
  }

  handleInput() {
    this.currentInput = this.terminalInput.value;
    this.showCommandSuggestions(this.currentInput);
  }

  async executeCommand(command) {
    if (!command.trim()) return;

    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;

    // Display command
    this.appendToTerminal(`$ ${command}`, 'command');
    this.terminalInput.value = '';
    this.hideSuggestions();
    
    // Process command
    this.isProcessing = true;
    this.updateStatus('processing');
    this.currentCommandEl.textContent = `Executing: ${command.split(' ')[0]}`;
    
    try {
      const output = await this.processCommand(command);
      if (output) {
        this.appendToTerminal(output, 'output');
      }
      this.updateStatus('success');
    } catch (error) {
      this.appendToTerminal(`Error: ${error.message}`, 'error');
      this.updateStatus('error');
    } finally {
      this.isProcessing = false;
      this.currentCommandEl.textContent = 'Ready';
      this.scrollToBottom();
    }
  }

  async processCommand(command) {
    const [cmd, ...args] = command.trim().split(/\s+/);
    const cmdLower = cmd.toLowerCase();

    switch (cmdLower) {
      case 'clear':
        this.clearTerminal();
        return '';
        
      case 'help':
        return this.availableCommands
          .map(cmd => `${cmd.name.padEnd(12)} ${cmd.description}`)
          .join('\n');
          
      case 'pwd':
        return this.currentPath;
        
      case 'ls':
        return await this.listDirectory(args[0] || this.currentPath);
        
      case 'cd':
        const newPath = args[0] || '~';
        await this.changeDirectory(newPath);
        return '';
        
      case 'echo':
        return args.join(' ');
        
      default:
        // Try to execute as a system command
        try {
          return await this.executeSystemCommand(command);
        } catch (error) {
          throw new Error(`Command not found: ${cmd}. Type 'help' for available commands.`);
        }
    }
  }

  async executeSystemCommand(command) {
    // This would be implemented to execute actual system commands
    // For now, just return a mock response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`Executed: ${command}\n[This is a mock response]`);
      }, 500);
    });
  }

  async listDirectory(path) {
    try {
      // In a real implementation, this would list files using the file system API
      // For now, return a mock directory listing
      const mockFiles = [
        'file1.txt',
        'folder1/',
        'folder2/',
        'script.js',
        'README.md'
      ];
      
      return mockFiles.join('\n');
    } catch (error) {
      throw new Error(`Error listing directory: ${error.message}`);
    }
  }

  async changeDirectory(path) {
    // In a real implementation, this would change the current working directory
    // For now, just update the UI
    const newPath = path === '~' ? '~' : `${this.currentPath}/${path}`.replace(/\/+/g, '/');
    this.currentPath = newPath;
    this.updateCwd();
  }

  // UI Helper Methods
  appendToTerminal(text, type = 'output') {
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = text;
    this.terminalOutput.appendChild(line);
    this.scrollToBottom();
  }

  clearTerminal() {
    this.terminalOutput.innerHTML = '';
  }

  scrollToBottom() {
    this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
  }

  updateStatus(status) {
    this.terminalStatus.className = 'status-indicator';
    if (status === 'processing') {
      this.terminalStatus.classList.add('processing');
      this.terminalStatus.title = 'Processing command...';
    } else if (status === 'success') {
      this.terminalStatus.classList.add('success');
      this.terminalStatus.title = 'Command executed successfully';
    } else if (status === 'error') {
      this.terminalStatus.classList.add('error');
      this.terminalStatus.title = 'Command failed';
    } else {
      this.terminalStatus.title = 'Ready';
    }
  }

  updateCwd() {
    this.terminalCwd.textContent = this.currentPath;
  }

  // Command history navigation
  navigateHistory(direction) {
    if (direction === 'up' && this.historyIndex > 0) {
      if (this.historyIndex === this.commandHistory.length) {
        this.currentInput = this.terminalInput.value;
      }
      this.historyIndex--;
      this.terminalInput.value = this.commandHistory[this.historyIndex];
    } else if (direction === 'down' && this.historyIndex < this.commandHistory.length) {
      this.historyIndex++;
      if (this.historyIndex === this.commandHistory.length) {
        this.terminalInput.value = this.currentInput;
      } else {
        this.terminalInput.value = this.commandHistory[this.historyIndex] || '';
      }
    }
    
    // Move cursor to the end of the input
    const length = this.terminalInput.value.length;
    this.terminalInput.setSelectionRange(length, length);
  }

  // Tab completion
  handleTabComplete() {
    const input = this.terminalInput.value.trim();
    if (!input) return;

    const commands = this.availableCommands
      .map(cmd => cmd.name)
      .filter(cmd => cmd.startsWith(input));

    if (commands.length === 1) {
      // Single match - complete the command
      this.terminalInput.value = commands[0] + ' ';
    } else if (commands.length > 1) {
      // Multiple matches - show suggestions
      this.showCommandSuggestions(input);
    }
  }

  // Command suggestions
  showCommandSuggestions(prefix) {
    if (!prefix) {
      this.hideSuggestions();
      return;
    }

    const suggestions = this.availableCommands
      .filter(cmd => cmd.name.startsWith(prefix))
      .slice(0, 5); // Limit to 5 suggestions

    if (suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.suggestions.innerHTML = suggestions
      .map((cmd, index) => `
        <div class="suggestion-item ${index === this.suggestionIndex ? 'selected' : ''}" 
             data-command="${cmd.name}">
          <span class="command-name">${this.highlightMatch(cmd.name, prefix)}</span>
          <span class="command-desc">${cmd.description}</span>
        </div>`
      )
      .join('');

    this.suggestions.style.display = 'block';
    this.suggestionIndex = -1;

    // Add click handlers for suggestions
    this.suggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        const command = item.getAttribute('data-command');
        this.terminalInput.value = command + ' ';
        this.terminalInput.focus();
        this.hideSuggestions();
      });
    });
  }

  highlightMatch(text, match) {
    if (!match) return text;
    const index = text.toLowerCase().indexOf(match.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const matched = text.substring(index, index + match.length);
    const after = text.substring(index + match.length);
    
    return `${before}<span class="highlight">${matched}</span>${after}`;
  }

  hideSuggestions() {
    this.suggestions.style.display = 'none';
    this.suggestionIndex = -1;
  }

  // Tab management
  createNewTab() {
    // In a real implementation, this would create a new terminal tab
    this.appendToTerminal('New terminal tab functionality coming soon!', 'info');
  }

  showSettings(e) {
    // In a real implementation, this would show terminal settings
    e.stopPropagation();
    this.appendToTerminal('Terminal settings coming soon!', 'info');
  }
}

// Initialize terminal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.terminal = new Terminal();
});

// All terminal functionality is now handled by the Terminal class 