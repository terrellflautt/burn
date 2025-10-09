import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

export const Privacy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <button onClick={() => navigate('/')} className="back-btn">← Back to Home</button>

      <h1>Privacy Policy</h1>
      <p className="last-updated">Last Updated: January 2025</p>

      <section>
        <h2>1. Information We Collect</h2>
        <p>When you use SnapIT Burn, we may collect:</p>
        <ul>
          <li><strong>File Metadata:</strong> Filename, file size, upload time, and expiration time</li>
          <li><strong>Usage Data:</strong> IP address, browser type, and access times</li>
          <li><strong>Optional Information:</strong> Email address if provided for notifications</li>
        </ul>
        <p><strong>Important:</strong> We do NOT store your file contents after they are deleted. All files are automatically removed from our servers after viewing or after 24 hours.</p>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use the collected information to:</p>
        <ul>
          <li>Provide and maintain the file sharing service</li>
          <li>Notify you of downloads (if email provided)</li>
          <li>Improve our services and user experience</li>
          <li>Detect and prevent abuse or illegal activities</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section>
        <h2>3. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data:
        </p>
        <ul>
          <li>Files are stored with server-side encryption (AES-256)</li>
          <li>Presigned URLs with limited validity (1 hour)</li>
          <li>Automatic file deletion after viewing or expiration</li>
          <li>Secure HTTPS connections for all data transmission</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <p>
          Files: Maximum 24 hours, automatically deleted after first view<br />
          Metadata: Retained for up to 30 days for service improvement and abuse prevention<br />
          Logs: Access logs retained for 90 days for security purposes
        </p>
      </section>

      <section>
        <h2>5. Third-Party Services</h2>
        <p>
          We use AWS (Amazon Web Services) for file storage and hosting. AWS may collect and process data
          according to their privacy policy. We do not share your files or personal information with any
          other third parties.
        </p>
      </section>

      <section>
        <h2>6. Cookies and Tracking</h2>
        <p>
          SnapIT Burn uses minimal cookies for essential functionality only. We do not use tracking cookies
          or third-party analytics that identify individual users.
        </p>
      </section>

      <section>
        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your data</li>
          <li>Request deletion of your data</li>
          <li>Opt-out of email notifications</li>
          <li>Object to data processing</li>
        </ul>
      </section>

      <section>
        <h2>8. Children's Privacy</h2>
        <p>
          Our service is not directed to children under 13. We do not knowingly collect personal information
          from children under 13.
        </p>
      </section>

      <section>
        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting
          the new Privacy Policy on this page and updating the "Last Updated" date.
        </p>
      </section>

      <section>
        <h2>10. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:snapitsoft@gmail.com">snapitsoft@gmail.com</a>
        </p>
      </section>
    </div>
  );
};
