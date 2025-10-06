# SnapIT Burn API - Quick Reference

Complete API reference for the SnapIT Burn file sharing service.

---

## 🔗 Base URL
```
https://api.burn.snapitsoftware.com
```

---

## 📋 Endpoints

### 1. Upload File
Create a burn record and get S3 upload URL.

```http
POST /upload
Content-Type: application/json
```

**Request Body:**
```json
{
  "fileName": "contract.pdf",          // Required
  "fileSize": 1024000,                 // Required (bytes)
  "contentType": "application/pdf",    // Optional (default: application/octet-stream)
  "expiresIn": 86400,                  // Optional (seconds, default: 24h)
  "maxDownloads": 5,                   // Optional (default: 5)
  "password": "secret123",             // Optional
  "uploaderEmail": "user@example.com", // Optional
  "customMessage": "Please review",    // Optional
  "watermark": true,                   // Optional (Pro only)
  "downloadNotifications": true        // Optional (default: true)
}
```

**Tier Limits:**
| Attribute | Free Tier | Pro Tier |
|-----------|-----------|----------|
| fileSize | 100MB max | 10GB max |
| expiresIn | 24h max | 30 days max |
| maxDownloads | 5 max | Unlimited (-1) |

**Response (201):**
```json
{
  "burnId": "550e8400-e29b-41d4-a716-446655440000",
  "shortLink": "abc123XY",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "shareUrl": "https://burn.snapitsoftware.com/d/abc123XY",
  "expiresAt": "2025-10-07T10:30:00Z",
  "maxDownloads": 5,
  "tier": "free"
}
```

**Next Step:**
Upload file to `uploadUrl` using PUT request:
```bash
curl -X PUT "UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --upload-file contract.pdf
```

---

### 2. Get Burn Metadata
Get file information before downloading.

```http
GET /burns/{burnId}
```

**Path Parameters:**
- `burnId`: Burn ID or short link (e.g., `abc123XY`)

**Response (200):**
```json
{
  "burnId": "550e8400-e29b-41d4-a716-446655440000",
  "shortLink": "abc123XY",
  "fileName": "contract.pdf",
  "fileSize": 1024000,
  "uploadedAt": "2025-10-06T10:30:00Z",
  "expiresAt": "2025-10-07T10:30:00Z",
  "currentDownloads": 2,
  "maxDownloads": 5,
  "requiresPassword": true,
  "customMessage": "Please review and sign",
  "isExpired": false,
  "isDeleted": false,
  "tier": "free",
  "watermark": false
}
```

**Error Responses:**
- `404`: Burn not found
- `410`: File deleted, expired, or max downloads reached

---

### 3. Download File
Verify password and get download URL.

```http
POST /burns/{burnId}/download
Content-Type: application/json
```

**Request Body:**
```json
{
  "password": "secret123",              // Required if burn has password
  "email": "recipient@example.com"      // Optional (for tracking)
}
```

**Response (200):**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "contract.pdf",
  "fileSize": 1024000,
  "expiresIn": 3600,
  "remainingDownloads": 3,
  "willBeDeleted": false,
  "message": null
}
```

**Auto-Delete Response (200):**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "contract.pdf",
  "fileSize": 1024000,
  "expiresIn": 3600,
  "remainingDownloads": 0,
  "willBeDeleted": true,
  "message": "This was the final download. File has been deleted."
}
```

**Next Step:**
Download file from `downloadUrl`:
```bash
curl -o contract.pdf "DOWNLOAD_URL"
```

**Error Responses:**
- `401`: Password required or incorrect
- `404`: Burn not found
- `410`: File deleted, expired, or max downloads reached

---

### 4. List Burns (Authenticated)
Get list of your uploaded burns.

```http
GET /burns?limit=50&status=active
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
- `limit`: Results per page (1-100, default: 50)
- `status`: Filter by status
  - `all`: All burns
  - `active`: Active and downloadable
  - `expired`: Past expiration time
  - `deleted`: Manually or auto-deleted

**Response (200):**
```json
{
  "burns": [
    {
      "burnId": "550e8400-e29b-41d4-a716-446655440000",
      "shortLink": "abc123XY",
      "fileName": "contract.pdf",
      "fileSize": 1024000,
      "uploadedAt": "2025-10-06T10:30:00Z",
      "expiresAt": "2025-10-07T10:30:00Z",
      "currentDownloads": 2,
      "maxDownloads": 5,
      "requiresPassword": true,
      "customMessage": "Please review",
      "isDeleted": false,
      "deleteReason": null,
      "tier": "free",
      "shareUrl": "https://burn.snapitsoftware.com/d/abc123XY",
      "status": "active"
    }
  ],
  "count": 1,
  "userId": "user-123",
  "tier": "free"
}
```

**Status Values:**
- `active`: File is available for download
- `expired`: Past expiration time
- `deleted`: Manually deleted
- `max-downloads`: Download limit reached

**Error Responses:**
- `401`: Authentication required

---

### 5. Delete Burn (Authenticated)
Manually delete a burn before expiration.

```http
DELETE /burns/{burnId}
Authorization: Bearer {JWT_TOKEN}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Burn deleted successfully",
  "burnId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**
