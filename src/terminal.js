document.addEventListener('DOMContentLoaded', () => {
  const terminalContainer = document.querySelector('.terminal-container');
  const terminalOutput = document.getElementById('terminal-output');
  const terminalInput = document.getElementById('terminal-input');
  const gripper = document.getElementById('gripper-editor-terminal');
  const clearButton = document.querySelector('.terminal-action[title="Clear Terminal"]');
  const newTerminalButton = document.querySelector('.terminal-action[title="New Terminal"]');

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  // Command history
  let commandHistory = [];
  let historyIndex = -1;
  let currentInput = '';

  // Handle terminal resizing
  gripper.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startY = e.clientY;
    startHeight = terminalContainer.offsetHeight;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    gripper.classList.add('resizing');
  });

  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const deltaY = startY - e.clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, startHeight + deltaY));
    terminalContainer.style.height = `${newHeight}px`;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function handleMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    gripper.classList.remove('resizing');
  }

  // Handle terminal commands and keyboard navigation
  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const command = terminalInput.value.trim();
      if (command) {
        // Add command to history
        commandHistory.push(command);
        if (commandHistory.length > 50) { // Limit history size
          commandHistory.shift();
        }
        historyIndex = commandHistory.length;

        // Add command to output
        appendToTerminal(`$ ${command}`);
        
        // Process command
        processCommand(command);
        
        // Clear input
        terminalInput.value = '';
        currentInput = '';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex === commandHistory.length) {
        currentInput = terminalInput.value;
      }
      if (historyIndex > 0) {
        historyIndex--;
        terminalInput.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        terminalInput.value = commandHistory[historyIndex];
      } else if (historyIndex === commandHistory.length - 1) {
        historyIndex = commandHistory.length;
        terminalInput.value = currentInput;
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // TODO: Implement command/path autocompletion
    } else if (e.ctrlKey && e.key === 'c') {
      // Handle Ctrl+C
      appendToTerminal('^C');
      terminalInput.value = '';
      currentInput = '';
    } else if (e.ctrlKey && e.key === 'l') {
      // Handle Ctrl+L (clear screen)
      clearTerminal();
    }
  });

  // Focus terminal input when clicking anywhere in the terminal
  terminalContainer.addEventListener('click', () => {
    terminalInput.focus();
  });

  function clearTerminal() {
    terminalOutput.innerHTML = '';
  }

  // Clear terminal button
  clearButton.addEventListener('click', clearTerminal);

  // New terminal (currently just clears the terminal)
  newTerminalButton.addEventListener('click', () => {
    terminalOutput.innerHTML = '';
    appendToTerminal('New terminal session started');
  });

  // Helper function to append text to terminal
  function appendToTerminal(text) {
    const line = document.createElement('div');
    line.textContent = text;
    terminalOutput.appendChild(line);
    
    // Scroll to bottom when new content is added
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  // Process terminal commands
  async function processCommand(command) {
    const args = command.split(' ');
    const cmd = args[0].toLowerCase();

    try {
      switch (cmd) {
        case 'clear':
          clearTerminal();
          break;

        case 'echo':
          appendToTerminal(args.slice(1).join(' '));
          break;

        case 'pwd':
          const pwd = await window.api.terminal.pwd();
          appendToTerminal(pwd);
          break;

        case 'ls':
          const files = await window.api.terminal.ls(args.slice(1));
          appendToTerminal(files);
          break;

        case 'cd':
          const result = await window.api.terminal.cd(args[1] || '~');
          if (result.error) {
            appendToTerminal(`cd: ${result.error}`);
          }
          break;

        case 'help':
          appendToTerminal(
            'Available commands:\n' +
            '  clear - Clear the terminal screen\n' +
            '  echo [text] - Display a line of text\n' +
            '  pwd - Print working directory\n' +
            '  ls [path] - List directory contents\n' +
            '  cd [path] - Change directory\n' +
            '  help - Show this help message\n\n' +
            'Keyboard shortcuts:\n' +
            '  Up/Down - Navigate command history\n' +
            '  Ctrl+C - Cancel current command\n' +
            '  Ctrl+L - Clear screen'
          );
          break;

        default:
          const cmdResult = await window.api.terminal.execute(command);
          if (cmdResult.output) {
            appendToTerminal(cmdResult.output);
          }
          if (cmdResult.error) {
            appendToTerminal(`Error: ${cmdResult.error}`);
          }
      }
    } catch (error) {
      appendToTerminal(`Error: ${error.message}`);
    }
  }

  // Initial terminal message
  appendToTerminal('Terminal ready. Type "help" for available commands.');

  // Handle window resize
  window.addEventListener('resize', () => {
    // Ensure terminal doesn't exceed maximum height
    const maxHeight = window.innerHeight * 0.5;
    if (terminalContainer.offsetHeight > maxHeight) {
      terminalContainer.style.height = `${maxHeight}px`;
    }
  });
}); 