import { generateFoodThemePrompt } from "./src/audioGenerator.js";

/**
 * Standalone test script for AI prompt generation
 * Run with: node test-prompt.js
 *
 * Prerequisites:
 * - Ensure GEMINI_API_KEY is set in the .env file
 */

async function runTestPrompts() {
  console.log("🤖 Testing AI Prompt Generation\n");
  console.log("================================\n");

  // Test different food titles
  const testTitles = ["Banana Cake"];

  for (const title of testTitles) {
    console.log(`\n📝 Title: "${title}"`);
    console.log("-".repeat(60));

    try {
      const prompt = await generateFoodThemePrompt(title);
      console.log(`✓ Generated Prompt:\n${prompt}\n`);

      // Wait 3 seconds between requests to avoid rate limits
      if (testTitles.indexOf(title) < testTitles.length - 1) {
        console.log("⏳ Waiting 3 seconds before next request...\n");
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`❌ Failed to generate prompt: ${error.message}\n`);
    }
  }

  console.log("================================");
  console.log("✅ Prompt Generation Tests Complete!\n");
}

// Run the test
runTestPrompts().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
