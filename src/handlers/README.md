# SnapIT Burn API Handlers

Complete implementation of the SnapIT Burn backend handlers with S3, DynamoDB, password protection, and auto-delete functionality.

---

## 📁 Files

### `burns.js`
Main handler file containing all burn-related operations:
- **Upload**: Create burn record and generate presigned S3 upload URL
- **Get**: Retrieve burn metadata before download
- **Download**: Verify password, increment counter, generate download URL, auto-delete
- **List**: Get user's burns (authenticated)
- **Delete**: Manually delete burn from S3 and DynamoDB

### `auth.js`
JWT authorizer for authenticated endpoints (Pro users)

---

## 🔧 Handler Details

### 1. Upload Handler
**Endpoint**: `POST /upload`

**Purpose**: Create a new burn record and return a presigned S3 upload URL

**Features**:
- ✅ Validates file size and expiration based on tier (Free vs Pro)
- ✅ Generates unique `burnId` (UUID v4) and `shortLink` (8-char random)
- ✅ Hashes password with bcrypt (cost factor 10) if provided
- ✅ Creates DynamoDB record with TTL for auto-expiration
- ✅ Returns presigned S3 upload URL (1-hour expiry)
- ✅ Supports S3 server-side encryption (AES-256)
- ✅ Tracks uploader IP and email

**Request Body**:
```json
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "contentType": "application/pdf",
  "expiresIn": 86400,
  "maxDownloads": 5,
  "password": "secret123",
  "uploaderEmail": "user@example.com",
  "customMessage": "Here's the file",
  "watermark": true,
  "downloadNotifications": true
}
```

**Response**:
```json
{
  "burnId": "uuid-v4",
  "shortLink": "abc123XY",
  "uploadUrl": "https://s3.amazonaws.com/presigned-url",
  "shareUrl": "https://burn.snapitsoftware.com/d/abc123XY",
  "expiresAt": "2025-10-07T22:30:00Z",
  "maxDownloads": 5,
  "tier": "free"
}
```

**Tier Limits**:
- **Free**: 100MB max, 24 hours max, 5 downloads max
- **Pro**: 10GB max, 30 days max, unlimited downloads

---

### 2. Get Handler
**Endpoint**: `GET /burns/:burnId`

**Purpose**: Retrieve burn metadata before downloading (preview page)

**Features**:
- ✅ Finds burn by `burnId` or `shortLink`
- ✅ Checks if deleted, expired, or max downloads reached
- ✅ Returns metadata without exposing password hash
- ✅ Calculates remaining downloads
- ✅ Provides countdown timer data

**Response**:
```json
{
  "burnId": "uuid-v4",
  "shortLink": "abc123XY",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "uploadedAt": "2025-10-06T10:30:00Z",
  "expiresAt": "2025-10-07T10:30:00Z",
  "currentDownloads": 2,
  "maxDownloads": 5,
  "requiresPassword": true,
  "customMessage": "From: John - Contract for review",
  "isExpired": false,
  "isDeleted": false,
  "tier": "free",
  "watermark": false
}
```

**Error Responses**:
- `404`: Burn not found
- `410`: Burn deleted, expired, or max downloads reached

---

### 3. Download Handler
**Endpoint**: `POST /burns/:burnId/download`

**Purpose**: Verify password (if required) and generate presigned download URL

**Features**:
- ✅ Validates password using bcrypt comparison
- ✅ Atomically increments download counter (prevents race conditions)
- ✅ Logs download to `downloads` table with IP, user-agent, email
- ✅ Generates presigned S3 GET URL (1-hour expiry)
- ✅ Auto-deletes file from S3 when max downloads reached
- ✅ Updates DynamoDB record with `isDeleted: true` and `deleteReason: 'max-downloads'`
- ✅ Returns download URL with filename attachment header

**Request Body**:
```json
{
  "password": "secret123",
  "email": "recipient@example.com"
}
```

**Response**:
```json
{
  "downloadUrl": "https://s3.amazonaws.com/presigned-download-url",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "expiresIn": 3600,
  "remainingDownloads": 3,
  "willBeDeleted": false,
  "message": null
}
```

**Auto-Delete Logic**:
```javascript
// After incrementing download counter
if (maxDownloads !== -1 && currentDownloads >= maxDownloads) {
  // 1. Delete from S3
  await s3.deleteObject({ Bucket, Key });

  // 2. Mark as deleted in DynamoDB
  await dynamodb.update({
    UpdateExpression: 'SET isDeleted = :true, deleteReason = :reason'
  });
}
```

