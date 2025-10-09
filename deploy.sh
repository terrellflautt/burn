#!/bin/bash

# Burn App Deployment Script
# This deploys the built React app to S3 and invalidates CloudFront cache

set -e

echo "🔥 Deploying Burn App to Production..."

# Configuration
S3_BUCKET="snapit-burn-static"
CLOUDFRONT_DIST="E33NJODULHM4R1"
BUILD_DIR="build"

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Error: Build directory not found. Run 'npm run build' first."
    exit 1
fi

echo "📦 Syncing files to S3 bucket: $S3_BUCKET"
aws s3 sync $BUILD_DIR/ s3://$S3_BUCKET/ --delete

echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DIST \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "✅ Deployment complete!"
echo "📊 CloudFront invalidation ID: $INVALIDATION_ID"
echo "🌐 Your site will be updated at: https://burn.snapitsoftware.com"
echo ""
echo "Note: CloudFront invalidation may take 1-5 minutes to propagate."
