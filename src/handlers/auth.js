const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Shared authorizer - validates JWT tokens from forum
exports.authorizer = async (event) => {
  try {
    const token = event.authorizationToken.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      principalId: decoded.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn.split('/').slice(0, 2).join('/') + '/*'
          }
        ]
      },
      context: {
        userId: decoded.userId,
        email: decoded.email
      }
    };
  } catch (error) {
    console.error('Authorization failed:', error);
    throw new Error('Unauthorized');
  }
};
