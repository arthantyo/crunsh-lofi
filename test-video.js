import { createVideo, getVideoInfo } from "./src/videoProcessor.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Standalone test script for video processor
 * Run with: node test-video.js
 *
 * Prerequisites:
 * - Place a sample audio file at: sample-vid/audio.mp3
 * - Place a sample thumbnail at: sample-vid/thumbnail.png
 */
async function testVideoProcessor() {
  console.log("🎬 Testing Video Processor\n");
  console.log("================================\n");

  // Setup sample file paths
  const sampleDir = path.join(__dirname, "assets/sample-vid");
  const sampleAudio = path.join(sampleDir, "audio.mp3");
  const sampleThumbnail = path.join(sampleDir, "thumbnail.png");

  // Test 1: MP4 with background image (matches audio duration)
  console.log("Test 1: MP4 with background image (audio-length)");
  try {
    const output1 = path.join(__dirname, "test-video.mp4");
    await createVideo(
      {
        audioPath: sampleAudio,
        backgroundImage: sampleThumbnail,
        format: "mp4",
      },
      output1
    );

    const info1 = await getVideoInfo(output1);
    console.log(`✓ Saved to: ${output1}`);
    console.log(`  Duration: ${info1.duration.toFixed(2)}s (matches audio)`);
    console.log(`  Size: ${(info1.size / 1024 / 1024).toFixed(2)} MB\n`);
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message, "\n");
  }

  // Test 2: AVI with background image
  console.log("Test 2: AVI with background image");
  try {
    const output2 = path.join(__dirname, "test-video.avi");
    await createVideo(
      {
        audioPath: sampleAudio,
        backgroundImage: sampleThumbnail,
        format: "avi",
      },
      output2
    );

    const info2 = await getVideoInfo(output2);
    console.log(`✓ Saved to: ${output2}`);
    console.log(`  Duration: ${info2.duration.toFixed(2)}s (matches audio)`);
    console.log(`  Size: ${(info2.size / 1024 / 1024).toFixed(2)} MB\n`);
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message, "\n");
  }

  // Test 3: Video with solid background (no image)
  console.log("Test 3: MP4 with solid color background");
  try {
    const output3 = path.join(__dirname, "test-video-solid-bg.mp4");
    await createVideo(
      {
        audioPath: sampleAudio,
        format: "mp4",
      },
      output3
    );

    const info3 = await getVideoInfo(output3);
    console.log(`✓ Saved to: ${output3}`);
    console.log(`  Duration: ${info3.duration.toFixed(2)}s (matches audio)`);
    console.log(`  Size: ${(info3.size / 1024 / 1024).toFixed(2)} MB\n`);
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message, "\n");
  }

  console.log("================================");
  console.log("✅ Video Processor Tests Complete!\n");
  console.log("Check the generated MP4 files in the project root directory.");
  console.log("\nNote: Play the videos to verify audio is present!");
}

// Run the tests
testVideoProcessor().catch((error) => {
  console.error("Fatal error:", error);
  console.error(error.stack);
  process.exit(1);
});
