// Handle ResizeObserver loop errors
const resizeObserverErrHandler = (entries, observer) => {
  requestAnimationFrame(() => {
    if (!Array.isArray(entries) || !entries.length) {
      return;
    }
    // Handle resize observations here if needed
  });
};

// Create a safe ResizeObserver
class SafeResizeObserver extends ResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      try {
        callback(entries, observer);
      } catch (e) {
        // Ignore ResizeObserver loop errors
        const isResizeLoopErr = e.name === 'ResizeObserverLoopError';
        if (!isResizeLoopErr) {
          console.error(e);
        }
      }
    });
  }
}

// Override the global ResizeObserver
window.ResizeObserver = window.ResizeObserver || SafeResizeObserver;

// Export for testing if needed
export { SafeResizeObserver, resizeObserverErrHandler };
