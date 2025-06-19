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
  BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  AUTH_URL,
  TOKEN_URL,
  KLAVIYO_CLIENT_ID,
  KLAVIYO_CLIENT_SECRET,
  KLAVIYO_REDIRECT_URI,
  KLAVIYO_AUTH_URL,
  KLAVIYO_TOKEN_URL
} = process.env;
const wixInstallations = {};
const klaviyoInstallations = {}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////// Wix oAuth /////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//app.get('/oauth/wix/authorize', (req, res) => {
//  const token = req.query.token
//  const authUrl = `${AUTH_URL}?appId=${CLIENT_ID}&token=${token}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}`;
////  if (token) {
////      authUrl += `&token=${token}`;
////    }
//  console.log(`authUrl:${authUrl}`);
////  res.send(`<a href="${authUrl}">Install on Wix</a>`);
//  res.redirect(authUrl)
//});

app.get('/oauth/wix/authorize', (req, res) => {
  const token = req.query.token;

  let authUrl = `${AUTH_URL}?appId=${CLIENT_ID}&redirectUrl=${encodeURIComponent(REDIRECT_URI)}&token=${token}`;
//  if (token) {
//    authUrl += `&token=${encodeURIComponent(token)}`;
//  }

  console.log(`authUrl: ${authUrl}`);
  res.redirect(authUrl);
});

app.get('/oauth/wix/callback', async (req, res) => {
  const code = req.query.code;
  const instanceId = req.query.instanceId;
  if (!code) return res.status(400).send('Missing code');

  // get the access token from Wix
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

    // Save the access token for the installed user
    wixInstallations[instanceId] = {
        access_token:  response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at:    Date.now() + (response.data.expires_in * 1000)
    };
    console.log('wixInstallations:', wixInstallations);

    // Redirect the user to the next step (Klaviyo auth flow)
    const redirectTo = `${BASE_URL}/oauth/klaviyo/authorize?instanceId=${instanceId}`;
    return res.redirect(redirectTo);

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).send('Token exchange failed');
  }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////// KLAVIYO oAuth /////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let crypto;

// use node:crypto if your version of node supports it
try {
        crypto = require('node:crypto');
} catch (error) {
        crypto = require('crypto');
}

function generateCodes() {
        const base64URLEncode = (str) => {
            return str.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        }
        const verifier = base64URLEncode(crypto.randomBytes(32));

        const sha256 = (buffer) => {
            return crypto.createHash('sha256').update(buffer).digest();
        }
        const challenge = base64URLEncode(sha256(verifier));

        return {
            codeVerifier: verifier,
            codeChallenge: challenge
        }
}
const pcke = generateCodes()

function getKlaviyoAuthorizationHeader() {
    // Step 1: Combine client_id and client_secret with a colon
    const credentials = `${KLAVIYO_CLIENT_ID}:${KLAVIYO_CLIENT_SECRET}`;
    // Step 2: Base64 encode the string
    const base64Credentials = Buffer.from(credentials).toString('base64');
    // Step 3: Create the Authorization header
    const authHeader = `Basic ${base64Credentials}`;
    return authHeader
}


app.get('/oauth/klaviyo/authorize', (req, res) => {
  const wixInstanceId = req.query.instanceId
  const authUrl = `${KLAVIYO_AUTH_URL}?response_type=code&client_id=${KLAVIYO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KLAVIYO_REDIRECT_URI)}&scope=accounts:read&state=${wixInstanceId}&code_challenge_method=S256&code_challenge=${pcke.codeChallenge}`
  console.log(`authUrl:${authUrl}`);
  res.send(`<a href="${authUrl}">Install on Klaviyo</a>`);
});

app.get('/oauth/klaviyo/callback', async (req, res) => {
  const code = req.query.code;
  const wixInstanceId = req.query.state;

  if (!code) return res.status(400).send('Missing code');

  const klaviyoAuthorizationHeader = getKlaviyoAuthorizationHeader()
  // get the access token from Wix
  try {
    const response = await axios.post(KLAVIYO_TOKEN_URL, {
      grant_type: 'authorization_code',
      code_verifier: pcke.codeVerifier,
      code,
      redirect_uri: KLAVIYO_REDIRECT_URI
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': klaviyoAuthorizationHeader
      }
    });

    // Save the access token for the installed user
    klaviyoInstallations[wixInstanceId] = {
        access_token:  response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at:    Date.now() + (response.data.expires_in * 1000)
    };
    console.log('klaviyo installations:', klaviyoInstallations);
    res.json(response.data); // shows access_token, etc.
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Token exchange failed');
  }

  // this is where you initiate external platform installation or log in.

});


app.listen(port, () => {
  console.log(`OAuth app running at http://localhost:${port}`);
});