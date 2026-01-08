# Lofi Video Automation 🎵

Automated lofi video creation system that handles content planning, image/audio generation, video production, and YouTube upload.

## Features

- ✅ Content planning via Appwrite or Airtable
- ✅ Image generation with kie.ai API
- ✅ Thumbnail generation with Canvas API
- ✅ Audio generation with kie.ai
- ✅ Video creation with FFmpeg
- ✅ YouTube upload with chapters, tags, and metadata
- ✅ Automatic thumbnail upload

## Prerequisites

- Node.js 18+
- FFmpeg (installed automatically via npm)
- API Keys for:
  - Appwrite or Airtable (for content planning)
  - kie.ai (for image/audio generation)
  - Google/YouTube API (for uploads)

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your API keys:

```bash
copy .env.example .env
```

3. Configure your environment variables in `.env`

## YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/oauth2callback`
6. Run the authentication helper:

```bash
node src/youtubeUploader.js
```

This will generate an auth URL. Visit it, authorize the app, and save the refresh token to your `.env` file.

## Content Planning Structure

### Appwrite

Create a collection with these fields:

- `title` (string)
- `description` (string)
- `tags` (array)
- `chapters` (JSON array)
- `imagePrompt` (string)
- `audioStyle` (string)
- `duration` (number)
- `status` (string: 'pending', 'scheduled', 'completed')

### Airtable

Create a table with these columns:

- Title (Single line text)
- Description (Long text)
- Tags (Single line text, comma-separated)
- Chapters (Long text, JSON format)
- ImagePrompt (Long text)
- AudioStyle (Single select)
- Duration (Number)
- Status (Single select: Pending/Scheduled/Completed)

### Chapters Format

Chapters must follow YouTube's rules:

- Minimum 3 chapters
- First chapter starts at 0:00
- Each chapter at least 10 seconds long

Example JSON:

```json
[
  { "timestamp": "0:00", "title": "Introduction" },
  { "timestamp": "0:15", "title": "Chill Beats" },
  { "timestamp": "30:00", "title": "Study Focus" }
]
```

## Usage

Run the automation:

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

## Workflow

1. **Fetch Content Plan**: Retrieves next pending video from Appwrite/Airtable
2. **Generate Thumbnail**: Creates custom thumbnail using kie.ai or Canvas
3. **Generate Audio**: Creates lofi track based on content plan
4. **Create Video**: Combines audio with background video using FFmpeg
5. **Upload to YouTube**: Publishes video with chapters, tags, and thumbnail

## Directory Structure

```
lfi/
├── index.js                 # Main orchestration script
├── package.json
├── .env                     # Your API keys (not committed)
├── .env.example            # Template for environment variables
├── src/
│   ├── contentPlanning.js  # Appwrite/Airtable integration
│   ├── imageGenerator.js   # kie.ai image generation
│   ├── canvasGenerator.js  # Canvas API fallback
│   ├── audioGenerator.js   # kie.ai audio generation
│   ├── videoProcessor.js   # FFmpeg video creation
│   └── youtubeUploader.js  # YouTube API integration
├── temp/                   # Temporary files (auto-created)
└── output/                 # Final videos (auto-created)
```

## Configuration

Key environment variables:

- `APPWRITE_*` or `AIRTABLE_*`: Content planning service
- `KIE_AI_API_KEY`: For image and audio generation
- `YOUTUBE_*`: YouTube API credentials
- `DEFAULT_VIDEO_BACKGROUND`: Path to background video file
- `OUTPUT_DIRECTORY`: Where to save final videos
- `TEMP_DIRECTORY`: Where to store temporary files

## Troubleshooting

### Audio Generation Fails

- Check kie.ai API key and quota
- Ensure duration is reasonable (under 1 hour recommended)

### Video Creation Fails

- Ensure FFmpeg is installed correctly
- Check background video path exists
- Verify audio file was generated successfully

### YouTube Upload Fails

- Verify OAuth tokens are valid
- Check YouTube API quota
- Ensure video meets YouTube's requirements

## License

MIT

## Contributing

Pull requests welcome! Please test thoroughly before submitting.
