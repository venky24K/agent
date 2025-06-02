// DOM Elements (declared as variables, but assigned in init)
let editorTextarea;
let fileExplorer;
let newProjectBtn;
let newProjectEmptyBtn;
let openFolderBtn;
let openFolderEmptyBtn;
let lineNumbers;

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
    // Flatten the arguments in case an array is passed (e.g., path.join(['a', 'b'], 'c'))
    // But ensure we pass individual segments to the main process, not a nested array.
    const segments = args.flatMap(arg => Array.isArray(arg) ? arg : [arg]);
    // Pass the flattened segments array directly to the main process handler
    return window.api.path.join(...segments); // <-- Spread the segments here
  },
  extname: (p) => window.api.path.extname(p),
  sep: window.api.path.sep()
};

// State
let currentContent = ''; // Track current editor content
let isModified = false;

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

// Update line numbers
function updateLineNumbers() {
  if (!editorTextarea || !lineNumbers) {
    console.warn('Editor textarea or line numbers element not found');
    return;
  }
  
  const content = editorTextarea.value;
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  // Create line numbers with proper padding
  const maxDigits = String(lineCount).length;
  let lineNumbersHtml = '';
  
  for (let i = 1; i <= lineCount; i++) {
    // Pad the number with spaces to align all numbers properly
    const paddedNumber = String(i).padStart(maxDigits, ' ');
    lineNumbersHtml += paddedNumber + '\n';
  }
  
  // Ensure at least one line number is shown
  if (lineCount === 0 || (lineCount === 1 && !content)) {
    lineNumbersHtml = '1\n';
  }
  
  lineNumbers.textContent = lineNumbersHtml;
  
  // Update line numbers width based on the number of digits
  const minWidth = 30; // Minimum width in pixels
  const digitWidth = 8; // Approximate width of each digit in pixels
  const width = Math.max(minWidth, (maxDigits * digitWidth) + 16); // 16px for padding
  lineNumbers.style.minWidth = `${width}px`;
  
  // Sync scroll position
  lineNumbers.scrollTop = editorTextarea.scrollTop;
}

