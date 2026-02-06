import axios from "axios";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { registerTask } from "./callbackServer.js";

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

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const isServerError =
        error.response?.status >= 500 ||
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT" ||
        error.message.includes("520") ||
        error.message.includes("522");

      if (isLastAttempt || !isServerError) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(
        `⚠ API error (attempt ${i + 1}/${retries}): ${error.message}`,
      );
      console.log(`   Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Poll kie.ai for task completion (used for localhost development)
 * Optimized intervals to reduce API calls:
 * - First 1 min: poll every 5 seconds
 * - After 1 min: poll every 15 seconds
 * - After 3 min: poll every 45 seconds
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
          throw new Error("No audio URL in response");
        }
        return { audioUrl }; // Return in consistent format
      } else if (
        status === "CREATE_TASK_FAILED" ||
        status === "GENERATE_AUDIO_FAILED" ||
        status === "SENSITIVE_WORD_ERROR"
      ) {
        throw new Error(`Task failed: ${errorMessage || status}`);
      }

      // Calculate elapsed time and determine wait interval
      const elapsed = Date.now() - startTime;
      let waitTime;

      if (elapsed < 60 * 1000) {
        // First 1 minute: 5 seconds
        waitTime = 5000;
      } else if (elapsed < 3 * 60 * 1000) {
        // After 1 min to 3 min: 15 seconds
        waitTime = 15000;
      } else {
        // After 3 min: 45 seconds
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
 * Generate lofi audio track using kie.ai Suno API
 * @param {Object} options - Audio generation options
 * @param {string} options.style - Audio style (e.g., 'lofi-chill', 'lofi-jazz')
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.prompt - Additional prompt for audio generation
 * @param {string} options.title - Track title
 * @param {string} outputPath - Where to save the generated audio
 * @returns {Promise<string>} Path to the generated audio file
 */
export async function generateAudio(options, outputPath) {
  console.log("🎵 Generating lofi audio with kie.ai (Suno)...");
  console.log(
    `   Style: ${options.style}, Title: ${options.title || "Untitled"}`,
  );

  try {
    const response = await retryWithBackoff(async () => {
      return await axios.post(
        KIE_AUDIO_ENDPOINT,
        {
          model: "V4",
          callBackUrl: CALLBACK_URL,
          prompt:
            options.prompt ||
            `Relaxing lofi hip hop instrumental with soft beats, ambient sounds, and chill vibes perfect for studying or relaxing`,
          customMode: true,
          instrumental: true, // No vocals for lofi beats
          style: mapLofiStyleToSunoStyle(options.style),
          title: options.title || "Lofi Beats to Chill",
          vocalGender: "m",
          styleWeight: 0.65,
          weirdnessConstraint: 0.65,
          audioWeight: 0.65,
          personaId: "persona_123",
          negativeTags:
            "Heavy Metal, Upbeat Drums, Loud, Aggressive, Fast Tempo, Vocals",
        },
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "axios/1.6.0",
          },
          timeout: 120000, // 2 minutes timeout for audio generation
        },
      );
    });

    // Check response code
    if (response.data.code !== 200) {
      throw new Error(`API error: ${response.data.msg}`);
    }

    // Get task ID from response
    const taskId = response.data.data?.taskId;

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

    // Extract audio URL from result
    const audioUrl =
      result.audioUrl || // From polling (sunoData[0].audioUrl)
      result.url ||
      result.audio_url ||
      result.output?.url; // From callback

    if (!audioUrl) {
      throw new Error("No audio URL in result");
    }

    // Download the generated audio
    console.log("📥 Downloading generated audio...");
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 180000, // 3 minutes for download
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, audioResponse.data);

    console.log(`✓ Audio saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("❌ Error generating audio:", error.message);

    if (error.response) {
      const status = error.response.status;
      console.error(`   API Error (${status}):`, error.response.data);

      if (status >= 500) {
        console.error(
          "   ⚠ Server error - kie.ai service may be temporarily down",
        );
        console.error(
          "   💡 Suggestion: Try again in a few minutes or use a sample audio file",
        );
      } else if (status === 401) {
        console.error("   ⚠ Authentication failed - check KIE_AI_API_KEY");
      } else if (status === 429) {
        console.error("   ⚠ Rate limit exceeded - too many requests");
      }
    } else if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      console.error("   ⚠ Request timeout - server took too long to respond");
    }

    throw new Error(`Failed to generate audio: ${error.message}`);
  }
}

