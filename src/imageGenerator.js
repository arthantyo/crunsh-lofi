import axios from "axios";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { registerTask } from "./callbackServer.js";

dotenv.config();

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_ENDPOINT = "https://api.kie.ai/api/v1/jobs/createTask";
const CALLBACK_URL =
  process.env.CALLBACK_URL || "http://localhost:3000/api/callback";
const IS_LOCALHOST =
  CALLBACK_URL.includes("localhost") || CALLBACK_URL.includes("127.0.0.1");

/**
 * Poll kie.ai for task completion (used for localhost development)
 * Follows best practices:
 * - First 30s: poll every 2-3 seconds
 * - After 30s: poll every 5-10 seconds
 * - After 2 min: poll every 15-30 seconds
 * - Max duration: 15 minutes
 */
async function pollForCompletion(taskId) {
  console.log("⏳ Polling for completion (localhost mode)...");

  const startTime = Date.now();
  const maxDuration = 15 * 60 * 1000; // 15 minutes
  let attempt = 0;

  while (Date.now() - startTime < maxDuration) {
    attempt++;

    try {
      const response = await axios.get(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
          },
        }
      );

      if (response.data.code !== 200) {
        throw new Error(`API error: ${response.data.message}`);
      }

      const { state, resultJson, failCode, failMsg } = response.data.data;

      if (state === "success") {
        // Parse resultJson to get the URLs
        const result = JSON.parse(resultJson);
        return result; // Return the parsed result
      } else if (state === "fail") {
        throw new Error(`Task failed: ${failMsg} (${failCode})`);
      }

      // Calculate elapsed time and determine wait interval
      const elapsed = Date.now() - startTime;
      let waitTime;

      if (elapsed < 30 * 1000) {
        // First 30 seconds: 2-3 seconds
        waitTime = 2500;
      } else if (elapsed < 2 * 60 * 1000) {
        // After 30s to 2 min: 5-10 seconds
        waitTime = 7500;
      } else {
        // After 2 min: 15-30 seconds
        waitTime = 20000;
      }

      console.log(
        `   Attempt ${attempt}: ${state}... (next check in ${waitTime / 1000}s)`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      if (
        error.message.startsWith("Task failed") ||
        error.message.startsWith("API error")
      ) {
        throw error;
      }
      console.log(`   Polling attempt ${attempt} failed, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error("Task timed out after 15 minutes");
}

/**
 * Generate image using kie.ai API
 * @param {string} prompt - The image generation prompt
 * @param {string} outputPath - Where to save the generated image
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Path to the generated image
 */
export async function generateImage(prompt, outputPath, options = {}) {
  console.log("🎨 Generating image with kie.ai...");

  try {
    const response = await axios.post(
      KIE_ENDPOINT,
      {
        model: "gpt-image/1.5-text-to-image",
        callBackUrl: CALLBACK_URL,
        input: {
          prompt: prompt,
          aspect_ratio: options.size || "1:1",
          quality: options.quality || "medium",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Get task ID from response
    const taskId =
      response.data.taskId ||
      response.data.task_id ||
      response.data.data?.taskId;

    if (!taskId) {
      throw new Error("No task ID returned from kie.ai API");
    }

    console.log(`⏳ Task created: ${taskId}`);

    // Use polling for localhost, callbacks for production
    let result;
    if (IS_LOCALHOST) {
      result = await pollForCompletion(taskId);
    } else {
      console.log("   Waiting for callback...");
      result = await registerTask(taskId);
    }

    // Extract image URL from result
    const imageUrl =
      result.resultUrls?.[0] || // From polling
      result.url ||
      result.imageUrl ||
      result.image_url ||
      result.output?.url; // From callback

    if (!imageUrl) {
      throw new Error("No image URL in callback result");
    }

    // Download the generated image
    console.log("📥 Downloading generated image...");
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, imageResponse.data);

    console.log(`✓ Image saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Error generating image:", error.message);
    if (error.response) {
      console.error("API Error:", error.response.data);
    }

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
 * Generate object image for thumbnail using kie.ai
 * This generates just the object (burger, cat, etc.) that will be composited on the canvas
 */
export async function generateObjectImage(contentPlan, outputPath) {
  console.log("🎨 Generating object image with kie.ai...");

  const prompt =
    contentPlan.imagePrompt ||
    `A single ${
      contentPlan.title || "object"
    }, isolated on transparent background, lofi aesthetic style, clean, minimalist, centered composition, 1024x1024`;

  try {
    return await generateImage(prompt, outputPath, {
      size: "1:1", // Square aspect ratio for objects
      isEnhance: true, // Enhance quality
    });
  } catch (error) {
    console.log("⚠ AI image generation failed, will use default sample object");
    return null; // Will fall back to default sample object
  }
}

/**
 * Generate complete thumbnail using Canvas API
 * Optionally uses AI-generated object image
 */
export async function generateThumbnail(contentPlan, thumbnailPath) {
  console.log("🖼️ Generating YouTube thumbnail...");

  // First, try to generate the object image with AI
  const timestamp = Date.now();
  const objectPath = path.join(
    path.dirname(thumbnailPath),
    `object_${timestamp}.png`
  );

  const generatedObjectPath = await generateObjectImage(
    contentPlan,
    objectPath
  );

  // Use canvas generator to create the final thumbnail
  const { generateThumbnail: createThumbnail } = await import(
    "./canvasGenerator.js"
  );

  await createThumbnail(
    {
      title: contentPlan.title,
      subtitle: contentPlan.subtitle || "chill!",
      sampleObject: generatedObjectPath || undefined, // Will use default if null
    },
    thumbnailPath
  );

  // Return both the thumbnail and the object image path
  return {
    thumbnailPath,
    objectImagePath: generatedObjectPath,
  };
}
