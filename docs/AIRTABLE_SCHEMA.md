# Airtable Schema Setup

## Base Name

`contentplan`

## Table Fields

Create these fields in your Airtable table:

### 1. **Title** (Single line text)

- Type: Single line text
- Required: Yes
- Description: The title of the video
- Example: `Burger Lofi Beats`

### 2. **Description** (Long text)

- Type: Long text
- Description: YouTube video description
- Example: `Relaxing lofi hip hop beats inspired by delicious burgers...`

### 3. **Status** (Single select)

- Type: Single select
- Required: Yes
- Options:
  - `Pending`
  - `Scheduled`
  - `Processing`
  - `Completed`
  - `Failed`
- Default: `Pending`

### 4. **AudioStyle** (Single select)

- Type: Single select
- Options:
  - `lofi-chill`
  - `lofi-jazz`
  - `lofi-ambient`
  - `lofi-upbeat`
- Default: `lofi-chill`

### 5. **Duration** (Number)

- Type: Number
- Format: Integer
- Default: `3600`
- Description: Duration in seconds (3600 = 1 hour)

### 6. **Tags** (Long text)

- Type: Long text
- Description: Comma-separated tags for YouTube
- Example: `lofi, study music, chill beats, burger vibes`

### 7. **ImagePrompt** (Long text)

- Type: Long text
- Description: Custom prompt for image generation (optional)
- Example: `Cozy anime style scene with a burger on a plate, warm lighting, lo-fi aesthetic`

### 8. **Chapters** (Long text)

- Type: Long text
- Description: JSON string of chapters
- Format: `[{"time":"0:00","title":"Intro"},{"time":"5:00","title":"Chill Vibes"}]`

## Quick Setup Steps

1. Go to [airtable.com](https://airtable.com)
2. Create a new base or use existing one
3. Create a table named `contentplan`
4. Add all 8 fields listed above with correct types
5. Set default values for Status (`Pending`) and AudioStyle (`lofi-chill`)
6. Get your Base ID from the URL: `https://airtable.com/[BASE_ID]/...`
7. Create a Personal Access Token at [airtable.com/create/tokens](https://airtable.com/create/tokens)
   - Give it access to your base
   - Grant permissions: `data.records:read` and `data.records:write`

## Environment Variables

Add to your `.env` file:

```env
AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token_here
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=contentplan
```

## Example Record

| Title             | Description            | Status  | AudioStyle | Duration | Tags        | ImagePrompt       | Chapters                          |
| ----------------- | ---------------------- | ------- | ---------- | -------- | ----------- | ----------------- | --------------------------------- |
| Burger Lofi Beats | Relaxing lofi beats... | Pending | lofi-chill | 3600     | lofi, study | Cozy burger scene | [{"time":"0:00","title":"Intro"}] |

## Testing

Once set up, you can:

1. Open the web UI at `http://localhost:3000`
2. Add a new content plan through the form
3. Check Airtable - it should appear with Status = "Pending"
4. Run your automation - it will pick up pending items
