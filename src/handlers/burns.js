const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BURNS_TABLE = process.env.BURNS_TABLE;
const DOWNLOADS_TABLE = process.env.DOWNLOADS_TABLE;
const BURN_BUCKET = process.env.BURN_BUCKET;

// Free tier limits
const FREE_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const FREE_MAX_EXPIRATION = 24 * 60 * 60; // 24 hours
const FREE_MAX_DOWNLOADS = 5;

// Pro tier limits
const PRO_MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
const PRO_MAX_EXPIRATION = 30 * 24 * 60 * 60; // 30 days

// Password hashing cost factor
const BCRYPT_ROUNDS = 10;

// Helper: CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': false,
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Helper: Success response
const success = (body, statusCode = 200) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// Helper: Error response
const error = (message, statusCode = 400) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error: message })
});

// Helper: Generate short link
const generateShortLink = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortLink = '';
  for (let i = 0; i < 8; i++) {
    shortLink += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return shortLink;
};

// Helper: Get user tier from context
const getUserTier = (event) => {
  // If authenticated via JWT authorizer
  if (event.requestContext && event.requestContext.authorizer) {
    return event.requestContext.authorizer.tier || 'free';
  }
  return 'free';
};

// Helper: Get user ID from context
const getUserId = (event) => {
  if (event.requestContext && event.requestContext.authorizer) {
    return event.requestContext.authorizer.userId;
  }
  return null;
};

// Helper: Validate tier limits
const validateTierLimits = (tier, fileSize, expiresIn, maxDownloads) => {
  if (tier === 'free') {
    if (fileSize > FREE_MAX_FILE_SIZE) {
      return `File size exceeds free tier limit of ${FREE_MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    if (expiresIn > FREE_MAX_EXPIRATION) {
      return `Expiration time exceeds free tier limit of ${FREE_MAX_EXPIRATION / 3600} hours`;
    }
    if (maxDownloads > FREE_MAX_DOWNLOADS) {
      return `Max downloads exceeds free tier limit of ${FREE_MAX_DOWNLOADS}`;
    }
  } else if (tier === 'pro') {
    if (fileSize > PRO_MAX_FILE_SIZE) {
      return `File size exceeds pro tier limit of ${PRO_MAX_FILE_SIZE / 1024 / 1024 / 1024}GB`;
    }
    if (expiresIn > PRO_MAX_EXPIRATION) {
      return `Expiration time exceeds pro tier limit of ${PRO_MAX_EXPIRATION / 86400} days`;
    }
  }
  return null;
};

/**
 * UPLOAD - Create burn record and return presigned S3 upload URL
 * POST /upload
 */
exports.upload = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      fileName,
      fileSize,
      contentType = 'application/octet-stream',
      expiresIn = 86400, // Default 24 hours
      maxDownloads = 5,
      password,
      uploaderEmail,
      customMessage,
      watermark = false,
      downloadNotifications = true
    } = body;

    // Validation
    if (!fileName || !fileSize) {
      return error('fileName and fileSize are required');
    }

    // Get user tier
    const tier = getUserTier(event);
    const userId = getUserId(event);

    // Validate tier limits
    const limitError = validateTierLimits(tier, fileSize, expiresIn, maxDownloads);
    if (limitError) {
      return error(limitError, 403);
    }

    // Generate IDs
    const burnId = uuidv4();
    const shortLink = generateShortLink();
    const fileKey = `burns/${burnId}`;
    const uploadedAt = Date.now();
    const expiresAt = Math.floor((uploadedAt + expiresIn * 1000) / 1000); // Convert to Unix timestamp in seconds for TTL

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    // Get uploader IP
    const uploaderIp = event.requestContext?.identity?.sourceIp || 'unknown';

    // Create burn record in DynamoDB
    const burnRecord = {
      burnId,
      fileName,
      fileSize,
      fileKey,
      uploadedAt,
      expiresAt, // TTL in seconds
      maxDownloads: maxDownloads === -1 ? -1 : maxDownloads, // -1 for unlimited (Pro only)
      currentDownloads: 0,
      password: hashedPassword,
      uploaderEmail,
      uploaderIp,
      tier,
      userId: userId || 'anonymous',
      isDeleted: false,
      deleteReason: null,
      customMessage,
      downloadNotifications,
      watermark: tier === 'pro' ? watermark : false,
      shortLink,
      metadata: {
        contentType,
        isEncrypted: tier === 'pro', // Pro users get encryption
        encryptionAlgorithm: tier === 'pro' ? 'AES-256-GCM' : null
      }
    };

    await dynamodb.put({
      TableName: BURNS_TABLE,
      Item: burnRecord
    }).promise();

    // Generate presigned upload URL
    const uploadUrl = s3.getSignedUrl('putObject', {
      Bucket: BURN_BUCKET,
      Key: fileKey,
      ContentType: contentType,
      Expires: 3600, // URL valid for 1 hour
      ServerSideEncryption: 'AES256' // S3 server-side encryption
    });

    // Return response
    return success({
      burnId,
      shortLink,
      uploadUrl,
      shareUrl: `https://burn.snapitsoftware.com/d/${shortLink}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      maxDownloads: maxDownloads === -1 ? 'unlimited' : maxDownloads,
      tier
    }, 201);

  } catch (err) {
    console.error('Upload error:', err);
    return error('Failed to create burn record', 500);
  }
};

