# Rise.ai OAuth Integration Example

This is a complete example application demonstrating how to integrate with the Rise.ai platform using OAuth 2.0. This example covers all the essential steps needed to build a third-party application that connects with Rise.ai.

## 🎯 What You'll Learn

- How to implement Rise.ai OAuth 2.0 flow
- How to handle authorization callbacks
- How to manage access tokens and token renewal
- How to process Rise.ai webhooks
- How to make authenticated API calls to Rise.ai

## 📋 Prerequisites

- Node.js (v14 or higher)
- Rise.ai app credentials (obtained from Rise.ai partnership team)
- Basic knowledge of Express.js

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone this repository
git clone https://github.com/your-username/rise-oauth-integration-example.git
cd rise-oauth-integration-example
npm install
```

*Note: Replace the repository URL above with your actual GitHub repository URL*

### 2. Get Rise.ai App Credentials

**Important**: Rise.ai doesn't have a public developer console. To get your app credentials:

1. **Contact Rise.ai Partnership Team**: Email `marina@rise-ai.com`
2. **Provide Required Information**:
   - **App URL**: The URL where users will be redirected when they click "Install" in their Rise dashboard
   - **Redirect URL**: Your OAuth callback URL (e.g., `https://your-domain.com/oauth/rise/callback`)
3. **Receive Credentials**: The partnership team will provide:
   - `CLIENT_ID` (your app ID)
   - `CLIENT_SECRET` (your app secret)
   - `CLIENT_PUBLIC_KEY` (for webhook verification)

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Rise.ai OAuth Configuration
CLIENT_ID=your_rise_client_id
CLIENT_SECRET=your_rise_client_secret
# Automatically constructed: SERVER_BASE_URL + '/oauth/rise/callback'

# Your server base URL (ngrok, domain, or localhost)
SERVER_BASE_URL=https://your-ngrok-url.ngrok-free.app

# Rise.ai platform URL
RISE_PLATFORM_URL=https://platform.rise.ai

# Rise.ai public key for webhook verification (provided by Rise.ai)
CLIENT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3gRdP/ytsjzz/C9ZDQmH
yeCJVeobG3Y7GS1MgFzNK780VG/q4z1JuAEHvdFKd9eTIHqLpe15M3DYFJAxNxfB
fpLJ3rl+pNEdzP46orTMsozUXuRGmU4Pnj71GMIDlZn80rjEE01WTKe/n9ehO3f0
mP0XZ0+veFhbWxBhmzcy9NXnaViEKEeFcgOImcu45vrvpiI+l750OojDWRGIuxyN
Gi20lCcpxgGR11SQqmsxQWO9g3iApqMCxd/fEdMO7yGajZmG3aKBkHf7M24xwevH
Xxizig2MBJN/rbjLK1MATNu2weKNkhxtCA4FUK3piobl5k9N25LgSSWhYT6gIsaZ
VQIDAQAB
-----END PUBLIC KEY-----"

# Application Configuration
PORT=3000
```

### 4. Run the Application

```bash
npm start
```

Visit `https://platform.rise.ai/protected/app-installer/install?appId=${CLIENT_ID}` to begin the OAuth flow.

## 🔄 OAuth Flow Explained

### Step 1: Authorization Request
```javascript
app.get('/oauth/rise/authorize', (req, res) => {
  // Redirect user to Rise.ai authorization server
  const authUrl = `${RISE_PLATFORM_URL}/installer/install?appId=${CLIENT_ID}&redirectUrl=${REDIRECT_URI}&token=${token}`;
  res.redirect(authUrl);
});
```
*Note: INSTALLER_URL is constructed as `${RISE_PLATFORM_URL}/installer`*

### Step 2: Handle Authorization Callback
```javascript
app.get('/oauth/rise/callback', async (req, res) => {
  // Exchange authorization code for access token
  const { code, instanceId } = req.query;
  // Make token request to Rise.ai
  // Store tokens securely
});
```

### Step 3: Use Access Tokens
```javascript
// Example API call using stored access token
const response = await axios.get(`${RISE_PLATFORM_URL}/v1/rise/accounts`, {
  headers: {
    'Authorization': accessToken
  }
});
```

## 🎣 Webhook Handling

Rise.ai sends webhooks for important events like app installations and removals:

```javascript
app.post('/rise/webhooks', express.text(), (req, res) => {
  // Verify webhook signature using CLIENT_PUBLIC_KEY
  const event = jwt.verify(req.body, CLIENT_PUBLIC_KEY);
  
  // Handle different event types
  switch (event.eventType) {
    case "AppRemoved":
      // Clean up user data
      break;
  }
});
```

## ⚡ Workflow Invocation Handling

