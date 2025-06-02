// DOM Elements
const editorTextarea = document.getElementById('editor-textarea');
const fileExplorer = document.getElementById('file-explorer');
const newProjectBtn = document.getElementById('new-project-btn');
const newProjectEmptyBtn = document.getElementById('new-project-empty-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const openFolderEmptyBtn = document.getElementById('open-folder-empty-btn');

// Current file path
let currentFilePath = null;

// File icons mapping
const FILE_ICONS = {
  // Folders
  folder: '📁',
  'folder-open': '📂',
  // Code files
  js: '',
  jsx: '',
  ts: '',
  tsx: '',
  html: '',
  css: '',
  json: '',
  // Config files
  gitignore: '',
  env: '',
  // Images
  png: '',
  jpg: '',
  jpeg: '',
  gif: '',
  svg: '',
  // Default
  default: ''
};

// Current working directory
let currentDir = '';

// Path helper functions
const path = {
  basename: (p) => window.api.path.basename(p),
  dirname: (p) => window.api.path.dirname(p),
  join: (...args) => {
    // Flatten the arguments in case an array is passed
    const segments = args.flatMap(arg => Array.isArray(arg) ? arg : [arg]);
    return window.api.path.join(segments);
  },
  extname: (p) => window.api.path.extname(p),
  sep: window.api.path.sep()
};

// State
let currentContent = ''; // Track current editor content
let isModified = false;

// Initialize
function init() {
  setupEventListeners();
  updateEmptyState(true);
  
  // Set initial editor state
  editorTextarea.readOnly = true;
  editorTextarea.placeholder = 'Open a file to start editing';
}

// Update empty state visibility
function updateEmptyState(isEmpty) {
  if (!fileExplorer) {
    console.error('File explorer element not found');
    return;
  }
  
  const emptyState = fileExplorer.querySelector('.empty-state');
  if (!emptyState) {
    console.error('Empty state element not found in file explorer');
    return;
  }
  
  try {
    if (isEmpty) {
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating empty state:', error);
  }
}

// Helper function to get file icon based on extension
async function getFileIcon(fileName) {
  try {
    const ext = await path.extname(fileName);
    const extLower = ext.toLowerCase();
    
    const iconMap = {
      '.js': '',
      '.jsx': '',
      '.ts': '',
      '.tsx': '',
      '.html': '',
      '.css': '',
      '.scss': '',
      '.sass': '',
      '.json': '',
      '.md': '',
      '.markdown': '',
      '.gitignore': '',
      '.gitmodules': '',
      '.gitattributes': '',
      '.gitkeep': '',
      '.git': '',
      '.png': '',
      '.jpg': '',
      '.jpeg': '',
      '.gif': '',
      '.svg': '',
      '.ico': '',
      '.pdf': '',
      '.zip': '',
      '.gz': '',
      '.tar': '',
      '.xz': '',
      '.exe': '',
      '.bat': '',
      '.sh': '',
      '.py': '',
      '.java': '',
      '.c': '',
      '.h': '',
      '.cpp': '',
      '.hpp': '',
      '.go': '',
      '.rs': '',
      '.php': '',
      '.rb': '',
      '.swift': '',
      '.kt': '',
      '.dart': '',
      '.lua': '',
      '.sql': '',
      '.yaml': '',
      '.yml': '',
      '.toml': '',
      '.xml': '',
      '.log': '',
      '.txt': '',
      '.lock': '',
      '.env': ''
    };
    
    return iconMap[extLower] || '📄';
  } catch (error) {
    console.error('Error getting file icon:', error);
    return '📄';
  }
}

// Create a tree item element
async function createTreeItem(name, fullPath, isDirectory, depth = 0) {
  const li = document.createElement('li');
  li.dataset.path = fullPath;
  li.dataset.name = name;
  li.dataset.type = isDirectory ? 'directory' : 'file';
  
  const treeItem = document.createElement('div');
  treeItem.className = 'tree-item';
  treeItem.tabIndex = 0;
  treeItem.style.paddingLeft = `${depth * 16 + 8}px`;
  
  // Get file extension for icon
  let extension = '';
  if (!isDirectory) {
    try {
      extension = await window.api.path.extname(fullPath);
    } catch (error) {
      console.error(`Error getting extension for ${name}:`, error);
    }
  }
  
  const arrow = document.createElement('span');
  arrow.className = 'tree-item-arrow';
  arrow.innerHTML = isDirectory ? '▼' : '';
  arrow.classList.toggle('hidden', !isDirectory);
  
  const icon = document.createElement('span');
  icon.className = isDirectory ? 'tree-item-icon folder-icon' : 'tree-item-icon file-icon';
  
  try {
    const iconChar = isDirectory ? '📁' : await getFileIcon(fullPath);
    icon.textContent = iconChar;
  } catch (error) {
    console.error('Error getting file icon:', error);
    icon.textContent = isDirectory ? '📁' : '📄';
  }
  const nameSpan = document.createElement('span');
  nameSpan.className = 'tree-item-name';
  nameSpan.textContent = name;
  
  treeItem.appendChild(arrow);
  treeItem.appendChild(icon);
  treeItem.appendChild(nameSpan);
  li.appendChild(treeItem);
  
  if (isDirectory) {
    const children = document.createElement('ul');
    children.className = 'tree-children';
    children.style.display = 'none'; // Start collapsed
    li.appendChild(children);
    
    // Add click handler for toggling children
    treeItem.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Toggle children visibility
      arrow.classList.toggle('collapsed');
      children.style.display = children.style.display === 'none' ? 'block' : 'none';
      
      // If expanding and children haven't been loaded yet
      if (children.style.display !== 'none' && children.children.length === 0) {
        loadDirectoryContents(fullPath, depth + 1, children);
      }
    });
  }
  
  // Handle click on tree item (for both files and folders)
  treeItem.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (!isDirectory) {
      // For files, open the file
      openFile(fullPath);
    } else {
      // For directories, toggle expansion
      const clickedArrow = treeItem.querySelector('.tree-item-arrow');
      const clickedChildren = li.querySelector('.tree-children');
      if (clickedArrow && clickedChildren) {
        clickedArrow.classList.toggle('collapsed');
        clickedChildren.style.display = clickedChildren.style.display === 'none' ? 'block' : 'none';
      }
    }
  });
  
  // Handle keyboard navigation
  treeItem.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDirectory) {
        openFile(fullPath);
      } else {
        const arrow = treeItem.querySelector('.tree-item-arrow');
        const children = li.querySelector('.tree-children');
        if (arrow && children) {
          const isCollapsed = arrow.classList.contains('collapsed') || children.style.display === 'none';
          arrow.classList.toggle('collapsed', !isCollapsed);
          children.style.display = isCollapsed ? 'block' : 'none';
          
          // If expanding and children haven't been loaded yet
          if (isCollapsed && children.children.length === 0) {
            loadDirectoryContents(fullPath, depth + 1, children);
          }
        }
      }
    } else if (e.key === 'ArrowRight' && isDirectory) {
      // Expand directory
      const arrow = treeItem.querySelector('.tree-item-arrow');
      const children = li.querySelector('.tree-children');
      if (arrow && children && (arrow.classList.contains('collapsed') || children.style.display === 'none')) {
        e.preventDefault();
        e.stopPropagation();
        arrow.classList.remove('collapsed');
        children.style.display = 'block';
        
        // If children haven't been loaded yet
        if (children.children.length === 0) {
          loadDirectoryContents(fullPath, depth + 1, children);
        }
      }
    } else if (e.key === 'ArrowLeft' && isDirectory) {
      // Collapse directory
      const arrow = treeItem.querySelector('.tree-item-arrow');
      const children = li.querySelector('.tree-children');
      if (arrow && children && !arrow.classList.contains('collapsed') && children.style.display !== 'none') {
        e.preventDefault();
        e.stopPropagation();
        arrow.classList.add('collapsed');
        children.style.display = 'none';
      }
    }
  });
  
  // Handle right-click for context menu
  treeItem.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Implement context menu
  });
  
  // Set initial ARIA attributes for accessibility
  if (isDirectory) {
    treeItem.setAttribute('role', 'treeitem');
    treeItem.setAttribute('aria-expanded', 'false');
    treeItem.setAttribute('aria-haspopup', 'true');
  } else {
    treeItem.setAttribute('role', 'treeitem');
    treeItem.setAttribute('aria-selected', 'false');
  }
  
  return li;
}

