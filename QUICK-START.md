# SnapIT Burn - Quick Start Guide

Get started with SnapIT Burn in 5 minutes.

---

## 🚀 Deploy in 3 Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure AWS credentials
aws configure

# 3. Deploy to production
npm run deploy-prod
```

---

## 🧪 Test Your Deployment

```bash
# Set API endpoint (from deployment output)
export API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

# Test upload
curl -X POST "$API_URL/upload" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "test.txt",
    "fileSize": 100,
    "password": "test123",
    "maxDownloads": 3
  }'

# Upload file to S3 (use uploadUrl from response)
echo "Hello World" > test.txt
curl -X PUT "UPLOAD_URL" \
  --upload-file test.txt

# Download file (use burnId from upload response)
curl -X POST "$API_URL/burns/BURN_ID/download" \
  -H 'Content-Type: application/json' \
  -d '{"password": "test123"}'

# Download from S3 (use downloadUrl from response)
curl -o downloaded.txt "DOWNLOAD_URL"

# Verify
cat downloaded.txt  # Should show "Hello World"
```

---

## 📋 Essential API Calls

### Upload File
```bash
POST /upload
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "password": "secret",
  "maxDownloads": 5
}
```

### Get Metadata
```bash
GET /burns/{burnId}
```

### Download File
```bash
POST /burns/{burnId}/download
{
  "password": "secret"
}
```

---

## 🔧 Environment Setup

### Required AWS Services
- ✅ DynamoDB (2 tables)
- ✅ S3 (1 bucket)
- ✅ Lambda (5 functions)
- ✅ API Gateway (1 API)
- ✅ CloudWatch (logs)

### Required SSM Parameters
```bash
aws ssm put-parameter \
  --name "/snapit-forum/prod/JWT_SECRET" \
  --value "your-secret-here" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/snapit-forum/prod/STRIPE_SECRET_KEY" \
  --value "sk_live_..." \
  --type "SecureString"
```

---

## 📊 Architecture Overview

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐
│  API Gateway    │────▶│   Lambda     │
│  (REST API)     │     │  (Handlers)  │
└─────────────────┘     └──────┬───────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
         ┌───────────┐  ┌───────────┐  ┌──────────┐
         │ DynamoDB  │  │    S3     │  │   SES    │
         │  (Metadata)│  │  (Files)  │  │ (Email)  │
         └───────────┘  └───────────┘  └──────────┘
```

---

## 🔐 Security Checklist

- [x] Passwords hashed with bcrypt
- [x] S3 server-side encryption enabled
- [x] Presigned URLs expire after 1 hour
- [x] DynamoDB TTL for auto-expiration
- [x] JWT authentication for protected endpoints
- [x] Download tracking for abuse prevention
- [x] Auto-delete on max downloads reached

---

## 📁 Project Structure

```
snapit-burn/
├── src/
│   └── handlers/
│       ├── burns.js       # Main handlers (599 lines)
│       ├── auth.js        # JWT authorizer
│       └── README.md      # Handler docs
├── serverless.yml         # Infrastructure config
├── package.json           # Dependencies
├── API-REFERENCE.md       # API documentation
├── DEPLOYMENT-GUIDE.md    # Deployment steps
└── IMPLEMENTATION-SUMMARY.md  # What was built
```

---

## 🐛 Common Issues

### "Parameter not found"
```bash
# Set SSM parameters
aws ssm put-parameter \
  --name "/snapit-forum/prod/JWT_SECRET" \
  --value "your-secret" \
  --type "SecureString"
```

### "Bucket already exists"
```bash
# Update serverless.yml bucket name to be unique
BURN_BUCKET: snapit-burn-files-${aws:accountId}-${self:provider.stage}
```

### "Unauthorized" on list/delete
```bash
# Get JWT token from forum login
# Add to request: Authorization: Bearer TOKEN
```

---

## 📊 Monitoring

### View Logs
```bash
# Upload function logs
serverless logs -f upload -t

# Download function logs
serverless logs -f download -t

# All functions
serverless logs -f upload -f download -f getBurn -t
```

### CloudWatch Metrics
- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- S3 storage size, requests
- API Gateway requests, latency

---

## 💰 Cost Estimation

### Free Tier (First 12 months)
- DynamoDB: 25GB storage, 25 WCU/RCU
- S3: 5GB storage, 20k GET, 2k PUT
- Lambda: 1M requests, 400k GB-seconds
- API Gateway: 1M requests

### After Free Tier (per month)
- 1000 users × 10 files × 10MB = ~$2 S3
- DynamoDB Pay-per-request = ~$5
- Lambda requests = ~$0.002
- **Total: ~$8/month**

### Revenue Potential
- 100 Pro users × $5/month = **$500/month**
- **Profit: $492/month (98% margin)**

---

## 🚀 Next Steps

1. **Deploy Backend** (you are here)
   ```bash
   npm run deploy-prod
   ```

2. **Build Frontend**
   - React app with file upload UI
   - Download page with password input
   - Dashboard for Pro users

3. **Configure Domain**
   - `api.burn.snapitsoftware.com` → API Gateway
   - `burn.snapitsoftware.com` → CloudFront

4. **Add Email**
   - SES for download notifications
   - Templates for download alerts

5. **Marketing**
   - Product Hunt launch
   - Hacker News "Show HN"
   - Reddit r/privacy, r/selfhosted

---

## 📚 Documentation

- **API Reference**: See `API-REFERENCE.md`
- **Deployment Guide**: See `DEPLOYMENT-GUIDE.md`
- **Implementation Details**: See `IMPLEMENTATION-SUMMARY.md`
- **Handler Docs**: See `src/handlers/README.md`
- **Architecture**: See `ARCHITECTURE.md`

---

## 🎯 Success Metrics

Track these KPIs after launch:

- **Signups**: 1,000 users in month 1
- **Conversion**: 5% free → Pro ($2,500 MRR)
- **Uploads**: 10,000 files shared
- **Retention**: 80% Pro users stay
- **Viral Coefficient**: 1.5 (growth!)

---

## 💡 Pro Tips

### Optimize Lambda Memory
```yaml
# Higher memory = faster bcrypt
functions:
  upload:
    memorySize: 512  # Instead of 256
```

### Enable API Gateway Caching
```yaml
# Cache GET requests
events:
  - http:
      path: burns/{burnId}
      caching:
        enabled: true
        ttlInSeconds: 60
```

### Monitor Error Rate
```bash
# Create CloudWatch alarm
aws cloudwatch put-metric-alarm \
  --alarm-name snapit-burn-errors \
  --metric-name Errors \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## 🔗 Useful Commands

```bash
# Deploy dev environment
npm run deploy-dev

# Deploy prod environment
npm run deploy-prod

# View logs
npm run logs

# Remove dev environment
serverless remove --stage dev

# Validate serverless.yml
serverless print

# Invoke function locally
serverless invoke local -f upload -d '{"body":"{\"fileName\":\"test.txt\",\"fileSize\":100}"}'
```

---

## 🎉 You're Ready!

Your SnapIT Burn backend is complete and ready to deploy.

```bash
npm install && npm run deploy-prod
```

**After deployment**, share your first file:
1. POST to `/upload` → Get uploadUrl
2. PUT file to uploadUrl
3. Share the shareUrl with anyone
4. They download with optional password
5. File auto-deletes after max downloads!

---

**Questions?** Read the full docs in `DEPLOYMENT-GUIDE.md` 📖
