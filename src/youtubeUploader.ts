import { google, youtube_v3 } from "googleapis";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// File to track uploaded videos and their timestamps
const VIDEO_REGISTRY_FILE = "./temp/video-registry.json";

interface VideoRecord {
  videoId: string;
  title: string;
  uploadedAt: number;
  published: boolean;
}

interface VideoRegistry {
  videos: VideoRecord[];
}

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

interface ContentPlan {
  title: string;
  description: string;
  tags?: string[];
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
    const fileSize = fsSync.statSync(filePath).size;
    console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Schedule publish time 24 hours from now (only for private videos)
    const publishAtTime =
      privacyStatus === "private"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;

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
          publishAt: publishAtTime,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fsSync.createReadStream(filePath),
      },
    });

    const videoId = response.data.id!;
    console.log(`✓ Video uploaded successfully!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   URL: https://www.youtube.com/watch?v=${videoId}`);
    if (publishAtTime) {
      console.log(`   📅 Scheduled to publish at: ${publishAtTime}`);
    }

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
        body: fsSync.createReadStream(thumbnailPath),
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

  // Upload video
  const uploadResult = await uploadVideo({
    filePath: videoPath,
    title: contentPlan.title,
    description: contentPlan.description,
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

  // Record video for publishing in 24 hours
  await recordUploadedVideo(videoId, contentPlan.title);

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
 * Record a newly uploaded video with timestamp for delayed publishing
 */
async function recordUploadedVideo(
  videoId: string,
  title: string,
): Promise<void> {
  try {
    let registry: VideoRegistry = { videos: [] };

    // Read existing registry if it exists
    try {
      const content = await fs.readFile(VIDEO_REGISTRY_FILE, "utf-8");
      registry = JSON.parse(content);
    } catch (e) {
      // File doesn't exist yet, create new registry
      registry = { videos: [] };
    }

    // Add new video record
    registry.videos.push({
      videoId,
      title,
      uploadedAt: Date.now(),
      published: false,
    });

    // Ensure temp directory exists
    await fs.mkdir("./temp", { recursive: true });

    // Write registry back
    await fs.writeFile(VIDEO_REGISTRY_FILE, JSON.stringify(registry, null, 2));

    console.log(`📝 Recorded video for publishing in 24 hours: ${videoId}`);
  } catch (error) {
    console.error("⚠ Failed to record video:", (error as Error).message);
  }
}

/**
 * Check for videos that are ready to publish (24+ hours old)
 * Updates their privacy status from private to public
 */
export async function publishPendingVideos(): Promise<void> {
  try {
    // Check if registry file exists
    if (!fsSync.existsSync(VIDEO_REGISTRY_FILE)) {
      return; // No videos to publish
    }

    const content = await fs.readFile(VIDEO_REGISTRY_FILE, "utf-8");
    const registry: VideoRegistry = JSON.parse(content);
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const youtube = await getYouTubeService();
    let updatedAny = false;

    for (const video of registry.videos) {
      if (video.published) continue; // Already published

      const ageMs = now - video.uploadedAt;

      if (ageMs >= ONE_DAY_MS) {
        console.log(
          `\n📖 Publishing video from 24 hours ago: ${video.videoId}`,
        );

        try {
          // Get current video metadata
          const getResponse = await youtube.videos.list({
            part: ["snippet", "status"],
            id: [video.videoId],
          });

          if (!getResponse.data.items || getResponse.data.items.length === 0) {
            console.log(
              `   ⚠ Video not found (may have been deleted): ${video.videoId}`,
            );
            video.published = true;
            updatedAny = true;
            continue;
          }

          // Update status to public
          await youtube.videos.update({
            part: ["status"],
            requestBody: {
              id: video.videoId,
              status: {
                privacyStatus: "public",
              },
            },
          });

          console.log(
            `   ✓ Published! https://www.youtube.com/watch?v=${video.videoId}`,
          );
          video.published = true;
          updatedAny = true;
        } catch (error) {
          console.error(
            `   ❌ Failed to publish video: ${(error as Error).message}`,
          );
        }
      }
    }

    // Clean up published videos and write updated registry
    if (updatedAny) {
      registry.videos = registry.videos.filter((v) => !v.published);
      await fs.writeFile(
        VIDEO_REGISTRY_FILE,
        JSON.stringify(registry, null, 2),
      );
    }
  } catch (error) {
    console.error(
      "Error checking for pending videos:",
      (error as Error).message,
    );
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
