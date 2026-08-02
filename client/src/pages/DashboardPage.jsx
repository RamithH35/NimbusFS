import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Call logout endpoint
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout endpoint failed, logging out client anyway:', err.message);
    } finally {
      logout();
      showToast('Logged out successfully', 'info');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-4 py-12">
      <div className="w-full max-w-md">
        <Card elevated={true} className="text-center space-y-6">
          <div className="flex flex-col items-center">
            {user && (
              <>
                <div className="w-16 h-16 rounded-full border border-hairline bg-canvas-soft overflow-hidden mb-3">
                  <img
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=${user.avatarSeed}`}
                    alt="User avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-lg font-bold text-ink mb-1">Welcome, {user.name}!</h2>
                <span className="text-xs text-ink-muted">{user.email}</span>
              </>
            )}
          </div>

          <div className="border-t border-hairline my-4 pt-4">
            <h3 className="text-sm font-semibold text-ink-secondary mb-2">Dashboard coming in Phase B</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Your secure storage file viewer, uploads, lists, and settings will appear here in the next phase.
            </p>
          </div>

          <Button
            onClick={handleLogout}
            variant="secondary"
            loading={loading}
            className="w-full"
          >
            Log Out
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