**Error Responses**:
- `401`: Password required or incorrect
- `404`: Burn not found
- `410`: Burn deleted, expired, or max downloads reached

---

### 4. List Handler
**Endpoint**: `GET /burns?limit=50&status=active`

**Purpose**: Get list of user's burns (authenticated users only)

**Features**:
- ✅ Requires JWT authentication via authorizer
- ✅ Queries DynamoDB using UserIndex GSI
- ✅ Filters by status: `all`, `active`, `expired`, `deleted`
- ✅ Returns burns sorted by most recent first
- ✅ Supports pagination with limit (max 100)
- ✅ Calculates status dynamically (active, expired, deleted, max-downloads)

**Query Parameters**:
- `limit`: 1-100 (default 50)
- `status`: all, active, expired, deleted

**Response**:
```json
{
  "burns": [
    {
      "burnId": "uuid-v4",
      "shortLink": "abc123XY",
      "fileName": "document.pdf",
      "fileSize": 1024000,
      "uploadedAt": "2025-10-06T10:30:00Z",
      "expiresAt": "2025-10-07T10:30:00Z",
      "currentDownloads": 2,
      "maxDownloads": 5,
      "requiresPassword": true,
      "customMessage": "From: John",
      "isDeleted": false,
      "deleteReason": null,
      "tier": "free",
      "shareUrl": "https://burn.snapitsoftware.com/d/abc123XY",
      "status": "active"
    }
  ],
  "count": 1,
  "userId": "user-id",
  "tier": "free"
}
```

**Status Calculation**:
```javascript
status = isDeleted ? 'deleted' :
         expiresAt <= now ? 'expired' :
         (maxDownloads !== -1 && currentDownloads >= maxDownloads) ? 'max-downloads' :
         'active'
```

---

### 5. Delete Handler
**Endpoint**: `DELETE /burns/:burnId`

**Purpose**: Manually delete a burn before expiration

**Features**:
- ✅ Requires JWT authentication
- ✅ Verifies ownership (userId match)
- ✅ Deletes file from S3 bucket
- ✅ Marks record as deleted in DynamoDB with `deleteReason: 'manual'`
- ✅ Continues even if S3 deletion fails (file might not exist)

**Response**:
```json
{
  "success": true,
  "message": "Burn deleted successfully",
  "burnId": "uuid-v4"
}
```

**Error Responses**:
- `401`: Authentication required
- `403`: Unauthorized (not owner)
- `404`: Burn not found
- `410`: Burn already deleted

---

## 🔐 Security Features

### Password Protection
- **Hashing**: bcrypt with cost factor 10
- **Storage**: Only hash stored in DynamoDB
- **Verification**: Constant-time comparison via bcrypt.compare()
- **Failed Attempts**: Logged to `downloads` table with `success: false`

### Download Tracking
All downloads logged to `downloads` table:
```json
{
  "downloadId": "uuid-v4",
  "burnId": "burn-uuid",
  "downloadedAt": 1696540800000,
  "downloaderIp": "1.2.3.4",
  "downloaderUserAgent": "Mozilla/5.0...",
  "downloaderEmail": "recipient@example.com",
  "success": true,
  "errorReason": null
}
```

### S3 Encryption
- **Free Tier**: S3 server-side encryption (AES-256)
- **Pro Tier**: Client-side encryption + S3 encryption (defense in depth)

### Auto-Delete
Files automatically deleted when:
1. **Max downloads reached**: Immediate S3 deletion after last download
2. **TTL expires**: DynamoDB TTL triggers deletion (up to 48 hours delay)
3. **Manual deletion**: User deletes via API

---

## 📊 DynamoDB Schema

### Burns Table
```javascript
{
  burnId: 'uuid-v4',              // Partition key
  fileName: 'document.pdf',
  fileSize: 1024000,
  fileKey: 'burns/uuid',          // S3 key
  uploadedAt: 1696540800000,      // Timestamp
  expiresAt: 1696627200,          // Unix timestamp (TTL in seconds)
  maxDownloads: 5,                // -1 for unlimited
  currentDownloads: 0,
  password: '$2a$10$...',          // Bcrypt hash
  uploaderEmail: 'user@email.com',
  uploaderIp: '1.2.3.4',
  tier: 'free',                   // or 'pro'
  userId: 'user-id',              // 'anonymous' if not logged in
  isDeleted: false,
  deleteReason: null,             // 'expired', 'max-downloads', 'manual'
  customMessage: 'From: John',
  downloadNotifications: true,
  watermark: false,
  shortLink: 'abc123XY',
  metadata: {
    contentType: 'application/pdf',
    isEncrypted: false,
    encryptionAlgorithm: null
  }
}
```

