import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Combine audio with background video using FFmpeg
 * @param {Object} options - Video generation options
 * @param {string} options.audioPath - Path to audio file
 * @param {string} options.backgroundVideo - Path to background video (optional)
 * @param {string} options.overlayImage - Path to overlay image (optional)
 * @param {number} options.duration - Duration in seconds
 * @param {string} outputPath - Where to save the final video
 * @returns {Promise<string>} Path to the generated video
 */
export async function createVideo(options, outputPath) {
  console.log("🎬 Creating video with FFmpeg...");

  const {
    audioPath,
    backgroundVideo = process.env.DEFAULT_VIDEO_BACKGROUND,
    overlayImage,
    duration,
  } = options;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add background video
    if (backgroundVideo) {
      console.log("   Using background video:", backgroundVideo);
      command = command.input(backgroundVideo);

      // Loop the background video if needed
      command = command.inputOptions([
        "-stream_loop",
        "-1", // Loop indefinitely
      ]);
    } else {
      // Create a solid color background if no video provided
      console.log("   Creating solid background");
      command = command
        .input("color=c=0x3d2a44:s=1920x1080:d=" + duration)
        .inputFormat("lavfi");
    }

    // Add audio
    command = command.input(audioPath);

    // Add overlay if provided
    if (overlayImage) {
      console.log("   Adding overlay image");
      command = command.input(overlayImage);
    }

    // Set output options
    command = command
      .outputOptions([
        "-c:v libx264",
        "-preset medium",
        "-crf 23",
        "-c:a aac",
        "-b:a 192k",
        "-shortest", // Stop when shortest input ends
        "-t " + duration, // Set duration
      ])
      .output(outputPath);

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
        "out"
      );
    } else {
      command = command.videoFilter("scale=1920:1080");
    }

    // Progress reporting
    command.on("progress", (progress) => {
      if (progress.percent) {
        console.log(`   Processing: ${Math.round(progress.percent)}%`);
      }
    });

    // Error handling
    command.on("error", (err) => {
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
export function formatChapters(chapters) {
  if (!chapters || chapters.length < 3) {
    console.warn(
      "⚠ Need at least 3 chapters for YouTube. Chapters won't be added."
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
export function validateChapters(chapters, videoDuration) {
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
          `❌ Last chapter "${chapter.title}" is less than 10 seconds from end!`
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
function parseTimestamp(timestamp) {
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
export async function getVideoInfo(videoPath) {
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
