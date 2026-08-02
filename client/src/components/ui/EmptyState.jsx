import React from 'react';

export const EmptyState = ({
    icon = '📄',
    title = 'Nothing here yet',
    description = '',
    action = null,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center bg-canvas-soft rounded-xl px-8 py-12 ${className}`}>
            <span className="text-3xl mb-3 select-none" aria-hidden="true">{icon}</span>
            <p className="text-sm font-semibold text-ink-secondary">{title}</p>
            {description && (
                <p className="text-xs text-ink-muted mt-1.5 max-w-sm leading-relaxed">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
};

export default EmptyState;
