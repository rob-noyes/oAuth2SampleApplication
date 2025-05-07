require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  next();
});

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  AUTH_URL,
  TOKEN_URL
} = process.env;
const installations = {};


app.get('/', (req, res) => {
  const authUrl = `${AUTH_URL}?appId=${CLIENT_ID}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}`;
  console.log(`authUrl:${authUrl}`);
  res.send(`<a href="${authUrl}">Install on Wix</a>`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const instanceId = req.query.instanceId;

  if (!code) return res.status(400).send('Missing code');

  try {
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    installations[instanceId] = {
        access_token:  response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at:    Date.now() + (response.data.expires_in * 1000)
    };
    console.log('installations:', installations);
    res.json(response.data); // shows access_token, etc.
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Token exchange failed');
  }
});

app.listen(port, () => {
  console.log(`OAuth app running at http://localhost:${port}`);
});
