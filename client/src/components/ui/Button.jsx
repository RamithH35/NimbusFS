import React from 'react';
import Spinner from './Spinner';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary-active rounded-full',
    secondary: 'bg-surface border border-hairline text-ink-secondary hover:bg-canvas-soft rounded-full',
    utility: 'bg-surface border border-hairline text-ink-secondary hover:bg-canvas-soft rounded-md',
  };

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-xs',
    md: 'px-6 py-2.5 text-sm',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2 border-t-current" />}
      {children}
    </button>
  );
};

export default Button;
