import React, { useState, useRef } from 'react';
import { useToast } from './ToastContainer';

const API_URL = 'https://gavcsyy3ka.execute-api.us-east-1.amazonaws.com/prod';

interface BurnFile {
  burnId: string;
  fileName: string;
  fileSize: number;
  expiresAt: number;
  oneTimeView: boolean;
  url: string;
}

export const BurnUpload: React.FC = () => {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [burnData, setBurnData] = useState<BurnFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);
    try {
      // Step 1: Get presigned upload URL from API
      const createResponse = await fetch(`${API_URL}/burns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
          expiresIn: 86400, // 24 hours in seconds
          maxDownloads: 1 // One-time view
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to create burn');
      }

      const data = await createResponse.json();
      console.log('Burn created:', data);

      // Step 2: Upload file to S3 using presigned URL
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Set burn data with correct URL using shareUrl from backend
      setBurnData({
        burnId: data.burnId,
        fileName: file.name,
        fileSize: file.size,
        expiresAt: new Date(data.expiresAt).getTime(),
        oneTimeView: true,
        url: data.shareUrl || `https://burn.snapitsoftware.com/d/${data.shortLink}`
      });
    } catch (error) {
      console.error('Upload failed:', error);
      showToast(`Upload failed: ${error instanceof Error ? error.message : 'Please try again.'}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = () => {
    if (burnData) {
      navigator.clipboard.writeText(burnData.url);
      showToast('Link copied to clipboard!', 'success');
    }
  };

  const reset = () => {
    setFile(null);
    setBurnData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (burnData) {
    return (
      <div className="success-container">
        <div className="success-icon">🔥</div>
        <h1>File Ready to Burn!</h1>
        <p className="success-message">Your file will self-destruct after one view or in 24 hours</p>

        <div className="link-box">
          <input
            type="text"
            value={burnData.url}
            readOnly
            className="link-input"
          />
          <button onClick={copyToClipboard} className="copy-btn">
            📋 Copy
          </button>
        </div>

        <div className="file-info">
          <p><strong>File:</strong> {burnData.fileName}</p>
          <p><strong>Size:</strong> {(burnData.fileSize / 1024).toFixed(2)} KB</p>
          <p><strong>Expires:</strong> {new Date(burnData.expiresAt).toLocaleString()}</p>
        </div>

        <button onClick={reset} className="new-burn-btn">
          Upload Another File
        </button>
      </div>
    );
  }

  return (
    <div className="upload-container">
      <div className="logo">🔥</div>
      <h1>SnapIT Burn</h1>
      <p className="tagline">Self-destructing file sharing. One view. Gone forever.</p>

      <div
        className={`drop-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <div className="file-selected">
            <p className="file-name">📎 {file.name}</p>
            <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
        ) : (
          <div className="drop-prompt">
            <p className="drop-text">Drop file here or click to browse</p>
            <p className="drop-subtext">Max 10MB • One-time view • 24h expiry</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          id="burn-file-input"
          name="burnFile"
          type="file"
          onChange={handleFileChange}
          aria-label="Upload file for burn"
          style={{ display: 'none' }}
        />
      </div>

      {file && (
        <div className="action-buttons">
          <button onClick={uploadFile} disabled={uploading} className="upload-btn">
            {uploading ? 'Uploading...' : '🔥 Create Burn Link'}
          </button>
          <button onClick={reset} className="cancel-btn">Cancel</button>
        </div>
      )}

      <div className="features">
        <div className="feature">
          <span className="feature-icon">🔒</span>
          <span>Encrypted</span>
        </div>
        <div className="feature">
          <span className="feature-icon">👁️</span>
          <span>One View</span>
        </div>
        <div className="feature">
          <span className="feature-icon">⏱️</span>
          <span>Auto-Delete</span>
        </div>
      </div>
    </div>
  );
};
