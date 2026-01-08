import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom fonts (optional - will use fallbacks if not found)
try {
  // Try to register Instrument Serif and Plus Jakarta Sans if font files exist
  const fontsDir = path.join(__dirname, "..", "fonts");

  // Attempt to load fonts if they exist
  try {
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "InstrumentSerif-Regular.ttf"),
      "Instrument Serif"
    );
  } catch (e) {
    console.log("Instrument Serif font not found, using serif fallback");
  }

  try {
    GlobalFonts.registerFromPath(
      path.join(fontsDir, "PlusJakartaSans-ExtraBold.ttf"),
      "Plus Jakarta Sans"
    );
  } catch (e) {
    console.log("Plus Jakarta Sans font not found, using sans-serif fallback");
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
export async function generateThumbnail(options, outputPath) {
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
      "assets",
      "frame-grain.png"
    );
    const frameGrain = await loadImage(frameGrainPath);

    // Center the frame grain image
    frameGrainX = (width - frameGrain.width) / 2;
    frameGrainY = (height - frameGrain.height) / 2;
    frameGrainWidth = frameGrain.width;
    frameGrainHeight = frameGrain.height;

    ctx.drawImage(frameGrain, frameGrainX, frameGrainY);
  } catch (error) {
    console.log("Frame grain image not found, skipping overlay");
  }

  // Add decorative elements
  drawLofiElements(ctx, width, height);

  // Main Title - Large centered text with Instrument Serif
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "180px 'Instrument Serif', 'Georgia', serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 15;

  const titleText = options.title || "lofi beats";
  ctx.fillText(titleText.toLowerCase(), width / 2, height / 2 - 250);

  // Subtitle - Bottom right of the frame grain with Plus Jakarta Sans Extra Bold
  ctx.shadowBlur = 0;
  ctx.font = "900 48px 'Plus Jakarta Sans', 'Arial Black', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "right";
  const subtitleText = options.subtitle || "chill!";

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
function drawBackground(ctx, width, height) {
  ctx.fillStyle = "#F7E1A4";
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw decorative lofi-style elements
 */
function drawLofiElements(ctx, width, height) {
  // Vinyl record
  //   ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  //   ctx.beginPath();
  //   ctx.arc(150, 150, 80, 0, Math.PI * 2);
  //   ctx.fill();

  //   ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  //   ctx.beginPath();
  //   ctx.arc(150, 150, 30, 0, Math.PI * 2);
  //   ctx.fill();

  // Music notes
  ctx.font = "48px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillText("♪", width - 150, 150);
  ctx.fillText("♫", width - 100, 200);

  // Bottom accent line
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(0, height - 10, width, 10);
}

/**
 * Create a simple overlay image for video
 */
export async function generateVideoOverlay(text, outputPath) {
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