// Function to load directory contents
async function loadDirectoryContents(dirPath, depth = 0, parentElement = null) {
  console.log(`Loading directory: ${dirPath}`);
  
  try {
    // Check if directory exists
    const dirExists = await window.api.fileExists(dirPath);
    if (!dirExists) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }
    
    // Read directory contents
    const files = await window.api.readDirectory(dirPath);
    console.log(`Found ${files.length} items in directory:`, files.map(f => f.name));
    
    // Clear loading indicator if parent element is provided
    if (parentElement) {
      const loadingItem = parentElement.querySelector('.loading');
      if (loadingItem) {
        parentElement.removeChild(loadingItem);
      }
    }
    
    const ul = document.createElement('ul');
    ul.className = 'tree-list';
    
    if (!files || files.length === 0) {
      const emptyText = document.createElement('div');
      emptyText.className = 'empty-folder';
      emptyText.textContent = '(empty)';
      return emptyText;
    }
    
    const directories = [];
    const fileItems = [];
    
    // Separate directories and files
    for (const file of files) {
      // Skip hidden files and directories (starting with .) except some common ones
      if (file.name.startsWith('.')) {
        const allowedHidden = [
          '.gitignore', '.env', '.gitmodules', 
          '.gitattributes', '.gitkeep', '.editorconfig',
          '.eslintrc', '.prettierrc', '.babelrc', '.npmrc',
          '.nvmrc', '.env.example', '.env.local', '.env.development',
          '.env.production', '.env.test'
        ];
        
        const isAllowed = allowedHidden.some(allowed => 
          file.name === allowed || file.name.startsWith(`${allowed}.`)
        );
        
        if (!isAllowed) {
          continue;
        }
      }
      
      // Skip common build and dependency directories
      const skipDirs = ['node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit'];
      if (file.isDirectory && skipDirs.includes(file.name)) {
        continue;
      }
      
      try {
        // Join path segments correctly - pass them as separate arguments
        const fullPath = await window.api.path.join(dirPath, file.name);
        const item = await createTreeItem(file.name, fullPath, file.isDirectory, depth);
        
        if (file.isDirectory) {
          directories.push(item);
        } else {
          fileItems.push(item);
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        continue;
      }
    }
    
    // Sort directories and files (case-insensitive)
    directories.sort((a, b) => 
      a.dataset.name.localeCompare(b.dataset.name, undefined, {sensitivity: 'base'})
    );
    
    fileItems.sort((a, b) => 
      a.dataset.name.localeCompare(b.dataset.name, undefined, {sensitivity: 'base'})
    );
    
    // Add directories first, then files
    for (const dir of directories) {
      ul.appendChild(dir);
    }
    
    for (const file of fileItems) {
      ul.appendChild(file);
    }
    
    return ul;
    
  } catch (error) {
    console.error(`Error loading directory ${dirPath}:`, error);
    
    // If we have a parent element, add the error there
    if (parentElement) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = `Error: ${error.message || 'Failed to load directory'}`;
      
      // Clear any existing loading indicator
      const loadingItem = parentElement.querySelector('.loading');
      if (loadingItem) {
        parentElement.removeChild(loadingItem);
      }
      
      parentElement.appendChild(errorElement);
    }
    
    // Re-throw the error so the caller knows something went wrong
    throw error;
  }
}

