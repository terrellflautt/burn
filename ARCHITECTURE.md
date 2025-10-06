# SnapIT Burn - Architecture & Technical Spec

**Tagline**: "Share Files That Vanish"

---

## 🎯 Core Features

### Free Tier
- ✅ 100MB max file size
- ✅ 24-hour expiration (max)
- ✅ 5 downloads max
- ✅ Password protection (optional)
- ✅ Email notification when file is downloaded
- ✅ Anonymous uploads (no account required)

### Pro Tier ($5/month)
- ✅ 10GB max file size
- ✅ 30-day expiration (max)
- ✅ Unlimited downloads (or custom limit)
- ✅ Custom expiration time
- ✅ Download analytics (who, when, IP)
- ✅ Watermark PDFs (prevent screenshots)
- ✅ Custom branding (white-label links)
- ✅ API access

---

## 🏗️ Technology Stack

### Frontend
- **Framework**: React + TypeScript
- **Styling**: Tailwind CSS (dark purple/hot pink theme like Forums)
- **File Upload**: React Dropzone
- **PDF Watermarking**: PDF-lib (client-side)
- **Hosting**: S3 + CloudFront

### Backend
- **Runtime**: Node.js 18.x (AWS Lambda)
- **API**: API Gateway (REST)
- **Database**: DynamoDB
  - `burns` table (file metadata)
  - `downloads` table (download tracking)
  - `users` table (Pro subscribers)
- **Storage**: S3 (with lifecycle policies)
- **Authentication**: JWT (for Pro users) + API keys
- **Payments**: Stripe (reuse existing integration)
- **Email**: SES (download notifications)

### Infrastructure
- **IaC**: Serverless Framework
- **Monitoring**: CloudWatch
- **CDN**: CloudFront
- **DNS**: Route 53 (burn.snapitsoftware.com)

---

## 📊 Database Schema

### `burns` Table
```json
{
  "burnId": "uuid-v4",           // Partition key
  "fileName": "document.pdf",
  "fileSize": 1024000,           // bytes
  "fileKey": "burns/uuid.enc",   // S3 key
  "uploadedAt": 1759702847000,   // timestamp
  "expiresAt": 1759789247000,    // TTL (auto-delete)
  "maxDownloads": 5,
  "currentDownloads": 0,
  "password": "hashed-password", // bcrypt (optional)
  "uploaderEmail": "user@email.com", // optional
  "uploaderIp": "1.2.3.4",
  "tier": "free|pro",
  "userId": "user-id",           // for Pro users
  "isDeleted": false,
  "deleteReason": "expired|max-downloads|manual",
  "customMessage": "From: John - Here's the contract",
  "downloadNotifications": true,
  "allowedDownloaders": ["email1@example.com"], // Pro only
  "watermark": true,             // Pro only (for PDFs)
  "shortLink": "abc123",         // Custom short URL
  "metadata": {
    "contentType": "application/pdf",
    "isEncrypted": true,
    "encryptionAlgorithm": "AES-256-GCM"
  }
}
```

### `downloads` Table
```json
{
  "downloadId": "uuid-v4",       // Partition key
  "burnId": "burn-uuid",         // GSI
  "downloadedAt": 1759703000000,
  "downloaderIp": "5.6.7.8",
  "downloaderUserAgent": "Mozilla/5.0...",
  "downloaderEmail": "recipient@email.com", // if provided
  "success": true,
  "errorReason": "password-incorrect|expired|max-downloads"
}
```

### `users` Table (Reuse from Forums)
```json
{
  "userId": "user-id",
  "email": "user@example.com",
  "tier": "free|pro",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "apiKey": "sk_burn_...",
  "createdAt": 1759702847000,
  "stats": {
    "totalUploads": 50,
    "totalDownloads": 200,
    "storageUsed": 5242880000  // bytes
  }
}
```

---

## 🔐 Security Features

