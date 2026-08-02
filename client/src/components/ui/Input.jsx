import React from 'react';

export const Input = ({
  label,
  error,
  type = 'text',
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col text-left w-full mb-4">
      {label && <label className="text-xs font-semibold text-ink-secondary mb-1.5">{label}</label>}
      <input
        type={type}
        className={`w-full px-3 py-2 text-sm bg-surface border border-hairline rounded-xs focus:outline-none focus:border-primary focus:shadow-level-1 transition-all ${error ? 'border-accent-orange' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-ink-muted mt-1">{error}</span>}
    </div>
  );
};

export default Input;
