# Burn - Self-Destructing File Sharing

One-time file sharing with automatic deletion after viewing.

## Setup

```bash
npm install
```

## Deploy

```bash
serverless deploy --stage prod
```

## Endpoints

- POST /upload - Upload file
- GET /burns/{burnId} - Get burn metadata
- POST /burns/{burnId}/download - Download (destroys file)
- GET /burns - List user's burns
- DELETE /burns/{burnId} - Delete burn

## Tech Stack

- AWS Lambda + API Gateway
- S3 for file storage
- DynamoDB for metadata