- `401`: Authentication required
- `403`: Unauthorized (not owner)
- `404`: Burn not found
- `410`: Already deleted

---

## 🔐 Authentication

### Public Endpoints (No Auth Required)
- `POST /upload` - Anyone can upload
- `GET /burns/{burnId}` - Anyone can view metadata
- `POST /burns/{burnId}/download` - Anyone can download

### Protected Endpoints (JWT Required)
- `GET /burns` - List your burns
- `DELETE /burns/{burnId}` - Delete your burn

### JWT Token Format
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token must contain:
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "tier": "free"
}
```

---

## 🎯 Complete Upload Flow

### 1. Create Burn
```bash
curl -X POST https://api.burn.snapitsoftware.com/upload \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "contract.pdf",
    "fileSize": 1024000,
    "password": "secret123",
    "maxDownloads": 3,
    "customMessage": "Please review and sign"
  }'
```

**Response:**
```json
{
  "burnId": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://snapit-burn-api-files-prod.s3.amazonaws.com/...",
  "shareUrl": "https://burn.snapitsoftware.com/d/abc123XY"
}
```

### 2. Upload File to S3
```bash
curl -X PUT "{uploadUrl}" \
  -H "Content-Type: application/pdf" \
  --upload-file contract.pdf
```

### 3. Share Link
Send `shareUrl` to recipient:
```
https://burn.snapitsoftware.com/d/abc123XY
```

---

## 🎯 Complete Download Flow

### 1. Get Metadata
```bash
curl https://api.burn.snapitsoftware.com/burns/abc123XY
```

**Response:**
```json
{
  "fileName": "contract.pdf",
  "requiresPassword": true,
  "currentDownloads": 0,
  "maxDownloads": 3,
  "expiresAt": "2025-10-07T10:30:00Z"
}
```

### 2. Request Download
```bash
curl -X POST https://api.burn.snapitsoftware.com/burns/abc123XY/download \
  -H 'Content-Type: application/json' \
  -d '{"password": "secret123"}'
```

**Response:**
```json
{
  "downloadUrl": "https://snapit-burn-api-files-prod.s3.amazonaws.com/...",
  "fileName": "contract.pdf",
  "remainingDownloads": 2
}
```

### 3. Download File
```bash
curl -o contract.pdf "{downloadUrl}"
```

---

## ⚙️ Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Password incorrect, missing JWT |
| 403 | Forbidden | Tier limit exceeded, not owner |
| 404 | Not Found | Burn doesn't exist |
| 410 | Gone | File deleted, expired, max downloads |
| 500 | Server Error | AWS service failure |

---

## 🔒 Security Features

### Password Protection
- Passwords hashed with bcrypt (cost factor 10)
- Password never stored in plain text
- Failed attempts logged for abuse detection

### Download Tracking
Every download logged with:
- IP address
- User agent
- Email (if provided)
- Timestamp
- Success/failure reason

### Auto-Delete
Files automatically deleted when:
1. Maximum downloads reached (immediate)
2. Expiration time reached (within 48 hours via TTL)
3. Manually deleted by owner

### Encryption
- **Free Tier**: S3 server-side encryption (AES-256)
- **Pro Tier**: Client-side + server-side encryption

---

## 📊 Rate Limits

| Tier | Uploads/Hour | Downloads/Hour |
|------|--------------|----------------|
| Free | 10 | Unlimited |
| Pro | Unlimited | Unlimited |

Rate limit based on IP address.

---

## 🧪 Example: JavaScript Client

```javascript
// Upload file
async function uploadFile(file, password) {
  // 1. Create burn
  const createResponse = await fetch('https://api.burn.snapitsoftware.com/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      password: password,
      maxDownloads: 5
    })
  });

  const { uploadUrl, shareUrl } = await createResponse.json();

  // 2. Upload to S3
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });

  return shareUrl;
}

// Download file
async function downloadFile(burnId, password) {
  // 1. Get download URL
  const downloadResponse = await fetch(
    `https://api.burn.snapitsoftware.com/burns/${burnId}/download`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }
  );

  const { downloadUrl, fileName } = await downloadResponse.json();

  // 2. Download from S3
  const fileResponse = await fetch(downloadUrl);
  const blob = await fileResponse.blob();

  // 3. Trigger download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}
```

---

## 📞 Support

- **Documentation**: https://burn.snapitsoftware.com/docs
- **Email**: support@snapitsoftware.com
- **Status**: https://status.snapitsoftware.com

---

**Last Updated**: October 6, 2025
