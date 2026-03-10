import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ThumbnailOptions {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  sampleObject?: string;
}

// Register custom fonts (optional - will use fallbacks if not found)
try {
  // Try to register Instrument Serif and Plus Jakarta Sans if font files exist
  // When built: __dirname = dist/src/, so "../.." goes to project root
  const fontsDir = path.join(__dirname, "..", "..", "fonts");

  console.log(`📝 Attempting to load fonts from: ${fontsDir}`);

  // Attempt to load fonts if they exist
  try {
    const instrumentSerifPath = path.join(
      fontsDir,
      "InstrumentSerif-Regular.ttf",
    );
    console.log(`  Trying: ${instrumentSerifPath}`);
    GlobalFonts.registerFromPath(instrumentSerifPath, "Instrument Serif");
    console.log("✓ Instrument Serif loaded");
  } catch (e) {
    console.log(`⚠ Instrument Serif not loaded: ${(e as Error).message}`);
  }

  try {
    const plusJakartaPath = path.join(
      fontsDir,
      "PlusJakartaSans-ExtraBold.ttf",
    );
    console.log(`  Trying: ${plusJakartaPath}`);
    GlobalFonts.registerFromPath(plusJakartaPath, "Plus Jakarta Sans");
    console.log("✓ Plus Jakarta Sans loaded");
  } catch (e) {
    console.log(`⚠ Plus Jakarta Sans not loaded: ${(e as Error).message}`);
  }
} catch (e) {
  console.log("Custom fonts not available, using system fallbacks");
}

/**
 * Generate thumbnail using Canvas API
 * @param {Object} options - Thumbnail options
 * @param {string} options.title - Main title text
 * @param {string} options.subtitle - Subtitle text
 * @param {string} options.backgroundImage - Optional background image path
 * @param {string} outputPath - Where to save the thumbnail
 * @returns {Promise<string>} Path to the generated thumbnail
 */
export async function generateThumbnail(
  options: ThumbnailOptions,
  outputPath: string,
): Promise<string> {
  console.log("🎨 Generating thumbnail with Canvas API...");

  const width = 1920;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  if (options.backgroundImage) {
    try {
      const bgImage = await loadImage(options.backgroundImage);
      ctx.drawImage(bgImage, 0, 0, width, height);

      // Add overlay for better text readability
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      console.log("Background image not found, using gradient");
      drawBackground(ctx, width, height);
    }
  } else {
    drawBackground(ctx, width, height);
  }

  // Add frame grain overlay in the center
  let frameGrainX = 0;
  let frameGrainY = 0;
  let frameGrainWidth = width;
  let frameGrainHeight = height;

  try {
    const frameGrainPath = path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "frame-grain.png",
    );

    const frameGrain = await loadImage(frameGrainPath);

    // Center the frame grain image
    frameGrainX = (width - frameGrain.width) / 2;
    frameGrainY = (height - frameGrain.height) / 2;
    frameGrainWidth = frameGrain.width;
    frameGrainHeight = frameGrain.height;

    ctx.drawImage(frameGrain, frameGrainX, frameGrainY);
  } catch (error) {
    console.log(error);
    console.log("Frame grain image not found, skipping overlay");
  }

  // Add decorative elements
  // drawLofiElements(ctx, width, height);

  // Main Title - Large centered text with Instrument Serif
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "180px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 15;

  const titleText = options.title || "lofi beats";
  ctx.fillText(titleText.toLowerCase(), width / 2, height / 2 - 250);

  // Add sample object image below title with lighten blend mode
  try {
    const sampleObjectPath =
      options.sampleObject ||
      path.join(__dirname, "..", "assets", "sample-objects", "burger.png");
    const sampleObject = await loadImage(sampleObjectPath);

    // Apply lighten blend mode for better integration
    ctx.globalCompositeOperation = "lighten";

    // Scale down the image (50% of original size)
    const scale = 1.3;
    const scaledWidth = sampleObject.width * scale;
    const scaledHeight = sampleObject.height * scale;

    // Position below the title, centered
    const objectX = (width - scaledWidth) / 2;
    const objectY = height / 2 - 500; // Below the title
    ctx.drawImage(sampleObject, objectX, objectY, scaledWidth, scaledHeight);

    // Reset composite operation
    ctx.globalCompositeOperation = "source-over";
  } catch (error) {
    console.log("Sample object image not found, skipping");
  }

  // Subtitle - Bottom right of the frame grain with Plus Jakarta Sans Extra Bold
  ctx.shadowBlur = 0;
  ctx.font = "900 48px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "right";
  const subtitleText = "crunsh.";

  // Position at bottom right of frame grain
  const subtitleX = frameGrainX + frameGrainWidth - 20;
  const subtitleY = frameGrainY + frameGrainHeight - 20;
  ctx.fillText(subtitleText.toLowerCase(), subtitleX, subtitleY);

  // Save to file
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(outputPath, buffer);

  console.log(`✓ Thumbnail saved to ${outputPath}`);
  return outputPath;
}

/**
 * Draw a gradient background
 */
function drawBackground(ctx: any, width: number, height: number): void {
  ctx.fillStyle = "#F7E1A4";
  ctx.fillRect(0, 0, width, height);
}

/**
 * Create a simple overlay image for video
 */
export async function generateVideoOverlay(
  text: string,
  outputPath: string,
): Promise<string> {
  const width = 1920;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Semi-transparent overlay at bottom
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, height - 150, width, 150);

  // Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height - 80);

  const buffer = canvas.toBuffer("image/png");
  await fs.writeFile(outputPath, buffer);

  return outputPath;
}
