# SnapIT Burn - Backend API

Self-destructing file sharing backend built with AWS Lambda and Serverless Framework.

## Overview

SnapIT Burn is a secure, one-time file sharing service. Files are automatically deleted after being viewed once (or after reaching max downloads/expiration time).

**Live Site**: https://burn.snapitsoftware.com

## Architecture

- **AWS Lambda** - Serverless compute for API handlers
- **API Gateway** - REST API endpoints
- **S3** - Secure file storage with presigned URLs
- **DynamoDB** - Burn metadata and download logs

## Prerequisites

Before deploying, ensure you have:

1. **Node.js** 18.x or higher
2. **npm** or **yarn**
3. **AWS CLI** configured with credentials
4. **Serverless Framework** installed globally

```bash
npm install -g serverless
```

5. **AWS Account** with permissions to create:
   - Lambda functions
   - API Gateway
   - S3 buckets
   - DynamoDB tables
   - IAM roles
   - CloudWatch logs

## Installation

```bash
npm install
```

## Configuration

The `serverless.yml` file contains all infrastructure configuration. Key settings:

### Environment Variables (auto-configured)

- `BURN_BUCKET` - S3 bucket name for file storage
- `BURNS_TABLE` - DynamoDB table for burn metadata
- `DOWNLOADS_TABLE` - DynamoDB table for download logs

### Customization

Edit `serverless.yml` to customize:

```yaml
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1  # Change to your preferred region
  stage: ${opt:stage, 'dev'}
```

## Deployment

### Deploy to AWS

```bash
# Deploy to production
serverless deploy --stage prod

# Deploy to development
serverless deploy --stage dev
```

After deployment, you'll receive:

- **API Gateway URL**: Your API endpoint (e.g., `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`)
- **S3 Bucket**: File storage bucket name
- **DynamoDB Tables**: Metadata and logs tables

### Important: Update Frontend

After deployment, update your frontend's API URL:

```javascript
// In your frontend src/config.ts or environment file
const API_URL = 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod';
```

## API Endpoints

### Create Burn
```
POST /burns
Content-Type: application/json

{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "contentType": "application/pdf",
  "expiresIn": 86400,
  "maxDownloads": 1
}

Response:
{
  "burnId": "uuid",
  "shortLink": "ABC123",
  "uploadUrl": "https://s3-presigned-url...",
  "shareUrl": "https://burn.snapitsoftware.com/d/ABC123",
  "expiresAt": 1234567890000
}
```

### Get Burn Metadata
```
GET /burns/{burnId}

Response:
{
  "burnId": "uuid",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "isDeleted": false,
  "requiresPassword": false,
  "expiresAt": 1234567890000,
  "maxDownloads": 1,
  "currentDownloads": 0
}
```

### Request Download URL
```
POST /burns/{burnId}/download
Content-Type: application/json

{
  "password": "optional-password"  // Only if burn requires password
}

Response:
{
  "downloadUrl": "https://s3-presigned-url...",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "expiresIn": 300,
  "remainingDownloads": 0,
  "willBeDeleted": true
}
```

### Confirm Download
```
POST /burns/{burnId}/confirm
Content-Type: application/json

{}

Response:
{
  "success": true,
  "deleted": true,
  "message": "File has been permanently deleted."
}
```

## S3 Bucket Configuration

After deployment, configure your S3 bucket:

### 1. Enable CORS

```bash
aws s3api put-bucket-cors --bucket YOUR-BUCKET-NAME --cors-configuration file://cors.json
```

Create `cors.json`:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://burn.snapitsoftware.com", "http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### 2. Public Access Block Settings

For presigned URLs to work:

```bash
aws s3api put-public-access-block --bucket YOUR-BUCKET-NAME --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

## DynamoDB Tables

### Burns Table
- **Primary Key**: `burnId` (String)
- **TTL**: Enabled on `expiresAt` field
- **Attributes**: fileName, fileSize, fileKey, shortLink, maxDownloads, currentDownloads, etc.

### Downloads Table
- **Primary Key**: `downloadId` (String)
- **Attributes**: burnId, downloadedAt, downloaderIp, success

## Monitoring

### View Logs
```bash
serverless logs -f createBurn --tail
serverless logs -f download --tail
```

### CloudWatch Logs
All Lambda functions log to CloudWatch:
- `/aws/lambda/snapit-burn-api-prod-createBurn`
- `/aws/lambda/snapit-burn-api-prod-getBurn`
- `/aws/lambda/snapit-burn-api-prod-download`
- `/aws/lambda/snapit-burn-api-prod-confirmDownload`

## Local Development

```bash
# Install dependencies
npm install

# Run tests (if available)
npm test

# Deploy to dev environment
serverless deploy --stage dev
```

## Cleanup / Remove

To remove all AWS resources:

```bash
serverless remove --stage prod
```

This will delete:
- Lambda functions
- API Gateway
- DynamoDB tables
- CloudWatch logs
- IAM roles

**Note**: S3 bucket must be manually emptied before removal:

```bash
aws s3 rm s3://YOUR-BUCKET-NAME --recursive
aws s3 rb s3://YOUR-BUCKET-NAME
```

## Security

- Files are stored in private S3 bucket
- Access via presigned URLs (5-minute expiration)
- No public bucket access
- Optional password protection per burn
- Automatic deletion after max downloads
- TTL-based expiration for old burns

## Troubleshooting

### 403 Forbidden on S3 Downloads

**Issue**: Presigned URLs return 403 errors

**Solution**: Check S3 public access block settings:
```bash
aws s3api get-public-access-block --bucket YOUR-BUCKET-NAME
```

Ensure `BlockPublicPolicy` and `RestrictPublicBuckets` are `false`.

### CORS Errors

**Issue**: Browser blocks S3 requests

**Solution**: Verify S3 CORS configuration includes your frontend domain.

### Lambda Timeout

**Issue**: Large file uploads timing out

**Solution**: Increase Lambda timeout in `serverless.yml`:
```yaml
provider:
  timeout: 30  # seconds
```

## Support

For issues or questions:
- **Email**: snapitsoft@gmail.com
- **GitHub**: https://github.com/terrellflautt/burn

## License

MIT License - See LICENSE file for details
