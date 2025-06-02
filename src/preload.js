const { contextBridge, ipcRenderer } = require('electron');

// Helper function to safely expose IPC methods
function createIpcInvoke(channel) {
  return (...args) => ipcRenderer.invoke(channel, ...args);
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // File system operations
  readFile: createIpcInvoke('read-file'),
  writeFile: createIpcInvoke('write-file'),
  readDirectory: createIpcInvoke('read-directory'),
  getStats: createIpcInvoke('get-stats'),
  fileExists: createIpcInvoke('file-exists'),
  
  // Dialogs
  openDirectory: createIpcInvoke('open-directory-dialog'),
  createProject: createIpcInvoke('create-project-dialog'),
  createProjectFile: createIpcInvoke('create-project-file'),
  
  // File operations
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Listeners
  onFileOpened: (callback) => {
    const handler = (_, content, filePath) => callback(content, filePath);
    ipcRenderer.on('file-opened', handler);
    return () => ipcRenderer.removeListener('file-opened', handler);
  },
  onGlobalShortcut: (callback) => {
    const handler = (_, action) => callback(action);
    ipcRenderer.on('global-shortcut', handler);
    return () => ipcRenderer.removeListener('global-shortcut', handler);
  },
  
  // Path operations (handled in main process)
  path: {
    basename: (p) => ipcRenderer.invoke('path-basename', p),
    dirname: (p) => ipcRenderer.invoke('path-dirname', p),
    join: (...args) => ipcRenderer.invoke('path-join', args),
    extname: (p) => ipcRenderer.invoke('path-extname', p),
    sep: () => ipcRenderer.invoke('path-sep')
  },
  
  // Clipboard operations
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard-read-text'),
    writeText: (text) => ipcRenderer.invoke('clipboard-write-text', text)
  },
  
  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('file-opened');
  }
});

// Handle errors
window.addEventListener('error', (error) => {
  ipcRenderer.send('renderer-error', error.message);
});

window.addEventListener('unhandledrejection', (event) => {
  ipcRenderer.send('renderer-error', event.reason);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason || 'Unknown error';
  const errorMessage = error.message || String(error);
  console.error('Unhandled rejection in renderer:', error);
});

// Add IPC call error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in preload:', reason);
});
