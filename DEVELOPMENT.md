# Development Guide

This guide helps you set up and customize the Rise.ai OAuth integration example for your own application.

## Quick Setup

### 1. Prerequisites

- Node.js 14+ installed
- Rise.ai app credentials (obtained from partnership team)
- Basic understanding of OAuth 2.0

### 2. Initial Setup

```bash
# Clone or download this example
git clone <repository-url>
cd rise-oauth-integration-example

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Get Rise.ai App Credentials

**Important**: Rise.ai doesn't have a public developer console. To get your app credentials:

1. **Contact Rise.ai Partnership Team**: Email `marina@rise-ai.com`
2. **Provide Required Information**:
   - **App URL**: The URL where users will be redirected when they click "Install" in their Rise dashboard
   - **Redirect URL**: Your OAuth callback URL (e.g., `https://your-domain.com/oauth/rise/callback`)
3. **Receive Credentials**: The partnership team will provide your `CLIENT_ID`, `CLIENT_SECRET`, and `CLIENT_PUBLIC_KEY`

### 4. Configure Environment

Edit `.env` with your Rise.ai app credentials:

```env
  CLIENT_ID=your_actual_client_id
  CLIENT_SECRET=your_actual_client_secret
  SERVER_BASE_URL=http://localhost:3000
  RISE_PLATFORM_URL=https://platform.rise.ai
  CLIENT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----"
  PORT=3000
```

### 5. Start Development Server

```bash
# Start with auto-reload
npm run dev

# Or start normally
npm start
```

## Testing the Integration

### Manual Testing Flow

1. **Start the OAuth Flow**
   - Visit: `https://platform.rise.ai/protected/app-installer/install?appId=${CLIENT_ID}`
   - Replace `${CLIENT_ID}` with your actual Rise.ai client ID

2. **Complete Authorization**
   - You'll be redirected to Rise.ai
   - Authorize the integration
   - Get redirected back to completion page

3. **Test API Endpoints**
   ```bash
   # View all installations
   curl http://localhost:3000/api/installations
   
   # Test example API call (replace INSTANCE_ID)
   # Get account information
curl http://localhost:3000/api/example/account/INSTANCE_ID

# List sales channels
curl http://localhost:3000/api/example/sales-channels/INSTANCE_ID

# Create a gift card
curl -X POST http://localhost:3000/api/example/gift-cards/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"code": "GIFT2024", "initialValue": "50.00", "currency": "USD"}'

# Search gift cards
curl -X POST http://localhost:3000/api/example/gift-cards/search/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@example.com"}'

# Create customer wallet
curl -X POST http://localhost:3000/api/example/wallets/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"firstName": "John", "lastName": "Doe", "email": "john@example.com", "initialValue": "100.00"}'

# Query wallets
curl -X POST http://localhost:3000/api/example/wallets/query/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"query": {}}'

# Report workflow event
curl -X POST http://localhost:3000/api/example/workflows/events/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"triggerKey": "testing_installation_flow-test_app_trigger", "payload": {"name": "John", "email": "John@email.com", "amount": "50.00"}}'
   ```

### Using ngrok for Webhook Testing

Since Rise.ai needs to send webhooks to your application, you'll need a public URL:

```bash
# Install ngrok if not already installed
npm install -g ngrok

# Expose your local server
ngrok http 3000
```

Then **contact the Rise.ai partnership team** (`marina@rise-ai.com`) to update your app configuration with the ngrok URLs:
- **App URL**: `https://your-ngrok-url.ngrok.io/oauth/rise/authorize`
- **Redirect URL**: `https://your-ngrok-url.ngrok.io/oauth/rise/callback`
- **Webhook URL**: `https://your-ngrok-url.ngrok.io/rise/webhooks`

## Customizing for Your Application

### 1. Modify the Server Structure

The example uses a simple Express.js structure. For larger applications, consider:

```
src/
├── routes/
│   ├── oauth.js       # OAuth flow routes
│   ├── webhooks.js    # Webhook handlers
│   └── api.js         # API endpoints
├── services/
│   ├── rise.js        # Rise.ai API service
│   ├── auth.js        # Authentication service
│   └── storage.js     # Token storage service
├── middleware/
│   ├── auth.js        # Authentication middleware
│   └── validation.js  # Input validation
└── app.js             # Main application
```

### 2. Implement Database Storage

Replace in-memory storage with a proper database:

