// =============================================================================
// RISE.AI OAUTH INTEGRATION EXAMPLE
// =============================================================================
// This example demonstrates how to integrate with Rise.ai using OAuth 2.0
// 
// Key Features:
// - Complete OAuth 2.0 flow implementation
// - Webhook handling for app lifecycle events
// - Token management and storage
// - Example API calls using stored tokens
// =============================================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

// =============================================================================
// EXPRESS CONFIGURATION
// =============================================================================

app.set('view engine', 'ejs');
app.set('views', './views');

// Enable CORS for cross-origin requests (required for Rise.ai integration)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});

// Serve static files (CSS, images, etc.)
app.use(express.static('public'));

// Parse JSON payloads for regular API calls
app.use('/api', express.json());

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

// Load environment variables with validation
const {
  RISE_PLATFORM_URL,
  SERVER_BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_PUBLIC_KEY
} = process.env;

// Construct derived URLs from base URLs
// This keeps .env file clean by avoiding repetitive URL configurations
const REDIRECT_URI = `${SERVER_BASE_URL}/oauth/rise/callback`;
const INSTALLER_URL = `${RISE_PLATFORM_URL}/installer`; 
const TOKEN_URL = `${RISE_PLATFORM_URL}/oauth2/token`;

// Validate required environment variables
const requiredEnvVars = {
  RISE_PLATFORM_URL,
  SERVER_BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_PUBLIC_KEY
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// In-memory storage for demo purposes
// ⚠️  IMPORTANT: In production, use a proper database (PostgreSQL, MongoDB, etc.)
const riseInstallations = {};

// Rise.ai public key for webhook JWT verification (loaded from environment)
// This public key is provided by Rise.ai and used to verify webhook authenticity
const PUBLIC_KEY = CLIENT_PUBLIC_KEY;

// =============================================================================
// OAUTH FLOW - STEP 1: AUTHORIZATION REQUEST
// =============================================================================

/**
 * Initiates the OAuth flow by redirecting users to Rise.ai authorization server
 * 
 * URL: GET /oauth/rise/authorize?token=INSTALL_TOKEN
 * 
 * @param {string} token - Installation token provided by Rise.ai
 */
app.get('/oauth/rise/authorize', (req, res) => {
  const token = req.query.token;
  
  if (!token) {
    return res.status(400).json({
      error: 'missing_token',
      message: 'Installation token is required'
    });
  }

  // Construct the authorization URL
  // This redirects the user to Rise.ai where they can authorize your app
  const authUrl = `${INSTALLER_URL}/install?appId=${CLIENT_ID}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}&token=${token}`;
  
  console.log(`🚀 Starting OAuth flow - redirecting to: ${authUrl}`);
  
  res.redirect(authUrl);
});

// =============================================================================
// OAUTH FLOW - STEP 2: HANDLE AUTHORIZATION CALLBACK
// =============================================================================

/**
 * Handles the OAuth callback from Rise.ai after user authorization
 * Exchanges the authorization code for access token
 * 
 * URL: GET /oauth/rise/callback?code=AUTH_CODE&instanceId=INSTANCE_ID
 */
app.get('/oauth/rise/callback', async (req, res) => {
  const { code, instanceId } = req.query;
  
  if (!code) {
    console.error('❌ OAuth callback missing authorization code');
    return res.status(400).json({
      error: 'missing_code',
      message: 'Authorization code is required'
    });
  }

  if (!instanceId) {
    console.error('❌ OAuth callback missing instance ID');
    return res.status(400).json({
      error: 'missing_instance_id',
      message: 'Instance ID is required'
    });
  }

  try {
    console.log(`🔄 Exchanging authorization code for access token...`);
    
    // Exchange authorization code for access token
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      instance_id: instanceId,
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Store the tokens securely
    // ⚠️  IMPORTANT: In production, encrypt tokens and use secure storage
    riseInstallations[instanceId] = {
      access_token: response.data.access_token,
      expires_at: Date.now() + (response.data.expires_in * 1000),
      created_at: new Date().toISOString()
    };

    console.log(`✅ Successfully stored tokens for instance: ${instanceId}`);
    console.log(`📊 Total installations: ${Object.keys(riseInstallations).length}`);

    // Show success page to the user
    res.render('installation-complete', { 
      instanceId,
      appName: 'Rise.ai Integration Example'
    });

  } catch (error) {
    console.error('❌ Token exchange failed:', error.response?.data || error.message);
    
    // Return user-friendly error
    res.status(500).render('error', {
      title: 'Installation Failed',
      message: 'There was an error connecting to Rise.ai. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Handles webhooks from Rise.ai for app lifecycle events
 * 
 * URL: POST /rise/webhooks
 * 
 * Important: Webhooks are signed with JWT using Rise.ai's public key
 */
app.post('/rise/webhooks', express.text(), (req, res) => {
  let event;
  let eventData;

  try {
    // Verify the webhook signature using Rise.ai's public key
    const rawPayload = jwt.verify(req.body, PUBLIC_KEY);
    event = JSON.parse(rawPayload.data);
    eventData = JSON.parse(event.data);
    
    console.log(`📡 Webhook received: ${event.eventType} for instance ${event.instanceId}`);

  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).json({
      error: 'webhook_verification_failed',
      message: 'Invalid webhook signature'
    });
  }

  // Handle different webhook event types
  switch (event.eventType) {
    case "AppRemoved":
      handleAppRemoval(event.instanceId, eventData);
      break;
      
    case "AppInstalled":
      handleAppInstallation(event.instanceId, eventData);
      break;
      
    default:
      console.log(`⚠️  Unknown webhook event type: ${event.eventType}`);
      break;
  }

  // Always respond with 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

/**
 * Handle app removal webhook
 */
function handleAppRemoval(instanceId, eventData) {
  console.log(`🗑️  App removed for instance: ${instanceId}`);
  console.log(`eventData: ${eventData}`)
  
  // Clean up stored installation data
  if (riseInstallations[instanceId]) {
    delete riseInstallations[instanceId];
    console.log(`✅ Cleaned up installation data for instance: ${instanceId}`);
  } else {
    console.log(`⚠️  No installation found for instance: ${instanceId}`);
  }
  
  console.log(`📊 Remaining installations: ${Object.keys(riseInstallations).length}`);
}

/**
 * Handle app installation webhook (optional)
 */
function handleAppInstallation(instanceId, eventData) {
  console.log(`🎉 App installed for instance: ${instanceId}`);
  console.log(eventData)

  // Add any post-installation logic here
}

// =============================================================================
// EXAMPLE API ENDPOINTS
// =============================================================================

/**
 * Example: Get installation status
 */
app.get('/api/installations', (req, res) => {
  const installations = Object.keys(riseInstallations).map(instanceId => ({
    instanceId,
    created_at: riseInstallations[instanceId].created_at,
    expires_at: new Date(riseInstallations[instanceId].expires_at).toISOString(),
    is_expired: riseInstallations[instanceId].expires_at < Date.now()
  }));

  res.json({
    total: installations.length,
    installations
  });
});

/**
 * Example: Get Account Information
 */
app.get('/api/example/account/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const response = await axios.get(`${RISE_PLATFORM_URL}/v1/rise/accounts`, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/accounts',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'account information');
  }
});

/**
 * Example: List Sales Channels
 */
app.get('/api/example/sales-channels/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);

    const response = await axios.get(`${RISE_PLATFORM_URL}/v1/rise/sales-channels`, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/sales-channels',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'sales channels');
  }
});

/**
 * Example: Create Gift Card
 */
app.post('/api/example/gift-cards/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { code, initialValue, currency = 'USD', expirationDate } = req.body;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const giftCardData = {
      giftCard: {
        code: code || generateGiftCardCode(),
        initialValue: initialValue || "50.00",
        sourceInfo: {
          type: "MANUAL",
          sourceTenantId: instanceId,
          sourceChannelId: instanceId
        },
        currency,
        expirationDate: expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    const response = await axios.post(`${RISE_PLATFORM_URL}/v1/rise/gift-cards`, giftCardData, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/gift-cards',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'gift card creation');
  }
});

/**
 * Example: Search Gift Cards
 */
app.post('/api/example/gift-cards/search/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { email, filters = [] } = req.body;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const searchQuery = {
      query: {
        filters: email ? [
          {
            field: "recipient.email",
            operator: "eq",
            value: email
          },
          ...filters
        ] : filters
      }
    };

    const response = await axios.post(`${RISE_PLATFORM_URL}/v1/rise/gift-cards/search`, searchQuery, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/gift-cards/search',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'gift card search');
  }
});

/**
 * Example: Create Wallet
 */
app.post('/api/example/wallets/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { 
    firstName, 
    lastName, 
    email, 
    phone, 
    sourceCustomerId, 
    initialValue = "0.00", 
    currency = "USD" 
  } = req.body;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const walletData = {
      customerReference: {
        sourceChannelId: instanceId,
        sourceTenantId: instanceId,
        sourceCustomerId: sourceCustomerId || `customer_${Date.now()}`,
        firstName,
        lastName,
        phone,
        email
      },
      initialValue,
      currency
    };

    const response = await axios.post(`${RISE_PLATFORM_URL}/v1/rise/wallets`, walletData, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/wallets',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'wallet creation');
  }
});

