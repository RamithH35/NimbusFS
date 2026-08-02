import React from 'react';

export const Card = ({
  children,
  elevated = false,
  className = '',
  ...props
}) => {
  const borderClass = elevated ? 'shadow-level-1 border-0' : 'border border-hairline';
  return (
    <div
      className={`rounded-xl bg-surface p-6 ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
