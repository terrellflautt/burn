import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

export const Terms: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <button onClick={() => navigate('/')} className="back-btn">← Back to Home</button>

      <h1>Terms of Service</h1>
      <p className="last-updated">Last Updated: January 2025</p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using SnapIT Burn, you accept and agree to be bound by the terms and provision of this agreement.
        </p>
      </section>

      <section>
        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily use SnapIT Burn for personal, non-commercial transitory viewing and file sharing only.
        </p>
        <p>This is the grant of a license, not a transfer of title, and under this license you may not:</p>
        <ul>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose</li>
          <li>Attempt to decompile or reverse engineer any software</li>
          <li>Remove any copyright or other proprietary notations</li>
          <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
        </ul>
      </section>

      <section>
        <h2>3. File Sharing</h2>
        <p>
          Files uploaded to SnapIT Burn are automatically deleted after being viewed once or after 24 hours, whichever comes first.
          You are responsible for ensuring you have appropriate backups of any files you upload.
        </p>
      </section>

      <section>
        <h2>4. Prohibited Content</h2>
        <p>You may not upload files that:</p>
        <ul>
          <li>Violate any applicable law or regulation</li>
          <li>Infringe upon the intellectual property rights of others</li>
          <li>Contain malware, viruses, or other harmful code</li>
          <li>Contain illegal content or content that promotes illegal activities</li>
          <li>Violate the privacy rights of others</li>
        </ul>
      </section>

      <section>
        <h2>5. Disclaimer</h2>
        <p>
          The materials on SnapIT Burn are provided on an 'as is' basis. SnapIT Software makes no warranties,
          expressed or implied, and hereby disclaims and negates all other warranties including, without limitation,
          implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement
          of intellectual property or other violation of rights.
        </p>
      </section>

      <section>
        <h2>6. Limitations</h2>
        <p>
          In no event shall SnapIT Software or its suppliers be liable for any damages (including, without limitation,
          damages for loss of data or profit, or due to business interruption) arising out of the use or inability to
          use SnapIT Burn.
        </p>
      </section>

      <section>
        <h2>7. Contact</h2>
        <p>
          If you have any questions about these Terms, please contact us at{' '}
          <a href="mailto:snapitsoft@gmail.com">snapitsoft@gmail.com</a>
        </p>
      </section>
    </div>
  );
};
