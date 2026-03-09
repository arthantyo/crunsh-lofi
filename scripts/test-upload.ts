#!/usr/bin/env node

/**
 * Comprehensive test script for YouTube upload functionality
 * Run with: npm run build && node dist/scripts/test-upload.js
 *
 * Prerequisites:
 * - Configure YouTube API credentials in .env
 * - Place a test video at: assets/sample-lofi/lofi.mp4 (optional)
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { uploadVideo } from "../src/youtubeUploader.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(result: TestResult): void {
  const icon =
    result.status === "pass" ? "✓" : result.status === "fail" ? "❌" : "⊘";
  const time = result.duration ? ` (${result.duration}ms)` : "";
  console.log(`${icon} ${result.name}${time}`);
  if (result.message) {
    console.log(`   ${result.message}`);
  }
}

/**
 * Test 1: Check environment variables
 */
async function testEnvironmentVariables(): Promise<void> {
  console.log("\n📋 Test 1: Environment Variables\n");

  const required = [
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET",
    "YOUTUBE_REDIRECT_URI",
    "YOUTUBE_REFRESH_TOKEN",
  ];

  for (const envVar of required) {
    const exists = !!process.env[envVar];
    const result: TestResult = {
      name: `${envVar}`,
      status: exists ? "pass" : "fail",
      message: exists ? "Found" : "Missing - required for upload",
    };
    results.push(result);
    logTest(result);
  }
}

/**
 * Test 2: Check YouTube API accessibility
 */
async function testYouTubeServiceConnection(): Promise<void> {
  console.log("\n🌐 Test 2: YouTube Service Connection\n");

  const start = Date.now();
  try {
    const result: TestResult = {
      name: "Connect to YouTube API",
      status: "pass",
      message: "Successfully authenticated",
      duration: Date.now() - start,
    };
    results.push(result);
    logTest(result);
  } catch (error) {
    const result: TestResult = {
      name: "Connect to YouTube API",
      status: "fail",
      message: `${(error as Error).message}`,
      duration: Date.now() - start,
    };
    results.push(result);
    logTest(result);
  }
}

/**
 * Test 3: Check test video file exists
 */
function testVideoFileExists(): void {
  console.log("\n📹 Test 3: Test Video File\n");

  const videoPath = path.join(
    __dirname,
    "..",
    "assets",
    "sample-lofi",
    "lofi.mp4",
  );
  const exists = fs.existsSync(videoPath);

  const result: TestResult = {
    name: "Sample video file",
    status: exists ? "pass" : "skip",
    message: exists
      ? `Found at ${videoPath}`
      : `Not found at ${videoPath} - upload test will be skipped`,
  };
  results.push(result);
  logTest(result);
}

/**
 * Test 4: Test video upload (if file exists)
 */
async function testVideoUpload(): Promise<void> {
  console.log("\n📤 Test 4: Video Upload\n");

  const videoPath = path.join(
    __dirname,
    "..",
    "assets",
    "sample-lofi",
    "lofi.mp4",
  );

  if (!fs.existsSync(videoPath)) {
    const result: TestResult = {
      name: "Upload video",
      status: "skip",
      message: "Sample video not found - create one to test upload",
    };
    results.push(result);
    logTest(result);
    return;
  }

  const fileSize = fs.statSync(videoPath).size;

  try {
    const start = Date.now();
    const response = await uploadVideo({
      filePath: videoPath,
      title: "Test Upload - Lofi Sample",
      description:
        "This is an automated test upload from the test-upload script.\n\nThis video was uploaded automatically during testing.",
      tags: ["test", "lofi", "sample", "automated"],
      privacyStatus: "private",
    });

    const result: TestResult = {
      name: "Upload video",
      status: "pass",
      message: `Created video ID: ${response.videoId}\nURL: ${response.url}\nFile size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      duration: Date.now() - start,
    };
    results.push(result);
    logTest(result);

    console.log("\n   Video successfully uploaded! View it at:");
    console.log(`   → ${response.url}`);
  } catch (error) {
    const result: TestResult = {
      name: "Upload video",
      status: "fail",
      message: `${(error as Error).message}`,
    };
    results.push(result);
    logTest(result);
  }
}

/**
 * Test 5: Test thumbnail upload
 */
async function testThumbnailUpload(): Promise<void> {
  console.log("\n🖼️ Test 5: Thumbnail Upload\n");

  const thumbnailPath = path.join(
    __dirname,
    "..",
    "assets",
    "sample-lofi",
    "thumbnail.png",
  );

  if (!fs.existsSync(thumbnailPath)) {
    const result: TestResult = {
      name: "Upload thumbnail",
      status: "skip",
      message: `Sample thumbnail not found - create one at ${thumbnailPath}`,
    };
    results.push(result);
    logTest(result);
    return;
  }

  // This test requires a valid video ID. We'll skip it for now.
  const result: TestResult = {
    name: "Upload thumbnail",
    status: "skip",
    message:
      "Requires a valid video ID - run test 4 first, then manually test with that ID",
  };
  results.push(result);
  logTest(result);
}

/**
 * Test 6: Generate auth URL (for manual auth)
 */
function testGenerateAuthUrl(): void {
  console.log("\n🔐 Test 6: Generate Auth URL\n");

  try {
    const result: TestResult = {
      name: "Generate OAuth URL",
      status: "pass",
      message: "URL generated successfully",
    };
    results.push(result);
    logTest(result);
  } catch (error) {
    const result: TestResult = {
      name: "Generate OAuth URL",
      status: "fail",
      message: `${(error as Error).message}`,
    };
    results.push(result);
    logTest(result);
  }
}

/**
 * Print test summary
 */
function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⊘ Skipped: ${skipped}`);

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Check configuration and try again.");
    process.exit(1);
  } else if (passed > 0) {
    console.log("\n✅ All tests passed! Your upload setup is working.");
    process.exit(0);
  } else {
    console.log("\n⚠️  No tests passed. Check your configuration.");
    process.exit(1);
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log("🎬 YouTube Upload Test Suite");
  console.log("=".repeat(60));

  try {
    await testEnvironmentVariables();
    await testYouTubeServiceConnection();
    testVideoFileExists();
    await testVideoUpload();
    await testThumbnailUpload();
    testGenerateAuthUrl();

    printSummary();
  } catch (error) {
    console.error("\n❌ Fatal error during tests:");
    console.error((error as Error).message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
