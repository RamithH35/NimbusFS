import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../api/client';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

export const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'chunked'
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !uploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, uploading, onClose]);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setChunkProgress({ current: 0, total: 0 });
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Perform single file upload
  const uploadSingle = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await apiFetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (result.isDuplicate) {
        showToast('File already exists in your storage (Deduplicated)', 'info');
      } else {
        showToast('File uploaded successfully!', 'success');
      }
      onUploadSuccess();
      onClose();
      clearFile();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Perform chunked file upload
  const uploadChunked = async () => {
    if (!selectedFile) return;
    setUploading(true);

    const CHUNK_SIZE = 512 * 1024; // 512KB
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    setChunkProgress({ current: 0, total: totalChunks });

    try {
      // 1. Initialize chunked upload
      const initResult = await apiFetch('/api/files/upload/init', {
        method: 'POST',
        body: JSON.stringify({
          originalName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          totalSize: selectedFile.size,
          totalChunks,
        }),
      });

      const { uploadId } = initResult;

      // 2. Upload chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunkBlob = selectedFile.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('chunk', chunkBlob, `chunk_${i}`);

        await apiFetch('/api/files/upload/chunk', {
          method: 'POST',
          body: formData,
        });

        setChunkProgress((prev) => ({ ...prev, current: i + 1 }));
      }

      // 3. Complete chunked upload
      const completeResult = await apiFetch('/api/files/upload/complete', {
        method: 'POST',
        body: JSON.stringify({
          uploadId,
          totalChunks,
        }),
      });

      if (completeResult.isDuplicate) {
        showToast('File already exists in your storage (Deduplicated)', 'info');
      } else {
        showToast('File uploaded successfully in chunks!', 'success');
      }
      onUploadSuccess();
      onClose();
      clearFile();
    } catch (err) {
      showToast(err.message || 'Chunked upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSubmit = () => {
    if (activeTab === 'single') {
      uploadSingle();
    } else {
      uploadChunked();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !uploading) {
      onClose();
    }
  };

  const percentage = chunkProgress.total > 0 ? Math.round((chunkProgress.current / chunkProgress.total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
      onClick={handleBackdropClick}
    >
      <Card elevated={true} className="w-full max-w-lg bg-surface shadow-level-2 animate-slide-in relative flex flex-col p-6">
        <button
          onClick={() => { if (!uploading) onClose(); }}
          className="absolute right-4 top-4 text-ink-muted hover:text-ink font-bold text-xs select-none cursor-pointer"
          disabled={uploading}
        >
          ✕
        </button>

        <h2 className="text-lg font-bold text-ink mb-4">Upload File</h2>

        {/* Tab Headers */}
        <div className="flex border-b border-hairline mb-5">
          <button
            onClick={() => { if (!uploading) { setActiveTab('single'); clearFile(); } }}
            className={`flex-1 pb-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${activeTab === 'single'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            disabled={uploading}
          >
            Single File
          </button>
          <button
            onClick={() => { if (!uploading) { setActiveTab('chunked'); clearFile(); } }}
            className={`flex-1 pb-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${activeTab === 'chunked'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            disabled={uploading}
          >
            Chunked Upload
          </button>
        </div>

        {/* Upload Area */}
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${dragActive
              ? 'border-primary bg-primary/5'
              : 'border-hairline hover:bg-canvas-soft'
              }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10 text-ink-muted mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
            <p className="text-sm font-medium text-ink-secondary">
              Drag & drop file here, or <span className="text-primary hover:underline">browse</span>
            </p>
            <p className="text-xs text-ink-muted mt-1.5">Supports any safe media types up to 10MB</p>
          </div>
        ) : (
          <div className="border border-hairline rounded-lg p-4 bg-canvas-soft flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-4">
              <p className="text-sm font-semibold text-ink truncate">{selectedFile.name}</p>
              <p className="text-xs text-ink-muted mt-0.5">{formatSize(selectedFile.size)}</p>
            </div>
            {!uploading && (
              <button
                onClick={clearFile}
                className="text-xs text-accent-orange hover:underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Progress Section */}
        {uploading && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span className="flex items-center gap-1.5">
                <Spinner size="sm" className="border-t-primary" />
                {activeTab === 'single' ? 'Uploading file...' : `Uploading chunk ${chunkProgress.current} of ${chunkProgress.total}...`}
              </span>
              {activeTab === 'chunked' && <span className="font-semibold">{percentage}%</span>}
            </div>
            {activeTab === 'chunked' && (
              <div className="h-2 w-full bg-hairline rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-hairline">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={uploading}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUploadSubmit}
            variant="primary"
            disabled={!selectedFile || uploading}
            size="sm"
          >
            Upload
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default UploadModal;
