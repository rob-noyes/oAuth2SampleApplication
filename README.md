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
- A Rise.ai developer account
- Basic knowledge of Express.js

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hello-world-auth
npm install
```

### 2. Configure Environment Variables

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

### 3. Run the Application

```bash
npm start
```

Visit `https://platform.rise.ai/protected/app-installer/install?appId=${CLIENT_ID}` to begin the OAuth flow.

## 🔄 OAuth Flow Explained

### Step 1: Authorization Request
```javascript
app.get('/oauth/rise/authorize', (req, res) => {
  // Redirect user to Rise.ai authorization server
  const authUrl = `${INSTALLER_URL}/install?appId=${CLIENT_ID}&redirectUrl=${REDIRECT_URI}&token=${token}`;
  res.redirect(authUrl);
});
```

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
const response = await axios.get(`${BASE_URL}/api/customers`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## 🎣 Webhook Handling

Rise.ai sends webhooks for important events like app installations and removals:

```javascript
app.post('/rise/webhooks', express.text(), (req, res) => {
  // Verify webhook signature
  const event = jwt.verify(req.body, PUBLIC_KEY);
  
  // Handle different event types
  switch (event.eventType) {
    case "AppRemoved":
      // Clean up user data
      break;
  }
});
```

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

### **Quick Test Examples**

```bash
# Replace {instanceId} with your actual instance ID

# Get account information
curl http://localhost:3000/api/example/account/{instanceId}

# Create a gift card
curl -X POST http://localhost:3000/api/example/gift-cards/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME2024", "initialValue": "25.00", "currency": "USD"}'

# Create customer wallet
curl -X POST http://localhost:3000/api/example/wallets/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Jane", "lastName": "Smith", "email": "jane@example.com", "initialValue": "50.00"}'

# Report a workflow event
curl -X POST http://localhost:3000/api/example/workflows/events/{instanceId} \
  -H "Content-Type: application/json" \
  -d '{"triggerKey": "customer_signup", "payload": {"customerId": "new_customer_123"}}'
```

**💡 Tip**: After completing OAuth, visit the installation complete page for an interactive testing interface!

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