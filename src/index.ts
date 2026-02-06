// ! Rules for adding chapters to YouTube videos:
// ! Timestamps must be in the video description
// ! Format: 0:00 Chapter Title (one per line)
// ! First chapter must start at 0:00
// ! Minimum of 3 chapters required
// ! Each chapter must be at least 10 seconds long

import dotenv from "dotenv";
import path from "path";
import readline from "readline";
import { fetchContentPlan } from "./contentPlanning.js";
import { generateThumbnail } from "./imageGenerator.js";
import { generateAudioFromPlan, validateAudioFile } from "./audioGenerator.js";
import {
  createVideo,
  validateChapters,
  getVideoInfo,
} from "./videoProcessor.js";
import { publishVideo } from "./youtubeUploader.js";
import { startCallbackServer, stopCallbackServer } from "./callbackServer.js";

dotenv.config();

interface Chapter {
  timestamp: string;
  title: string;
}

interface ContentPlan {
  title: string;
  description: string;
  subtitle: string;
  tags: string[];
  audioStyle: string;
  duration: number;
  imagePrompt?: string;
  audioPrompt?: string;
  chapters: Chapter[];
}

/**
 * Create readline interface for interactive input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function prompt(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Interactive content plan input
 */
async function getContentPlanInteractively(): Promise<ContentPlan> {
  console.log("\n📝 Interactive Content Plan Entry");
  console.log("================================\n");

  const title = await prompt("Video Title: ");
  const description = await prompt("Description: ");
  const subtitle = await prompt("Subtitle (for thumbnail, e.g., 'chill!'): ");
  const tags = await prompt("Tags (comma-separated): ");
  const audioStyle = await prompt(
    "Audio Style (lofi-chill/lofi-jazz/lofi-ambient/lofi-upbeat) [lofi-chill]: ",
  );
  const durationInput = await prompt("Duration in seconds [3600]: ");
  const imagePrompt = await prompt("Image generation prompt (optional): ");
  const audioPrompt = await prompt("Audio generation prompt (optional): ");

  console.log("\n📑 Chapters (optional - press Enter to skip)");
  console.log("Format: timestamp|title (e.g., 0:00|Introduction)");
  console.log("Enter chapters one per line, empty line to finish:\n");

  const chapters: Chapter[] = [];
  let chapterInput;
  let chapterIndex = 1;

  while (true) {
    chapterInput = await prompt(
      `Chapter ${chapterIndex} (or press Enter to finish): `,
    );
    if (!chapterInput.trim()) break;

    const [timestamp, chapterTitle] = chapterInput.split("|");
    if (timestamp && chapterTitle) {
      chapters.push({
        timestamp: timestamp.trim(),
        title: chapterTitle.trim(),
      });
      chapterIndex++;
    }
  }

  return {
    title: title || "Lofi Beats",
    description: description || "Relaxing lofi music for study and chill",
    subtitle: subtitle || "chill!",
    tags: tags
      ? tags.split(",").map((t) => t.trim())
      : ["lofi", "study music", "chill beats"],
    audioStyle: audioStyle || "lofi-chill",
    duration: parseInt(durationInput, 10) || 3600,
    imagePrompt: imagePrompt || undefined,
    audioPrompt: audioPrompt || undefined,
    chapters: chapters.length >= 3 ? chapters : [],
  };
}

/**
 * Main automation workflow
 */
async function main(): Promise<void> {
  console.log("🎵 Lofi Video Automation Started");
  console.log("================================\n");

  // Start callback server for kie.ai
  await startCallbackServer();

  try {
    // Check if interactive mode is
    const useInteractive =
      process.argv.includes("--interactive") || process.argv.includes("-i");

    // Check if YouTube upload should be skipped
    const skipUpload =
      process.argv.includes("--no-upload") || process.argv.includes("-n");

    let contentPlan: ContentPlan;

    if (useInteractive) {
      // Step 1: Get content plan interactively
      contentPlan = await getContentPlanInteractively();
    } else {
      // Step 1: Fetch content planning from API
      console.log("💡 Tip: Use --interactive or -i flag for manual input\n");
      contentPlan = (await fetchContentPlan()) as any;
    }

    console.log(`\n✓ Content Plan: "${contentPlan.title}"\n`);

    // Setup paths
    const timestamp = Date.now();
    const tempDir = process.env.TEMP_DIRECTORY || "./temp";
    const outputDir = process.env.OUTPUT_DIRECTORY || "./output";

    const audioPath = path.join(tempDir, `audio_${timestamp}.mp3`);
    const thumbnailPath = path.join(tempDir, `thumbnail_${timestamp}.png`);
    const videoPath = path.join(outputDir, `lofi_video_${timestamp}.mp4`);

    // Step 2: Generate thumbnail and object image
    console.log("\n--- Step 2: Generate Thumbnail & Object Image ---");
    const result = await generateThumbnail(contentPlan, thumbnailPath);
    const finalThumbnailPath =
      typeof result === "string" ? result : result.thumbnailPath;

    // Step 3: Generate audio
    console.log("\n--- Step 3: Generate Audio ---");
    await generateAudioFromPlan(contentPlan, audioPath);
    await validateAudioFile(audioPath);

    // Step 4: Create video (use thumbnail as background)
    console.log("\n--- Step 4: Create Video ---");
    await createVideo(
      {
        audioPath: audioPath,
        backgroundImage: finalThumbnailPath,
      },
      videoPath,
    );

    // Validate video
    const videoInfo = await getVideoInfo(videoPath);
    console.log(
      `\n✓ Video created: ${(videoInfo.size / 1024 / 1024).toFixed(2)} MB`,
    );

    // Validate chapters if provided
    if (contentPlan.chapters && contentPlan.chapters.length > 0) {
      validateChapters(contentPlan.chapters, videoInfo.duration);
    }

    // Step 5: Upload to YouTube (if not skipped)
    if (skipUpload) {
      console.log("\n--- Step 5: Upload to YouTube (SKIPPED) ---");
      console.log("💡 Upload skipped due to --no-upload flag");

      console.log("\n================================");
      console.log("✅ Automation Complete!");
      console.log("================================");
      console.log(`📁 Video file: ${videoPath}`);
      console.log(`🖼️ Thumbnail file: ${finalThumbnailPath}`);
    } else {
      console.log("\n--- Step 5: Upload to YouTube ---");
      const uploadResult = await publishVideo(
        contentPlan as any,
        videoPath,
        finalThumbnailPath,
      );

      console.log("\n================================");
      console.log("✅ Automation Complete!");
      console.log("================================");
      console.log(`📺 Video URL: ${uploadResult.url}`);
      console.log(`🎬 Video ID: ${uploadResult.videoId}`);
      console.log(`📁 Local file: ${videoPath}`);
    }
  } catch (error) {
    console.error("\n❌ Error in automation workflow:");
    console.error((error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    // Stop the callback server
    await stopCallbackServer();
  }
}

// Run the automation
main().catch((error) => {
  console.error("\n❌ Fatal error:");
  console.error((error as Error).message);
  console.error((error as Error).stack);
  process.exit(1);
});
