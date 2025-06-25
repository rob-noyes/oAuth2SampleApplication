// =============================================================================
// RISE.AI OAUTH INTEGRATION EXAMPLE
// =============================================================================
// This example demonstrates how to integrate with Rise.ai using OAuth 2.0
// Key Features: OAuth 2.0 flow, webhook handling, token management, API examples
// =============================================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

// =============================================================================
// CONFIGURATION
// =============================================================================

app.set('view engine', 'ejs');
app.set('views', './views');
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});
app.use(express.static('public'));
app.use('/api', express.json());

// Environment variables
const {
  RISE_PLATFORM_URL,
  SERVER_BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_PUBLIC_KEY
} = process.env;

// Derived URLs
const REDIRECT_URI = `${SERVER_BASE_URL}/oauth/rise/callback`;
const INSTALLER_URL = `${RISE_PLATFORM_URL}/installer`; 
const TOKEN_URL = `${RISE_PLATFORM_URL}/oauth2/token`;

// Validate required environment variables
const requiredEnvVars = { RISE_PLATFORM_URL, SERVER_BASE_URL, CLIENT_ID, CLIENT_SECRET, CLIENT_PUBLIC_KEY };
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// In-memory storage (use database in production)
const riseInstallations = {};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Verify JWT using Rise.ai public key
function verifyJWT(token) {
  try {
    return jwt.verify(token, CLIENT_PUBLIC_KEY);
  } catch (error) {
    throw new Error('Invalid JWT signature');
  }
}

// Get valid access token, refresh if needed
async function getValidAccessToken(instanceId) {
  const installation = riseInstallations[instanceId];
  if (!installation) {
    throw new Error('Installation not found');
  }

  // Refresh token if expired
  if (installation.expires_at < Date.now()) {
    console.log('Refreshing expired token...');
    
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      instance_id: instanceId
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    riseInstallations[instanceId] = {
      ...installation,
      access_token: response.data.access_token,
      expires_at: Date.now() + (response.data.expires_in * 1000)
    };

    console.log('Token refreshed successfully');
    return response.data.access_token;
  }

  return installation.access_token;
}

// Generate random gift card code
function generateGiftCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 16 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Handle API errors consistently
function handleApiError(res, error, operation) {
  console.error(`API call failed for ${operation}:`, error.response?.data || error.message);
  
  if (error.message === 'Installation not found') {
    return res.status(404).json({ error: 'installation_not_found', message: 'No installation found for this instance ID' });
  }
  
  if (error.message.includes('token')) {
    return res.status(401).json({ error: 'token_error', message: 'Token validation failed' });
  }
  
  res.status(error.response?.status || 500).json({
    error: 'api_call_failed',
    message: `Failed to ${operation}`,
    details: error.response?.data || error.message
  });
}

// Make authenticated API call to Rise.ai
async function makeRiseApiCall(method, endpoint, instanceId, data = null) {
  const accessToken = await getValidAccessToken(instanceId);
  const config = {
    method,
    url: `${RISE_PLATFORM_URL}${endpoint}`,
    headers: {
      'Authorization': accessToken,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) config.data = data;
  return axios(config);
}

// =============================================================================
// OAUTH FLOW
// =============================================================================

// Step 1: Start OAuth flow
app.get('/oauth/rise/authorize', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'missing_token', message: 'Installation token is required' });
  }

  const authUrl = `${INSTALLER_URL}/install?appId=${CLIENT_ID}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}&token=${token}`;
  console.log('Starting OAuth flow...');
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get('/oauth/rise/callback', async (req, res) => {
  const { code, instanceId } = req.query;
  
  if (!code || !instanceId) {
    return res.status(400).json({ 
      error: 'missing_parameters', 
      message: 'Authorization code and instance ID are required' 
    });
  }

  try {
    console.log('Exchanging authorization code for access token...');
    
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      instance_id: instanceId,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    // Store tokens
    riseInstallations[instanceId] = {
      access_token: response.data.access_token,
      expires_at: Date.now() + (response.data.expires_in * 1000),
      created_at: new Date().toISOString()
    };

    console.log(`Installation completed for instance: ${instanceId}`);
    res.render('installation-complete', { instanceId, appName: 'Rise.ai Integration Example' });

  } catch (error) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    res.status(500).render('error', {
      title: 'Installation Failed',
      message: 'There was an error connecting to Rise.ai. Please try again.'
    });
  }
});

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

