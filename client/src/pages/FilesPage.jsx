import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import UploadModal from '../components/files/UploadModal';
import ShareModal from '../components/files/ShareModal';
import EmptyState from '../components/ui/EmptyState';

export const FilesPage = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals / dialogs state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/files?page=${currentPage}&limit=20`);
      setFiles(data.files || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      showToast(err.message || 'Failed to fetch files', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, showToast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (file) => {
    try {
      const token = localStorage.getItem('nimbusfs_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/files/${file._id || file.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Download failed');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Started download: ${file.originalName}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download file', 'error');
    }
  };

  const handleDeleteTrigger = (file) => {
    setDeleteTarget(file);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/files/${deleteTarget._id || deleteTarget.id}`, {
        method: 'DELETE',
      });
      showToast('File deleted successfully', 'success');
      fetchFiles();
      setDeleteTarget(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete file', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleShare = (file) => {
    setShareTarget(file);
  };

  const handleShareStateChange = () => {
    // Refresh file list after share / revoke
    fetchFiles();
  };

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

  // Client-side search filtering
  const filteredFiles = files.filter(f =>
    f.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6 text-left select-none">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">My Files</h1>
            <p className="text-xs text-ink-muted mt-0.5">Upload, download, search, or remove files.</p>
          </div>
          <Button
            onClick={() => setIsUploadOpen(true)}
            variant="primary"
            size="sm"
          >
            Upload File
          </Button>
        </div>

        {/* Filter input */}
        <Card elevated={true} className="p-4 bg-surface border border-hairline flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-ink-muted mr-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm bg-transparent border-0 outline-none text-ink focus:ring-0 placeholder-ink-muted"
          />
        </Card>

        {/* Table list */}
        <Card elevated={true} className="p-6 bg-surface border border-hairline">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No files match your query"
              description="Try refining your search keyword or upload new items."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted text-xs">
                    <th className="py-3 font-medium">Name</th>
                    <th className="py-3 font-medium">Size</th>
                    <th className="py-3 font-medium">Provider</th>
                    <th className="py-3 font-medium">Date Uploaded</th>
                    <th className="py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredFiles.map((file) => (
                    <tr key={file._id || file.id} className="text-ink-secondary hover:bg-canvas-soft/50">
                      <td className="py-3.5 font-medium text-ink truncate max-w-[220px]">{file.originalName}</td>
                      <td className="py-3.5 text-xs">{formatSize(file.size)}</td>
                      <td className="py-3.5">
                        <Badge color={getProviderColor(file.provider)}>{file.provider}</Badge>
                      </td>
                      <td className="py-3.5 text-xs text-ink-muted">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        <Button
                          onClick={() => handleDownload(file)}
                          variant="utility"
                          size="sm"
                          className="px-2.5 py-1 text-[11px]"
                        >
                          Download
                        </Button>
                        <Button
                          onClick={() => handleShare(file)}
                          variant="utility"
                          size="sm"
                          className="px-2.5 py-1 text-[11px]"
                        >
                          Share
                        </Button>
                        <Button
                          onClick={() => handleDeleteTrigger(file)}
                          variant="secondary"
                          size="sm"
                          className="px-2.5 py-1 text-[11px] text-accent-orange border-accent-orange/30 hover:bg-accent-orange/5"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-hairline">
                <span className="text-xs text-ink-muted">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    variant="secondary"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    variant="secondary"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Upload Modal */}
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={fetchFiles}
        />

        {/* Share Modal */}
        <ShareModal
          file={shareTarget}
          isOpen={!!shareTarget}
          onClose={() => setShareTarget(null)}
          onShareStateChange={handleShareStateChange}
        />

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Delete File"
          message={`Are you sure you want to permanently delete "${deleteTarget?.originalName}"? This action cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          loading={deleteLoading}
        />
      </div>
    </AppShell>
  );
};

export default FilesPage;
