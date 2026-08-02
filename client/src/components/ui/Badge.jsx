import React from 'react';

export const Badge = ({
  children,
  color = 'gray',
  className = '',
  ...props
}) => {
  const colorMap = {
    blue: 'bg-primary/10 text-primary border border-primary/20',
    green: 'bg-accent-green/10 text-accent-green border border-accent-green/20',
    gray: 'bg-hairline text-ink-muted border border-hairline',
    orange: 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20',
    red: 'bg-accent-orange-deep/10 text-accent-orange-deep border border-accent-orange-deep/20',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold select-none ${colorMap[color] || colorMap.gray} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
