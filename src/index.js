const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;
const os = require('os');

// Store windows by ID
const windows = new Map();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

const createWindow = async () => {
  try {
    // Create the browser window with better default size
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#1e1e1e',
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Load the index.html file
    await mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Handle window being closed
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      dialog.showErrorBox('An error occurred', error.message);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
      dialog.showErrorBox('An error occurred', String(reason));
    });

  } catch (error) {
    console.error('Failed to create window:', error);
    dialog.showErrorBox('Failed to start', 'Failed to create the main window');
    app.quit();
  }
};

// File system helpers
async function readDirectory(directory) {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true });
    return files.map(file => ({
      name: file.name,
      path: path.join(directory, file.name),
      isDirectory: file.isDirectory(),
      isFile: file.isFile()
    }));
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
}

async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    console.error('Error getting file stats:', error);
    throw error;
  }
}

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set up IPC handlers
  setupIpcHandlers();
  
  // Create main window
  createWindow();

  // Register shortcuts
  registerShortcuts();

  // On macOS, re-create a window when the dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Unregister all shortcuts when the application is about to quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function setupIpcHandlers() {
  // File system operations
  ipcMain.handle('read-file', async (_, filePath) => {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  ipcMain.handle('write-file', async (_, filePath, content) => {
    try {
      await ensureDirectoryExists(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  });

  ipcMain.handle('read-directory', async (_, dirPath) => {
    try {
      return await readDirectory(dirPath);
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
    }
  });

  ipcMain.handle('get-stats', async (_, filePath) => {
    try {
      return await getFileStats(filePath);
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  });

  ipcMain.handle('file-exists', async (_, filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // Dialog handlers
  ipcMain.handle('open-directory-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (!canceled && filePaths.length > 0) {
      return filePaths[0];
    }
    return null;
  });

  ipcMain.handle('create-project-dialog', async () => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Create New Project',
        buttonLabel: 'Create Project',
        properties: ['createDirectory', 'showOverwriteConfirmation'],
        nameFieldLabel: 'Project Name:'
      });
      
      if (canceled || !filePath) {
        return null;
      }

      // Ensure the directory exists
      await ensureDirectoryExists(filePath);
      
      // Verify the directory was created
      try {
        await fs.access(filePath);
        return filePath;
      } catch (error) {
        throw new Error(`Failed to verify project directory creation: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in create-project-dialog:', error);
      throw new Error(`Failed to create project directory: ${error.message}`);
    }
  });

  // Window controls
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  // Handle renderer errors
  ipcMain.on('renderer-error', (_, error) => {
    console.error('Renderer error:', error);
    dialog.showErrorBox('Application Error', error);
  });

  // Path operation handlers
  ipcMain.handle('path-basename', (_, filePath) => path.basename(filePath));
  ipcMain.handle('path-dirname', (_, filePath) => path.dirname(filePath));
  ipcMain.handle('path-join', async (_, ...pathSegments) => {
    // Ensure all segments are strings before joining
    const validSegments = pathSegments.filter(segment => typeof segment === 'string');
    if (validSegments.length !== pathSegments.length) {
        console.warn('path-join received non-string segments:', pathSegments);
    }
    return path.join(...validSegments);
  });
  ipcMain.handle('path-extname', (_, filePath) => path.extname(filePath));
  ipcMain.handle('path-sep', () => path.sep);

  // Project creation handlers
  ipcMain.handle('create-project-file', async (_, filePath, content) => {
    try {
      await ensureDirectoryExists(path.dirname(filePath));
      await fs.writeFile(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('Error creating project file:', error);
      throw error;
    }
  });
}

function registerShortcuts() {
  console.log('Attempting to register shortcuts...');
  // Register CmdOrCtrl+O for Open Folder
  const ret = globalShortcut.register('CmdOrCtrl+O', () => {
    console.log('CmdOrCtrl+O pressed');
    // Send a message to the renderer process to open the folder dialog
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Sending global-shortcut: open-folder to renderer...');
      mainWindow.webContents.send('global-shortcut', 'open-folder');
    } else {
      console.log('mainWindow not available to send global-shortcut.');
    }
  });

  if (!ret) {
    console.error('Registration failed for CmdOrCtrl+O');
  } else {
      console.log('Registration successful for CmdOrCtrl+O');
  }

  // Check whether a shortcut is registered.
  console.log('Is CmdOrCtrl+O registered after attempt?', globalShortcut.isRegistered('CmdOrCtrl+O'));
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (mainWindow) {
    dialog.showErrorBox('An error occurred', error.message);
  }
});

// Handle any unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (mainWindow) {
    dialog.showErrorBox('An error occurred', String(reason));
  }
});
