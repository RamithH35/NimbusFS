import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/client';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Badge from '../ui/Badge';

const EXPIRY_OPTIONS = [
    { label: 'No expiry', value: '' },
    { label: '1 hour', value: '1h' },
    { label: '1 day', value: '1d' },
    { label: '7 days', value: '7d' },
];

const formatExpiryLabel = (expiresAt) => {
    if (!expiresAt) return 'No expiry';
    const expiresDate = new Date(expiresAt);
    if (isNaN(expiresDate.getTime())) return 'No expiry';

    const diffMs = expiresDate.getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffHours >= 168) return 'Expires in 7 days';
    if (diffHours >= 24 && diffHours % 24 === 0) return `Expires in ${diffHours / 24} day${diffHours / 24 > 1 ? 's' : ''}`;
    if (diffHours >= 1) return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffMinutes >= 1) return `Expires in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    return 'Expires soon';
};

export const ShareModal = ({ file, isOpen, onClose, onShareStateChange }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [revoking, setRevoking] = useState(false);

    // Share configuration state
    const [visibility, setVisibility] = useState('private');
    const [expiry, setExpiry] = useState('');
    const [passwordProtected, setPasswordProtected] = useState(false);
    const [password, setPassword] = useState('');
    const [maxDownloads, setMaxDownloads] = useState('');

    // Manage state
    const [shareUrl, setShareUrl] = useState('');
    const [expiresAt, setExpiresAt] = useState(null);
    const [downloadCount, setDownloadCount] = useState(0);
    const [shareMaxDownloads, setShareMaxDownloads] = useState(null);
    const [copied, setCopied] = useState(false);

    // Reset state whenever the modal target file changes or opens
    useEffect(() => {
        if (!isOpen || !file) return;
        setVisibility(file.visibility === 'shared' ? 'shared' : 'private');
        // If the file is already shared, reconstruct the public URL from its shareId
        const origin = window.location.origin;
        setShareUrl(file.visibility === 'shared' && file.shareId ? `${origin}/share/${file.shareId}` : '');
        setExpiresAt(file.expiresAt || null);
        setShareMaxDownloads(file.maxDownloads ?? null);
        setDownloadCount(file.downloadCount || 0);
        setPasswordProtected(false);
        setPassword('');
        setMaxDownloads('');
        setExpiry('');
        setCopied(false);
        setLoading(false);
        setRevoking(false);
    }, [isOpen, file]);

    // Escape key closes modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading && !revoking) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, loading, revoking, onClose]);

    const fileId = file?._id || file?.id;
    const isCreateMode = visibility === 'private';

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !loading && !revoking) {
            onClose();
        }
    };

    const buildShareUrl = useMemo(() => {
        // Prefer the shareUrl returned by backend; otherwise construct from current origin
        if (shareUrl) return shareUrl;
        return '';
    }, [shareUrl]);

    const handleGenerateShare = async () => {
        if (!fileId) return;
        setLoading(true);
        try {
            const body = {
                expiresIn: expiry,
                ...(passwordProtected && password ? { password } : {}),
                ...(maxDownloads ? { maxDownloads: parseInt(maxDownloads, 10) } : {}),
            };

            const result = await apiFetch(`/api/files/${fileId}/share`, {
                method: 'POST',
                body: JSON.stringify(body),
            });

            const sharedFile = result.file;
            setVisibility('shared');
            setShareUrl(result.shareUrl || '');
            setExpiresAt(sharedFile?.expiresAt || null);
            setShareMaxDownloads(sharedFile?.maxDownloads ?? null);
            setDownloadCount(sharedFile?.downloadCount || 0);
            setPasswordProtected(!!password);
            showToast('Share link generated successfully', 'success');
            onShareStateChange?.(sharedFile || file);
        } catch (err) {
            showToast(err.message || 'Failed to generate share link', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!buildShareUrl) return;
        try {
            await navigator.clipboard.writeText(buildShareUrl);
        } catch (err) {
            // Fallback for non-secure contexts
            const textarea = document.createElement('textarea');
            textarea.value = buildShareUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        setCopied(true);
        showToast('Share link copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevokeShare = async () => {
        if (!fileId) return;
        setRevoking(true);
        try {
            await apiFetch(`/api/files/${fileId}/revoke-share`, {
                method: 'POST',
            });
            setVisibility('private');
            setShareUrl('');
            setExpiresAt(null);
            setShareMaxDownloads(null);
            setDownloadCount(0);
            setPasswordProtected(false);
            setPassword('');
            setMaxDownloads('');
            setExpiry('');
            showToast('Share link revoked', 'success');
            onShareStateChange?.(file);
        } catch (err) {
            showToast(err.message || 'Failed to revoke share link', 'error');
        } finally {
            setRevoking(false);
        }
    };

    if (!isOpen || !file) return null;

    const toggleSwitch = (
        <button
            type="button"
            role="switch"
            aria-checked={passwordProtected}
            onClick={() => setPasswordProtected((prev) => !prev)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${passwordProtected ? 'bg-primary' : 'bg-hairline'}`}
            disabled={loading || revoking}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${passwordProtected ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
            />
        </button>
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={isCreateMode ? 'Create share link' : 'Manage share link'}
        >
            <Card elevated={true} className="w-full max-w-md bg-surface shadow-level-2 animate-slide-in relative flex flex-col p-6">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-ink-muted hover:text-ink font-bold text-xs select-none cursor-pointer"
                    disabled={loading || revoking}
                    aria-label="Close modal"
                >
                    ✕
                </button>

                <h2 className="text-lg font-bold text-ink mb-1">
                    {isCreateMode ? 'Share File' : 'Manage Share'}
                </h2>
                <p className="text-xs text-ink-muted mb-5 truncate">
                    {file.originalName}
                </p>

                {isCreateMode ? (
                    /* ─── CREATE SHARE STATE ─── */
                    <div className="space-y-5">
                        {/* Expiry radios */}
                        <div>
                            <p className="text-xs font-semibold text-ink-secondary mb-2">Expiry</p>
                            <div className="grid grid-cols-2 gap-2">
                                {EXPIRY_OPTIONS.map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${expiry === opt.value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-hairline text-ink-secondary hover:bg-canvas-soft'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="share-expiry"
                                            value={opt.value}
                                            checked={expiry === opt.value}
                                            onChange={() => setExpiry(opt.value)}
                                            className="accent-primary w-3.5 h-3.5"
                                            disabled={loading}
                                        />
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Password protection toggle */}
                        <div className="flex items-center justify-between border border-hairline rounded-md px-3 py-2.5">
                            <div>
                                <p className="text-xs font-semibold text-ink-secondary">Password protection</p>
                                <p className="text-[11px] text-ink-muted">Require a password to download</p>
                            </div>
                            {toggleSwitch}
                        </div>

                        {passwordProtected && (
                            <div>
                                <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
                                    Share Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter a password"
                                    className="w-full px-3 py-2 text-sm bg-surface border border-hairline rounded-xs focus:outline-none focus:border-primary focus:shadow-level-1 transition-all text-ink placeholder-ink-faint"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        {/* Max downloads */}
                        <div>
                            <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
                                Max downloads
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={maxDownloads}
                                onChange={(e) => setMaxDownloads(e.target.value)}
                                placeholder="Unlimited"
                                className="w-full px-3 py-2 text-sm bg-surface border border-hairline rounded-xs focus:outline-none focus:border-primary focus:shadow-level-1 transition-all text-ink placeholder-ink-faint"
                                disabled={loading}
                            />
                            <p className="text-[11px] text-ink-muted mt-1">Leave blank for unlimited downloads</p>
                        </div>

                        {/* Footer actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                            <Button onClick={onClose} variant="secondary" size="sm" disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerateShare}
                                variant="primary"
                                size="sm"
                                loading={loading}
                                disabled={loading}
                            >
                                Generate Share Link
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ─── MANAGE SHARE STATE ─── */
                    <div className="space-y-5">
                        {/* Share URL + Copy */}
                        <div>
                            <label className="text-xs font-semibold text-ink-secondary mb-1.5 block">
                                Share Link
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={buildShareUrl}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="Generating link..."
                                    className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-canvas-soft border border-hairline rounded-xs focus:outline-none focus:border-primary text-ink-secondary truncate"
                                />
                                <Button
                                    onClick={handleCopyLink}
                                    variant="utility"
                                    size="sm"
                                    className="shrink-0 px-3"
                                    disabled={!buildShareUrl}
                                >
                                    {copied ? 'Copied!' : 'Copy Link'}
                                </Button>
                            </div>
                            <p className="text-[11px] text-ink-muted mt-1.5 break-all">{buildShareUrl}</p>
                        </div>

                        {/* Share metadata */}
                        <div className="border border-hairline rounded-md divide-y divide-hairline">
                            <div className="flex items-center justify-between px-3 py-2.5">
                                <span className="text-xs text-ink-muted">Expiry</span>
                                <span className="text-xs font-semibold text-ink-secondary">
                                    {formatExpiryLabel(expiresAt)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2.5">
                                <span className="text-xs text-ink-muted">Downloads</span>
                                <span className="text-xs font-semibold text-ink-secondary">
                                    {shareMaxDownloads ? `${downloadCount} / ${shareMaxDownloads}` : `${downloadCount}`} {downloadCount === 1 ? 'download' : 'downloads'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2.5">
                                <span className="text-xs text-ink-muted">Password</span>
                                {passwordProtected ? (
                                    <Badge color="orange">🔒 Password protected</Badge>
                                ) : (
                                    <span className="text-xs font-semibold text-ink-faint">Not set</span>
                                )}
                            </div>
                        </div>

                        {/* Footer actions */}
                        <div className="flex justify-between items-center gap-3 pt-4 border-t border-hairline">
                            <button
                                onClick={handleRevokeShare}
                                className="inline-flex items-center px-4 py-1.5 text-xs font-medium rounded-full border border-accent-orange/30 text-accent-orange hover:bg-accent-orange/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={revoking}
                            >
                                {revoking ? (
                                    <span className="flex items-center gap-2">
                                        <Spinner size="sm" className="border-t-current" />
                                        Revoking...
                                    </span>
                                ) : (
                                    'Revoke Share'
                                )}
                            </button>
                            <Button onClick={onClose} variant="secondary" size="sm" disabled={revoking}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ShareModal;
