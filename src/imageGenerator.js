import axios from "axios";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_ENDPOINT = process.env.KIE_AI_ENDPOINT || "https://api.kie.ai/v1";

/**
 * Generate image using kie.ai API
 * @param {string} prompt - The image generation prompt
 * @param {string} outputPath - Where to save the generated image
 * @returns {Promise<string>} Path to the generated image
 */
export async function generateImage(prompt, outputPath) {
  console.log("🎨 Generating image with kie.ai...");

  try {
    const response = await axios.post(
      `${KIE_ENDPOINT}/images/generate`,
      {
        prompt: prompt,
        size: "1280x720", // YouTube thumbnail size
        quality: "high",
        style: "lofi-aesthetic",
      },
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Download the generated image
    const imageUrl = response.data.url || response.data.image_url;

    if (!imageUrl) {
      throw new Error("No image URL returned from kie.ai API");
    }

    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, imageResponse.data);

    console.log(`✓ Image saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Error generating image:", error.message);

    // Fallback: create placeholder with message
    console.log("⚠ Using fallback image generation");
    return await createFallbackImage(outputPath, prompt);
  }
}

/**
 * Fallback image creation if API fails
 */
async function createFallbackImage(outputPath, prompt) {
  // This will be handled by the Canvas API module
  const { generateThumbnail } = await import("./canvasGenerator.js");
  return await generateThumbnail(
    { title: "Lofi Beats", subtitle: prompt.substring(0, 50) },
    outputPath
  );
}

/**
 * Generate thumbnail specifically optimized for YouTube
 */
export async function generateThumbnail(contentPlan, outputPath) {
  console.log("🖼️ Generating YouTube thumbnail...");

  const prompt =
    contentPlan.imagePrompt ||
    `Lofi aesthetic thumbnail for "${contentPlan.title}", cozy study vibes, pastel colors, minimalist design`;

  return await generateImage(prompt, outputPath);
}