// Initialize
function init() {
  console.log('Initializing renderer...');

  // Get DOM elements here to ensure they are available after DOMContentLoaded
  editorTextarea = document.getElementById('editor-textarea');
  fileExplorer = document.getElementById('file-explorer');
  newProjectBtn = document.getElementById('new-project-btn');
  newProjectEmptyBtn = document.getElementById('new-project-empty-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  openFolderEmptyBtn = document.getElementById('open-folder-empty-btn');
  lineNumbers = document.getElementById('line-numbers');

  console.log('Inside init - Editor Textarea element:', editorTextarea);
  console.log('Inside init - Line Numbers element:', lineNumbers);
  console.log('Inside init - File Explorer element:', fileExplorer);

  // Initially show the empty state
  updateEmptyState('file-explorer', true);

  // Set initial editor state
  if (editorTextarea) {
    editorTextarea.readOnly = true;
    // Update placeholder to include shortcut instruction
    const placeholderText = 'Open a file or folder to start editing (Cmd+O or Ctrl+O)';
    editorTextarea.placeholder = placeholderText;
    console.log('Editor placeholder set to:', placeholderText);
  }

  // Initialize line numbers - only if element is found
  if (lineNumbers) {
    updateLineNumbers();
  } else {
      console.warn('Line numbers element not found, skipping initial update.');
  }

  setupEventListeners(); // Call setupEventListeners after initial empty state is set
  initializeChat(); // Initialize chat after other setup
}

// Update empty state visibility
function updateEmptyState(containerId, isEmpty) {
  const containerEl = document.getElementById(containerId);
   if (!containerEl) {
     console.error(`Container element with id ${containerId} not found`);
     return;
   }

   // Find the empty state element within the container
   const emptyState = containerEl.querySelector('.empty-state');
   if (!emptyState) {
     console.error('Empty state element not found in container.');
     return;
   }

   if (isEmpty) {
     // Show the empty state
     emptyState.style.display = 'flex';
     // Make the container focusable only when empty state is shown
     containerEl.setAttribute('tabindex', '0');
   } else {
     // Hide the empty state
     emptyState.style.display = 'none';
     // Remove tabindex when not in empty state
     containerEl.removeAttribute('tabindex');
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
  li.dataset.depth = depth; // Add depth data attribute
  
  const treeItem = document.createElement('div');
  treeItem.className = 'tree-item';
  treeItem.tabIndex = 0; // Make focusable for keyboard navigation
  treeItem.style.paddingLeft = `${depth * 16 + 8}px`;
  
  const arrow = document.createElement('span');
  arrow.className = 'tree-item-arrow';
  arrow.innerHTML = isDirectory ? '▼' : '';
  arrow.classList.toggle('hidden', !isDirectory);
  
  const icon = document.createElement('span');
  icon.className = isDirectory ? 'tree-item-icon folder-icon' : 'tree-item-icon file-icon';
  
  try {
    const iconChar = isDirectory ? '📁' : await getFileIcon(fullPath);
    icon.textContent = iconChar;
     if (!isDirectory) { // Add data attribute for file type icon coloring
       const ext = await path.extname(fullPath);
       icon.dataset.ext = ext.toLowerCase();
     }
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
    
    // Add click handler for toggling children - This will be handled by delegation
    // treeItem.addEventListener('click', (e) => { ... });
  }
  
  // Handle click on tree item (for both files and folders) - This will be handled by delegation
  // treeItem.addEventListener('click', (e) => { ... });
  
  // Handle keyboard navigation - Keep this here for individual item focus
  treeItem.addEventListener('keydown', async (e) => { // Made async to await toggleDirectory
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDirectory) {
        openFile(fullPath);
      } else {
         await toggleDirectory(li); // Await toggleDirectory
      }
    } else if (e.key === 'ArrowRight' && isDirectory) {
      // Expand directory
       const children = li.querySelector('.tree-children');
       if (children && (children.style.display === 'none' || li.classList.contains('collapsed'))) {
         e.preventDefault();
         e.stopPropagation();
         await toggleDirectory(li, true); // Await toggleDirectory
       }
    } else if (e.key === 'ArrowLeft' && isDirectory) {
      // Collapse directory or go to parent
       const children = li.querySelector('.tree-children');
       if (children && children.style.display !== 'none' && !li.classList.contains('collapsed')) {
         e.preventDefault();
         e.stopPropagation();
         await toggleDirectory(li, false); // Await toggleDirectory
       } else if (depth > 0) {
           // If collapsed or a file, navigate to parent directory
           const parentLi = li.parentElement.closest('li[data-type="directory"]');
           if (parentLi) {
               e.preventDefault();
               parentLi.querySelector('.tree-item').focus();
           }
       }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextItem = li.nextElementSibling;
        if (nextItem) {
            nextItem.querySelector('.tree-item')?.focus();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevItem = li.previousElementSibling;
        if (prevItem) {
             prevItem.querySelector('.tree-item')?.focus();
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
    // aria-selected will be managed when a file is opened
    treeItem.setAttribute('aria-selected', 'false');
  }
  
  return li;
}

// Function to load directory contents
async function loadDirectoryContents(dirPath, depth = 0, parentElement = null) {
  console.log(`loadDirectoryContents called for: ${dirPath}`, `Depth: ${depth}`);
  
  try {
    // Check if directory exists
    const dirExists = await window.api.fileExists(dirPath);
    if (!dirExists) {
      console.error(`Directory does not exist: ${dirPath}`);
      throw new Error(`Directory does not exist: ${dirPath}`);
    }
    
    // Read directory contents
    console.log(`Reading directory: ${dirPath}`);
    const files = await window.api.readDirectory(dirPath);
    console.log(`Found ${files.length} items in directory ${dirPath}:`, files.map(f => f.name));
    
    // Clear loading indicator if parent element is provided
    if (parentElement) {
      console.log('Clearing loading indicator in parent element.');
      const loadingItem = parentElement.querySelector('.loading');
      if (loadingItem) {
        parentElement.removeChild(loadingItem);
      }
    }
    
    const ul = document.createElement('ul');
    ul.className = 'tree-list';
    ul.setAttribute('role', 'group'); // Add ARIA role for nested lists
    
    if (!files || files.length === 0) {
      console.log(`Directory ${dirPath} is empty.`);
      const emptyText = document.createElement('div');
      emptyText.className = 'empty-folder';
      emptyText.textContent = '(empty)';
      // Return the empty text element so it can be appended by the caller
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
        const fullPath = await window.api.path.join(dirPath, file.name);
        // Pass the correct depth to createTreeItem
        const item = await createTreeItem(file.name, fullPath, file.isDirectory, depth);
        
        if (file.isDirectory) {
          directories.push(item);
        } else {
          fileItems.push(item);
        }
      } catch (error) {
        console.error(`Error processing file/directory ${file.name} in ${dirPath}:`, error);
        // Optionally, create an error item to display in the tree
        const errorItem = document.createElement('li');
        errorItem.className = 'tree-item error-item';
        errorItem.textContent = `Error loading ${file.name}`; // Simplified error message
        fileItems.push(errorItem);
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
    
    // Add directories first, then files to the ul
    for (const dir of directories) {
      ul.appendChild(dir);
    }
    
    for (const file of fileItems) {
      ul.appendChild(file);
    }
    
    // Return the created ul element
    console.log(`Finished loading directory: ${dirPath}`, ul);
    return ul; // Return the ul element to the caller
    
  } catch (error) {
    console.error(`Error loading directory ${dirPath}:`, error);
    
    // If we have a parent element, add the error there
    if (parentElement) {
      console.log('Adding error message to parent element.');
      // Clear any existing loading indicator
      const loadingItem = parentElement.querySelector('.loading');
      if (loadingItem) {
        parentElement.removeChild(loadingItem);
      }
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = `Error: ${error.message || 'Failed to load directory'}`;
       // Clear previous contents before appending error message
       parentElement.innerHTML = '';
      parentElement.appendChild(errorElement);
    }
    
    // Re-throw the error so the caller knows something went wrong
    throw error;
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
    // Clear previous content and show empty state
    fileExplorer.innerHTML = '';
    updateEmptyState('file-explorer', true);
    return;
  }

  // Clear previous content and show loading state
  console.log('Clearing previous content and showing loading state');
  fileExplorer.innerHTML = '<div class="loading">Loading...</div>';
  updateEmptyState('file-explorer', false); // Hide empty state buttons

  try {
    // Get the directory name to display as the root
    const dirName = await window.api.path.basename(currentDir);

    // Create the root list
    const rootList = document.createElement('ul');
    rootList.className = 'tree-list';
    rootList.setAttribute('role', 'tree'); // Add ARIA role

    // Create the root directory item
    const rootItem = document.createElement('li');
    rootItem.dataset.path = currentDir;
    rootItem.dataset.name = dirName || currentDir; // Use dirName for display
    rootItem.dataset.type = 'directory';
    rootItem.dataset.depth = 0; // Root is depth 0
    rootItem.className = 'expanded'; // Start root expanded
    rootItem.setAttribute('role', 'treeitem');
    rootItem.setAttribute('aria-expanded', 'true');

    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';
    treeItem.tabIndex = 0; // Make focusable
    treeItem.style.paddingLeft = '8px'; // Root item padding

    const arrow = document.createElement('span');
    arrow.className = 'tree-item-arrow';
    arrow.innerHTML = '▼';
    arrow.classList.remove('collapsed'); // Ensure not collapsed

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
     childrenContainer.style.display = 'block'; // Start root children visible

     // Add loading indicator to childrenContainer before loading contents
    const loadingItem = document.createElement('div');
    loadingItem.className = 'loading';
    loadingItem.textContent = 'Loading...';
    childrenContainer.appendChild(loadingItem);

    rootItem.appendChild(treeItem);
    rootItem.appendChild(childrenContainer);
    rootList.appendChild(rootItem);

    // Clear the loading state from the main file explorer div and append the root list
    fileExplorer.innerHTML = '';
    fileExplorer.appendChild(rootList);

    // Load the root directory contents
    try {
      console.log('Loading root directory contents for:', currentDir);
      const contents = await loadDirectoryContents(currentDir, 1, childrenContainer);
      console.log('Root directory contents loaded:', contents ? 'success' : 'empty', 'for', currentDir);

       // Clear loading indicator from childrenContainer
      const currentLoadingItem = childrenContainer.querySelector('.loading');
      if (currentLoadingItem) {
           childrenContainer.removeChild(currentLoadingItem);
      }

      if (contents instanceof Node) {
          // Clear childrenContainer before appending new contents to avoid duplicates
          childrenContainer.innerHTML = '';
          childrenContainer.appendChild(contents);
      } else if (contents) { // Handle the case loadDirectoryContents might return the empty div directly
           childrenContainer.innerHTML = '';
           childrenContainer.appendChild(contents);
      } else {
         // If no contents and not an empty div, ensure loading is removed and maybe show empty folder message
          childrenContainer.innerHTML = ''; // Ensure it's clear
           const emptyText = document.createElement('div');
           emptyText.className = 'empty-folder';
           emptyText.textContent = '(empty)';
           childrenContainer.appendChild(emptyText);
      }

    } catch (error) {
      console.error('Error loading root directory contents:', error);
       // Clear loading indicator from childrenContainer
       const currentLoadingItem = childrenContainer.querySelector('.loading');
       if (currentLoadingItem) {
            childrenContainer.removeChild(currentLoadingItem);
       }
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = `Error loading: ${error.message || 'Unknown error'}`;
      // Clear childrenContainer before appending error
      childrenContainer.innerHTML = '';
      childrenContainer.appendChild(errorElement);
    }

    // Add event delegation for click to the main file explorer div
    fileExplorer.addEventListener('click', handleFileExplorerClick);
    // Keyboard navigation is handled by listeners on individual tree-item elements (already added in createTreeItem)

  } catch (error) {
    console.error('Error initializing file explorer:', error);

    // Clear any existing content and show error message
    fileExplorer.innerHTML = '';
    updateEmptyState('file-explorer', false); // Hide empty state buttons

    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = `Error loading directory: ${error.message || 'Unknown error'}`;
    fileExplorer.appendChild(errorElement);

    showError('Error', `Failed to initialize file explorer: ${error.message}`);
  }
}

// Event delegation handler for clicks in the file explorer
async function handleFileExplorerClick(e) {
    const treeItem = e.target.closest('.tree-item');
    if (!treeItem) return;

    e.stopPropagation();
    const li = treeItem.closest('li');
    if (!li) return;

    if (li.dataset.type === 'directory') {
        // Toggle directory ONLY if the arrow is clicked
        const arrow = treeItem.querySelector('.tree-item-arrow');
        if (arrow && (e.target === arrow || arrow.contains(e.target))) {
             await toggleDirectory(li); // Use toggleDirectory with default (toggle) behavior
        }
    } else if (li.dataset.path) {
        // For files, open the file (click anywhere on the file item)
        openFile(li.dataset.path);
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
    
    console.log('All project files created.');
    
    // Re-render to show new files
    await renderFileExplorer();
    
    console.log('Project created successfully');
    
  } catch (error) {
    console.error('Error creating project:', error);
    showError('Project Creation Failed', error.message || 'An unknown error occurred while creating the project');
  }
}

// Event Listeners
function setupEventListeners() {
  console.log('Setting up renderer event listeners...');

  // Check if elements exist before adding listeners
  if (!editorTextarea || !fileExplorer || !lineNumbers || !newProjectBtn || !newProjectEmptyBtn || !openFolderBtn || !openFolderEmptyBtn) {
      console.error('One or more elements not found in setupEventListeners, skipping listener setup.');
      return;
  }

  // New Project buttons
  // Attach listeners to the buttons within the empty state div directly
  document.getElementById('new-project-empty-btn').addEventListener('click', createNewProject);
  document.getElementById('open-folder-empty-btn').addEventListener('click', openFolder);

  // Open Folder buttons (from the header)
  document.getElementById('open-folder-btn').addEventListener('click', openFolder);
  // New Project button (from the header)
  document.getElementById('new-project-btn').addEventListener('click', createNewProject);
  
  // Editor change handler
  editorTextarea.addEventListener('input', async (e) => {
    if (!currentFilePath) return;
    
    const newContent = e.target.value;
    isModified = newContent !== currentContent;
    
    // Update line numbers
    updateLineNumbers();
    
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
  
  // Sync scroll between editor and line numbers
  editorTextarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editorTextarea.scrollTop;
  });
  
  // Handle file opened from main process
  if (window.api?.onFileOpened) {
    window.api.onFileOpened((content, filePath) => {
      console.log('File opened message received from main process:', filePath);
      openFile(filePath);
    });
  }
  
  // Handle global shortcuts received from the main process
  if (window.api?.onGlobalShortcut) {
    console.log('Adding listener for global-shortcut messages...');
    window.api.onGlobalShortcut((action) => {
      console.log('Global shortcut message received with action:', action);
      if (action === 'open-folder') {
        console.log('Received open-folder action, calling openFolder()...');
        openFolder();
      }
      // Add other shortcut actions here later if needed
    });
  } else {
      console.log('window.api.onGlobalShortcut not available.');
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

  // Add resizable functionality
  addResizablePanels();
}

function addResizablePanels() {
  const explorer = document.querySelector('.explorer');
  const editorArea = document.querySelector('.editor-area');
  const chatPanel = document.querySelector('.chat-panel');
  const gripperExplorerEditor = document.getElementById('gripper-explorer-editor');
  const gripperEditorChat = document.getElementById('gripper-editor-chat');

  if (!explorer || !editorArea || !chatPanel || !gripperExplorerEditor || !gripperEditorChat) {
    console.error('One or more panel/gripper elements not found.');
    return;
  }

  let isDragging = false;
  let activeGripper = null;
  let startPos = 0;
  let startExplorerWidth = explorer.offsetWidth;
  let startEditorWidth = editorArea.offsetWidth;
  let startChatWidth = chatPanel.offsetWidth;

  const MIN_EXPLORER_WIDTH = 150;
  const MAX_EXPLORER_WIDTH = 400;
  const MIN_EDITOR_WIDTH = 200;
  const MIN_CHAT_WIDTH = 150;
  const MAX_CHAT_WIDTH = 400;

  function onMouseDown(e) {
    isDragging = true;
    activeGripper = this;
    startPos = e.clientX;
    startExplorerWidth = explorer.offsetWidth;
    startEditorWidth = editorArea.offsetWidth;
    startChatWidth = chatPanel.offsetWidth;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.classList.add('resizing');
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    const currentPos = e.clientX;
    const diff = currentPos - startPos;

    if (activeGripper.id === 'gripper-explorer-editor') {
      const newExplorerWidth = Math.min(
        Math.max(startExplorerWidth + diff, MIN_EXPLORER_WIDTH),
        MAX_EXPLORER_WIDTH
      );
      explorer.style.width = `${newExplorerWidth}px`;
    } else if (activeGripper.id === 'gripper-editor-chat') {
      const newChatWidth = Math.min(
        Math.max(startChatWidth - diff, MIN_CHAT_WIDTH),
        MAX_CHAT_WIDTH
      );
      chatPanel.style.width = `${newChatWidth}px`;
    }
  }

  function onMouseUp() {
    if (!isDragging) return;
    
    isDragging = false;
    activeGripper = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.classList.remove('resizing');
    
    startExplorerWidth = explorer.offsetWidth;
    startEditorWidth = editorArea.offsetWidth;
    startChatWidth = chatPanel.offsetWidth;
  }

  gripperExplorerEditor?.addEventListener('mousedown', onMouseDown);
  gripperEditorChat?.addEventListener('mousedown', onMouseDown);
  console.log('Mousedown listeners attached to grippers.');
}

// Helper function to toggle directory expansion
async function toggleDirectory(li, expand) {
   console.log('Toggling directory:', li.dataset.path);
   const arrow = li.querySelector('.tree-item-arrow');
   const children = li.querySelector('.tree-children');
   if (!arrow || !children) {
     console.warn('Toggle elements not found for:', li.dataset.path);
     return;
   }

   const isCollapsed = arrow.classList.contains('collapsed') || children.style.display === 'none';
   console.log('Current state:', isCollapsed ? 'collapsed' : 'expanded');

   // Determine the new state: expand === true, collapse === false, toggle === undefined
   let newState = isCollapsed;
   if (expand === true) newState = true;
   else if (expand === false) newState = false;
   // If expand is undefined, newState remains isCollapsed, so we toggle it
   else newState = !isCollapsed;

   if (newState) { // Should be expanding
      console.log('Expanding directory:', li.dataset.path);
      arrow.classList.remove('collapsed');
      children.style.display = 'block';
      li.classList.add('expanded');
      li.querySelector('.tree-item')?.setAttribute('aria-expanded', 'true');

      // Load children if not already loaded (check if only loading indicator exists)
      if (children.children.length === 0 || (children.children.length === 1 && children.children[0].classList.contains('loading'))) {
           console.log('Children container is empty or only has loading indicator. Loading children...');
            // Add temporary loading indicator if not present
           if (!children.querySelector('.loading')) {
                const loadingItem = document.createElement('div');
                loadingItem.className = 'loading';
                loadingItem.textContent = 'Loading...';
                children.innerHTML = ''; // Clear previous content before adding loading
                children.appendChild(loadingItem);
                 console.log('Added loading indicator for:', li.dataset.path);
           }

           try {
               // Use dataset.depth from the current li
               const currentDepth = parseInt(li.dataset.depth || '0', 10);
                console.log(`Calling loadDirectoryContents for ${li.dataset.path} with depth ${currentDepth + 1}`);
               const contents = await loadDirectoryContents(li.dataset.path, currentDepth + 1, children);
               console.log('Directory contents loaded from loadDirectoryContents.', 'for', li.dataset.path, contents);

                // Clear loading indicator
                const loadingItem = children.querySelector('.loading');
                if (loadingItem) {
                    children.removeChild(loadingItem);
                     console.log('Removed loading indicator for:', li.dataset.path);
                }

               // Clear childrenContainer before appending new contents to avoid duplicates
               children.innerHTML = '';
                console.log('Cleared children container for appending.');

               if (contents instanceof Node) {
                    console.log('Appending loaded contents (Node) to children container.');
                   children.appendChild(contents);
               } else if (contents) { // Handle the case loadDirectoryContents might return the empty div directly
                    console.log('Appending loaded contents (other) to children container.');
                    children.appendChild(contents);
               } else {
                  console.log('loadDirectoryContents returned no contents.');
                 // If no contents and not an empty div, ensure loading is removed and maybe show empty folder message
                  children.innerHTML = ''; // Ensure it's clear
                   const emptyText = document.createElement('div');
                   emptyText.className = 'empty-folder';
                   emptyText.textContent = '(empty)';
                   children.appendChild(emptyText);
                    console.log('Appended empty folder message.');
               }
           } catch (error) {
               console.error('Error loading directory contents:', error);
                // Clear loading indicator
                const loadingItem = children.querySelector('.loading');
                if (loadingItem) {
                    children.removeChild(loadingItem);
                     console.log('Removed loading indicator on error for:', li.dataset.path);
                }
               const errorElement = document.createElement('div');
               errorElement.className = 'error-message';
               errorElement.textContent = `Error loading: ${error.message || 'Unknown error'}`;
                // Clear childrenContainer before appending error
                children.innerHTML = '';
               children.appendChild(errorElement);
                console.log('Appended error message to children container.');
           }
      } else {
          console.log('Children already loaded for:', li.dataset.path, `Children count: ${children.children.length}`);
          // If children are already loaded and just hidden, no need to reload.
      }

   } else { // Should be collapsing
      console.log('Collapsing directory:', li.dataset.path);
      arrow.classList.add('collapsed');
      children.style.display = 'none';
      li.classList.remove('expanded');
      li.querySelector('.tree-item')?.setAttribute('aria-expanded', 'false');
   }

   // Ensure the clicked item remains focused after toggling
   li.querySelector('.tree-item').focus();
}

// Chat functionality
function initializeChat() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('chat-send');

  // Auto-resize textarea as user types
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Send message on button click
  sendButton.addEventListener('click', () => {
    sendMessage();
  });

  // Send message on Enter (but allow Shift+Enter for new line)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const message = chatInput.value.trim();

  if (message) {
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // TODO: Handle the message (will be implemented later)
    console.log('Message to send:', message);
  }
}

// Initialize the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initializeChat();
    // Update line numbers initially after the DOM is ready
    updateLineNumbers();
  });
} else {
  init();
  initializeChat();
  // Update line numbers initially if the DOM is already ready
  updateLineNumbers();
}