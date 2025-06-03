import React from 'react';

export const WelcomeMessage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-8 text-center">
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          Welcome to Codelamma AI Assistant
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          I'm here to help you solve coding problems, debug issues, and build amazing applications.
          Let's work together to make your development journey smoother!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">💡 Get Started</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ask me anything about coding, debugging, or software development.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
            <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">🚀 Quick Tips</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Be specific in your questions for the best results. I can help with code reviews, architecture, and more.
            </p>
          </div>
        </div>
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          Type your message below to start the conversation
        </div>
      </div>
    </div>
  );
};

export default WelcomeMessage; 