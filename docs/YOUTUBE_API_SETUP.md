# YouTube API Setup Guide

This guide will help you set up YouTube API credentials for automated video uploads.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** at the top → **"New Project"**
3. Enter a project name (e.g., "Lofi Video Automation")
4. Click **"Create"**

## Step 2: Enable YouTube Data API v3

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"YouTube Data API v3"**
3. Click on it and press **"Enable"**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen:

   - Choose **"External"** (unless you have a Google Workspace)
   - Fill in app name: "Lofi Video Automation"
   - Add your email as support email
   - Add your email in developer contact
   - Click **"Save and Continue"**
   - Skip scopes (click "Save and Continue")
   - Skip test users (click "Save and Continue")

4. Back to **"Create OAuth client ID"**:

   - Application type: **"Web application"**
   - Name: "Lofi Automation Client"
   - Add **Authorized redirect URIs**: `http://localhost:3000/oauth2callback`
   - Click **"Create"**

5. **Save your credentials**:
   - Copy the **Client ID**
   - Copy the **Client Secret**
   - Add them to your `.env` file

## Step 4: Get Refresh Token

Run this script to get your refresh token:

```bash
node scripts/get-youtube-token.js
```

Or manually:

1. Update your `.env` with Client ID and Client Secret (leave refresh token empty for now)
2. Run the interactive authentication:

```javascript
import { generateAuthUrl } from "./src/youtubeUploader.js";

console.log(generateAuthUrl());
```

3. Open the URL in your browser
4. Sign in with your YouTube account
5. Grant permissions to the app
6. Copy the authorization code from the callback URL
7. Exchange it for a refresh token:

```javascript
import { getTokenFromCode } from "./src/youtubeUploader.js";

await getTokenFromCode("YOUR_AUTHORIZATION_CODE_HERE");
```

8. Copy the refresh token and add it to your `.env` file

## Step 5: Update .env File

Your `.env` should now have:

```env
YOUTUBE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-abc123def456
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
YOUTUBE_REFRESH_TOKEN=1//0abc123def456-xyz789
```

## Step 6: Test the Setup

Run a test upload to verify everything works:

```bash
npm run interactive
```

## Important Notes

- ⚠️ **Keep your credentials secret** - never commit `.env` to git
- 📊 **YouTube API Quota**: Default quota is 10,000 units/day
  - Upload = ~1,600 units per video
  - You can upload ~6 videos per day with default quota
- 🔒 **OAuth Consent Screen**: For personal use, "External" + Testing mode works fine
- 🔄 **Refresh Token**: Doesn't expire unless you revoke access

## Troubleshooting

### "Crunsh has not completed the Google verification process"

**This is the most common issue!**

Your app is in testing mode and you need to add yourself as a test user:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **"APIs & Services"** → **"OAuth consent screen"**
4. Scroll down to **"Test users"** section
5. Click **"Add Users"**
6. Enter the email address you use for YouTube
7. Click **"Add"** then **"Save"**
8. Try the authorization URL again

**Alternative**: If you only see "Publishing status: Testing":

- You can keep it in testing mode for personal use
- Just make sure your YouTube account email is added as a test user
- No need to publish the app for personal automation

### "Invalid redirect_uri"

- Make sure `http://localhost:3000/oauth2callback` is added in Google Cloud Console
- Check for typos in the redirect URI

### "Access blocked: Authorization Error"

- Your app is in testing mode and needs test users added
- Go to **"APIs & Services"** → **"OAuth consent screen"** → **"Test users"**
- Click **"Add Users"** and enter your YouTube/Google email
- The email must match the account you're signing in with
- Save and try authorization again

### "Invalid credentials"

- Double-check Client ID and Client Secret
- Make sure there are no extra spaces in `.env`

### "Quota exceeded"

- Check [API usage](https://console.cloud.google.com/apis/dashboard)
- Request quota increase if needed (can take several days)

## Need Help?

- [YouTube API Documentation](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [API Quota Info](https://developers.google.com/youtube/v3/getting-started#quota)
