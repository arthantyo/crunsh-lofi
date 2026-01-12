import { testUpload } from "./src/youtubeUploader.js";

/**
 * Standalone test script for YouTube upload
 * Run with: node test-upload.js
 *
 * Prerequisites:
 * - Ensure the YouTube API credentials are set in the .env file
 * - Ensure the sample video exists at: assets/sample-lofi/lofi.mp4
 */

async function runTestUpload() {
  console.log("📤 Testing YouTube Upload\n");
  console.log("================================\n");

  try {
    await testUpload();
    console.log("\n✅ Test upload completed successfully!");
  } catch (error) {
    console.error("\n❌ Test upload failed:", error.message);
    console.error(error.stack);
  }

  console.log("================================\n");
}

// Run the test
runTestUpload().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