### Encryption
1. **Client-Side Encryption** (Pro feature)
   - Files encrypted in browser before upload
   - AES-256-GCM encryption
   - Key derived from password (if set) or random key
   - Key included in share link fragment (#key=...)
   - Server never sees unencrypted files

2. **Server-Side Encryption** (Free tier)
   - S3 encryption at rest (AWS managed keys)
   - No client-side encryption (simpler UX)

### Password Protection
- Bcrypt hashed passwords (cost factor 10)
- Rate limiting on password attempts (5 tries, then 15-min lockout)
- Password required before download link is revealed

### Download Limits
- Atomic counter in DynamoDB (prevent race conditions)
- File auto-deletes when limit reached
- 7-pass DoD secure deletion (overwrite S3 object)

### Anti-Abuse
- Rate limiting: 10 uploads/hour (Free), unlimited (Pro)
- File scanning: AWS Macie for sensitive data detection
- Blacklist file extensions: .exe, .bat, .sh (configurable)
- CAPTCHA for anonymous uploads (hCaptcha)

---

## 🔄 File Lifecycle

### Upload Flow
```
1. User drags file into browser
   ↓
2. (Pro) Client-side encryption with password/random key
   ↓
3. Generate presigned S3 URL (POST)
   ↓
4. Upload directly to S3 (multipart for >5MB)
   ↓
5. Lambda triggered on S3 upload
   ↓
6. Create DynamoDB record with metadata
   ↓
7. Set DynamoDB TTL for expiration
   ↓
8. Return share link to user
   ↓
9. (Optional) Send email with link
```

### Download Flow
```
1. User visits share link (burn.snapitsoftware.com/d/abc123)
   ↓
2. Fetch burn metadata from DynamoDB
   ↓
3. Check: Expired? Max downloads? Password required?
   ↓
4. (If password) Verify password → Rate limit
   ↓
5. Increment download counter (atomic)
   ↓
6. Generate presigned S3 GET URL (1-hour expiry)
   ↓
7. Log download to `downloads` table
   ↓
8. (Optional) Send email notification to uploader
   ↓
9. User downloads file from S3
   ↓
10. If max downloads reached → Delete file from S3
```

### Expiration Flow
```
1. DynamoDB TTL expires
   ↓
2. DynamoDB Streams triggers Lambda
   ↓
3. Lambda deletes S3 object
   ↓
4. 7-pass overwrite (write random data 7 times)
   ↓
5. Update burn record: isDeleted=true, deleteReason="expired"
   ↓
6. (Optional) Send expiration notification email
```

---

## 🎨 Frontend Pages

### 1. Landing Page (`/`)
- Hero section with file drop zone
- Features list (auto-delete, password, etc.)
- Pricing comparison (Free vs Pro)
- Testimonials
- CTA: "Share Your First File"

### 2. Upload Page (`/upload`)
- Drag-and-drop file zone
- Upload progress bar
- Settings panel:
  - Expiration time (1h, 6h, 24h, custom for Pro)
  - Max downloads (1, 5, 10, unlimited for Pro)
  - Password (optional)
  - Email notification (optional)
  - Custom message
- **Result**: Share link with copy button

### 3. Download Page (`/d/:burnId` or `/d/:shortLink`)
- File info (name, size, uploaded date)
- Custom message from sender
- Download counter (e.g., "2/5 downloads used")
- Expiration countdown timer
- Password input (if required)
- Big "Download" button
- Powered by SnapIT branding

### 4. My Burns (`/dashboard`) - Pro Only
- List of all uploaded burns
- Stats: Total uploads, downloads, storage used
- Actions: Delete, View analytics, Regenerate link
- Download analytics chart

### 5. Pricing Page (`/pricing`)
- Free vs Pro comparison table
- Stripe checkout integration
- FAQ

### 6. API Docs (`/api`) - Pro Only
- Authentication (API key)
- Upload endpoint
- Download endpoint
- Delete endpoint
- Rate limits
- Code examples (curl, Python, Node.js)

---

## 🚀 API Endpoints

### Public Endpoints

#### `POST /upload`
Upload a new file (returns share link)

**Request**:
```json
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "expiresIn": 86400,        // seconds (max 86400 for free)
  "maxDownloads": 5,
  "password": "secret123",    // optional
  "uploaderEmail": "sender@example.com", // optional
  "customMessage": "Here's the contract",
  "watermark": true           // Pro only
}
```

**Response**:
```json
{
  "burnId": "abc123-def456",
  "uploadUrl": "https://s3.amazonaws.com/presigned-upload-url",
  "shareUrl": "https://burn.snapitsoftware.com/d/abc123",
  "expiresAt": "2025-10-06T22:30:00Z",
  "maxDownloads": 5
}
```

#### `GET /burn/:burnId`
Get burn metadata (before download)

**Response**:
```json
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "uploadedAt": "2025-10-05T22:30:00Z",
  "expiresAt": "2025-10-06T22:30:00Z",
  "currentDownloads": 2,
  "maxDownloads": 5,
  "requiresPassword": true,
  "customMessage": "From: John - Contract for review",
  "isExpired": false,
  "isDeleted": false
}
```

#### `POST /burn/:burnId/download`
Verify password and get download URL

**Request**:
```json
{
  "password": "secret123",    // if required
  "email": "recipient@email.com" // optional
}
```

**Response**:
```json
{
  "downloadUrl": "https://s3.amazonaws.com/presigned-download-url",
  "fileName": "document.pdf",
  "expiresIn": 3600,          // URL valid for 1 hour
  "remainingDownloads": 3
}
```

#### `DELETE /burn/:burnId`
Delete a burn (requires password or uploader auth)

**Response**:
```json
{
  "success": true,
  "message": "Burn deleted successfully"
}
```

### Pro Endpoints (Requires API Key)

#### `GET /dashboard/burns`
List all user's burns

**Query Params**:
- `limit`: 10-100 (default 50)
- `offset`: pagination
- `status`: active|expired|deleted

#### `GET /dashboard/analytics`
Get upload/download analytics

**Response**:
```json
{
  "totalUploads": 50,
  "totalDownloads": 200,
  "storageUsed": 5242880000,
  "tier": "pro",
  "apiRequestsThisMonth": 1000,
  "topBurns": [
    {
      "burnId": "abc123",
      "fileName": "document.pdf",
      "downloads": 50
    }
  ]
}
```

---

## 💰 Revenue Model

### Pricing Tiers

| Feature | Free | Pro ($5/mo) |
|---------|------|-------------|
| Max file size | 100MB | 10GB |
| Expiration | 24 hours | 30 days |
| Downloads | 5 max | Unlimited* |
| Storage | N/A (no account) | 50GB included |
| Uploads/month | 10 | Unlimited |
| Password protection | ✅ | ✅ |
| Email notifications | ✅ | ✅ |
| Custom expiration | ❌ | ✅ |
| Download analytics | ❌ | ✅ |
| PDF watermarking | ❌ | ✅ |
| White-label | ❌ | ✅ |
| API access | ❌ | ✅ |
| Custom domain | ❌ | ❌ (Enterprise) |

### Cost Structure

**Infrastructure Costs** (estimated):
- S3 storage: $0.023/GB/month
- S3 bandwidth: $0.09/GB (first 10TB)
- Lambda: $0.20/1M requests
- DynamoDB: $0.25/GB + $1.25/million writes
- CloudFront: $0.085/GB

**Example**: 1000 users × 1GB/user × $0.023 = $23/month storage
- Revenue: 1000 users × $5 = $5,000/month
- Profit margin: ~95% (excluding support)

---

## 🔧 Implementation Phases

### Phase 1: MVP (Week 1-2)
- ✅ Basic upload/download flow
- ✅ S3 presigned URLs
- ✅ DynamoDB metadata storage
- ✅ Expiration via TTL
- ✅ Download limits
- ✅ Simple React UI
- ✅ Password protection

### Phase 2: Free Tier Polish (Week 3)
- ✅ Landing page design
- ✅ Email notifications
- ✅ Custom messages
- ✅ CAPTCHA for abuse prevention
- ✅ Rate limiting
- ✅ Mobile responsive UI

### Phase 3: Pro Tier (Week 4-5)
- ✅ User authentication (Google OAuth)
- ✅ Stripe subscription integration
- ✅ Dashboard with analytics
- ✅ API key generation
- ✅ PDF watermarking
- ✅ Extended file size/expiration

### Phase 4: Advanced Features (Week 6+)
- ✅ Client-side encryption
- ✅ White-label branding
- ✅ API documentation
- ✅ Webhooks (notify on download)
- ✅ Bulk upload
- ✅ File preview (images, PDFs)

---

## 🚦 Success Metrics

### KPIs
- **Signups**: 1,000 free users in month 1
- **Conversion**: 5% free → Pro ($2,500 MRR)
- **Retention**: 80% Pro users stay after month 1
- **Uploads**: 10,000 files shared in month 1
- **Viral Coefficient**: 1.5 (each user shares with 1.5 new users)

### Analytics to Track
- Upload success rate
- Download completion rate
- Password failure rate
- Average file size
- Popular expiration times
- Referral sources

---

## 🔒 Compliance & Legal

### Terms of Service
- No illegal content (DMCA, CSAM, etc.)
- No malware/viruses
- File scanning with AWS Macie
- Right to delete violating content
- No warranty on file availability

### Privacy Policy
- Files encrypted at rest
- Metadata retained for 90 days after deletion
- Download logs retained for compliance
- No selling of user data
- GDPR/CCPA compliant (data export/deletion)

### Content Moderation
- Hash-based detection (PhotoDNA for CSAM)
- File extension blacklist
- Size limits prevent DDoS via storage
- Report abuse feature

---

## 🎯 Go-to-Market Strategy

### Launch Channels
1. **Product Hunt** - Launch on Monday
2. **Hacker News** - "Show HN: SnapIT Burn - WeTransfer with auto-delete"
3. **Reddit** - r/selfhosted, r/privacy, r/entrepreneur
4. **Twitter** - Privacy tech community
5. **Email**: Existing SnapIT users (Forums, Forms, etc.)

### Marketing Copy
**Headline**: "Share Files That Vanish Like Snapchat for Documents"

**Subheadline**: "Send sensitive files with confidence. Auto-delete after download or 24 hours. No account required."

**Use Cases**:
- Journalists sharing leaked documents
- Lawyers sending contracts
- HR sharing offer letters
- Freelancers delivering client work
- Anyone sending passwords, keys, or sensitive info

---

## 📝 Next Steps

1. Create project directory structure
2. Set up Serverless Framework config
3. Create DynamoDB tables
4. Build upload Lambda function
5. Build download Lambda function
6. Create React frontend
7. Set up S3 bucket with CORS
8. Configure CloudFront distribution
9. Integrate Stripe for Pro tier
10. Deploy to production (burn.snapitsoftware.com)

---

**Ready to build?** Let's start with Phase 1 MVP! 🚀
