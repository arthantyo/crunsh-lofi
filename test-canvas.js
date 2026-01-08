import {
  generateThumbnail,
  generateVideoOverlay,
} from "./src/canvasGenerator.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Standalone test script for canvas generator
 * Run with: node test-canvas.js
 */
async function testCanvasGenerator() {
  console.log("🎨 Testing Canvas Generator\n");
  console.log("================================\n");

  // Test 1: Basic thumbnail
  console.log("Test 1: Cheeseburger style");
  try {
    const output1 = path.join(__dirname, "test-output-basic.png");
    await generateThumbnail(
      {
        title: "cheeseburger.",
        subtitle: "crunch!",
      },
      output1
    );
    console.log(`✓ Saved to: ${output1}\n`);
  } catch (error) {
    console.error("❌ Test 1 failed:", error.message, "\n");
  }

  // Test 2: Custom title and subtitle
  console.log("Test 2: Custom title and subtitle");
  try {
    const output2 = path.join(__dirname, "test-output-custom.png");
    await generateThumbnail(
      {
        title: "Late Night Vibes",
        subtitle: "2 Hours of Chill Beats",
      },
      output2
    );
    console.log(`✓ Saved to: ${output2}\n`);
  } catch (error) {
    console.error("❌ Test 2 failed:", error.message, "\n");
  }

  // Test 3: Long text
  console.log("Test 3: Thumbnail with long text");
  try {
    const output3 = path.join(__dirname, "test-output-long.png");
    await generateThumbnail(
      {
        title: "Study Session Mix",
        subtitle: "Focus Music for Deep Work and Productivity",
      },
      output3
    );
    console.log(`✓ Saved to: ${output3}\n`);
  } catch (error) {
    console.error("❌ Test 3 failed:", error.message, "\n");
  }

  // Test 4: Video overlay
  console.log("Test 4: Video overlay text");
  try {
    const output4 = path.join(__dirname, "test-output-overlay.png");
    await generateVideoOverlay("Now Playing: Lofi Beats Radio 24/7", output4);
    console.log(`✓ Saved to: ${output4}\n`);
  } catch (error) {
    console.error("❌ Test 4 failed:", error.message, "\n");
  }

  // Test 5: Minimal data
  console.log("Test 5: Minimal data (defaults)");
  try {
    const output5 = path.join(__dirname, "test-output-minimal.png");
    await generateThumbnail({}, output5);
    console.log(`✓ Saved to: ${output5}\n`);
  } catch (error) {
    console.error("❌ Test 5 failed:", error.message, "\n");
  }

  console.log("================================");
  console.log("✅ Canvas Generator Tests Complete!\n");
  console.log("Check the generated PNG files in the project root directory.");
}

// Run the tests
testCanvasGenerator().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
