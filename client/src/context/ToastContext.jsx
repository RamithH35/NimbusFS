import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => {
          let leftBorder = 'border-l-4 border-l-primary';
          if (toast.type === 'success') {
            leftBorder = 'border-l-4 border-l-accent-green';
          } else if (toast.type === 'error') {
            leftBorder = 'border-l-4 border-l-accent-orange';
          }

          return (
            <div
              key={toast.id}
              onClick={() => removeToast(toast.id)}
              className={`flex items-start justify-between bg-white text-ink-secondary text-sm p-4 rounded-xl shadow-level-2 border border-hairline cursor-pointer animate-slide-in ${leftBorder}`}
            >
              <div className="pr-4">{toast.message}</div>
              <button className="text-ink-muted hover:text-ink font-bold text-xs select-none">✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