/**
 * GET - Get burn metadata (before download)
 * GET /burns/:burnId
 */
exports.get = async (event) => {
  try {
    const { burnId } = event.pathParameters;

    if (!burnId) {
      return error('burnId is required');
    }

    // Try to find by burnId first
    let burn = await dynamodb.get({
      TableName: BURNS_TABLE,
      Key: { burnId }
    }).promise();

    // If not found by burnId, try to find by shortLink
    if (!burn.Item) {
      const result = await dynamodb.scan({
        TableName: BURNS_TABLE,
        FilterExpression: 'shortLink = :shortLink',
        ExpressionAttributeValues: {
          ':shortLink': burnId
        }
      }).promise();

      if (result.Items && result.Items.length > 0) {
        burn = { Item: result.Items[0] };
      }
    }

    if (!burn.Item) {
      return error('Burn not found', 404);
    }

    const burnData = burn.Item;

    // Check if deleted
    if (burnData.isDeleted) {
      return error('This file has been deleted', 410);
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    const isExpired = burnData.expiresAt < now;

    if (isExpired) {
      return error('This file has expired', 410);
    }

    // Check if max downloads reached
    if (burnData.maxDownloads !== -1 && burnData.currentDownloads >= burnData.maxDownloads) {
      return error('Maximum downloads reached', 410);
    }

    // Return metadata (don't expose password hash)
    return success({
      burnId: burnData.burnId,
      shortLink: burnData.shortLink,
      fileName: burnData.fileName,
      fileSize: burnData.fileSize,
      uploadedAt: new Date(burnData.uploadedAt).toISOString(),
      expiresAt: new Date(burnData.expiresAt * 1000).toISOString(),
      currentDownloads: burnData.currentDownloads,
      maxDownloads: burnData.maxDownloads === -1 ? 'unlimited' : burnData.maxDownloads,
      requiresPassword: !!burnData.password,
      customMessage: burnData.customMessage,
      isExpired,
      isDeleted: burnData.isDeleted,
      tier: burnData.tier,
      watermark: burnData.watermark
    });

  } catch (err) {
    console.error('Get burn error:', err);
    return error('Failed to retrieve burn', 500);
  }
};

/**
 * DOWNLOAD - Verify password and generate presigned download URL
 * POST /burns/:burnId/download
 */
exports.download = async (event) => {
  try {
    const { burnId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');
    const { password, email: downloaderEmail } = body;

    if (!burnId) {
      return error('burnId is required');
    }

    // Get burn record
    let burn = await dynamodb.get({
      TableName: BURNS_TABLE,
      Key: { burnId }
    }).promise();

    // If not found by burnId, try shortLink
    if (!burn.Item) {
      const result = await dynamodb.scan({
        TableName: BURNS_TABLE,
        FilterExpression: 'shortLink = :shortLink',
        ExpressionAttributeValues: {
          ':shortLink': burnId
        }
      }).promise();

      if (result.Items && result.Items.length > 0) {
        burn = { Item: result.Items[0] };
      }
    }

    if (!burn.Item) {
      return error('Burn not found', 404);
    }

    const burnData = burn.Item;

    // Check if deleted
    if (burnData.isDeleted) {
      return error('This file has been deleted', 410);
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (burnData.expiresAt < now) {
      return error('This file has expired', 410);
    }

    // Check if max downloads reached
    if (burnData.maxDownloads !== -1 && burnData.currentDownloads >= burnData.maxDownloads) {
      return error('Maximum downloads reached', 410);
    }

    // Verify password if required
    if (burnData.password) {
      if (!password) {
        return error('Password required', 401);
      }

      const passwordMatch = await bcrypt.compare(password, burnData.password);
      if (!passwordMatch) {
        // Log failed download attempt
        await dynamodb.put({
          TableName: DOWNLOADS_TABLE,
          Item: {
            downloadId: uuidv4(),
            burnId: burnData.burnId,
            downloadedAt: Date.now(),
            downloaderIp: event.requestContext?.identity?.sourceIp || 'unknown',
            downloaderUserAgent: event.headers?.['User-Agent'] || 'unknown',
            downloaderEmail,
            success: false,
            errorReason: 'password-incorrect'
          }
        }).promise();

        return error('Incorrect password', 401);
      }
    }

    // Atomically increment download counter
    const updateResult = await dynamodb.update({
      TableName: BURNS_TABLE,
      Key: { burnId: burnData.burnId },
      UpdateExpression: 'SET currentDownloads = currentDownloads + :inc',
      ExpressionAttributeValues: {
        ':inc': 1
      },
      ReturnValues: 'ALL_NEW'
    }).promise();

    const updatedBurn = updateResult.Attributes;

    // Generate presigned download URL
    const downloadUrl = s3.getSignedUrl('getObject', {
      Bucket: BURN_BUCKET,
      Key: burnData.fileKey,
      Expires: 3600, // URL valid for 1 hour
      ResponseContentDisposition: `attachment; filename="${burnData.fileName}"`
    });

    // Log successful download
    await dynamodb.put({
      TableName: DOWNLOADS_TABLE,
      Item: {
        downloadId: uuidv4(),
        burnId: burnData.burnId,
        downloadedAt: Date.now(),
        downloaderIp: event.requestContext?.identity?.sourceIp || 'unknown',
        downloaderUserAgent: event.headers?.['User-Agent'] || 'unknown',
        downloaderEmail,
        success: true,
        errorReason: null
      }
    }).promise();

    // Check if max downloads reached after this download
    const shouldDelete = burnData.maxDownloads !== -1 &&
                        updatedBurn.currentDownloads >= burnData.maxDownloads;

    // Auto-delete if max downloads reached
    if (shouldDelete) {
      // Delete from S3
      await s3.deleteObject({
        Bucket: BURN_BUCKET,
        Key: burnData.fileKey
      }).promise();

      // Mark as deleted in DynamoDB
      await dynamodb.update({
        TableName: BURNS_TABLE,
        Key: { burnId: burnData.burnId },
        UpdateExpression: 'SET isDeleted = :deleted, deleteReason = :reason',
        ExpressionAttributeValues: {
          ':deleted': true,
          ':reason': 'max-downloads'
        }
      }).promise();
    }

    // Calculate remaining downloads
    const remainingDownloads = burnData.maxDownloads === -1
      ? 'unlimited'
      : Math.max(0, burnData.maxDownloads - updatedBurn.currentDownloads);

    return success({
      downloadUrl,
      fileName: burnData.fileName,
      fileSize: burnData.fileSize,
      expiresIn: 3600, // URL valid for 1 hour
      remainingDownloads,
      willBeDeleted: shouldDelete,
      message: shouldDelete ? 'This was the final download. File has been deleted.' : null
    });

  } catch (err) {
    console.error('Download error:', err);
    return error('Failed to generate download URL', 500);
  }
};

/**
 * LIST - Get user's burns (authenticated only)
 * GET /burns?limit=50&status=active
 */
exports.list = async (event) => {
  try {
    const userId = getUserId(event);

    if (!userId) {
      return error('Authentication required', 401);
    }

    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
    const status = queryParams.status || 'all'; // all, active, expired, deleted

    // Query user's burns using GSI
    const queryResult = await dynamodb.query({
      TableName: BURNS_TABLE,
      IndexName: 'UserIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false // Most recent first
    }).promise();

    let burns = queryResult.Items;

    // Filter by status
    const now = Math.floor(Date.now() / 1000);
    if (status === 'active') {
      burns = burns.filter(b => !b.isDeleted && b.expiresAt > now &&
                                (b.maxDownloads === -1 || b.currentDownloads < b.maxDownloads));
    } else if (status === 'expired') {
      burns = burns.filter(b => !b.isDeleted && b.expiresAt <= now);
    } else if (status === 'deleted') {
      burns = burns.filter(b => b.isDeleted);
    }

    // Format response
    const formattedBurns = burns.map(burn => ({
      burnId: burn.burnId,
      shortLink: burn.shortLink,
      fileName: burn.fileName,
      fileSize: burn.fileSize,
      uploadedAt: new Date(burn.uploadedAt).toISOString(),
      expiresAt: new Date(burn.expiresAt * 1000).toISOString(),
      currentDownloads: burn.currentDownloads,
      maxDownloads: burn.maxDownloads === -1 ? 'unlimited' : burn.maxDownloads,
      requiresPassword: !!burn.password,
      customMessage: burn.customMessage,
      isDeleted: burn.isDeleted,
      deleteReason: burn.deleteReason,
      tier: burn.tier,
      shareUrl: `https://burn.snapitsoftware.com/d/${burn.shortLink}`,
      status: burn.isDeleted ? 'deleted' :
              burn.expiresAt <= now ? 'expired' :
              (burn.maxDownloads !== -1 && burn.currentDownloads >= burn.maxDownloads) ? 'max-downloads' :
              'active'
    }));

    return success({
      burns: formattedBurns,
      count: formattedBurns.length,
      userId,
      tier: getUserTier(event)
    });

  } catch (err) {
    console.error('List burns error:', err);
    return error('Failed to list burns', 500);
  }
};

/**
 * DELETE - Delete burn manually (authenticated only)
 * DELETE /burns/:burnId
 */
exports.delete = async (event) => {
  try {
    const { burnId } = event.pathParameters;
    const userId = getUserId(event);

    if (!userId) {
      return error('Authentication required', 401);
    }

    if (!burnId) {
      return error('burnId is required');
    }

    // Get burn record
    const burn = await dynamodb.get({
      TableName: BURNS_TABLE,
      Key: { burnId }
    }).promise();

    if (!burn.Item) {
      return error('Burn not found', 404);
    }

    const burnData = burn.Item;

    // Check ownership (only owner can delete)
    if (burnData.userId !== userId) {
      return error('Unauthorized: You can only delete your own burns', 403);
    }

    // Check if already deleted
    if (burnData.isDeleted) {
      return error('Burn already deleted', 410);
    }

    // Delete from S3
    try {
      await s3.deleteObject({
        Bucket: BURN_BUCKET,
        Key: burnData.fileKey
      }).promise();
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      // Continue even if S3 deletion fails (file might not exist)
    }

    // Mark as deleted in DynamoDB
    await dynamodb.update({
      TableName: BURNS_TABLE,
      Key: { burnId },
      UpdateExpression: 'SET isDeleted = :deleted, deleteReason = :reason',
      ExpressionAttributeValues: {
        ':deleted': true,
        ':reason': 'manual'
      }
    }).promise();

    return success({
      success: true,
      message: 'Burn deleted successfully',
      burnId
    });

  } catch (err) {
    console.error('Delete burn error:', err);
    return error('Failed to delete burn', 500);
  }
};
