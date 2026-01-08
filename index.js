// ! Rules for adding chapters to YouTube videos:
// ! Timestamps must be in the video description
// ! Format: 0:00 Chapter Title (one per line)
// ! First chapter must start at 0:00
// ! Minimum of 3 chapters required
// ! Each chapter must be at least 10 seconds long

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { fetchContentPlan } from "./src/contentPlanning.js";
import { generateThumbnail } from "./src/imageGenerator.js";
import {
  generateAudioFromPlan,
  validateAudioFile,
} from "./src/audioGenerator.js";
import {
  createVideo,
  validateChapters,
  getVideoInfo,
} from "./src/videoProcessor.js";
import { publishVideo } from "./src/youtubeUploader.js";

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/**
 * Main automation workflow
 */
async function main() {
  console.log("🎵 Lofi Video Automation Started");
  console.log("================================\n");

  try {
    // Step 1: Fetch content planning
    const contentPlan = await fetchContentPlan();
    console.log(`\n✓ Content Plan: "${contentPlan.title}"\n`);

    // Setup paths
    const timestamp = Date.now();
    const tempDir = process.env.TEMP_DIRECTORY || "./temp";
    const outputDir = process.env.OUTPUT_DIRECTORY || "./output";

    const audioPath = path.join(tempDir, `audio_${timestamp}.mp3`);
    const thumbnailPath = path.join(tempDir, `thumbnail_${timestamp}.png`);
    const videoPath = path.join(outputDir, `lofi_video_${timestamp}.mp4`);

    // Step 2: Generate thumbnail
    console.log("\n--- Step 2: Generate Thumbnail ---");
    await generateThumbnail(contentPlan, thumbnailPath);

    // Step 3: Generate audio
    console.log("\n--- Step 3: Generate Audio ---");
    await generateAudioFromPlan(contentPlan, audioPath);
    await validateAudioFile(audioPath);

    // Step 4: Create video (stitch audio with background)
    console.log("\n--- Step 4: Create Video ---");
    await createVideo(
      {
        audioPath: audioPath,
        backgroundVideo: process.env.DEFAULT_VIDEO_BACKGROUND,
        duration: contentPlan.duration || 3600,
      },
      videoPath
    );

    // Validate video
    const videoInfo = await getVideoInfo(videoPath);
    console.log(
      `\n✓ Video created: ${(videoInfo.size / 1024 / 1024).toFixed(2)} MB`
    );

    // Validate chapters if provided
    if (contentPlan.chapters && contentPlan.chapters.length > 0) {
      validateChapters(contentPlan.chapters, videoInfo.duration);
    }

    // Step 5: Upload to YouTube
    console.log("\n--- Step 5: Upload to YouTube ---");
    const uploadResult = await publishVideo(
      contentPlan,
      videoPath,
      thumbnailPath
    );

    console.log("\n================================");
    console.log("✅ Automation Complete!");
    console.log("================================");
    console.log(`📺 Video URL: ${uploadResult.url}`);
    console.log(`🎬 Video ID: ${uploadResult.videoId}`);
    console.log(`📁 Local file: ${videoPath}`);
  } catch (error) {
    console.error("\n❌ Error in automation workflow:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the automation
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
