import { google, youtube_v3 } from "googleapis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { formatChapters } from "./videoProcessor.js";

dotenv.config();

const OAuth2 = google.auth.OAuth2;

interface VideoUploadData {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "public" | "private" | "unlisted";
}

interface UploadResult {
  videoId: string;
  url: string;
  data: youtube_v3.Schema$Video;
}

interface Chapter {
  timestamp: string;
  title: string;
}

interface ContentPlan {
  title: string;
  description: string;
  tags?: string[];
  chapters?: Chapter[];
}

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
  return new OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI,
  );
}

/**
 * Get authenticated YouTube service
 */
export async function getYouTubeService(): Promise<youtube_v3.Youtube> {
  const oauth2Client = createOAuth2Client();

  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });
  } else {
    throw new Error(
      "No YouTube refresh token found. Please authenticate first.",
    );
  }

  return google.youtube({
    version: "v3",
    auth: oauth2Client,
  });
}

/**
 * Upload video to YouTube
 * @param {Object} videoData - Video metadata and file info
 * @param {string} videoData.filePath - Path to video file
 * @param {string} videoData.title - Video title
 * @param {string} videoData.description - Video description
 * @param {string[]} videoData.tags - Video tags
 * @param {string} videoData.privacyStatus - 'public', 'private', or 'unlisted'
 * @returns {Promise<Object>} Video upload response with video ID
 */
export async function uploadVideo(
  videoData: VideoUploadData,
): Promise<UploadResult> {
  console.log("📤 Uploading video to YouTube...");

  const youtube = await getYouTubeService();

  const {
    filePath,
    title,
    description,
    tags = [],
    privacyStatus = "private",
  } = videoData;

  try {
    const fileSize = fs.statSync(filePath).size;
    console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: tags,
          categoryId: "10", // Music category
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    const videoId = response.data.id!;
    console.log(`✓ Video uploaded successfully!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);

    return {
      videoId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      data: response.data,
    };
  } catch (error) {
    console.error("Error uploading video:", (error as Error).message);
    if ((error as any).response) {
      console.error("API Error:", (error as any).response.data);
    }
    throw error;
  }
}

/**
 * Update video metadata (description, title, tags)
 * Used to add chapters and other info after upload
 */
export async function updateVideoMetadata(
  videoId: string,
  metadata: youtube_v3.Schema$VideoSnippet,
): Promise<youtube_v3.Schema$Video> {
  console.log("📝 Updating video metadata...");

  const youtube = await getYouTubeService();

  try {
    const response = await youtube.videos.update({
      part: ["snippet"],
      requestBody: {
        id: videoId,
        snippet: metadata,
      },
    });

    console.log("✓ Metadata updated successfully");
    return response.data;
  } catch (error) {
    console.error("Error updating metadata:", (error as Error).message);
    throw error;
  }
}

/**
 * Set video thumbnail
 */
export async function setThumbnail(
  videoId: string,
  thumbnailPath: string,
): Promise<youtube_v3.Schema$ThumbnailSetResponse> {
  console.log("🖼️ Uploading thumbnail...");

  const youtube = await getYouTubeService();

  try {
    const response = await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: fs.createReadStream(thumbnailPath),
      },
    });

    console.log("✓ Thumbnail uploaded successfully");
    return response.data;
  } catch (error) {
    console.error("Error uploading thumbnail:", (error as Error).message);
    throw error;
  }
}

/**
 * Complete video upload with all metadata
 * This is the main function to upload and configure everything
 */
export async function publishVideo(
  contentPlan: ContentPlan,
  videoPath: string,
  thumbnailPath: string,
): Promise<UploadResult> {
  console.log("🚀 Publishing video to YouTube...");

  // Format description with chapters
  let description = contentPlan.description;

  if (contentPlan.chapters && contentPlan.chapters.length >= 3) {
    description += formatChapters(contentPlan.chapters);
  }

  // Upload video
  const uploadResult = await uploadVideo({
    filePath: videoPath,
    title: contentPlan.title,
    description: description,
    tags: contentPlan.tags || [
      "lofi",
      "lofi hip hop",
      "study music",
      "chill beats",
    ],
    privacyStatus: "private", // Start as private, can change later
  });

  const videoId = uploadResult.videoId;

  // Set thumbnail
  if (thumbnailPath) {
    try {
      await setThumbnail(videoId, thumbnailPath);
    } catch (error) {
      console.error("⚠ Failed to set thumbnail:", (error as Error).message);
    }
  }

  return uploadResult;
}

/**
 * Generate OAuth URL for first-time authentication
 * Run this once to get your refresh token
 */
export function generateAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  console.log("🔐 Authorize this app by visiting this URL:");
  console.log(url);
  console.log("\nAfter authorization, you will receive a code.");
  console.log("Use getTokenFromCode(code) to get your refresh token.");

  return url;
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokenFromCode(code: string): Promise<any> {
  const oauth2Client = createOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("✓ Tokens received!");
    console.log("Add this to your .env file:");
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    return tokens;
  } catch (error) {
    console.error("Error getting tokens:", (error as Error).message);
    throw error;
  }
}

/**
 * Test video upload functionality
 */
export async function testUpload(): Promise<void> {
  const sampleVideoPath = path.resolve("assets/sample-lofi/lofi.mp4");

  const videoData: VideoUploadData = {
    filePath: sampleVideoPath,
    title: "Test Upload - Lofi Sample",
    description: "This is a test upload using the sample lofi video.",
    tags: ["test", "lofi", "sample"],
    privacyStatus: "private",
  };

  try {
    const result = await uploadVideo(videoData);
    console.log("Test upload successful:", result);
  } catch (error) {
    console.error("Test upload failed:", error);
  }
}
