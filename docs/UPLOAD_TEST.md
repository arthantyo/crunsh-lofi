# Upload Test Script

Comprehensive testing script for YouTube upload functionality. This script validates your YouTube API setup and tests the upload pipeline.

## Quick Start

```bash
npm run test-upload
```

## What Gets Tested

### 1. **Environment Variables**

Checks if all required YouTube API credentials are configured:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`
- `YOUTUBE_REFRESH_TOKEN`

### 2. **YouTube Service Connection**

Attempts to authenticate with YouTube API using your credentials and refresh token.

### 3. **Test Video File**

Looks for sample video at: `assets/sample-lofi/lofi.mp4`

### 4. **Video Upload**

If test video exists, uploads it as a private test video to your channel.

### 5. **Thumbnail Upload**

Checks for sample thumbnail at: `assets/sample-lofi/thumbnail.png` (skipped in automated tests)

### 6. **Generate Auth URL**

Generates a fresh OAuth URL if you need to re-authenticate.

## Test Results

Each test returns one of:

- ✓ **PASS** - Test succeeded
- ❌ **FAIL** - Test failed (check configuration)
- ⊘ **SKIP** - Test skipped (usually missing test files)

## Prerequisites

### 1. YouTube API Setup

If you haven't set up YouTube API credentials yet:

```bash
npm run youtube-auth
```

This will guide you through the OAuth authentication flow.

### 2. Environment Variables

Make sure your `.env` file contains:

```env
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
YOUTUBE_REFRESH_TOKEN=your_refresh_token
```

### 3. Test Video File (Optional)

For testing actual uploads, create a sample video:

```
assets/
  └─ sample-lofi/
      ├─ lofi.mp4        (test video)
      └─ thumbnail.png   (optional test thumbnail)
```

## Common Issues

### ❌ "YOUTUBE_REFRESH_TOKEN" not found

**Solution:** Run `npm run youtube-auth` to get your refresh token

### ❌ "Failed to authenticate"

**Solution:** Your refresh token may have expired. Re-run `npm run youtube-auth`

### ❌ "Sample video not found"

**Solution:** This is fine - the test will skip video upload test. Create a test video if you want to test uploads.

### ❌ "Permission denied" on upload

**Solution:** Make sure your YouTube API has the `youtube.upload` scope enabled in Google Cloud Console

## Full Test Output Example

```
🎬 YouTube Upload Test Suite
============================================================

📋 Test 1: Environment Variables

✓ YOUTUBE_CLIENT_ID
   Found
✓ YOUTUBE_CLIENT_SECRET
   Found
✓ YOUTUBE_REDIRECT_URI
   Found
✓ YOUTUBE_REFRESH_TOKEN
   Found

🌐 Test 2: YouTube Service Connection

✓ Connect to YouTube API (1234ms)
   Successfully authenticated

📹 Test 3: Test Video File

✓ Sample video file
   Found at ./assets/sample-lofi/lofi.mp4

📤 Test 4: Video Upload

✓ Upload video (45678ms)
   Created video ID: dQw4w9WgXcQ
   URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   File size: 12.34 MB

   Video successfully uploaded! View it at:
   → https://www.youtube.com/watch?v=dQw4w9WgXcQ

🖼️ Test 5: Thumbnail Upload

⊘ Upload thumbnail
   Requires a valid video ID - run test 4 first, then manually test with that ID

🔐 Test 6: Generate Auth URL

✓ Generate OAuth URL
   URL generated successfully

============================================================
📊 Test Summary

Total Tests: 6
✓ Passed: 5
❌ Failed: 0
⊘ Skipped: 1

✅ All tests passed! Your upload setup is working.
```

## Testing Workflow

1. **First time?** Run setup:

   ```bash
   npm run youtube-auth
   npm run test-upload
   ```

2. **Everything working?** Run daily automation:

   ```bash
   npm start
   ```

3. **Debug issues?** Run test again to identify the problem:
   ```bash
   npm run test-upload
   ```

## Cleanup

Test videos are uploaded as **private** and can be deleted from your channel's video manager.

## Next Steps

Once tests pass, you can:

- ✅ Run interactive mode: `npm run interactive`
- ✅ Set up GitHub Actions: See `.github/workflows/daily-automation.yml`
- ✅ Run daily automation: `npm start`
