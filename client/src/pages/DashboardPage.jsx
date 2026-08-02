import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import UploadModal from '../components/files/UploadModal';
import ShareModal from '../components/files/ShareModal';
import EmptyState from '../components/ui/EmptyState';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [providers, setProviders] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [usedStorageBytes, setUsedStorageBytes] = useState(0);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    // 1. Fetch health
    try {
      setLoadingHealth(true);
      const healthData = await apiFetch('/api/health/storage');
      setProviders(healthData.providers || []);
    } catch (err) {
      console.error('Failed to load storage health:', err.message);
      showToast('Could not load storage provider status', 'error');
    } finally {
      setLoadingHealth(false);
    }

    // 2. Fetch recent files
    try {
      setLoadingFiles(true);
      const filesData = await apiFetch('/api/files?limit=5&page=1');
      setRecentFiles(filesData.files || []);
      setTotalFilesCount(filesData.pagination?.total || 0);

      // Sum all file sizes to compute total storage usage
      const allFiles = await apiFetch('/api/files?limit=100&page=1');
      const sum = (allFiles.files || []).reduce((acc, f) => acc + (f.size || 0), 0);
      setUsedStorageBytes(sum);
    } catch (err) {
      console.error('Failed to load recent files:', err.message);
    } finally {
      setLoadingFiles(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getProviderColor = (p) => {
    if (p === 'cloudinary') return 'blue';
    if (p === 'supabase') return 'green';
    return 'gray';
  };

  const handleShare = (file) => {
    setShareTarget(file);
  };

  const handleShareStateChange = () => {
    fetchDashboardData();
  };

  const TOTAL_STORAGE_LIMIT_BYTES = 50 * 1024 * 1024; // 50MB Virtual Storage Limit
  const storagePercentage = Math.min(Math.round((usedStorageBytes / TOTAL_STORAGE_LIMIT_BYTES) * 100), 100);

  return (
    <AppShell>
      <div className="space-y-6 text-left select-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">Dashboard</h1>
            <p className="text-xs text-ink-muted mt-0.5">Overall health, storage details, and recent uploads.</p>
          </div>
          <Button
            onClick={() => setIsUploadOpen(true)}
            variant="primary"
            size="sm"
          >
            Upload File
          </Button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Storage Usage Card */}
          <Card elevated={true} className="flex flex-col justify-between p-6 bg-surface border border-hairline">
            <div>
              <h2 className="text-sm font-bold text-ink mb-1">Storage Usage</h2>
              <span className="text-xs text-ink-muted">Used space of virtual allowance</span>
            </div>

            <div className="my-6">
              <div className="flex justify-between text-xs font-semibold text-ink-secondary mb-2">
                <span>{formatSize(usedStorageBytes)} used</span>
                <span>{formatSize(TOTAL_STORAGE_LIMIT_BYTES)} limit</span>
              </div>
              <div className="h-2.5 w-full bg-hairline rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
            </div>

            <div className="text-xs text-ink-muted flex items-center justify-between">
              <span>Files count: {totalFilesCount}</span>
              <span className="font-semibold">{storagePercentage}% occupied</span>
            </div>
          </Card>

          {/* Provider status list */}
          <Card elevated={true} className="lg:col-span-2 p-6 bg-surface border border-hairline">
            <h2 className="text-sm font-bold text-ink mb-1">Storage Providers Status</h2>
            <p className="text-xs text-ink-muted mb-4">Failover status and API latency measurements.</p>

            {loadingHealth ? (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {providers.map((p) => (
                  <div key={p.provider} className="border border-hairline rounded-md p-4 bg-canvas-soft flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold capitalize text-ink-secondary">{p.provider}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${p.healthy ? 'bg-accent-green' : 'bg-accent-orange'}`} />
                          <span className="text-[10px] uppercase font-semibold text-ink-muted">
                            {p.healthy ? 'Healthy' : 'Down'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-ink-muted">Latency: <span className="font-semibold text-ink-secondary">{p.latency}ms</span></p>
                    </div>
                    <div className="mt-3 text-[10px] text-ink-faint border-t border-hairline pt-2">
                      NimbusFS Failover target
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent files */}
        <Card elevated={true} className="p-6 bg-surface border border-hairline">
          <h2 className="text-sm font-bold text-ink mb-1">Recent Uploads</h2>
          <p className="text-xs text-ink-muted mb-4">Latest 5 files uploaded to your cloud storage.</p>

          {loadingFiles ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : recentFiles.length === 0 ? (
            <EmptyState
              icon="📂"
              title="No files uploaded yet"
              description="Upload your first image, text, or binary file using the upload button to get started."
              action={
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  variant="secondary"
                  size="sm"
                >
                  Upload File
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted text-xs">
                    <th className="py-2.5 font-medium">Name</th>
                    <th className="py-2.5 font-medium">Size</th>
                    <th className="py-2.5 font-medium">Provider</th>
                    <th className="py-2.5 font-medium">Date</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {recentFiles.map((file) => (
                    <tr key={file._id || file.id} className="text-ink-secondary hover:bg-canvas-soft/50">
                      <td className="py-3 font-medium text-ink truncate max-w-[200px]">{file.originalName}</td>
                      <td className="py-3 text-xs">{formatSize(file.size)}</td>
                      <td className="py-3">
                        <Badge color={getProviderColor(file.provider)}>{file.provider}</Badge>
                      </td>
                      <td className="py-3 text-xs text-ink-muted">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          onClick={() => handleShare(file)}
                          variant="utility"
                          size="sm"
                          className="px-2.5 py-1 text-[11px]"
                        >
                          Share
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Upload Modal */}
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={fetchDashboardData}
        />

        {/* Share Modal */}
        <ShareModal
          file={shareTarget}
          isOpen={!!shareTarget}
          onClose={() => setShareTarget(null)}
          onShareStateChange={handleShareStateChange}
        />
      </div>
    </AppShell>
  );
};

export default DashboardPage;
