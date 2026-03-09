import dotenv from "dotenv";
import axios, { AxiosError } from "axios";
import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_AUDIO_ENDPOINT = "https://api.kie.ai/api/v1/generate";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const CALLBACK_URL =
  process.env.CALLBACK_URL || "http://localhost:3000/api/callback";
const IS_LOCALHOST =
  CALLBACK_URL.includes("localhost") || CALLBACK_URL.includes("127.0.0.1");

// Initialize Gemini for dynamic prompt generation
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

interface AudioOptions {
  style: string;
  duration: number;
  prompt: string;
  title: string;
}

interface PollResponse {
  audioUrl?: string;
  url?: string;
  audio_url?: string;
  output?: {
    url: string;
  };
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const axiosError = error as AxiosError;
      const isLastAttempt = i === retries - 1;
      const isServerError =
        (axiosError.response?.status ?? 0) >= 500 ||
        (axiosError as any).code === "ECONNABORTED" ||
        (axiosError as any).code === "ETIMEDOUT" ||
        (error as any).message.includes("520") ||
        (error as any).message.includes("522");

      if (isLastAttempt || !isServerError) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(
        `⚠ API error (attempt ${i + 1}/${retries}): ${
          (error as Error).message
        }`,
      );
      console.log(`   Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Poll kie.ai for task completion (used for localhost development)
 * Optimized intervals to reduce API calls:
 * - First 1 min: poll every 5 seconds
 * - After 1 min: poll every 15 seconds
 * - After 3 min: poll every 45 seconds
 * - Max duration: 15 minutes
 */
async function pollForCompletion(taskId: string): Promise<PollResponse> {
  console.log("⏳ Polling for completion (localhost mode)...");

  const startTime = Date.now();
  const maxDuration = 15 * 60 * 1000; // 15 minutes
  let attempt = 0;

  while (Date.now() - startTime < maxDuration) {
    attempt++;

    try {
      const response = await axios.get(
        `https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            Accept: "application/json",
            "User-Agent": "axios/1.6.0",
          },
        },
      );

      if (response.data.code !== 200) {
        throw new Error(`API error: ${response.data.msg}`);
      }

      const {
        status,
        response: responseData,
        errorMessage,
      } = response.data.data;

      if (status === "SUCCESS") {
        // Extract audio URL from sunoData array
        const audioUrl = responseData?.sunoData?.[0]?.audioUrl;
        if (!audioUrl) {
          throw new Error("No audio URL in successful response");
        }
        return { audioUrl }; // Return in consistent format
      } else if (
        status === "CREATE_TASK_FAILED" ||
        status === "GENERATE_AUDIO_FAILED" ||
        status === "SENSITIVE_WORD_ERROR"
      ) {
        throw new Error(`Task failed: ${status} - ${errorMessage}`);
      }

      // Calculate elapsed time and determine wait interval
      const elapsed = Date.now() - startTime;
      let waitTime;

      if (elapsed < 60 * 1000) {
        // First 1 minute: 5 seconds
        waitTime = 5000;
      } else if (elapsed < 3 * 60 * 1000) {
        // 1-3 minutes: 15 seconds
        waitTime = 15000;
      } else {
        // After 3 minutes: 45 seconds
        waitTime = 45000;
      }

      console.log(
        `   Attempt ${attempt}: ${status}... (next check in ${
          waitTime / 1000
        }s)`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      if (
        (error as Error).message.startsWith("Task failed") ||
        (error as Error).message.startsWith("API error")
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
 * Generate lofi audio track using kie.ai Suno API
 * @param {Object} options - Audio generation options
 * @param {string} options.style - Audio style (e.g., 'lofi-chill', 'lofi-jazz')
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.prompt - Additional prompt for audio generation
 * @param {string} options.title - Track title
 * @param {string} outputPath - Where to save the generated audio
 * @returns {Promise<string>} Path to the generated audio file
 */
export async function generateAudio(
  options: AudioOptions,
  outputPath: string,
): Promise<string> {
  console.log("🎵 Generating lofi audio with kie.ai (Suno)...");
  console.log(
    `   Style: ${options.style}, Title: ${options.title || "Untitled"}`,
  );

  try {
    const response = await retryWithBackoff(async () => {
      const payload = {
        customMode: true,
        instrumental: true,
        model: "V5",
        title: options.title,
        prompt: options.prompt,
        style: options.style,
        duration: options.duration,
        callBackUrl: CALLBACK_URL,
      };

      console.log("   Sending request to kie.ai...");

      return await axios.post(KIE_AUDIO_ENDPOINT, payload, {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
    });

    // Check response code
    if (response.data.code !== 200) {
      throw new Error(
        `API returned error code: ${response.data.code} - ${response.data.msg}`,
      );
    }

    // Get task ID from response
    const taskId = response.data.data?.taskId;

    if (!taskId) {
      throw new Error("No taskId returned from API");
    }

    console.log(`⏳ Task created: ${taskId}`);

    // Use polling for localhost, callbacks for production
    let result;
    if (IS_LOCALHOST) {
      result = await pollForCompletion(taskId);
    } else {
      const { registerTask } = await import("./callbackServer.js");
      result = await registerTask(taskId);
    }

    // Extract audio URL from result
    const audioUrl =
      result.audioUrl || result.url || result.audio_url || result.output?.url; // From callback

    if (!audioUrl) {
      throw new Error("No audio URL found in result");
    }

    // Download the generated audio
    console.log("📥 Downloading generated audio...");
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 180000,
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, audioResponse.data);

    console.log(`✓ Audio saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("❌ Error generating audio:", (error as Error).message);

    if ((error as AxiosError).response) {
      const axiosError = error as AxiosError;
      console.error("API Response Status:", axiosError.response?.status);
      console.error("API Response Data:", axiosError.response?.data);
    } else {
      console.error("Error details:", (error as Error).stack);
    }

    throw new Error(`Failed to generate audio: ${(error as Error).message}`);
  }
}

/**
 * Generate AI-powered lofi prompt for any food using Gemini
 */
async function generateAIFoodPrompt(foodName: string): Promise<string> {
  if (!genAI) {
    console.warn(
      "⚠️  Gemini API key not found. Using generic prompt for",
      foodName,
    );
    return `Relaxing lofi hip hop inspired by ${foodName} - smooth beats, warm textures, ambient sounds perfect for studying or relaxing`;
  }

  // Retry logic for handling API overload
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `Generate a creative and engaging lofi hip hop description/prompt for a track inspiration by: "${foodName}".
            The description should capture the vibe, mood, and feeling of that food in a lofi music context.
            Keep it concise (1-2 sentences) and evocative. Focus on sensory details and atmosphere.`;

      const result = await model.generateContent(prompt);
      const generatedPrompt =
        result.response.text().trim() ||
        `Relaxing lofi hip hop inspired by ${foodName}`;

      console.log(`   Generated prompt for "${foodName}": ${generatedPrompt}`);
      return generatedPrompt;
    } catch (error) {
      const isRateLimitError =
        (error as any).status === 429 ||
        (error as any).message?.includes("429") ||
        (error as any).message?.includes("rate");

      if (isRateLimitError && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `⚠️  Rate limited. Waiting ${waitTime / 1000}s before retry...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else if (attempt === maxRetries) {
        console.warn(
          `⚠️  Failed to generate prompt after ${maxRetries} attempts: ${
            (error as Error).message
          }`,
        );
      } else {
        console.warn(
          `⚠️  Attempt ${attempt} failed: ${(error as Error).message}`,
        );
      }
    }
  }

  // Fallback to generic prompt after all retries
  console.warn(`⚠️  Using fallback prompt for ${foodName}`);
  return `Relaxing lofi hip hop inspired by ${foodName} - smooth beats, warm textures, ambient sounds perfect for studying or relaxing`;
}

/**
 * Generate food-themed lofi prompt based on the topic
 * Always uses AI to generate unique prompts for any food
 */
export async function generateFoodThemePrompt(title: string): Promise<string> {
  return await generateAIFoodPrompt(title);
}

/**
 * Generate audio from content plan
 */
export async function generateAudioFromPlan(
  contentPlan: any,
  outputPath: string,
): Promise<string> {
  // Generate food-themed prompt based on title (may use AI for unknown foods)
  const foodPrompt = await generateFoodThemePrompt(contentPlan.title);

  const audioOptions: AudioOptions = {
    style: contentPlan.audioStyle || "lofi-chill",
    duration: contentPlan.duration || 3600,
    title: contentPlan.title || "Lofi Beats to Chill",
    prompt: contentPlan.audioPrompt || foodPrompt,
  };

  return await generateAudio(audioOptions, outputPath);
}

/**
 * Validate audio file
 */
export async function validateAudioFile(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error("Audio file is empty");
    }
    console.log(
      `✓ Audio file validated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    );
    return true;
  } catch (error) {
    console.error("Audio validation failed:", (error as Error).message);
    return false;
  }
}
