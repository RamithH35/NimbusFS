import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle = ({ className = '', ...props }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2 rounded-full hover:bg-canvas-soft text-ink transition-colors border border-hairline bg-surface select-none cursor-pointer flex items-center justify-center ${className}`}
      aria-label="Toggle theme"
      {...props}
    >
      {theme === 'light' ? (
        // Moon Icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-ink"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
          />
        </svg>
      ) : (
        // Sun Icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-ink"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m0 13.5V21M4.93 4.93l1.59 1.59m10.96 10.96l1.59 1.59m-16.5 0l1.59-1.59m10.96-10.96l1.59-1.59M3 12h2.25m13.5 0H21m-9-9a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5z"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
