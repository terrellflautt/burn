# SnapIT Burn - Deployment Guide

Complete step-by-step guide to deploy the SnapIT Burn service to AWS.

---

## 📋 Prerequisites

### Required Accounts
- ✅ AWS account with admin access
- ✅ Stripe account (for Pro subscriptions)
- ✅ Domain registered (burn.snapitsoftware.com)

### Required Tools
```bash
# Node.js 18+
node --version  # Should be v18.x or higher

# NPM
npm --version

# AWS CLI configured
aws --version
aws configure list

# Serverless Framework
npm install -g serverless
```

---

## 🚀 Deployment Steps

### 1. Clone and Install Dependencies
```bash
cd /mnt/c/Users/decry/Desktop/snapit-burn
npm install
```

### 2. Configure AWS Credentials
```bash
# Option A: Environment variables
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"

# Option B: AWS CLI profile
aws configure --profile snapit-burn
# Then deploy with: serverless deploy --aws-profile snapit-burn
```

### 3. Set Up SSM Parameters
```bash
# JWT Secret (shared with forum)
aws ssm put-parameter \
  --name "/snapit-forum/prod/JWT_SECRET" \
  --value "your-jwt-secret-min-32-chars" \
  --type "SecureString" \
  --region us-east-1

# Stripe Secret Key
aws ssm put-parameter \
  --name "/snapit-forum/prod/STRIPE_SECRET_KEY" \
  --value "sk_live_..." \
  --type "SecureString" \
  --region us-east-1
```

### 4. Deploy to Development
```bash
# Deploy dev environment first
npm run deploy-dev

# Expected output:
# ✔ Service deployed to stack snapit-burn-api-dev
# endpoints:
#   POST - https://abc123.execute-api.us-east-1.amazonaws.com/dev/upload
#   GET - https://abc123.execute-api.us-east-1.amazonaws.com/dev/burns/{burnId}
#   POST - https://abc123.execute-api.us-east-1.amazonaws.com/dev/burns/{burnId}/download
#   GET - https://abc123.execute-api.us-east-1.amazonaws.com/dev/burns
#   DELETE - https://abc123.execute-api.us-east-1.amazonaws.com/dev/burns/{burnId}
```

### 5. Test Development Deployment
```bash
# Get API endpoint from deployment output
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com/dev"

# Test upload endpoint
curl -X POST "$API_URL/upload" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "test.txt",
    "fileSize": 100,
    "password": "test123"
  }'

# Should return:
# {
#   "burnId": "...",
#   "uploadUrl": "...",
#   "shareUrl": "..."
# }
```

### 6. Verify DynamoDB Tables
```bash
# Check burns table
aws dynamodb describe-table \
  --table-name snapit-burn-api-burns-dev \
  --region us-east-1

# Check downloads table
aws dynamodb describe-table \
  --table-name snapit-burn-api-downloads-dev \
  --region us-east-1

# Verify TTL is enabled
aws dynamodb describe-time-to-live \
  --table-name snapit-burn-api-burns-dev \
  --region us-east-1
```

### 7. Verify S3 Bucket
```bash
# Check bucket exists
aws s3 ls s3://snapit-burn-api-files-dev

# Check CORS configuration
aws s3api get-bucket-cors \
  --bucket snapit-burn-api-files-dev

# Check encryption
aws s3api get-bucket-encryption \
  --bucket snapit-burn-api-files-dev
```

### 8. Deploy to Production
```bash
# After dev testing passes
npm run deploy-prod

# IMPORTANT: Note the API Gateway URL
# https://xyz789.execute-api.us-east-1.amazonaws.com/prod
```

### 9. Configure Custom Domain
```bash
# Create SSL certificate in ACM (us-east-1 for API Gateway)
aws acm request-certificate \
  --domain-name api.burn.snapitsoftware.com \
  --validation-method DNS \
  --region us-east-1

# Get certificate ARN
aws acm list-certificates --region us-east-1

# Create custom domain in API Gateway
aws apigateway create-domain-name \
  --domain-name api.burn.snapitsoftware.com \
  --certificate-arn arn:aws:acm:us-east-1:... \
  --endpoint-configuration types=EDGE \
  --region us-east-1

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name api.burn.snapitsoftware.com \
  --rest-api-id xyz789 \
  --stage prod \
  --region us-east-1

# Add Route53 record (from API Gateway console)
# Type: A
# Alias: Yes
# Alias Target: API Gateway domain
```

### 10. Set Up CloudFront (Frontend)
```bash
# CloudFront distribution for burn.snapitsoftware.com
# pointing to S3 bucket with React app
# (See frontend deployment guide)
```

