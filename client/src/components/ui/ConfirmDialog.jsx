
import React, { useEffect } from 'react';
import Card from './Card';
import Button from './Button';

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}) => {
  // Escape key closes dialog (disabled while an action is in progress)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const confirmButtonColor = variant === 'danger' ? 'bg-accent-orange hover:bg-accent-orange-deep text-white border-0' : 'bg-primary hover:bg-primary-active text-white border-0';

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
      onClick={handleBackdropClick}
    >
      <Card elevated={true} className="w-full max-w-md bg-surface shadow-level-2 animate-slide-in">
        <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
        <p className="text-sm text-ink-secondary mb-6 leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3">
          <Button
            onClick={onCancel}
            variant="secondary"
            disabled={loading}
            size="sm"
          >
            {cancelText}
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-1.5 text-xs font-medium rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${confirmButtonColor}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmDialog;
