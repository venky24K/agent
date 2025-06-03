const { ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');

const execPromise = util.promisify(exec);

let currentWorkingDirectory = os.homedir();

function setupTerminalHandlers() {
  // Get current working directory
  ipcMain.handle('terminal:pwd', () => {
    return currentWorkingDirectory;
  });

  // Change directory
  ipcMain.handle('terminal:cd', async (_, dir) => {
    try {
      // Handle home directory
      if (dir === '~') {
        dir = os.homedir();
      }
      
      // Resolve relative paths
      const newPath = path.resolve(currentWorkingDirectory, dir);
      
      // Check if directory exists
      const stats = await fs.promises.stat(newPath);
      if (!stats.isDirectory()) {
        return { error: 'Not a directory' };
      }
      
      currentWorkingDirectory = newPath;
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  });

  // List directory contents
  ipcMain.handle('terminal:ls', async (_, args = []) => {
    try {
      let targetDir = currentWorkingDirectory;
      if (args.length > 0) {
        targetDir = path.resolve(currentWorkingDirectory, args[0]);
      }

      const files = await fs.promises.readdir(targetDir, { withFileTypes: true });
      const output = files.map(file => {
        const isDir = file.isDirectory();
        const name = isDir ? `${file.name}/` : file.name;
        return name;
      }).join('  ');

      return output;
    } catch (error) {
      return `ls: ${error.message}`;
    }
  });

  // Execute general shell commands
  ipcMain.handle('terminal:execute', async (_, command) => {
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: currentWorkingDirectory,
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        output: stdout,
        error: stderr
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}

module.exports = { setupTerminalHandlers };