**Indexes**:
- Primary Key: `burnId`
- GSI: `UserIndex` on `userId` (for listing user's burns)

**TTL**: `expiresAt` attribute (Unix timestamp in seconds)

---

## 🚀 Deployment

### Install Dependencies
```bash
npm install
```

### Deploy to AWS
```bash
# Development
npm run deploy-dev

# Production
npm run deploy-prod
```

### Environment Variables
Set in AWS Systems Manager Parameter Store:
- `/snapit-forum/prod/JWT_SECRET` - Shared JWT secret
- `/snapit-forum/prod/STRIPE_SECRET_KEY` - Stripe API key

---

## 🧪 Testing

### Upload Flow
```bash
# 1. Create burn
curl -X POST https://api.burn.snapitsoftware.com/upload \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "test.pdf",
    "fileSize": 1024000,
    "password": "secret123",
    "maxDownloads": 3
  }'

# 2. Upload file to S3 presigned URL
curl -X PUT "PRESIGNED_UPLOAD_URL" \
  -H 'Content-Type: application/pdf' \
  --upload-file test.pdf

# 3. Get burn metadata
curl https://api.burn.snapitsoftware.com/burns/BURN_ID

# 4. Download file
curl -X POST https://api.burn.snapitsoftware.com/burns/BURN_ID/download \
  -H 'Content-Type: application/json' \
  -d '{"password": "secret123"}'

# 5. Download from S3 presigned URL
curl -o downloaded.pdf "PRESIGNED_DOWNLOAD_URL"
```

### List Burns (Authenticated)
```bash
curl https://api.burn.snapitsoftware.com/burns?status=active \
  -H 'Authorization: Bearer JWT_TOKEN'
```

### Delete Burn (Authenticated)
```bash
curl -X DELETE https://api.burn.snapitsoftware.com/burns/BURN_ID \
  -H 'Authorization: Bearer JWT_TOKEN'
```

---

## 📈 Monitoring

### CloudWatch Metrics
- Upload success/failure rate
- Download success/failure rate
- Password verification failures
- Average file size
- S3 storage usage
- DynamoDB read/write capacity

### Logs
```bash
# View upload logs
serverless logs -f upload -t

# View download logs
serverless logs -f download -t
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "Burn not found" when using shortLink**
- Ensure the scan operation checks `shortLink` attribute
- ShortLinks are case-sensitive

**2. "Maximum downloads reached" but currentDownloads < maxDownloads**
- Check for race conditions in download counter
- Use atomic DynamoDB updates with `UpdateExpression`

**3. TTL not deleting expired burns**
- DynamoDB TTL has up to 48-hour delay
- Use manual cleanup Lambda for time-sensitive deletions

**4. S3 presigned URL expired**
- Upload URLs expire after 1 hour
- Download URLs expire after 1 hour
- Frontend should handle regeneration

**5. Password verification failing**
- Ensure password is sent in POST body, not query params
- Check bcrypt cost factor matches (default 10)

---

## 🚧 Future Enhancements

### Phase 2
- [ ] Email notifications on download (SES integration)
- [ ] Download analytics dashboard
- [ ] CAPTCHA for anonymous uploads
- [ ] Rate limiting per IP address

### Phase 3
- [ ] Client-side encryption (AES-256-GCM)
- [ ] PDF watermarking (pdf-lib)
- [ ] Custom branding (white-label)
- [ ] API key authentication

### Phase 4
- [ ] Webhooks on download events
- [ ] Bulk upload API
- [ ] File preview (images, PDFs)
- [ ] Custom domains (Enterprise)

---

## 📝 Notes

- **Atomic Operations**: Download counter uses DynamoDB atomic updates to prevent race conditions
- **Security**: Passwords never logged or exposed in responses
- **CORS**: All endpoints support CORS for browser-based uploads
- **Error Handling**: All errors logged to CloudWatch with context
- **Presigned URLs**: Generate on-demand to avoid storing sensitive URLs
- **TTL Cleanup**: DynamoDB TTL automatically deletes expired records (up to 48h delay)
- **S3 Lifecycle**: Bucket policy deletes files after 30 days as failsafe

---

**Ready to deploy?** Run `npm install && npm run deploy-prod` 🚀
