import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ShareModal from '../components/files/ShareModal';

const formatExpiry = (expiresAt) => {
    if (!expiresAt) return 'No expiry';
    const expiresDate = new Date(expiresAt);
    if (isNaN(expiresDate.getTime())) return 'No expiry';

    const diffMs = expiresDate.getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 7) return `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours >= 1) return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return 'Expires soon';
};

const getProviderColor = (p) => {
    if (p === 'cloudinary') return 'blue';
    if (p === 'supabase') return 'green';
    return 'gray';
};

const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const SharedPage = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState([]);
    const [shareTarget, setShareTarget] = useState(null);
    const [revokeTarget, setRevokeTarget] = useState(null);
    const [revokeLoading, setRevokeLoading] = useState(false);

    const fetchSharedFiles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/api/files?limit=100&page=1');
            const allFiles = data.files || [];
            // Client-side filter for shared visibility
            const sharedFiles = allFiles.filter((f) => f.visibility === 'shared');
            setFiles(sharedFiles);
        } catch (err) {
            showToast(err.message || 'Failed to fetch shared files', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchSharedFiles();
    }, [fetchSharedFiles]);

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
            fetchSharedFiles();
        } catch (err) {
            showToast(err.message || 'Failed to download file', 'error');
        }
    };

    const handleManageShare = (file) => {
        setShareTarget(file);
    };

    const handleRevokeTrigger = (file) => {
        setRevokeTarget(file);
    };

    const handleRevokeConfirm = async () => {
        if (!revokeTarget) return;
        setRevokeLoading(true);
        try {
            await apiFetch(`/api/files/${revokeTarget._id || revokeTarget.id}/revoke-share`, {
                method: 'POST',
            });
            showToast('Share link revoked', 'success');
            fetchSharedFiles();
            setRevokeTarget(null);
        } catch (err) {
            showToast(err.message || 'Failed to revoke share link', 'error');
        } finally {
            setRevokeLoading(false);
        }
    };

    const handleShareStateChange = () => {
        fetchSharedFiles();
    };

    return (
        <AppShell>
            <div className="space-y-6 text-left select-none">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-ink">Shared Files</h1>
                        <p className="text-xs text-ink-muted mt-0.5">Files you've shared with public links.</p>
                    </div>
                </div>

                {/* Shared files table */}
                <Card elevated={true} className="p-6 bg-surface border border-hairline">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Spinner size="md" />
                        </div>
                    ) : files.length === 0 ? (
                        <EmptyState
                            icon="🔗"
                            title="No shared files yet"
                            description="Share a file from My Files to see it here."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-hairline text-ink-muted text-xs">
                                        <th className="py-3 font-medium">Name</th>
                                        <th className="py-3 font-medium">Size</th>
                                        <th className="py-3 font-medium">Provider</th>
                                        <th className="py-3 font-medium">Shared</th>
                                        <th className="py-3 font-medium">Expiry</th>
                                        <th className="py-3 font-medium">Downloads</th>
                                        <th className="py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {files.map((file) => (
                                        <tr key={file._id || file.id} className="text-ink-secondary hover:bg-canvas-soft/50">
                                            <td className="py-3.5 font-medium text-ink truncate max-w-[180px]">{file.originalName}</td>
                                            <td className="py-3.5 text-xs">{formatSize(file.size)}</td>
                                            <td className="py-3.5">
                                                <Badge color={getProviderColor(file.provider)}>{file.provider}</Badge>
                                            </td>
                                            <td className="py-3.5 text-xs text-ink-muted">
                                                {new Date(file.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="py-3.5 text-xs text-ink-muted">
                                                {formatExpiry(file.expiresAt)}
                                            </td>
                                            <td className="py-3.5 text-xs">
                                                {file.maxDownloads ? `${file.downloadCount} / ${file.maxDownloads}` : `${file.downloadCount || 0}`}
                                            </td>
                                            <td className="py-3.5 text-right space-x-2 whitespace-nowrap">
                                                <Button
                                                    onClick={() => handleDownload(file)}
                                                    variant="utility"
                                                    size="sm"
                                                    className="px-2.5 py-1 text-[11px]"
                                                >
                                                    Download
                                                </Button>
                                                <Button
                                                    onClick={() => handleManageShare(file)}
                                                    variant="utility"
                                                    size="sm"
                                                    className="px-2.5 py-1 text-[11px]"
                                                >
                                                    Manage
                                                </Button>
                                                <Button
                                                    onClick={() => handleRevokeTrigger(file)}
                                                    variant="secondary"
                                                    size="sm"
                                                    className="px-2.5 py-1 text-[11px] text-accent-orange border-accent-orange/30 hover:bg-accent-orange/5"
                                                >
                                                    Revoke
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* Manage Share Modal — opens in MANAGE state (file.visibility === 'shared') */}
                <ShareModal
                    file={shareTarget}
                    isOpen={!!shareTarget}
                    onClose={() => setShareTarget(null)}
                    onShareStateChange={handleShareStateChange}
                />

                {/* Confirm Revoke Dialog */}
                <ConfirmDialog
                    isOpen={!!revokeTarget}
                    title="Revoke Share"
                    message={`Are you sure you want to revoke the public share link for "${revokeTarget?.originalName}"? The link will stop working immediately.`}
                    onConfirm={handleRevokeConfirm}
                    onCancel={() => setRevokeTarget(null)}
                    confirmText="Revoke"
                    cancelText="Cancel"
                    variant="danger"
                    loading={revokeLoading}
                />
            </div>
        </AppShell>
    );
};

export default SharedPage;
