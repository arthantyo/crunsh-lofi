import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

interface VideoOptions {
  audioPath: string;
  backgroundImage?: string;
  overlayImage?: string;
  format?: "mp4" | "avi";
}

interface Chapter {
  timestamp: string;
  title: string;
}

interface VideoInfo {
  duration: number;
  size: number;
  bitrate: number;
}

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Combine audio with background image using FFmpeg
 * @param {Object} options - Video generation options
 * @param {string} options.audioPath - Path to audio file
 * @param {string} options.backgroundImage - Path to background image
 * @param {string} options.overlayImage - Path to overlay image (optional)
 * @param {string} options.format - Output format ('mp4' or 'avi', default: 'mp4')
 * @param {string} outputPath - Where to save the final video
 * @returns {Promise<string>} Path to the generated video
 */
export async function createVideo(
  options: VideoOptions,
  outputPath: string,
): Promise<string> {
  console.log("🎬 Creating video with FFmpeg...");

  const { audioPath, backgroundImage, overlayImage, format = "mp4" } = options;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add background image
    if (backgroundImage) {
      console.log("   Using background image:", backgroundImage);
      command = command.input(backgroundImage);
      // Loop the image for the duration
      command = command.inputOptions(["-loop", "1"]);
    } else {
      // Create a solid color background if no image provided
      console.log("   Creating solid background");
      command = command
        .input("color=c=0x3d2a44:s=1920x1080")
        .inputFormat("lavfi");
    }

    // Add audio
    command = command.input(audioPath);

    // Determine codecs based on format
    const videoCodec = format === "avi" ? "mpeg4" : "libx264";
    const audioCodec = format === "avi" ? "mp3" : "aac";

    // Add overlay if provided
    if (overlayImage) {
      console.log("   Adding overlay image");
      command = command.input(overlayImage);
    }

    // Add complex filter if overlay exists
    if (overlayImage) {
      command = command.complexFilter(
        [
          {
            filter: "overlay",
            options: { x: 0, y: 0 },
            inputs: ["0:v", "2:v"],
            outputs: "tmp",
          },
          {
            filter: "scale",
            options: { w: 1920, h: 1080 },
            inputs: "tmp",
            outputs: "out",
          },
        ],
        "out",
      );

      // Set output options with explicit mapping for complex filter
      command = command
        .outputOptions([
          "-map",
          "[out]", // Map the video output from filter
          "-map",
          "1:a", // Map audio from input 1 (audio file)
          "-c:v",
          videoCodec,
          "-preset",
          "medium",
          "-crf",
          "23",
          "-c:a",
          audioCodec,
          "-b:a",
          "192k",
          "-shortest", // Video duration matches audio duration
        ])
        .output(outputPath);
    } else {
      // No overlay - simple video filter and standard mapping
      command = command
        .videoFilter("scale=1920:1080")
        .outputOptions([
          "-c:v",
          videoCodec,
          "-preset",
          "medium",
          "-crf",
          "23",
          "-c:a",
          audioCodec,
          "-b:a",
          "192k",
          "-shortest", // Video duration matches audio duration
        ])
        .output(outputPath);
    }

    // Progress reporting
    command.on("progress", (progress: any) => {
      if (progress.percent) {
        console.log(`   Processing: ${Math.round(progress.percent)}%`);
      }
    });

    // Error handling
    command.on("error", (err: Error) => {
      console.error("FFmpeg error:", err.message);
      reject(err);
    });

    // Success
    command.on("end", () => {
      console.log(`✓ Video created successfully: ${outputPath}`);
      resolve(outputPath);
    });

    // Start processing
    command.run();
  });
}

/**
 * Add chapters to video description
 * Formats chapters according to YouTube requirements
 */
export function formatChapters(chapters: Chapter[]): string {
  if (!chapters || chapters.length < 3) {
    console.warn(
      "⚠ Need at least 3 chapters for YouTube. Chapters won't be added.",
    );
    return "";
  }

  // Ensure first chapter starts at 0:00
  if (chapters[0].timestamp !== "0:00" && chapters[0].timestamp !== "00:00") {
    console.warn("⚠ First chapter must start at 0:00. Adjusting...");
    chapters[0].timestamp = "0:00";
  }

  return (
    "\n\n📑 Chapters:\n" +
    chapters
      .map((chapter) => {
        return `${chapter.timestamp} ${chapter.title}`;
      })
      .join("\n")
  );
}

/**
 * Validate video duration matches chapters
 */
export function validateChapters(
  chapters: Chapter[],
  videoDuration: number,
): boolean {
  if (!chapters || chapters.length === 0) return true;

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const timeSeconds = parseTimestamp(chapter.timestamp);

    // Check if chapter is at least 10 seconds long
    if (i < chapters.length - 1) {
      const nextTimeSeconds = parseTimestamp(chapters[i + 1].timestamp);
      if (nextTimeSeconds - timeSeconds < 10) {
        console.error(`❌ Chapter "${chapter.title}" is less than 10 seconds!`);
        return false;
      }
    } else {
      // Last chapter should be at least 10 seconds from the end
      if (videoDuration - timeSeconds < 10) {
        console.error(
          `❌ Last chapter "${chapter.title}" is less than 10 seconds from end!`,
        );
        return false;
      }
    }
  }

  console.log("✓ Chapters validation passed");
  return true;
}

/**
 * Parse timestamp string to seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

/**
 * Get video info
 */
export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
        });
      }
    });
  });
}

/**
 * Stitch an image and audio into a video (mp4)
 * @param {string} imagePath - Path to the image file
 * @param {string} audioPath - Path to the audio file
 * @param {string} outputPath - Path to save the resulting video
 * @param {Object} [options] - Optional ffmpeg options (e.g., duration)
 * @returns {Promise<string>} Path to the generated video
 */
export async function stitchImageAndAudio(
  imagePath: string,
  audioPath: string,
  outputPath: string,
  options: { duration?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(imagePath)
      .loop(options.duration || 10) // Loop image to match audio duration if not specified
      .addInput(audioPath)
      .outputOptions([
        "-c:v libx264",
        "-c:a aac",
        "-shortest",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .on("end", () => {
        console.log(`✅ Video created at ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err: Error) => {
        console.error("FFmpeg error:", err.message);
        reject(err);
      })
      .save(outputPath);
  });
}
