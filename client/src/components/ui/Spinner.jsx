import React from 'react';

export const Spinner = ({
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-primary border-hairline ${sizeClasses[size]} ${className}`}
      style={{ borderStyle: 'solid' }}
      {...props}
    />
  );
};

export default Spinner;
