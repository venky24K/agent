import React from 'react';

interface ThinkingAnimationProps {
  text?: string;
  className?: string;
}

export const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({
  text = "Codelamma is thinking",
  className = "",
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-gray-700 dark:text-gray-300">{text}</span>
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ThinkingAnimation; 