Rise.ai can trigger any of your application actions through the invocation endpoint:

```javascript
app.post('/rise/workflows/actions/v1/invoke', express.text(), (req, res) => {
  // Verify JWT signature using CLIENT_PUBLIC_KEY
  const payload = jwt.verify(req.body, CLIENT_PUBLIC_KEY);
  const { request, metadata } = payload.data;

  // Handle different workflow actions
  if (request.actionKey === 'rise_test_application-create_giftcard_v1') {
    // Process gift card creation workflow
    // Return immediate response, process asynchronously
  }
});
```

**Key Features:**
- ✅ JWT signature verification for security
- ✅ Immediate response with background processing
- ✅ Example gift card creation workflow implementation
- ✅ Proper error handling and logging

## 📚 API Examples

This example implements real Rise.ai API endpoints that you can test immediately. Once you complete the OAuth flow, you can try these endpoints:

### **Account & Configuration**
- 🏢 **GET /api/example/account/:instanceId** - Get account information
- 🏪 **GET /api/example/sales-channels/:instanceId** - List sales channels

### **Gift Cards**
- 🎁 **POST /api/example/gift-cards/:instanceId** - Create gift cards
- 🔍 **POST /api/example/gift-cards/search/:instanceId** - Search gift cards by email

### **Customer Wallets**
- 👤 **POST /api/example/wallets/:instanceId** - Create customer loyalty wallets
- 📊 **POST /api/example/wallets/query/:instanceId** - Query customer wallets

### **Workflows & Events**
- ⚡ **POST /api/example/workflows/events/:instanceId** - Report workflow events

### **System Endpoints**
- 📊 **GET /api/installations** - List all installations and their status
- 🔄 **POST /rise/workflows/actions/v1/invoke** - Handle workflow invocations from Rise.ai (webhook)

### **Quick Test Examples**

```bash
# Replace {instanceId} with your actual instance ID

# Get installation status
curl http://localhost:3000/api/installations

# Get account information
curl http://localhost:3000/api/example/account/{instanceId}

# Create a gift card
curl -X POST http://localhost:3000/api/example/gift-cards/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME2024", "initialValue": "25.00", "currency": "USD"}'

# Search gift cards by email
curl -X POST http://localhost:3000/api/example/gift-cards/search/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@example.com"}'

# Create customer wallet
curl -X POST http://localhost:3000/api/example/wallets/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Jane", "lastName": "Smith", "email": "jane@example.com", "initialValue": "50.00"}'

# Query wallets
curl -X POST http://localhost:3000/api/example/wallets/query/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"query": {}}'

# Report a workflow event
curl -X POST http://localhost:3000/api/example/workflows/events/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"triggerKey": "customer_signup", "payload": {"customerId": "new_customer_123"}}'
```

**💡 Tip**: After completing OAuth, you'll be redirected to an installation complete page that provides:
- ✅ Interactive API testing interface
- ✅ Your instance ID for testing
- ✅ Pre-filled curl commands
- ✅ Live API response preview

## 🔄 Automatic Token Management

The application automatically handles token renewal:

```javascript
// Tokens are automatically refreshed when expired
async function getValidAccessToken(instanceId) {
  const installation = riseInstallations[instanceId];
  
  // Check if token is expired and refresh if needed
  if (installation.expires_at < Date.now()) {
    // Automatically get new token from Rise.ai
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      instance_id: instanceId
    });
    
    // Update stored token
    riseInstallations[instanceId] = {
      ...installation,
      access_token: response.data.access_token,
      expires_at: Date.now() + (response.data.expires_in * 1000)
    };
  }
  
  return installation.access_token;
}
```

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **Token Storage**: Use secure storage for production (database, encrypted)
3. **Webhook Verification**: Always verify webhook signatures
4. **HTTPS**: Use HTTPS in production
5. **Token Renewal**: Implement token renewal logic

## 🚨 Common Issues & Solutions

### Issue: "Invalid redirect URI"
**Solution**: Ensure your redirect URI exactly matches what's registered in Rise.ai developer console.

### Issue: "Token expired"
**Solution**: Implement token renewal by calling the createToken API again.

### Issue: "Webhook verification failed"
**Solution**: Check that you're using the correct public key for JWT verification.

## 📖 Additional Resources

- [Rise.ai API Documentation](https://platform.rise.ai/docs)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [JWT.io](https://jwt.io) - For debugging JWT tokens

## 🤝 Support

If you have questions about this example or Rise.ai integration:

1. Check the [Rise.ai Developer Documentation](https://platform.rise.ai/docs)
2. Review the code comments in this example
3. Contact Rise.ai developer support

## 📄 License

This example is provided under the MIT License. See LICENSE file for details. 