---

## 🧪 Testing Production

### Test 1: Upload Flow
```bash
PROD_API="https://api.burn.snapitsoftware.com"

# Create burn
RESPONSE=$(curl -s -X POST "$PROD_API/upload" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileName": "test.txt",
    "fileSize": 100,
    "password": "test123",
    "maxDownloads": 3
  }')

echo $RESPONSE | jq .

# Extract upload URL and burn ID
UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
BURN_ID=$(echo $RESPONSE | jq -r '.burnId')

# Upload file
echo "Hello, SnapIT Burn!" > test.txt
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  --upload-file test.txt

echo "✅ Upload successful"
```

### Test 2: Download Flow
```bash
# Get metadata
curl "$PROD_API/burns/$BURN_ID" | jq .

# Download with password
DOWNLOAD_RESPONSE=$(curl -s -X POST "$PROD_API/burns/$BURN_ID/download" \
  -H 'Content-Type: application/json' \
  -d '{"password": "test123"}')

echo $DOWNLOAD_RESPONSE | jq .

# Extract download URL
DOWNLOAD_URL=$(echo $DOWNLOAD_RESPONSE | jq -r '.downloadUrl')

# Download file
curl -o downloaded.txt "$DOWNLOAD_URL"

# Verify content
cat downloaded.txt
# Should show: "Hello, SnapIT Burn!"

echo "✅ Download successful"
```

### Test 3: Auto-Delete on Max Downloads
```bash
# Download 2 more times (total 3)
for i in {2..3}; do
  curl -s -X POST "$PROD_API/burns/$BURN_ID/download" \
    -H 'Content-Type: application/json' \
    -d '{"password": "test123"}' | jq .
done

# Last download should return:
# {
#   "willBeDeleted": true,
#   "message": "This was the final download. File has been deleted."
# }

# Try to download again (should fail)
curl "$PROD_API/burns/$BURN_ID/download" \
  -H 'Content-Type: application/json' \
  -d '{"password": "test123"}'

# Should return 410: "Maximum downloads reached"

echo "✅ Auto-delete successful"
```

### Test 4: Authenticated Endpoints
```bash
# Get JWT token from forum login
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# List burns
curl "$PROD_API/burns?status=active" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

# Delete burn
curl -X DELETE "$PROD_API/burns/$BURN_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .

echo "✅ Authentication successful"
```

---

## 📊 Monitoring Setup

### CloudWatch Alarms
```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name snapit-burn-high-errors \
  --alarm-description "Alert on high error rate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=snapit-burn-api-prod-upload

# S3 storage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name snapit-burn-storage-high \
  --alarm-description "Alert on high S3 storage" \
  --metric-name BucketSizeBytes \
  --namespace AWS/S3 \
  --statistic Average \
  --period 86400 \
  --threshold 107374182400 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=BucketName,Value=snapit-burn-api-files-prod
```

### CloudWatch Dashboard
```bash
# Create dashboard JSON
cat > dashboard.json <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          [".", "Errors", {"stat": "Sum"}],
          [".", "Duration", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Lambda Metrics"
      }
    }
  ]
}
EOF

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name SnapIT-Burn-Production \
  --dashboard-body file://dashboard.json
```

---

## 🔐 Security Hardening

### 1. Enable AWS WAF
```bash
# Create WAF WebACL
aws wafv2 create-web-acl \
  --name snapit-burn-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules '[
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": { "Block": {} },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimitRule"
      }
    }
  ]' \
  --region us-east-1
```

### 2. Enable API Gateway Logging
```bash
# Create CloudWatch log group
aws logs create-log-group \
  --log-group-name /aws/apigateway/snapit-burn-prod

# Enable execution logs in API Gateway console
# Settings → Logs/Tracing → Enable CloudWatch Logs
```

### 3. Enable S3 Access Logging
```bash
# Create logging bucket
aws s3 mb s3://snapit-burn-logs

# Enable access logging
aws s3api put-bucket-logging \
  --bucket snapit-burn-api-files-prod \
  --bucket-logging-status '{
    "LoggingEnabled": {
      "TargetBucket": "snapit-burn-logs",
      "TargetPrefix": "s3-access/"
    }
  }'
```

### 4. Enable DynamoDB Backups
```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name snapit-burn-api-burns-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

aws dynamodb update-continuous-backups \
  --table-name snapit-burn-api-downloads-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

---

## 💰 Cost Optimization

### Enable S3 Lifecycle Policies
```bash
# Delete old files after 30 days (already in serverless.yml)
# Transition to Glacier after 7 days for cost savings

