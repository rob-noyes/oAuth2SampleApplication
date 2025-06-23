require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});

const {
  BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  AUTH_URL,
  TOKEN_URL
} = process.env;
const riseInstallations = {};
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3gRdP/ytsjzz/C9ZDQmH
yeCJVeobG3Y7GS1MgFzNK780VG/q4z1JuAEHvdFKd9eTIHqLpe15M3DYFJAxNxfB
fpLJ3rl+pNEdzP46orTMsozUXuRGmU4Pnj71GMIDlZn80rjEE01WTKe/n9ehO3f0
mP0XZ0+veFhbWxBhmzcy9NXnaViEKEeFcgOImcu45vrvpiI+l750OojDWRGIuxyN
Gi20lCcpxgGR11SQqmsxQWO9g3iApqMCxd/fEdMO7yGajZmG3aKBkHf7M24xwevH
Xxizig2MBJN/rbjLK1MATNu2weKNkhxtCA4FUK3piobl5k9N25LgSSWhYT6gIsaZ
VQIDAQAB
-----END PUBLIC KEY-----`;

app.get('/oauth/rise/authorize', (req, res) => {
  const token = req.query.token;

  let authUrl = `${AUTH_URL}?appId=${CLIENT_ID}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}&token=${token}`;
  console.log(`authUrl: ${authUrl}`);
  res.redirect(authUrl);
});

app.get('/oauth/rise/callback', async (req, res) => {
  const code = req.query.code;
  const instanceId = req.query.instanceId;
  if (!code) return res.status(400).send('Missing code');

  // get the access token from Rise
  try {
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

    // Save the access token for the installed user
    riseInstallations[instanceId] = {
        access_token:  response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at:    Date.now() + (response.data.expires_in * 1000)
    };
    console.log('riseInstallations:', riseInstallations);

    //This is where you can redirect the user to your log-in page.
    res.json(riseInstallations);
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).send('Token exchange failed');
  }
});

app.post('/rise/webhooks', express.text(), (req, res) => {
  let event;
  let eventData;

 try {
    console.log(req.body)
    console.log(PUBLIC_KEY)
    const rawPayload = jwt.verify(req.body, PUBLIC_KEY);
    event = JSON.parse(rawPayload.data);
    eventData = JSON.parse(event.data);
    console.log(`Webhook event received with data:`, event);

  } catch (err) {
    console.error(err);
    res.status(400).send(`Webhook error: ${err.message}`);
    return;
  }

  switch (event.eventType) {
    case "AppRemoved":
      console.log(`AppRemoved event received with data:`, eventData);
      console.log(`App instance ID:`, event.instanceId);
      //Remove the installation details. from RiseInstallations
      break;
    default:
      console.log(`Received unknown event type: ${event.eventType}`);
      break;
  }

  res.status(200).send();
});

app.listen(port, () => {
  console.log(`OAuth app running at http://localhost:${port}`);
});