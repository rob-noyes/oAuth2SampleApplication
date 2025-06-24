# Rise.ai OAuth Integration Example

This is a complete example application demonstrating how to integrate with the Rise.ai platform using OAuth 2.0. This example covers all the essential steps needed to build a third-party application that connects with Rise.ai.

## 🎯 What You'll Learn

- How to implement Rise.ai OAuth 2.0 flow
- How to handle authorization callbacks
- How to manage access tokens and refresh tokens
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
REDIRECT_URI=http://localhost:3000/oauth/rise/callback

# Rise.ai API Endpoints
RISE_PLATFORM_URL=https://platform.rise.ai
INSTALLER_URL=https://platform.rise.ai
TOKEN_URL=https://platform.rise.ai/oauth2/token

# Application Configuration
PORT=3000
```

### 3. Run the Application

```bash
npm start
```

Visit `http://localhost:3000/oauth/rise/authorize?token=YOUR_INSTALL_TOKEN` to begin the OAuth flow.

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

This example shows how to make authenticated calls to Rise.ai's API endpoints. Once you have valid access tokens, you can call any Rise.ai API endpoint. Common examples include:

- 🔍 **GET /api/example/customers** - Fetch customer data
- 📊 **GET /api/example/analytics** - Get analytics data
- 🎁 **POST /api/example/rewards** - Create rewards

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **Token Storage**: Use secure storage for production (database, encrypted)
3. **Webhook Verification**: Always verify webhook signatures
4. **HTTPS**: Use HTTPS in production
5. **Token Refresh**: Implement token refresh logic

## 🚨 Common Issues & Solutions

### Issue: "Invalid redirect URI"
**Solution**: Ensure your redirect URI exactly matches what's registered in Rise.ai developer console.

### Issue: "Token expired"
**Solution**: Implement token refresh logic using the refresh token.

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