app.post('/rise/webhooks', express.text(), (req, res) => {
  try {
    const payload = verifyJWT(req.body);
    const event = JSON.parse(payload.data);
    const eventData = JSON.parse(event.data);
    
    console.log(`Webhook received: ${event.eventType} for instance ${event.instanceId}`);

    switch (event.eventType) {
      case "AppRemoved":
        handleAppRemoval(event.instanceId);
        break;
      case "AppInstalled":
        handleAppInstallation(event.instanceId, eventData);
        break;
      default:
        console.log(`Unknown webhook event: ${event.eventType}`);
        break;
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    res.status(400).json({ error: 'webhook_verification_failed', message: 'Invalid webhook signature' });
  }
});

function handleAppRemoval(instanceId) {
  console.log(`App removed for instance: ${instanceId}`);
  delete riseInstallations[instanceId];
  console.log(`Cleaned up installation data. Remaining: ${Object.keys(riseInstallations).length}`);
}

function handleAppInstallation(instanceId, eventData) {
  console.log(`App installed for instance: ${instanceId}`);
  // Add post-installation logic here
}

// =============================================================================
// WORKFLOW INVOCATION HANDLING
// =============================================================================

app.post('/rise/workflows/actions/v1/invoke', express.text(), (req, res) => {
  try {
    const payload = verifyJWT(req.body);
    const { request, metadata } = payload.data;

    console.log(`Workflow invocation: ${request.actionKey}`);

    const result = handleWorkflowInvocation(request, metadata);
    res.status(200).json({ success: true, result });

    // Process gift card creation asynchronously
    if (request.actionKey === 'rise_test_application-create_giftcard_v1') {
      handleCreateGiftCardAsync(request, metadata).catch(error => {
        console.error('Background gift card creation failed:', error.message);
      });
    }

  } catch (error) {
    console.error('Workflow invocation failed:', error.message);
    res.status(400).json({ 
      error: 'invocation_failed', 
      message: 'Invalid invocation signature or payload' 
    });
  }
});

function handleWorkflowInvocation(request, metadata) {
  if (request.actionKey === 'rise_test_application-create_giftcard_v1') {
    const { name, email, amount = "50.00", currency = 'USD' } = request.actionParams || {};
    
    return {
      status: 'accepted',
      action: 'create-gift-card',
      message: 'Gift card creation request accepted',
      requestInfo: {
        recipient: { name, email },
        amount,
        currency,
        executionIdentifier: request.executionIdentifier
      },
      timestamp: new Date().toISOString()
    };
  }

  console.log(`Unknown workflow action: ${request.actionKey}`);
  return {
    status: 'error',
    message: `Unsupported workflow action: ${request.actionKey}`,
    timestamp: new Date().toISOString()
  };
}

async function handleCreateGiftCardAsync(request, metadata) {
  try {
    const { instanceId } = metadata;
    const { amount = "50.00", name, email, code, currency = 'USD' } = request.actionParams || {};

    console.log(`Creating gift card for: ${name} (${email}) - Amount: ${amount}`);

    // Create gift card
    const giftCardData = {
      giftCard: {
        code: code || generateGiftCardCode(),
        initialValue: amount,
        sourceInfo: {
          type: "MANUAL",
          initiator: { type: "APP", id: CLIENT_ID }
        },
        currency,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    const giftCardResponse = await makeRiseApiCall('POST', '/v1/rise/gift-cards', instanceId, giftCardData);
    
    if (!giftCardResponse.data?.giftCard?.id) {
      throw new Error('Gift card creation failed - no ID returned');
    }

    // Create recipient
    const recipientData = {
      recipient: {
        name,
        email,
        giftCardId: giftCardResponse.data.giftCard.id
      },
      sideEffects: { skipNotifications: true }
    };

    const recipientResponse = await makeRiseApiCall('POST', '/v1/rise/recipients', instanceId, recipientData);

    if (!recipientResponse.data?.recipient?.id) {
      throw new Error('Recipient creation failed - no ID returned');
    }

    console.log(`Gift card created successfully: ${giftCardData.giftCard.code}`);

    return {
      status: 'success',
      action: 'create-gift-card',
      data: {
        giftCardCode: giftCardData.giftCard.code,
        initialValue: amount,
        currency,
        recipient: { id: recipientResponse.data.recipient.id, name, email },
        giftCardId: giftCardResponse.data.giftCard.id
      }
    };

  } catch (error) {
    console.error('Gift card creation failed:', error.message);
    throw error;
  }
}

// =============================================================================
// API EXAMPLES
// =============================================================================

// Get installation status
app.get('/api/installations', (req, res) => {
  const installations = Object.keys(riseInstallations).map(instanceId => ({
    instanceId,
    created_at: riseInstallations[instanceId].created_at,
    expires_at: new Date(riseInstallations[instanceId].expires_at).toISOString(),
    is_expired: riseInstallations[instanceId].expires_at < Date.now()
  }));

  res.json({ total: installations.length, installations });
});

// Get account information
app.get('/api/example/account/:instanceId', async (req, res) => {
  try {
    const response = await makeRiseApiCall('GET', '/v1/rise/accounts', req.params.instanceId);
    res.json({ success: true, endpoint: '/v1/rise/accounts', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'account information');
  }
});

// List sales channels
app.get('/api/example/sales-channels/:instanceId', async (req, res) => {
  try {
    const response = await makeRiseApiCall('GET', '/v1/rise/sales-channels', req.params.instanceId);
    res.json({ success: true, endpoint: '/v1/rise/sales-channels', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'sales channels');
  }
});

// Create gift card
app.post('/api/example/gift-cards/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { code, initialValue = "50.00", currency = 'USD', expirationDate } = req.body;
  
  try {
    const giftCardData = {
      giftCard: {
        code: code || generateGiftCardCode(),
        initialValue,
        sourceInfo: {
          type: "MANUAL",
          sourceTenantId: instanceId,
          sourceChannelId: instanceId
        },
        currency,
        expirationDate: expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    const response = await makeRiseApiCall('POST', '/v1/rise/gift-cards', instanceId, giftCardData);
    res.json({ success: true, endpoint: '/v1/rise/gift-cards', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'gift card creation');
  }
});

// Search gift cards
app.post('/api/example/gift-cards/search/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { email, filters = [] } = req.body;
  
  try {
    const searchQuery = {
      query: {
        filters: email ? [{ field: "recipient.email", operator: "eq", value: email }, ...filters] : filters
      }
    };

    const response = await makeRiseApiCall('POST', '/v1/rise/gift-cards/search', instanceId, searchQuery);
    res.json({ success: true, endpoint: '/v1/rise/gift-cards/search', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'gift card search');
  }
});

// Create wallet
app.post('/api/example/wallets/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { 
    firstName, lastName, email, phone, sourceCustomerId, 
    initialValue = "0.00", currency = "USD" 
  } = req.body;
  
  try {
    const walletData = {
      customerReference: {
        sourceChannelId: instanceId,
        sourceTenantId: instanceId,
        sourceCustomerId: sourceCustomerId || `customer_${Date.now()}`,
        firstName, lastName, phone, email
      },
      initialValue, currency
    };

    const response = await makeRiseApiCall('POST', '/v1/rise/wallets', instanceId, walletData);
    res.json({ success: true, endpoint: '/v1/rise/wallets', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'wallet creation');
  }
});

// Query wallets
app.post('/api/example/wallets/query/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { query = {} } = req.body;
  
  try {
    const response = await makeRiseApiCall('POST', '/v1/rise/wallets/query', instanceId, { query });
    res.json({ success: true, endpoint: '/v1/rise/wallets/query', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'wallet query');
  }
});

// Report workflow event
app.post('/api/example/workflows/events/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { triggerKey, payload = {}, idempotencyKey } = req.body;
  
  try {
    const eventData = {
      triggerKey,
      payload,
      idempotency: {
        key: idempotencyKey || `event_${Date.now()}`,
        ttlInMilliseconds: "604800000"
      }
    };

    const response = await makeRiseApiCall('POST', '/workflows/v1/events/report', instanceId, eventData);
    res.json({ success: true, endpoint: '/workflows/v1/events/report', data: response.data });
  } catch (error) {
    handleApiError(res, error, 'workflow event reporting');
  }
});

// =============================================================================
// ROUTES & ERROR HANDLING
// =============================================================================

// Home page
app.get('/', (req, res) => {
  res.json({
    name: 'Rise.ai OAuth Integration Example',
    version: '1.0.0',
    description: 'Example application demonstrating Rise.ai OAuth integration',
    endpoints: {
      oauth: {
        authorize: '/oauth/rise/authorize?token=INSTALL_TOKEN',
        callback: '/oauth/rise/callback'
      },
      webhooks: '/rise/webhooks',
      invoke: '/rise/workflows/actions/v1/invoke',
      api: {
        installations: '/api/installations',
        examples: {
          account: '/api/example/account/:instanceId',
          sales_channels: '/api/example/sales-channels/:instanceId',
          create_gift_card: 'POST /api/example/gift-cards/:instanceId',
          search_gift_cards: 'POST /api/example/gift-cards/search/:instanceId',
          create_wallet: 'POST /api/example/wallets/:instanceId',
          query_wallets: 'POST /api/example/wallets/query/:instanceId',
          report_event: 'POST /api/example/workflows/events/:instanceId'
        }
      }
    },
    documentation: 'See README.md for complete integration guide'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'internal_server_error', message: 'An unexpected error occurred' });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(port, () => {
  console.log(`Rise.ai OAuth Example running at ${SERVER_BASE_URL}`);
  console.log(`Configured for Client ID: ${CLIENT_ID}`);
  console.log(`Webhook endpoint: ${SERVER_BASE_URL}/rise/webhooks`);
  console.log(`Workflow endpoint: ${SERVER_BASE_URL}/rise/workflows/actions/v1/invoke`);
  console.log(`\nTo start OAuth flow, visit:`);
  console.log(`${RISE_PLATFORM_URL}/protected/app-installer/install?appId=${CLIENT_ID}`);
});