// Update empty state of file explorer
function updateEmptyState(container, isEmpty) {
  const containerEl = container;
  if (!containerEl) {
    console.error('Container element is null or undefined');
    return;
  }
  
  // Clear the container first
  while (containerEl.firstChild) {
    containerEl.removeChild(containerEl.firstChild);
  }
  
  if (isEmpty) {
    // Create and add empty state content
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-state-content">
        <div class="empty-state-icon">📁</div>
        <h3>No Folder Opened</h3>
        <p>Open a folder to start editing</p>
        <div class="empty-state-actions">
          <button id="open-folder-btn" class="btn btn-primary">
            <span class="icon">📂</span> Open Folder
          </button>
          <button id="new-project-btn" class="btn">
            <span class="icon">🆕</span> New Project
          </button>
        </div>
      </div>
    `;
    
    containerEl.appendChild(emptyState);
    
    // Add event listeners to buttons
    const openFolderBtn = containerEl.querySelector('#open-folder-btn');
    const newProjectBtn = containerEl.querySelector('#new-project-btn');
    
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFolder();
      });
      
      openFolderBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFolder();
        }
      });
    }
    
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // createNewProject function will be implemented later
        console.log('New project button clicked');
      });
      
      newProjectBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // createNewProject function will be implemented later
          console.log('New project button activated via keyboard');
        }
      });
    }
    
    // Make the container focusable for keyboard navigation
    containerEl.setAttribute('tabindex', '0');
  } else {
    // Just clear the tabindex if not empty
    containerEl.removeAttribute('tabindex');
  }
}

// Render file explorer with the current directory
async function renderFileExplorer() {
  console.log('renderFileExplorer called');
  const fileExplorer = document.getElementById('file-explorer');
  if (!fileExplorer) {
    console.error('File explorer element not found');
    return;
  }
  
  console.log('Current directory:', currentDir);
  if (!currentDir) {
    console.log('No current directory, showing empty state');
    updateEmptyState(fileExplorer, true);
    return;
  }
  
  // Show loading state
  console.log('Showing loading state');
  fileExplorer.innerHTML = '<div class="loading">Loading...</div>';
  
  try {
    // Get the directory name to display as the root
    const dirName = await window.api.path.basename(currentDir);
    
    // Create the root list
    const rootList = document.createElement('ul');
    rootList.className = 'tree-list';
    
    // Create the root directory item
    const rootItem = document.createElement('li');
    rootItem.dataset.path = currentDir;
    rootItem.dataset.type = 'directory';
    rootItem.className = 'expanded';
    
    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';
    treeItem.tabIndex = 0;
    
    const arrow = document.createElement('span');
    arrow.className = 'tree-item-arrow';
    arrow.innerHTML = '▼';
    
    const icon = document.createElement('span');
    icon.className = 'tree-item-icon folder-icon';
    icon.textContent = '📁';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tree-item-name';
    nameSpan.textContent = dirName || 'Root';
    
    treeItem.appendChild(arrow);
    treeItem.appendChild(icon);
    treeItem.appendChild(nameSpan);
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    
    // Add loading indicator
    const loadingItem = document.createElement('div');
    loadingItem.className = 'loading';
    loadingItem.textContent = 'Loading...';
    childrenContainer.appendChild(loadingItem);
    
    rootItem.appendChild(treeItem);
    rootItem.appendChild(childrenContainer);
    rootList.appendChild(rootItem);
    
    fileExplorer.innerHTML = '';
    fileExplorer.appendChild(rootList);
    
    try {
      console.log('Loading directory contents for:', currentDir);
      
      // Clear any existing loading indicator
      childrenContainer.innerHTML = '';
      
      // Create a new loading indicator
      const loadingItem = document.createElement('div');
      loadingItem.className = 'loading';
      loadingItem.textContent = 'Loading...';
      childrenContainer.appendChild(loadingItem);
      
      // Load the root directory contents
      const contents = await loadDirectoryContents(currentDir, 1, childrenContainer);
      console.log('Directory contents loaded:', contents ? 'success' : 'empty');
      
      // Clear loading indicator
      if (childrenContainer.contains(loadingItem)) {
        childrenContainer.removeChild(loadingItem);
      }
      
      if (contents) {
        console.log('Appending contents to DOM');
        childrenContainer.appendChild(contents);
      } else {
        console.log('No contents to display');
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-folder';
        emptyText.textContent = '(empty)';
        childrenContainer.appendChild(emptyText);
      }
    } catch (error) {
      console.error('Error loading directory contents:', error);
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = `Error loading directory: ${error.message || 'Unknown error'}`;
      childrenContainer.appendChild(errorElement);
    }
    
    // Add event delegation for the entire file explorer
    fileExplorer.addEventListener('click', (e) => {
      const treeItem = e.target.closest('.tree-item');
      if (!treeItem) return;
      
      e.stopPropagation();
      const li = treeItem.closest('li');
      if (!li) return;
      
      if (li.dataset.type === 'directory') {
        // Toggle directory on arrow click or anywhere in the item
        if (e.target.closest('.tree-item-arrow') || e.target === treeItem) {
          toggleDirectory(li);
        }
      } else if (li.dataset.path) {
        openFile(li.dataset.path);
      }
    });
    
    // Add double-click handler for directories
    fileExplorer.addEventListener('dblclick', (e) => {
      const treeItem = e.target.closest('.tree-item');
      if (!treeItem) return;
      
      e.stopPropagation();
      const li = treeItem.closest('li');
      if (li && li.dataset.type === 'directory') {
        toggleDirectory(li, true);
      }
    });
    
    // Add keyboard navigation
    fileExplorer.addEventListener('keydown', (e) => {
      const activeItem = document.activeElement.closest('.tree-item');
      if (!activeItem) return;
      
      const li = activeItem.closest('li');
      if (!li) return;
      
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (li.dataset.type === 'directory') {
            toggleDirectory(li, true);
          } else if (li.dataset.path) {
            openFile(li.dataset.path);
          }
          break;
          
        case 'ArrowRight':
          if (li.dataset.type === 'directory' && !li.classList.contains('expanded')) {
            e.preventDefault();
            toggleDirectory(li, true);
          }
          break;
          
        case 'ArrowLeft':
          if (li.dataset.type === 'directory' && li.classList.contains('expanded')) {
            e.preventDefault();
            toggleDirectory(li, false);
          }
          break;
      }
    });
  } catch (error) {
    console.error('Error initializing file explorer:', error);
    
    // Clear any existing loading indicator
    const loadingItem = fileExplorer.querySelector('.loading');
    if (loadingItem) {
      fileExplorer.removeChild(loadingItem);
    }
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = `Error loading directory: ${error.message || 'Unknown error'}`;
    fileExplorer.appendChild(errorElement);
    
    showError('Error', `Failed to initialize file explorer: ${error.message}`);
  }
}

// Open file in editor
async function openFile(filePath) {
  try {
    console.log('Opening file:', filePath);
    const content = await window.api.readFile(filePath);
    currentFilePath = filePath;
    currentContent = content;
    editorTextarea.value = content;
    editorTextarea.readOnly = false;
    
    // Update window title
    const fileName = await window.api.path.basename(filePath);
    document.title = `${fileName} - Agent`;
    
    // Highlight in explorer
    highlightFileInExplorer(filePath);
    
    // Reset modified state
    isModified = false;
    
    console.log('File opened successfully');
    return true;
    
  } catch (error) {
    console.error('Error opening file:', error);
    const errorMsg = error.message || 'Failed to open file';
    showError('Open File Failed', errorMsg);
    throw error; // Re-throw to allow caller to handle
  }  
  return false;
}

// Highlight file in explorer
async function highlightFileInExplorer(filePath) {
  if (!filePath) return;
  
  try {
    // Normalize file path for comparison
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Remove highlight from all files and directories
    const allItems = document.querySelectorAll('.tree-item');
    for (const el of allItems) {
      el.classList.remove('active');
    }
    
    // Find and highlight the current file or directory
    const allListItems = document.querySelectorAll('li[data-path]');
    let fileEl = null;
    
    // First try exact match
    for (const el of allListItems) {
      const itemPath = el.getAttribute('data-path');
      if (itemPath && itemPath.replace(/\\/g, '/') === normalizedPath) {
        fileEl = el.querySelector('.tree-item');
        break;
      }
    }
    
    // If no exact match, try partial match (useful for Windows paths)
    if (!fileEl) {
      for (const el of allListItems) {
        const itemPath = el.getAttribute('data-path');
        if (itemPath && normalizedPath.endsWith(itemPath.replace(/\\/g, '/'))) {
          fileEl = el.querySelector('.tree-item');
          break;
        }
      }
    }
    
    if (fileEl) {
      // Add active class to the found element
      fileEl.classList.add('active');
      
      // Ensure all parent directories are expanded
      let parent = fileEl.closest('li[data-type="directory"]');
      while (parent) {
        const arrow = parent.querySelector('.tree-item-arrow');
        const children = parent.querySelector('.tree-children');
        if (arrow && children) {
          arrow.classList.remove('collapsed');
          children.style.display = 'block';
        }
        parent = parent.parentElement.closest('li[data-type="directory"]');
      }
      
      // Scroll the item into view
      setTimeout(() => {
        fileEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }, 100);
    }
  } catch (error) {
    console.error('Error highlighting file in explorer:', error);
  }
}

// Show error message
function showError(title, message) {
  // You could replace this with a more sophisticated error display
  alert(`${title}: ${message}`);
}

async function openFolder() {
  try {
    console.log('Open folder button clicked');
    
    // Prompt to save current file if modified
    if (currentFilePath && !(await promptSaveIfNeeded())) {
      return;
    }
    
    console.log('Opening directory dialog...');
    const dirPath = await window.api.openDirectory();
    
    if (!dirPath) {
      console.log('No directory selected');
      return;
    }
    
    console.log('Selected directory:', dirPath);
    
    // Show loading state
    const fileExplorer = document.getElementById('file-explorer');
    if (fileExplorer) {
      fileExplorer.innerHTML = '<div class="loading">Loading folder contents...</div>';
    }
    
    // Update current directory
    currentDir = dirPath;
    currentFilePath = null;
    currentContent = '';
    
    // Update editor state
    editorTextarea.value = '';
    editorTextarea.readOnly = true;
    document.title = 'Agent';
    
    try {
      // Render the file explorer with the new directory
      await renderFileExplorer();
      
      // Try to open index.html by default
      try {
        const indexPath = await window.api.path.join(dirPath, 'index.html');
        console.log('Looking for index.html at:', indexPath);
        
        const fileExists = await window.api.fileExists(indexPath);
        if (fileExists) {
          console.log('Found index.html, opening...');
          const stats = await window.api.getStats(indexPath);
          if (stats && stats.isFile) {
            await openFile(indexPath);
          }
        } else {
          console.log('index.html not found in the selected directory');
        }
      } catch (error) {
        console.error('Error checking for index.html:', error);
      }
      
      console.log('Folder opened successfully');
    } catch (error) {
      console.error('Error rendering file explorer:', error);
      showError('Error Loading Folder', 'Failed to load folder contents. Please try again.');
      
      // Reset to empty state
      if (fileExplorer) {
        updateEmptyState(fileExplorer, true);
      }
    }
  } catch (error) {
    console.error('Error in openFolder:', error);
    showError('Open Folder Failed', error.message || 'An unknown error occurred while opening the folder');
    
    // Reset to empty state
    const fileExplorer = document.getElementById('file-explorer');
    if (fileExplorer) {
      updateEmptyState(fileExplorer, true);
    }
  }
}

// Create new project
async function createNewProject() {
  try {
    console.log('Create new project button clicked');
    
    // Check for unsaved changes in current file
    if (currentFilePath && !(await promptSaveIfNeeded())) {
      console.log('User cancelled save');
      return; // User cancelled
    }
    
    console.log('Opening project directory dialog...');
    const projectPath = await window.api.createProject();
    
    if (!projectPath) {
      console.log('Project creation cancelled');
      return; // User cancelled
    }
    
    console.log('New project path:', projectPath);
    
    // Reset editor state
    currentDir = projectPath;
    currentFilePath = null;
    currentContent = '';
    editorTextarea.value = '';
    editorTextarea.readOnly = true;
    document.title = 'Agent';
    
    // Default project files
    const files = [
      { 
        name: 'index.html', 
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Start editing to see some magic happen!</p>
  <script src="app.js"></script>
</body>
</html>` 
      },
      { 
        name: 'styles.css', 
        content: `/* Custom styles */
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #1e1e1e;
  color: #e0e0e0;
  line-height: 1.6;
}

h1 {
  color: #569cd6;
  margin-top: 0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}` 
      },
      { 
        name: 'app.js', 
        content: '// Your JavaScript code here\nconsole.log("Hello from app.js");\n\n// Example: Add an interactive element\ndocument.addEventListener("DOMContentLoaded", () => {\n  console.log("DOM fully loaded and parsed");\n});' 
      }
    ];
    
    // Create project files
    for (const file of files) {
      const filePath = path.join(projectPath, file.name);
      console.log('Creating file:', filePath);
      try {
        await window.api.writeFile(filePath, file.content);
      } catch (fileError) {
        console.error(`Error creating file ${filePath}:`, fileError);
        throw new Error(`Failed to create file ${file.name}: ${fileError.message}`);
      }
    }
    
    // Re-render to show new files
    await renderFileExplorer();
    
    // Open index.html by default
    let extension = '';
    if (!isDirectory) {
      try {
        extension = await window.api.path.extname(fullPath);
      } catch (error) {
        console.error(`Error getting extension for ${name}:`, error);
      }
    }
    const indexPath = await window.api.path.join([projectPath, 'index.html']);
    try {
      await openFile(indexPath);
    } catch (error) {
      console.error('Error opening index.html:', error);
      // Continue even if we can't open index.html
    }
    
    console.log('Project created successfully');
    
  } catch (error) {
    console.error('Error creating project:', error);
    showError('Project Creation Failed', error.message || 'An unknown error occurred while creating the project');
  }
}

