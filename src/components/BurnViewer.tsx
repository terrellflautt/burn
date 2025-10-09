import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from './ToastContainer';

const API_URL = 'https://gavcsyy3ka.execute-api.us-east-1.amazonaws.com/prod';

interface BurnMetadata {
  burnId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  expiresAt: string;
  currentDownloads: number;
  maxDownloads: number | string;
  requiresPassword: boolean;
  customMessage?: string;
}

interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresIn: number;
  remainingDownloads: number | string;
  willBeDeleted: boolean;
  message?: string;
}

export const BurnViewer: React.FC = () => {
  const { burnId } = useParams<{ burnId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [burnData, setBurnData] = useState<BurnMetadata | null>(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (burnId) {
      loadBurn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burnId]);

  const loadBurn = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/burns/${burnId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('This file has already been viewed and destroyed, or never existed.');
        } else if (response.status === 410) {
          const errorData = await response.json();
          setError(errorData.error || 'This file has been deleted or expired.');
        } else {
          setError('Failed to retrieve file. Please check the link and try again.');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setBurnData(data);
    } catch (err) {
      console.error('Load failed:', err);
      setError('Failed to load file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async () => {
    if (!burnData || !burnId) return;

    setDownloading(true);
    try {
      // Step 1: Request download URL from API
      const response = await fetch(`${API_URL}/burns/${burnId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get download URL');
      }

      const downloadData: DownloadResponse = await response.json();

      // Step 2: Download file from S3 presigned URL
      const fileResponse = await fetch(downloadData.downloadUrl);
      if (!fileResponse.ok) {
        throw new Error('Failed to download file from storage');
      }

      const blob = await fileResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Confirm download to backend (this will delete the file if max downloads reached)
      try {
        await fetch(`${API_URL}/burns/${burnId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } catch (confirmErr) {
        console.error('Failed to confirm download:', confirmErr);
        // Don't fail the whole download if confirm fails
      }

      setDownloaded(true);
      showToast('File downloaded successfully!', 'success');

      if (downloadData.message) {
        console.log(downloadData.message);
      }
    } catch (err) {
      console.error('Download failed:', err);
      showToast(`Failed to download file: ${err instanceof Error ? err.message : 'Please try again.'}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div className="viewer-container">
          <div className="logo">🔥</div>
          <h1>Loading...</h1>
          <p className="viewer-message">Retrieving your file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div className="viewer-container">
          <div className="logo error-icon">💨</div>
          <h1>File Not Found</h1>
          <p className="error-message">{error}</p>
          <button onClick={() => navigate('/')} className="home-btn">
            Create New Burn
          </button>
        </div>
      </div>
    );
  }

  if (downloaded) {
    return (
      <div className="App">
        <div className="viewer-container">
          <div className="logo">🔥💨</div>
          <h1>File Downloaded!</h1>
          <p className="viewer-message">
            This file has been destroyed and can never be accessed again.
          </p>
          <div className="burned-notice">
            <p>🔥 Burned Forever</p>
          </div>
          <button onClick={() => navigate('/')} className="home-btn">
            Create New Burn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="viewer-container">
        <div className="logo">📎</div>
        <h1>File Ready</h1>
        <p className="viewer-message">
          This file will be destroyed immediately after download.
        </p>

        <div className="file-details">
          <p><strong>Filename:</strong> {burnData?.fileName}</p>
          <p><strong>Size:</strong> {burnData ? (burnData.fileSize / 1024).toFixed(2) : '0'} KB</p>
        </div>

        <div className="warning-box">
          <p>⚠️ Warning: One-time download only!</p>
          <p>This file will be permanently deleted after you download it.</p>
        </div>

        <button onClick={downloadFile} disabled={downloading} className="download-btn">
          {downloading ? 'Downloading...' : '📥 Download & Destroy'}
        </button>

        <button onClick={() => navigate('/')} className="cancel-btn">
          Cancel (File will remain available)
        </button>
      </div>
    </div>
  );
};
