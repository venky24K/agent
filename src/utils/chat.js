// Chat functionality
document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  // Show welcome message when chat is empty
  function showWelcomeMessage() {
    const welcomeHTML = `
      <div class="welcome-message">
        <div class="welcome-content">
          <h1>Welcome to Codelamma AI Assistant</h1>
          <p>I'm here to help you solve coding problems, debug issues, and build amazing applications.
             Let's work together to make your development journey smoother!</p>
          
          <div class="welcome-cards">
            <div class="welcome-card">
              <h3>💡 Get Started</h3>
              <p>Ask me anything about coding, debugging, or software development.</p>
            </div>
            <div class="welcome-card">
              <h3>🚀 Quick Tips</h3>
              <p>Be specific in your questions for the best results. I can help with code reviews, architecture, and more.</p>
            </div>
          </div>
          
          <div class="welcome-footer">
            Type your message below to start the conversation
          </div>
        </div>
      </div>
    `;
    chatMessages.innerHTML = welcomeHTML;
  }

  // Initialize welcome message
  showWelcomeMessage();

  // Hide welcome message when user starts typing
  chatInput.addEventListener('input', () => {
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage && chatInput.value.trim().length > 0) {
      welcomeMessage.style.opacity = '0';
      welcomeMessage.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => {
        welcomeMessage.remove();
      }, 300);
    }
  });

  // Handle sending messages
  chatSend.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
      // Clear welcome message when first message is sent
      if (chatMessages.querySelector('.welcome-message')) {
        chatMessages.innerHTML = '';
      }
      
      // Add user message
      const userMessageHTML = `
        <div class="message user-message">
          <div class="message-content">${message}</div>
        </div>
      `;
      chatMessages.insertAdjacentHTML('beforeend', userMessageHTML);
      
      // Clear input
      chatInput.value = '';
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // TODO: Handle AI response here
    }
  });

  // Handle Enter key
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatSend.click();
    }
  });
}); 