aws s3api put-bucket-lifecycle-configuration \
  --bucket snapit-burn-api-files-prod \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "DeleteOldFiles",
        "Status": "Enabled",
        "ExpirationInDays": 30,
        "Transitions": [
          {
            "Days": 7,
            "StorageClass": "GLACIER"
          }
        ]
      }
    ]
  }'
```

### Enable DynamoDB Auto-Scaling
```bash
# Already using PAY_PER_REQUEST billing mode
# No need for auto-scaling configuration
```

### Monitor Costs
```bash
# Create cost anomaly detector
aws ce create-anomaly-detector \
  --anomaly-detector '{
    "AnomalyDetectorName": "SnapIT-Burn-Detector",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'
```

---

## 🔄 CI/CD Setup (Optional)

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to production
        run: npm run deploy-prod
```

---

## 🐛 Troubleshooting

### Issue: "Unable to resolve serverless.yml"
```bash
# Make sure you're in the project directory
cd /mnt/c/Users/decry/Desktop/snapit-burn
ls -la serverless.yml

# Validate serverless.yml
serverless print
```

### Issue: "IAM role creation failed"
```bash
# Grant CloudFormation permissions
aws iam attach-user-policy \
  --user-name your-user \
  --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess
```

### Issue: "Parameter /snapit-forum/prod/JWT_SECRET not found"
```bash
# Verify parameter exists
aws ssm get-parameter \
  --name "/snapit-forum/prod/JWT_SECRET" \
  --with-decryption \
  --region us-east-1

# If not found, create it
aws ssm put-parameter \
  --name "/snapit-forum/prod/JWT_SECRET" \
  --value "your-secret-here" \
  --type "SecureString" \
  --region us-east-1
```

### Issue: "S3 bucket already exists"
```bash
# Bucket names must be globally unique
# Update serverless.yml to use unique bucket name
BURN_BUCKET: snapit-burn-files-${self:provider.stage}-${aws:accountId}
```

### Issue: "TTL not deleting expired burns"
```bash
# DynamoDB TTL has up to 48-hour delay
# Verify TTL is enabled
aws dynamodb describe-time-to-live \
  --table-name snapit-burn-api-burns-prod

# Create manual cleanup Lambda for immediate deletion
```

---

## 📈 Performance Tuning

### Lambda Memory Optimization
```bash
# Test with different memory sizes
# 256MB (default) → 512MB → 1024MB
# Higher memory = faster CPU = faster bcrypt

# Update serverless.yml:
# functions:
#   upload:
#     memorySize: 512
#     timeout: 30
```

### Enable Lambda Provisioned Concurrency
```bash
# For high-traffic scenarios
aws lambda put-provisioned-concurrency-config \
  --function-name snapit-burn-api-prod-upload \
  --provisioned-concurrent-executions 5
```

### Enable API Gateway Caching
```bash
# Cache GET /burns/:burnId responses
# Update serverless.yml:
# events:
#   - http:
#       path: burns/{burnId}
#       method: get
#       caching:
#         enabled: true
#         ttlInSeconds: 60
```

---

## 🎯 Post-Deployment Checklist

- [ ] All Lambda functions deployed successfully
- [ ] DynamoDB tables created with TTL enabled
- [ ] S3 bucket created with CORS and encryption
- [ ] SSM parameters configured
- [ ] Custom domain mapped to API Gateway
- [ ] CloudWatch alarms configured
- [ ] WAF rules enabled
- [ ] S3 access logging enabled
- [ ] DynamoDB backups enabled
- [ ] Tested upload/download flow
- [ ] Tested auto-delete functionality
- [ ] Tested authenticated endpoints
- [ ] Monitored CloudWatch metrics for errors
- [ ] Verified cost estimates in AWS Cost Explorer

---

## 🚀 Next Steps

1. **Deploy Frontend**: Build and deploy React app to CloudFront
2. **Configure DNS**: Point burn.snapitsoftware.com to CloudFront
3. **Enable SES**: Set up email notifications for downloads
4. **Add Monitoring**: Set up Datadog/New Relic for APM
5. **Load Testing**: Use Artillery/k6 to test at scale
6. **Documentation**: Create user guides and API docs
7. **Marketing**: Launch on Product Hunt, Hacker News

---

**Deployment Complete! 🎉**

Your SnapIT Burn API is now live at:
```
https://api.burn.snapitsoftware.com
```

Share link format:
```
https://burn.snapitsoftware.com/d/{shortLink}
```