/**
 * Example: Query Wallets
 */
app.post('/api/example/wallets/query/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { query = {} } = req.body;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const response = await axios.post(`${RISE_PLATFORM_URL}/v1/rise/wallets/query`, { query }, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/v1/rise/wallets/query',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'wallet query');
  }
});

/**
 * Example: Report Workflow Event
 */
app.post('/api/example/workflows/events/:instanceId', async (req, res) => {
  const { instanceId } = req.params;
  const { triggerKey, payload = {}, idempotencyKey } = req.body;
  
  try {
    const accessToken = await getValidAccessToken(instanceId);
    
    const eventData = {
      triggerKey,
      payload,
      idempotency: {
        key: idempotencyKey || `event_${Date.now()}`,
        ttlInMilliseconds: "604800000" // a week in milliseconds
      }
    };

    const response = await axios.post(`${RISE_PLATFORM_URL}/workflows/v1/events/report`, eventData, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      endpoint: '/workflows/v1/events/report',
      data: response.data
    });

  } catch (error) {
    handleApiError(res, error, 'workflow event reporting');
  }
});

// Helper function to generate gift card codes
function generateGiftCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to get a valid access token (with re-authentication if needed)
async function getValidAccessToken(instanceId) {
  const installation = riseInstallations[instanceId];
  if (!installation) {
    throw new Error('Installation not found');
  }

  // Check if token is expired
  if (installation.expires_at < Date.now()) {
    console.log('🔄 Access token expired, requesting new token...');
    
    try {
      // Get a new token using the client_credentials flow
      const response = await axios.post(`${RISE_PLATFORM_URL}/oauth2/token`, {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        instance_id: instanceId
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Update the stored token
      riseInstallations[instanceId] = {
        ...installation,
        access_token: response.data.access_token,
        expires_at: Date.now() + (response.data.expires_in * 1000),
        renewed_at: Date.now()
      };

      console.log('✅ Access token renewed successfully');
      return response.data.access_token;

    } catch (renewError) {
      console.error('❌ Failed to renew access token:', renewError.response?.data || renewError.message);
      throw new Error('Failed to renew access token');
    }
  }

  return installation.access_token;
}

// Helper function to handle API errors consistently
function handleApiError(res, error, operation) {
  console.error(`❌ Rise.ai API call failed for ${operation}:`, error.response?.data || error.message);
  
  if (error.message === 'Installation not found') {
    return res.status(404).json({
      error: 'installation_not_found',
      message: 'No installation found for this instance ID'
    });
  }
  
  if (error.message === 'Failed to renew access token') {
    return res.status(401).json({
      error: 'token_expired',
      message: 'Access token has expired and renewal failed'
    });
  }
  
  res.status(error.response?.status || 500).json({
    error: 'api_call_failed',
    message: `Failed to ${operation}`,
    details: error.response?.data || error.message
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================



// =============================================================================
// ERROR HANDLING & 404
// =============================================================================

// Home page with basic info
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
    documentation: 'See README.md for complete integration guide',
    api_docs: 'https://platform.rise.ai/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /oauth/rise/authorize',
      'GET /oauth/rise/callback',
      'POST /rise/webhooks',
      'GET /api/installations',
      'GET /api/example/account/:instanceId',
      'GET /api/example/sales-channels/:instanceId',
      'POST /api/example/gift-cards/:instanceId',
      'POST /api/example/gift-cards/search/:instanceId',
      'POST /api/example/wallets/:instanceId',
      'POST /api/example/wallets/query/:instanceId',
      'POST /api/example/workflows/events/:instanceId'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred'
  });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(port, () => {
  console.log(`🚀 Rise.ai OAuth Example running at ${SERVER_BASE_URL}:${port}`);
  console.log(`📋 Visit ${SERVER_BASE_URL}:${port} for available endpoints`);
  console.log(`🔧 Configured for Rise.ai Client ID: ${CLIENT_ID}`);
  console.log(`📡 Webhook endpoint: ${SERVER_BASE_URL}:${port}/rise/webhooks`);
  console.log(`\n📚 To start OAuth flow, visit`);
  console.log(`   ${RISE_PLATFORM_URL}/protected/app-installer/install?appId=${CLIENT_ID}`);
});