// Event Listeners
function setupEventListeners() {
  // New Project buttons
  newProjectBtn?.addEventListener('click', createNewProject);
  newProjectEmptyBtn?.addEventListener('click', createNewProject);
  
  // Open Folder buttons
  openFolderBtn?.addEventListener('click', openFolder);
  openFolderEmptyBtn?.addEventListener('click', openFolder);
  
  // Editor change handler
  editorTextarea?.addEventListener('input', async (e) => {
    if (!currentFilePath) return;
    
    const newContent = e.target.value;
    isModified = newContent !== currentContent;
    
    // Auto-save after a short delay
    if (isModified) {
      clearTimeout(window.saveTimeout);
      window.saveTimeout = setTimeout(async () => {
        try {
          await window.api.writeFile(currentFilePath, newContent);
          currentContent = newContent;
          isModified = false;
          // Show saved indicator (you could add a subtle UI indicator here)
          document.title = document.title.replace(/\*?$/, '');
        } catch (error) {
          console.error('Error saving file:', error);
          showError('Save Failed', error.message);
        }
      }, 500);
      
      // Show modified indicator
      if (!document.title.endsWith('*')) {
        document.title += '*';
      }
    }
  });
  
  // Handle file opened from main process
  if (window.api?.onFileOpened) {
    window.api.onFileOpened((content, filePath) => {
      openFile(filePath);
    });
  }
  
  // Handle drag and drop
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files.length > 0) {
      const filePath = e.dataTransfer.files[0].path;
      
      try {
        const stats = await window.api.getStats(filePath);
        
        if (stats.isDirectory()) {
          // Check for unsaved changes before changing directory
          if (currentFilePath && !(await promptSaveIfNeeded())) {
            return; // User cancelled
          }
          
          currentDir = filePath;
          currentFilePath = null;
          currentContent = '';
          editorTextarea.value = '';
          editorTextarea.readOnly = true;
          document.title = 'Agent';
          
          await renderFileExplorer();
          
          // Try to open index.html by default
          try {
            const indexPath = await window.api.path.join([filePath, 'index.html']);
            const exists = await window.api.fileExists(indexPath);
            if (exists) {
              await openFile(indexPath);
            }
          } catch (innerError) {
            console.log('No index.html found or error opening it:', innerError);
          }
        } else if (stats.isFile()) {
          await openFile(filePath);
        }
      } catch (error) {
        console.error('Error handling dropped file:', error);
        const errorMsg = error.message || 'Could not open the dropped file/folder';
        showError('Error', errorMsg);
      }
    }
  });
      
  // Save current file
  async function saveCurrentFile() {
    if (!currentFilePath) {
      console.log('No file is currently open to save');
      return false;
    }
        
    try {
      const content = editorTextarea.value;
      console.log(`Saving file: ${currentFilePath}`);
          
      await window.api.writeFile(currentFilePath, content);
      currentContent = content;
      isModified = false;
          
      // Update window title to remove modified indicator
      const fileName = await window.api.path.basename(currentFilePath);
      const dirName = await window.api.path.dirname(currentFilePath);
      document.title = `${fileName} - ${dirName}`.replace(/\*+$/, '');
          
      console.log('File saved successfully');
      return true;
          
    } catch (error) {
      console.error('Error saving file:', error);
      const errorMsg = error.message || 'Failed to save the file';
      showError('Save Failed', errorMsg);
      return false;
    }
  }

  // Check if there are unsaved changes
  function hasUnsavedChanges() {
    return isModified;
  }

  // Prompt to save changes if needed
  async function promptSaveIfNeeded() {
    console.log('Checking if save is needed...');
    
    if (!hasUnsavedChanges()) {
      console.log('No unsaved changes, continuing...');
      return true;
    }
    
    console.log('Unsaved changes detected, showing save dialog...');
    const fileName = currentFilePath ? await window.api.path.basename(currentFilePath) : 'Untitled';
    const shouldSave = confirm(`Save changes to ${fileName}?`);
    
    if (shouldSave) {
      console.log('User chose to save, saving file...');
      try {
        const saved = await saveCurrentFile();
        console.log('Save result:', saved ? 'success' : 'failed');
        return saved;
      } catch (error) {
        console.error('Error during save:', error);
        const errorMsg = error.message || 'Failed to save the file';
        showError('Save Error', errorMsg);
        return false; // Don't continue if save failed
      }
    } else {
      console.log('User chose not to save, discarding changes...');
      return true; // Continue without saving
    }
  }
}

// Initialize the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}