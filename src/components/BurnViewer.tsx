import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = 'https://gavcsyy3ka.execute-api.us-east-1.amazonaws.com/prod';

interface BurnData {
  burnId: string;
  fileName: string;
  fileData: string;
  fileSize: number;
  contentType?: string;
}

export const BurnViewer: React.FC = () => {
  const { burnId } = useParams<{ burnId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [burnData, setBurnData] = useState<BurnData | null>(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);

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

  const downloadFile = () => {
    if (!burnData) return;

    try {
      // Decode base64 to binary
      const binaryString = atob(burnData.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], {
        type: burnData.contentType || 'application/octet-stream'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = burnData.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloaded(true);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file. Please try again.');
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

        <button onClick={downloadFile} className="download-btn">
          📥 Download & Destroy
        </button>

        <button onClick={() => navigate('/')} className="cancel-btn">
          Cancel (File will remain available)
        </button>
      </div>
    </div>
  );
};
