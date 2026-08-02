import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getFilenameFromDisposition = (disposition, fallback) => {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) return decodeURIComponent(utfMatch[1]);
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
};

export const SharePage = () => {
  const { shareId } = useParams();

  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileInfo, setFileInfo] = useState({ name: '', size: null, mime: '' });
  const [isDownloading, setIsDownloading] = useState(false);
  const fileBlobRef = useRef(null);

  const formatSize = useCallback((bytes) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Process a successful binary response: extract filename + blob
  const processDownloadResponse = useCallback(async (res) => {
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const filename = getFilenameFromDisposition(disposition, `download_${shareId}.bin`);
    const mime = res.headers.get('content-type') || blob.type || 'application/octet-stream';
    fileBlobRef.current = blob;
    setFileInfo({ name: filename, size: blob.size, mime });
  }, [shareId]);

  // Initial fetch on mount (public, no auth header)
  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    fileBlobRef.current = null;

    try {
      const res = await fetch(`${API_URL}/api/share/${shareId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/octet-stream' },
      });

      if (res.status === 200) {
        await processDownloadResponse(res);
      } else if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body.requiresPassword) {
          setRequiresPassword(true);
          setPasswordError('');
        } else {
          setErrorMessage('Incorrect password');
        }
      } else if (res.status === 410) {
        setErrorMessage('This link has expired or reached its download limit');
      } else if (res.status === 403) {
        setErrorMessage('This file is private');
      } else if (res.status === 404) {
        setErrorMessage('Share link not found');
      } else {
        setErrorMessage('Something went wrong. Please try again later.');
      }
    } catch (err) {
      setErrorMessage('Unable to reach the server. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [shareId, processDownloadResponse]);

  useEffect(() => {
    setPassword('');
    setRequiresPassword(false);
    fetchInitial();
  }, [fetchInitial]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter a password');
      return;
    }
    setSubmittingPassword(true);
    setPasswordError('');

    try {
      const res = await fetch(`${API_URL}/api/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.status === 200) {
        await processDownloadResponse(res);
        setRequiresPassword(false);
        setPassword('');
      } else if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        // Invalid password (no requiresPassword flag) — show error under input
        setPasswordError('Incorrect password');
      } else if (res.status === 410) {
        setErrorMessage('This link has expired or reached its download limit');
        setRequiresPassword(false);
      } else if (res.status === 403) {
        setErrorMessage('This file is private');
        setRequiresPassword(false);
      } else if (res.status === 404) {
        setErrorMessage('Share link not found');
        setRequiresPassword(false);
      } else {
        setPasswordError('Something went wrong. Please try again.');
      }
    } catch (err) {
      setPasswordError('Unable to reach the server. Please try again later.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleDownload = () => {
    if (!fileBlobRef.current) return;
    setIsDownloading(true);
    try {
      const url = window.URL.createObjectURL(fileBlobRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorMessage('Failed to start download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas-soft px-4 py-12 select-none">
      {/* NimbusFS wordmark */}
      <div className="mb-10">
        <span className="text-2xl font-bold tracking-tight text-ink font-sans">NimbusFS</span>
      </div>

      <div className="w-full max-w-md">
        {loading ? (
          <Card elevated={true} className="flex flex-col items-center justify-center py-16 bg-surface">
            <Spinner size="md" />
            <p className="text-xs text-ink-muted mt-4">Loading share...</p>
          </Card>
        ) : errorMessage ? (
          /* ─── Error states ─── */
          <Card elevated={true} className="flex flex-col items-center text-center py-12 bg-surface">
            <span className="text-4xl mb-4" aria-hidden="true">
              {errorMessage.includes('expired') || errorMessage.includes('limit')
                ? '⏰'
                : errorMessage.includes('private')
                  ? '🔒'
                  : errorMessage.includes('not found')
                    ? '🔍'
                    : '⚠️'}
            </span>
            <h2 className="text-base font-bold text-ink mb-2">Share Unavailable</h2>
            <p className="text-sm text-ink-muted leading-relaxed">{errorMessage}</p>
            <div className="pt-6">
              <Link
                to="/login"
                className="text-xs text-primary hover:underline font-medium"
              >
                Go to NimbusFS Drive
              </Link>
            </div>
          </Card>
        ) : requiresPassword ? (
          /* ─── Password prompt ─── */
          <Card elevated={true} className="flex flex-col bg-surface">
            <div className="text-center mb-6">
              <span className="text-4xl block mb-3" aria-hidden="true">🔒</span>
              <h2 className="text-lg font-bold text-ink">This file is password protected</h2>
              <p className="text-xs text-ink-muted mt-1.5">
                Enter the password to download this file.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  className={`w-full px-3 py-2 text-sm bg-surface border rounded-xs focus:outline-none focus:border-primary focus:shadow-level-1 transition-all text-ink placeholder-ink-faint ${passwordError ? 'border-accent-orange' : 'border-hairline'}`}
                  disabled={submittingPassword}
                />
                {passwordError && (
                  <p className="text-xs text-accent-orange mt-1.5">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                loading={submittingPassword}
                disabled={submittingPassword}
              >
                {submittingPassword ? 'Checking...' : 'Download File'}
              </Button>
            </form>

            <div className="pt-6 text-center">
              <Link
                to="/login"
                className="text-xs text-primary hover:underline font-medium"
              >
                Go to NimbusFS Drive
              </Link>
            </div>
          </Card>
        ) : (
          /* ─── Ready to download ─── */
          <Card elevated={true} className="flex flex-col bg-surface">
            <div className="text-center mb-6">
              <span className="text-4xl block mb-3" aria-hidden="true">📄</span>
              <h2 className="text-lg font-bold text-ink truncate px-2" title={fileInfo.name}>
                {fileInfo.name || 'Untitled file'}
              </h2>
              <p className="text-xs text-ink-muted mt-1.5">{formatSize(fileInfo.size)}</p>
            </div>

            <Button
              onClick={handleDownload}
              variant="primary"
              size="md"
              className="w-full"
              loading={isDownloading}
              disabled={isDownloading}
            >
              Download File
            </Button>

            <div className="pt-6 text-center">
              <Link
                to="/login"
                className="text-xs text-primary hover:underline font-medium"
              >
                Go to NimbusFS Drive
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SharePage;
