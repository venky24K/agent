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
let saveTimeout = null;

// Track open files
let openFiles = [];
let activeFileIndex = -1;

// Context menu state
let contextMenuTarget = null;

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
    
    // Set initial content to empty string to ensure line numbers show up
    editorTextarea.value = '';
    updateLineNumbers(); // This will show the initial line number
  }

  // Initialize line numbers - only if element is found
  if (lineNumbers) {
    updateLineNumbers();
  } else {
      console.warn('Line numbers element not found, skipping initial update.');
  }

  setupEventListeners(); // Call setupEventListeners after initial empty state is set
  
  // Initialize chat after all other setup is complete
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    initializeChat();
  } else {
    console.warn('Chat messages container not found, skipping chat initialization.');
  }
}

// Update empty state visibility
function updateEmptyState(containerId, isEmpty) {
  const containerEl = document.getElementById(containerId);
  if (!containerEl) {
    console.error(`Container element with id ${containerId} not found`);
    return;
  }

  // Find or create the empty state element
  let emptyState = containerEl.querySelector('.empty-state');
  if (!emptyState) {
    console.log('Creating empty state element...');
    emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-state-content">
        <div class="empty-state-icon">📁</div>
        <h3>No Folder Opened</h3>
        <p>Open a folder to start editing</p>
        <div class="empty-state-actions">
          <button id="open-folder-empty-btn" class="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" style="margin-right: 6px;">
              <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            Open Folder
          </button>
          <button id="new-project-empty-btn" class="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" style="margin-right: 6px;">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            New Project
          </button>
        </div>
      </div>
    `;
    containerEl.appendChild(emptyState);

    // Set up event listeners for the new buttons
    const openFolderEmptyBtn = emptyState.querySelector('#open-folder-empty-btn');
    const newProjectEmptyBtn = emptyState.querySelector('#new-project-empty-btn');

    if (openFolderEmptyBtn) {
      openFolderEmptyBtn.addEventListener('click', openFolder);
    }

    if (newProjectEmptyBtn) {
      newProjectEmptyBtn.addEventListener('click', createNewProject);
    }
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
    
    // Nerd Fonts icons for common file types
    const iconMap = {
      // File types
      '.js': '',
      '.jsx': '',
      '.ts': '',
      '.tsx': '',
      '.html': '',
      '.css': '',
      '.scss': '',
      '.sass': '',
      '.json': 'ﬥ',
      '.md': '',
      '.markdown': '',
      '.gitignore': '',
      '.gitmodules': '',
      '.gitattributes': '',
      '.gitkeep': '',
      '.git': '',
      
      // Images
      '.png': '',
      '.jpg': '',
      '.jpeg': '',
      '.gif': '',
      '.svg': '',
      '.ico': '',
      '.bmp': '',
      '.webp': '',
      
      // Documents
      '.pdf': '',
      '.doc': '',
      '.docx': '',
      '.xls': '',
      '.xlsx': '',
      '.ppt': '',
      '.pptx': '',
      
      // Archives
      '.zip': '',
      '.gz': '',
      '.tar': '',
      '.xz': '',
      '.rar': '',
      '.7z': '',
      
      // Executables
      '.exe': '',
      '.bat': '',
      '.sh': '',
      '.ps1': '',
      
      // Programming languages
      '.py': '',
      '.java': '',
      '.c': '',
      '.h': '',
      '.cpp': '',
      '.hpp': '',
      '.go': '',
      '.rs': '',
      '.php': '',
      '.rb': '',
      '.swift': '',
      '.kt': '',
      '.dart': '',
      '.lua': '',
      '.sql': '',
      '.yaml': '',
      '.yml': '',
      '.toml': '',
      '.xml': '',
      
      // Other
      '.log': '',
      '.txt': '',
      '.lock': '',
      '.env': '',
      '.dockerfile': '',
      '.dockerignore': '',
      '.editorconfig': '',
      '.babelrc': 'ﬥ',
      '.eslintrc': '',
      '.prettierrc': '',
      '.npmrc': '',
      '.yarnrc': '',
      '.bowerrc': '',
      '.travis.yml': '',
      '.gitlab-ci.yml': '',
      '.github': '',
      '.gitignore_global': '',
      '.npmignore': '',
      '.nvmrc': '',
      '.node-version': '',
      '.editorconfig': '',
      '.browserslistrc': '',
      '.prettierignore': '',
      '.eslintignore': '',
      '.stylelintrc': '',
      '.stylelintignore': '',
      '.babelrc.js': 'ﬥ',
      '.babelrc.json': 'ﬥ',
      '.babel.config.js': 'ﬥ',
      '.babel.config.json': 'ﬥ',
      '.eslintrc.js': '',
      '.eslintrc.json': '',
      '.eslintrc.yml': '',
      '.eslintrc.yaml': '',
      '.eslintignore': '',
      '.prettierrc.js': '',
      '.prettierrc.json': '',
      '.prettierrc.yml': '',
      '.prettierrc.yaml': '',
      '.prettierrc.toml': '',
      '.prettierignore': '',
      '.stylelintrc.js': '',
      '.stylelintrc.json': '',
      '.stylelintrc.yml': '',
      '.stylelintrc.yaml': '',
      '.stylelintrc.toml': '',
      '.stylelintignore': ''
    };
    
    return iconMap[extLower] || ''; // Default file icon
  } catch (error) {
    console.error('Error getting file icon:', error);
    return ''; // Default file icon on error
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
    const iconChar = isDirectory ? '' : await getFileIcon(fullPath); //  is Nerd Fonts folder icon
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
        try {
          await openFile(fullPath);
        } catch (error) {
          console.error('Error opening file:', error);
          showError('Open File Failed', error.message);
        }
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
        // Ensure we have the full path
        const fullPath = file.path || await window.api.path.join(dirPath, file.name);
        console.log('Creating tree item for:', fullPath, 'isDirectory:', file.isDirectory);
        
        // Pass the correct depth to createTreeItem
        const item = await createTreeItem(file.name, fullPath, file.isDirectory === true, depth);
        
        if (file.isDirectory === true) {
          directories.push(item);
        } else if (file.isFile === true) {
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
        // If clicking the arrow, toggle the directory
        const arrow = treeItem.querySelector('.tree-item-arrow');
        if (arrow && (e.target === arrow || arrow.contains(e.target))) {
            await toggleDirectory(li);
        }
        // If clicking anywhere else on the directory item, just toggle it
        else if (e.target !== arrow && !arrow.contains(e.target)) {
            await toggleDirectory(li);
        }
    } else if (li.dataset.path && li.dataset.type === 'file') {
        if (e.button === 2) { // Right click
            showContextMenu(e, li);
        } else { // Left click
            try {
                await openFile(li.dataset.path);
            } catch (error) {
                console.error('Error opening file:', error);
                showError('Open File Failed', error.message);
            }
        }
    }
}

// Open file in editor
async function openFile(filePath, focus = true) {
  try {
    console.log('Attempting to open file:', filePath);
    
    // Check if file is already open
    const existingIndex = openFiles.findIndex(f => f.path === filePath);
    if (existingIndex !== -1) {
      if (focus) {
        switchToFile(existingIndex);
      }
      return true;
    }
    
    // First check if the file exists
    const exists = await window.api.fileExists(filePath);
    console.log('File exists check:', exists);
    if (!exists) {
      throw new Error('File does not exist');
    }
    
    // Get directory contents to check file type
    const parentDir = await window.api.path.dirname(filePath);
    console.log('Parent directory:', parentDir);
    const dirContents = await window.api.readDirectory(parentDir);
    console.log('Directory contents:', dirContents);
    
    // Find our file in the directory contents using normalized paths
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    console.log('Normalized file path:', normalizedFilePath);
    
    // Log each file path for debugging
    dirContents.forEach(f => {
      const normalizedFPath = (f.path || window.api.path.join(parentDir, f.name)).replace(/\\/g, '/');
      console.log('Comparing with:', normalizedFPath);
    });
    
    const targetFile = dirContents.find(f => {
      const normalizedFPath = (f.path || window.api.path.join(parentDir, f.name)).replace(/\\/g, '/');
      return normalizedFPath === normalizedFilePath;
    });
    
    console.log('Found target file:', targetFile);
    
    if (!targetFile) {
      // Try direct file read if not found in directory listing
      console.log('File not found in directory listing, attempting direct read');
      const content = await window.api.readFile(filePath);
      const fileName = await window.api.path.basename(filePath);
      
      // Add to open files
      const fileInfo = {
        path: filePath,
        name: fileName,
        content: content,
        isModified: false
      };
      
      openFiles.push(fileInfo);
      if (focus) {
        switchToFile(openFiles.length - 1);
      }
      
      updateTabs();
      console.log('File opened successfully via direct read');
      return true;
    }
    
    if (targetFile.isDirectory === true) {
      throw new Error('Cannot open a directory as a file');
    }
    
    if (targetFile.isFile !== true) {
      throw new Error('Not a valid file');
    }
    
    // Read the file contents
    console.log('Reading file contents:', filePath);
    const content = await window.api.readFile(filePath);
    const fileName = await window.api.path.basename(filePath);
    
    // Add to open files
    const fileInfo = {
      path: filePath,
      name: fileName,
      content: content,
      isModified: false
    };
    
    openFiles.push(fileInfo);
    if (focus) {
      switchToFile(openFiles.length - 1);
    }
    
    updateTabs();
    console.log('File opened successfully');
    return true;
    
  } catch (error) {
    console.error('Error opening file:', error);
    const errorMsg = error.message || 'Failed to open file';
    showError('Open File Failed', errorMsg);
    throw error;
  }
}

// Switch to a specific file tab
function switchToFile(index) {
  if (index < 0 || index >= openFiles.length) return;
  
  // Save current content if modified
  if (activeFileIndex !== -1 && openFiles[activeFileIndex]?.isModified) {
    openFiles[activeFileIndex].content = editorTextarea.value;
  }
  
  activeFileIndex = index;
  const file = openFiles[index];
  
  currentFilePath = file.path;
  currentContent = file.content;
  editorTextarea.value = file.content;
  editorTextarea.readOnly = false;
  
  // Update line numbers
  updateLineNumbers();
  
  // Update window title
  document.title = `${file.name} - Agent`;
  
  // Highlight in explorer
  highlightFileInExplorer(file.path);
  
  // Update tabs
  updateTabs();
}

// Close a file tab
function closeFile(index) {
  if (index < 0 || index >= openFiles.length) return;
  
  const file = openFiles[index];
  if (file.isModified) {
    // TODO: Prompt to save changes
    if (!confirm(`Save changes to ${file.name}?`)) return;
  }
  
  openFiles.splice(index, 1);
  
  if (openFiles.length === 0) {
    // No files left open
    activeFileIndex = -1;
    currentFilePath = null;
    currentContent = '';
    editorTextarea.value = '';
    editorTextarea.readOnly = true;
    document.title = 'Agent';
  } else {
    // Switch to nearest tab
    const newIndex = Math.min(index, openFiles.length - 1);
    switchToFile(newIndex);
  }
  
  updateTabs();
}

// Update the tabs UI
function updateTabs() {
  const tabsContainer = document.getElementById('editor-tabs');
  tabsContainer.innerHTML = '';
  
  openFiles.forEach((file, index) => {
    const tab = document.createElement('div');
    tab.className = `editor-tab${index === activeFileIndex ? ' active' : ''}${file.isModified ? ' modified' : ''}`;
    
    const title = document.createElement('span');
    title.className = 'editor-tab-title';
    title.textContent = file.name;
    tab.appendChild(title);
    
    const closeBtn = document.createElement('div');
    closeBtn.className = 'editor-tab-close';
    closeBtn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>';
    tab.appendChild(closeBtn);
    
    tab.addEventListener('click', (e) => {
      if (e.target === closeBtn || closeBtn.contains(e.target)) {
        closeFile(index);
      } else {
        switchToFile(index);
      }
    });
    
    tabsContainer.appendChild(tab);
  });
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
          if (stats && stats.isFile === true) {
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
// Handle context menu
function showContextMenu(e, target) {
  e.preventDefault();
  
  const contextMenu = document.getElementById('context-menu');
  contextMenuTarget = target;
  
  // Position the menu
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.classList.add('show');
  
  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.classList.remove('show');
      document.removeEventListener('click', closeMenu);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

// Handle context menu actions
async function handleContextMenuAction(action) {
  const filePath = contextMenuTarget.dataset.path;
  if (!filePath) return;
  
  switch (action) {
    case 'open':
      await openFile(filePath);
      break;
    case 'copy':
      // TODO: Implement copy
      break;
    case 'cut':
      // TODO: Implement cut
      break;
    case 'paste':
      // TODO: Implement paste
      break;
    case 'rename':
      const newName = prompt('Enter new name:', contextMenuTarget.dataset.name);
      if (newName) {
        try {
          const dirPath = await window.api.path.dirname(filePath);
          const newPath = await window.api.path.join(dirPath, newName);
          await window.api.renameFile(filePath, newPath);
          await renderFileExplorer(); // Refresh explorer
        } catch (error) {
          showError('Rename Failed', error.message);
        }
      }
      break;
    case 'delete':
      if (confirm(`Are you sure you want to delete ${contextMenuTarget.dataset.name}?`)) {
        try {
          await window.api.deleteFile(filePath);
          await renderFileExplorer(); // Refresh explorer
        } catch (error) {
          showError('Delete Failed', error.message);
        }
      }
      break;
  }
}

function setupEventListeners() {
  console.log('Setting up renderer event listeners...');
  
  // Get all required elements
  const editorTextarea = document.getElementById('editor-textarea');
  const fileExplorer = document.getElementById('file-explorer');
  const lineNumbers = document.getElementById('line-numbers');
  const newProjectBtn = document.getElementById('new-project-btn');
  const newProjectEmptyBtn = document.getElementById('new-project-empty-btn');
  const openFolderBtn = document.getElementById('open-folder-btn');
  const openFolderEmptyBtn = document.getElementById('open-folder-empty-btn');
  const contextMenu = document.getElementById('context-menu');

  // Check if elements exist before adding listeners
  if (!editorTextarea || !fileExplorer || !lineNumbers || !newProjectBtn || !newProjectEmptyBtn || !openFolderBtn || !openFolderEmptyBtn) {
    console.error('One or more elements not found in setupEventListeners:', {
      editorTextarea: !!editorTextarea,
      fileExplorer: !!fileExplorer,
      lineNumbers: !!lineNumbers,
      newProjectBtn: !!newProjectBtn,
      newProjectEmptyBtn: !!newProjectEmptyBtn,
      openFolderBtn: !!openFolderBtn,
      openFolderEmptyBtn: !!openFolderEmptyBtn
    });
    return;
  }

  // Context menu setup
  if (contextMenu) {
    contextMenu.addEventListener('click', (e) => {
      const action = e.target.closest('.context-menu-item')?.dataset.action;
      if (action) {
        handleContextMenuAction(action);
        contextMenu.classList.remove('show');
      }
    });
  }

  // New Project buttons
  newProjectEmptyBtn.addEventListener('click', createNewProject);
  newProjectBtn.addEventListener('click', createNewProject);

  // Open Folder buttons
  openFolderEmptyBtn.addEventListener('click', openFolder);
  openFolderBtn.addEventListener('click', openFolder);
  
  // Editor change handler
  editorTextarea.addEventListener('input', async (e) => {
    const newContent = e.target.value;
    
    // Update line numbers immediately on content change
    updateLineNumbers();
    
    // Only handle auto-save if we have a current file
    if (currentFilePath && newContent !== currentContent) {
      currentContent = newContent;
      
      // Mark file as modified
      if (activeFileIndex !== -1) {
        openFiles[activeFileIndex].isModified = true;
        openFiles[activeFileIndex].content = newContent;
        updateTabs();
      }
      
      // Trigger save after 1 second of no typing
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          await saveCurrentFile();
          if (activeFileIndex !== -1) {
            openFiles[activeFileIndex].isModified = false;
            updateTabs();
          }
        } catch (error) {
          console.error('Error saving file:', error);
          showError('Save Failed', error.message);
        }
      }, 1000);
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
        
        if (stats.isDirectory === true) {
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
        } else if (stats.isFile === true) {
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
    console.error('Missing required elements for directory toggle');
    return;
  }
  
  // Determine new state
  const newState = expand !== undefined ? expand : !li.classList.contains('expanded');
  
  if (newState) { // Should be expanding
    console.log('Expanding directory:', li.dataset.path);
    arrow.classList.remove('collapsed');
    children.style.display = 'block';
    li.classList.add('expanded');
    li.querySelector('.tree-item')?.setAttribute('aria-expanded', 'true');
    
    // Load children if not already loaded
    if (children.children.length === 0 || (children.children.length === 1 && children.children[0].classList.contains('loading'))) {
      console.log('Loading children for directory:', li.dataset.path);
      
      // Add loading indicator
      const loadingItem = document.createElement('div');
      loadingItem.className = 'loading';
      loadingItem.textContent = 'Loading...';
      children.innerHTML = '';
      children.appendChild(loadingItem);
      
      try {
        const currentDepth = parseInt(li.dataset.depth || '0', 10);
        const contents = await loadDirectoryContents(li.dataset.path, currentDepth + 1, children);
        
        // Clear loading indicator
        children.innerHTML = '';
        
        if (contents instanceof Node) {
          children.appendChild(contents);
        } else if (contents) {
          children.appendChild(contents);
        } else {
          const emptyText = document.createElement('div');
          emptyText.className = 'empty-folder';
          emptyText.textContent = '(empty)';
          children.appendChild(emptyText);
        }
      } catch (error) {
        console.error('Error loading directory contents:', error);
        children.innerHTML = '';
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = `Error loading: ${error.message || 'Unknown error'}`;
        children.appendChild(errorElement);
      }
    }
  } else { // Should be collapsing
    console.log('Collapsing directory:', li.dataset.path);
    arrow.classList.add('collapsed');
    children.style.display = 'none';
    li.classList.remove('expanded');
    li.querySelector('.tree-item')?.setAttribute('aria-expanded', 'false');
  }
}

// Chat functionality
function initializeChat() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('chat-send');
  const chatMessages = document.getElementById('chat-messages');

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

async function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const message = chatInput.value.trim();

  if (message) {
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Add user message to chat
    addMessageToChat('user', message);

    try {
      // Show loading indicator
      const loadingId = addLoadingIndicator();

      // Send message to main process for CodeLlama
      const response = await window.api.sendToCodeLlama(message);

      // Remove loading indicator
      removeLoadingIndicator(loadingId);

      // Add CodeLlama response to chat
      addMessageToChat('assistant', response);
    } catch (error) {
      console.error('Error getting response from CodeLlama:', error);
      addMessageToChat('error', 'Failed to get response from CodeLlama. Please try again.');
    }
  }
}

function addMessageToChat(role, content) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message`;
  
  const roleIndicator = document.createElement('div');
  roleIndicator.className = 'message-role';
  roleIndicator.textContent = role === 'user' ? 'You' : 'CodeLlama';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(roleIndicator);
  messageDiv.appendChild(contentDiv);
  
  // Add copy button for assistant messages
  if (role === 'assistant') {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy'; // Or use an SVG icon later
    copyButton.title = 'Copy message to clipboard';
    copyButton.addEventListener('click', () => {
      // Use Electron's clipboard API via preload
      if (window.api && window.api.clipboard && window.api.clipboard.writeText) {
        window.api.clipboard.writeText(content);
        // Optionally provide visual feedback
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      } else {
        console.error('Clipboard API not available.');
        // Fallback for browser environments (less secure)
        // navigator.clipboard.writeText(content).then(() => { /* feedback */ }).catch(err => console.error('Failed to copy:', err));
      }
    });
    messageDiv.appendChild(copyButton);
  }
  
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingIndicator() {
  const chatMessages = document.getElementById('chat-messages');
  const loadingDiv = document.createElement('div');
  const loadingId = 'loading-' + Date.now();
  loadingDiv.id = loadingId;
  loadingDiv.className = 'chat-message loading-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = 'CodeLlama is thinking...';
  
  loadingDiv.appendChild(contentDiv);
  chatMessages.appendChild(loadingDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return loadingId;
}

function removeLoadingIndicator(loadingId) {
  const loadingDiv = document.getElementById(loadingId);
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

// Initialize the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    // Update line numbers initially after the DOM is ready
    updateLineNumbers();
  });
} else {
  init();
  // Update line numbers initially if the DOM is already ready
  updateLineNumbers();
}