**PostgreSQL Example:**
```javascript
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create installations table
const createTable = `
  CREATE TABLE IF NOT EXISTS installations (
    instance_id VARCHAR(255) PRIMARY KEY,
    encrypted_tokens TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`;

// Store tokens securely
async function storeTokens(instanceId, tokenData) {
  const encrypted = encrypt(JSON.stringify(tokenData));
  
  await pool.query(`
    INSERT INTO installations (instance_id, encrypted_tokens, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (instance_id) 
    DO UPDATE SET encrypted_tokens = $2, updated_at = NOW()
  `, [instanceId, encrypted]);
}

// Retrieve tokens
async function getTokens(instanceId) {
  const result = await pool.query(
    'SELECT encrypted_tokens FROM installations WHERE instance_id = $1',
    [instanceId]
  );
  
  if (result.rows.length === 0) return null;
  
  const decrypted = decrypt(result.rows[0].encrypted_tokens);
  return JSON.parse(decrypted);
}

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText) {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 3. Add Authentication Middleware

Protect your API endpoints:

```javascript
// middleware/auth.js
async function requireAuth(req, res, next) {
  const { instanceId } = req.params;
  
  if (!instanceId) {
    return res.status(400).json({
      error: 'missing_instance_id',
      message: 'Instance ID is required'
    });
  }

  try {
    const tokens = await getTokens(instanceId);
    if (!tokens) {
      return res.status(404).json({
        error: 'installation_not_found',
        message: 'App not installed for this instance'
      });
    }

    // Check token expiry
    if (tokens.expires_at < Date.now()) {
      return res.status(401).json({
        error: 'token_expired',
        message: 'Access token has expired'
      });
    }

    req.installation = tokens;
    req.instanceId = instanceId;
    next();

  } catch (error) {
    res.status(500).json({
      error: 'auth_error',
      message: 'Authentication failed'
    });
  }
}

// Usage
app.get('/api/customers/:instanceId', requireAuth, async (req, res) => {
  const { installation } = req;
  
  try {
    const response = await axios.get(`${BASE_URL}/api/customers`, {
      headers: {
        'Authorization': `Bearer ${installation.access_token}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    // Handle API errors
  }
});
```

### 4. Implement Token Renewal

Add automatic token renewal:

```javascript
// services/auth.js
class AuthService {
  async getValidAccessToken(instanceId) {
    let installation = await getTokens(instanceId);
    
    if (!installation) {
      throw new Error('Installation not found');
    }

    // If token expires within 5 minutes, renew it
    if (installation.expires_at < Date.now() + 300000) {
      installation = await this.renewTokens(instanceId, installation);
    }

    return installation.access_token;
  }

  async renewTokens(instanceId, installation) {
    try {
      const response = await axios.post(TOKEN_URL, {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        instance_id: instanceId
      });

      const newInstallation = {
        ...installation,
        access_token: response.data.access_token,
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };

      await storeTokens(instanceId, newInstallation);
      console.log(`Renewed tokens for instance: ${instanceId}`);
      
      return newInstallation;

    } catch (error) {
      console.error('Token renewal failed:', error.response?.data);
      throw new Error('Failed to renew access token');
    }
  }
}
```

### 5. Add Input Validation

Use a validation library like Joi:

```javascript
const Joi = require('joi');

// Validation schemas
const schemas = {
  oauthCallback: Joi.object({
    code: Joi.string().required(),
    instanceId: Joi.string().required()
  }),

  webhookEvent: Joi.object({
    eventType: Joi.string().required(),
    instanceId: Joi.string().required(),
    data: Joi.string().required()
  })
};

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'validation_error',
        message: error.details[0].message
      });
    }
    next();
  };
}

// Usage
app.get('/oauth/rise/callback', 
  validate(schemas.oauthCallback), 
  handleOAuthCallback
);
```

### 6. Add Logging

Implement structured logging:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage throughout your app
logger.info('OAuth flow started', { instanceId, timestamp: new Date() });
logger.error('Token renewal failed', { instanceId, error: error.message });
```

## Production Deployment

### Environment Variables

Ensure all required environment variables are set:

```bash
# Required
CLIENT_ID=your_production_client_id
CLIENT_SECRET=your_production_client_secret
REDIRECT_URI=https://yourdomain.com/oauth/rise/callback
DATABASE_URL=postgresql://user:pass@host:port/db
ENCRYPTION_KEY=your_32_character_encryption_key

# Optional
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
REDIS_URL=redis://localhost:6379
```

### Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Validate all inputs
- [ ] Encrypt stored tokens
- [ ] Use secure session configuration
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Set secure HTTP headers
- [ ] Use environment variables for secrets
- [ ] Implement proper error handling
- [ ] Add monitoring and alerting

### Performance Optimization

1. **Connection Pooling**: Use connection pools for database connections
2. **Caching**: Cache frequently accessed data with Redis
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Monitoring**: Add health checks and monitoring endpoints

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Ensure redirect URI matches exactly what's registered
   - Check for trailing slashes and protocol (http vs https)

2. **"Token verification failed"**
   - Verify you're using the correct public key
   - Check that webhook payload hasn't been modified

3. **"Installation not found"**
   - Check that tokens are being stored correctly
   - Verify instanceId is correct

4. **API calls failing**
   - Check token expiry and renewal logic
   - Verify API endpoint URLs
   - Check request headers and authentication

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Testing Webhooks Locally

Use tools like ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Update webhook URL in Rise.ai dashboard to:
# https://your-subdomain.ngrok.io/rise/webhooks
```

## Next Steps

1. **Customize the UI**: Update the installation complete page with your branding
2. **Add Your Business Logic**: Implement the specific functionality your app needs
3. **Integrate with Your Database**: Replace the example storage with your data models
4. **Add Tests**: Write unit and integration tests for your OAuth flow
5. **Deploy to Production**: Use a proper hosting platform with HTTPS

## Getting Help

- 📖 [Rise.ai API Documentation](https://platform.rise.ai/docs)
- 💬 [Developer Community](https://community.rise.ai)
- 🐛 [Report Issues](https://github.com/rise-ai/oauth-integration-example/issues)
- 📧 [Developer Support](mailto:developers@rise.ai) 