/**
 * Map lofi style names to Suno-compatible styles
 */
function mapLofiStyleToSunoStyle(lofiStyle) {
  const styleMap = {
    "lofi-chill": "Lo-fi Hip Hop",
    "lofi-jazz": "Jazz Lo-fi",
    "lofi-ambient": "Ambient Lo-fi",
    "lofi-upbeat": "Upbeat Lo-fi",
  };

  return styleMap[lofiStyle] || "Lo-fi Hip Hop";
}

/**
 * Generate AI-powered lofi prompt for any food using Gemini
 */
async function generateAIFoodPrompt(foodName) {
  if (!genAI) {
    console.warn(
      "⚠️  Gemini API key not found. Using generic prompt for",
      foodName,
    );
    return `Relaxing lofi hip hop inspired by ${foodName} - smooth beats, warm textures, ambient sounds perfect for studying or relaxing`;
  }

  // Retry logic for handling API overload
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `🤖 Generating AI-powered lofi vibe for "${foodName}"... (attempt ${attempt}/${maxRetries})`,
      );

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });

      const prompt = `You are a creative music producer specializing in chill, lo-fi music across various genres. Generate a detailed music prompt that captures the essence and vibe of different foods.

Your prompts should include:
1. A music genre/style that matches the food (lofi hip hop, lofi jazz, chillhop, lofi house, ambient lofi, jazzhop, study beats, etc.)
2. A unique vibe/mood that matches the food (2-4 adjectives)
3. Specific instruments that evoke the food's character
4. A descriptive atmosphere/mood phrase
5. Tempo description
6. Optional: time of day or weather context
7. Optional: texture elements (vinyl crackle, tape warmth, etc.)

GENRE OPTIONS: lofi hip hop, lofi jazz, chillhop, jazzhop, lofi house, ambient lofi, study beats, downtempo, trip hop lofi, soul lofi, bossa nova lofi, indie lofi

VIBE OPTIONS (mix and match): upbeat, satisfying, groovy, comforting, funky, bold, soulful, vibrant, spicy, festive, lively, smooth, elegant, romantic, cozy, sophisticated, rustic, casual, fun, easygoing, clean, minimalist, zen, peaceful, refined, delicate, warm, steamy, intimate, mellow, aromatic, intellectual, contemplative, sweet, dreamy, whimsical, playful, smoky, grounded, hearty, laid-back

INSTRUMENT OPTIONS: warm bass, crispy hi-hats, juicy synth chords, funky guitar licks, vintage drum breaks, smooth rhodes, punchy drums, rich synth pads, latin percussion, acoustic guitar, congas, brass stabs, nylon guitar, bongo rhythms, soft piano, gentle strings, classical guitar, accordion, grand piano, cello, mandolin, laid-back drums, mellow rhodes, upright bass, jazzy guitar, cozy organ, vintage electric piano, koto samples, ambient pads, shakuhachi flute, minimal beats, Japanese bells, water sounds, bamboo chimes, bubbling textures, rain sounds, jazzy piano, brushed drums, saxophone, sparkly bells, music box melodies, chimes, glockenspiel, dreamy piano, guitar licks, deep bass, shuffled drums, slide guitar, harmonica, blues-inspired keys

MOOD OPTIONS: comfort food energy, late-night diner vibes, street food soul, casual hangout atmosphere, festive and flavorful, taco truck vibes, neighborhood energy, fiesta atmosphere, Italian trattoria ambiance, Roman evening atmosphere, Tuscan countryside vibes, neighborhood pizzeria vibes, family restaurant warmth, Japanese aesthetic, omakase experience, Tokyo sushi bar atmosphere, zen garden ambiance, late-night noodle shop atmosphere, rainy evening ramen bar, cafe ambiance, morning coffee shop vibes, European cafe atmosphere, bookstore cafe warmth, sugary sweet, patisserie charm, candy shop magic, bakery warmth, backyard cookout soul, summer barbecue vibes, southern porch atmosphere

TEMPO OPTIONS: medium tempo with head-nodding beats, upbeat groove, mid-tempo with bouncy feel, mid-tempo with latin grooves, upbeat rhythm, relaxed tempo with flowing melodies, slow waltz tempo, gentle rhythm, moderate tempo with relaxed grooves, easy-going pace, slow to medium tempo with meditative flow, unhurried pace, peaceful tempo, slow groove with comforting ambiance, relaxed tempo with soothing rhythm, relaxed jazz-influenced tempo, easy morning pace, contemplative rhythm, slow tempo with dreamy atmosphere, gentle pace, medium swing tempo

TEXTURE OPTIONS: vinyl crackle, ambient room tone, subtle field recordings, tape warmth, nostalgic touches

TIME/WEATHER OPTIONS: morning vibes, afternoon vibes, evening vibes, late-night vibes, golden hour, rainy day, sunny afternoon, cloudy sky, misty morning, starlit night

Examples of prompts for different foods:
- Burger: "upbeat and satisfying lofi hip hop inspired by burger. Features warm bass, crispy hi-hats, juicy synth chords with vinyl crackle. Captures late-night diner vibes with nostalgic warmth. Medium tempo with head-nodding beats. Perfect for rainy day."
- Taco: "vibrant and spicy chillhop inspired by taco. Features latin-inspired percussion, warm guitar tones, playful melodies. Captures festive and flavorful street food charm. Mid-tempo with latin-tinged grooves. Evokes evening vibes."
- Pasta: "smooth and elegant lofi jazz inspired by pasta. Features soft piano, gentle strings, warm vinyl crackle. Captures Italian trattoria ambiance with sophisticated warmth. Relaxed tempo with flowing melodies."
- Sushi: "clean and minimalist ambient lofi inspired by sushi. Features subtle koto samples, ambient pads, precise percussion. Captures zen garden ambiance with contemplative grace. Slow to medium tempo with meditative flow."
- Ramen: "warm and comforting jazzhop inspired by ramen. Features bubbling textures, cozy rhodes, soft rain sounds. Captures late-night noodle shop atmosphere with soulful warmth. Slow groove with comforting ambiance."
- Coffee: "smooth and sophisticated lofi jazz inspired by coffee. Features jazzy piano, brushed drums, warm bass with tape warmth. Captures cafe ambiance with intellectual charm. Relaxed jazz-influenced tempo. Perfect for misty morning."

Always end with: "Chill, instrumental, perfect for studying or relaxing."

Generate a unique and creative lofi music prompt for: ${foodName}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiPrompt = response.text().trim();

      console.log(`✓ AI generated prompt for ${foodName}`);
      return aiPrompt;
    } catch (error) {
      lastError = error;
      const isOverloaded =
        error.message.includes("503") || error.message.includes("overloaded");
      const isRateLimited =
        error.message.includes("429") || error.message.includes("quota");

      if (attempt < maxRetries && (isOverloaded || isRateLimited)) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(
          `⚠️  API error (attempt ${attempt}/${maxRetries}): ${
            error.message.split("\n")[0]
          }`,
        );
        console.log(`   Retrying in ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // If it's the last attempt or a different error, break and use fallback
      console.error("Error generating AI prompt:", error.message);
      break;
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
export async function generateFoodThemePrompt(title) {
  return await generateAIFoodPrompt(title);
}
/**
 * Generate audio from content plan
 */
export async function generateAudioFromPlan(contentPlan, outputPath) {
  // Generate food-themed prompt based on title (may use AI for unknown foods)
  const foodPrompt = await generateFoodThemePrompt(contentPlan.title);

  const audioOptions = {
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
export async function validateAudioFile(filePath) {
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
    console.error("Audio validation failed:", error.message);
    return false;
  }
}
