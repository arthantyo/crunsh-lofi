import axios from "axios";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { registerTask } from "./callbackServer.js";

dotenv.config();

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_AUDIO_ENDPOINT = "https://api.kie.ai/api/v1/generate";
const CALLBACK_URL =
  process.env.CALLBACK_URL || "http://localhost:3000/api/callback";
const IS_LOCALHOST =
  CALLBACK_URL.includes("localhost") || CALLBACK_URL.includes("127.0.0.1");

// Initialize OpenAI for dynamic prompt generation
const openai = process.env.GITHUB_TOKEN
  ? new OpenAI({ apiKey: process.env.GITHUB_TOKEN })
  : null;

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
          },
        }
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
        }s)`
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
    `   Style: ${options.style}, Title: ${options.title || "Untitled"}`
  );

  try {
    const response = await axios.post(
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
        },
        timeout: 120000, // 2 minutes timeout for audio generation
      }
    );

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
    console.error("Error generating audio:", error.message);

    if (error.response) {
      console.error("API Error:", error.response.data);
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
 * Generate AI-powered lofi prompt for any food using predefined patterns
 */
async function generateAIFoodPrompt(foodName) {
  if (!openai) {
    console.warn(
      "⚠️  OpenAI API key not found. Using generic prompt for",
      foodName
    );
    return `Relaxing lofi hip hop inspired by ${foodName} - smooth beats, warm textures, ambient sounds perfect for studying or relaxing`;
  }

  try {
    console.log(`🤖 Generating AI-powered lofi vibe for "${foodName}"...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a creative music producer specializing in lofi hip hop. Generate a detailed lofi music prompt that captures the essence and vibe of different foods. 

Your prompts should include:
1. A unique vibe/mood that matches the food (2-4 adjectives)
2. Specific instruments that evoke the food's character
3. A descriptive atmosphere/mood phrase
4. Tempo description
5. Optional: time of day or weather context
6. Optional: texture elements (vinyl crackle, tape warmth, etc.)

Examples of good prompts:
- "upbeat and satisfying lofi hip hop inspired by burger. Features warm bass, crispy hi-hats, juicy synth chords with vinyl crackle. Captures late-night diner vibes with nostalgic warmth. Medium tempo with head-nodding beats. Perfect for rainy day."
- "clean and minimalist lofi hip hop inspired by sushi. Features subtle koto samples, ambient pads, precise percussion. Captures zen garden ambiance with contemplative grace. Slow to medium tempo with meditative flow."
- "smooth and elegant lofi hip hop inspired by pasta. Features soft piano, gentle strings, warm vinyl crackle. Captures Italian trattoria ambiance with sophisticated warmth. Relaxed tempo with flowing melodies. Evokes evening vibes."

Always end with: "Chill, instrumental, perfect for studying or relaxing."`,
        },
        {
          role: "user",
          content: `Generate a unique lofi hip hop prompt for: ${foodName}`,
        },
      ],
      temperature: 0.9, // High creativity for variation
      max_tokens: 150,
    });

    const aiPrompt = completion.choices[0].message.content.trim();
    console.log(`✓ AI generated prompt for ${foodName}`);
    return aiPrompt;
  } catch (error) {
    console.error("Error generating AI prompt:", error.message);
    // Fallback to generic prompt
    return `Relaxing lofi hip hop inspired by ${foodName} - smooth beats, warm textures, ambient sounds perfect for studying or relaxing`;
  }
}

/**
 * Generate food-themed lofi prompt based on the topic
 * Creates unique vibes for different foods with variations each time
 * Uses AI for foods not in the predefined list
 */
async function generateFoodThemePrompt(title) {
  const titleLower = title.toLowerCase();

  // Define food-specific vibes and characteristics with multiple variations
  const foodThemes = {
    burger: {
      vibes: [
        "upbeat and satisfying",
        "groovy and comforting",
        "funky and bold",
        "soulful and juicy",
      ],
      instruments: [
        "warm bass, crispy hi-hats, juicy synth chords",
        "funky guitar licks, thick bass, vintage drum breaks",
        "smooth rhodes, punchy drums, rich synth pads",
        "groovy bassline, snappy snares, retro organ",
      ],
      moods: [
        "comfort food energy with smooth rhythms",
        "late-night diner vibes with nostalgic warmth",
        "street food soul with urban flavor",
        "casual hangout atmosphere with satisfying grooves",
      ],
      tempos: [
        "medium tempo with head-nodding beats",
        "upbeat groove with steady rhythm",
        "mid-tempo with bouncy feel",
      ],
    },
    taco: {
      vibes: [
        "vibrant and spicy",
        "festive and lively",
        "colorful and rhythmic",
        "zesty and energetic",
      ],
      instruments: [
        "latin-inspired percussion, warm guitar tones, playful melodies",
        "acoustic guitar, congas, bright brass stabs",
        "nylon guitar, bongo rhythms, cheerful piano",
        "mariachi-inspired horns, percussion, warm bass",
      ],
      moods: [
        "festive and flavorful with street food charm",
        "taco truck vibes with neighborhood energy",
        "fiesta atmosphere with authentic spice",
        "street corner flavor with cultural richness",
      ],
      tempos: [
        "mid-tempo with latin-tinged grooves",
        "upbeat rhythm with dance-friendly pace",
        "moderate tempo with salsa influences",
      ],
    },
    pasta: {
      vibes: [
        "smooth and elegant",
        "romantic and cozy",
        "sophisticated and warm",
        "rustic and authentic",
      ],
      instruments: [
        "soft piano, gentle strings, warm vinyl crackle",
        "classical guitar, accordion, subtle orchestral touches",
        "grand piano, cello, ambient textures",
        "mandolin, soft keys, Italian-inspired melodies",
      ],
      moods: [
        "Italian trattoria ambiance with sophisticated warmth",
        "Roman evening atmosphere with romantic charm",
        "Tuscan countryside vibes with rustic elegance",
        "old-world cafe setting with timeless grace",
      ],
      tempos: [
        "relaxed tempo with flowing melodies",
        "slow waltz tempo with elegant pacing",
        "gentle rhythm with Mediterranean feel",
      ],
    },
    pizza: {
      vibes: [
        "casual and fun",
        "easygoing and cheerful",
        "friendly and relaxed",
        "playful and inviting",
      ],
      instruments: [
        "laid-back drums, mellow rhodes, cheerful chords",
        "upright bass, soft keys, jazzy guitar",
        "cozy organ, gentle percussion, warm synths",
        "vintage electric piano, brushed drums, happy melodies",
      ],
      moods: [
        "neighborhood pizzeria vibes with friendly atmosphere",
        "family restaurant warmth with communal joy",
        "local spot energy with welcoming charm",
        "corner shop ambiance with casual comfort",
      ],
      tempos: [
        "moderate tempo with relaxed grooves",
        "easy-going pace with friendly bounce",
        "medium tempo with comfortable swing",
      ],
    },
    sushi: {
      vibes: [
        "clean and minimalist",
        "zen and peaceful",
        "refined and delicate",
        "meditative and pure",
      ],
      instruments: [
        "subtle koto samples, ambient pads, precise percussion",
        "shakuhachi flute, soft synths, minimal beats",
        "Japanese bells, water sounds, ethereal textures",
        "bamboo chimes, gentle keys, zen atmospheres",
      ],
      moods: [
        "Japanese aesthetic with tranquil precision",
        "omakase experience with mindful artistry",
        "Tokyo sushi bar atmosphere with quiet sophistication",
        "zen garden ambiance with contemplative grace",
      ],
      tempos: [
        "slow to medium tempo with meditative flow",
        "unhurried pace with mindful rhythm",
        "peaceful tempo with balanced energy",
      ],
    },
    ramen: {
      vibes: [
        "warm and comforting",
        "cozy and steamy",
        "soulful and satisfying",
        "intimate and nurturing",
      ],
      instruments: [
        "bubbling textures, cozy rhodes, soft rain sounds",
        "warm pads, gentle percussion, ambient kitchen sounds",
        "mellow synths, light drums, steamy atmospheres",
        "soft piano, subtle beats, comforting soundscapes",
      ],
      moods: [
        "late-night noodle shop atmosphere with soulful warmth",
        "rainy evening ramen bar with intimate charm",
        "hidden alley spot with authentic comfort",
        "Tokyo back-street warmth with homestyle soul",
      ],
      tempos: [
        "slow groove with comforting ambiance",
        "relaxed tempo with soothing rhythm",
        "gentle pace with warming feel",
      ],
    },
    coffee: {
      vibes: [
        "smooth and sophisticated",
        "mellow and aromatic",
        "intellectual and refined",
        "contemplative and rich",
      ],
      instruments: [
        "jazzy piano, brushed drums, warm bass",
        "upright bass, soft keys, gentle saxophone",
        "vintage rhodes, light percussion, smooth guitar",
        "grand piano, double bass, subtle jazz elements",
      ],
      moods: [
        "cafe ambiance with intellectual charm",
        "morning coffee shop vibes with creative energy",
        "European cafe atmosphere with artistic soul",
        "bookstore cafe warmth with literary grace",
      ],
      tempos: [
        "relaxed jazz-influenced tempo",
        "easy morning pace with smooth groove",
        "contemplative rhythm with sophisticated swing",
      ],
    },
    dessert: {
      vibes: [
        "sweet and dreamy",
        "delicate and whimsical",
        "playful and light",
        "sugary and ethereal",
      ],
      instruments: [
        "sparkly bells, soft pads, gentle keys",
        "music box melodies, chimes, airy synths",
        "glockenspiel, dreamy piano, cotton-soft textures",
        "twinkling tones, delicate harp, sweet soundscapes",
      ],
      moods: [
        "sugary sweet with whimsical textures",
        "patisserie charm with delicate elegance",
        "candy shop magic with playful wonder",
        "bakery warmth with comforting sweetness",
      ],
      tempos: [
        "slow tempo with dreamy atmosphere",
        "gentle pace with floating feel",
        "unhurried rhythm with light touch",
      ],
    },
    bbq: {
      vibes: [
        "smoky and soulful",
        "grounded and hearty",
        "rustic and warm",
        "laid-back and rich",
      ],
      instruments: [
        "warm guitar licks, deep bass, shuffled drums",
        "slide guitar, harmonica, thick bassline",
        "blues-inspired keys, acoustic guitar, earthy percussion",
        "southern guitar, warm organ, steady groove",
      ],
      moods: [
        "backyard cookout soul with smoky richness",
        "summer barbecue vibes with community warmth",
        "southern porch atmosphere with authentic flavor",
        "outdoor gathering energy with hearty comfort",
      ],
      tempos: [
        "medium swing tempo with Southern flavor",
        "relaxed groove with laid-back feel",
        "easy tempo with bluesy swing",
      ],
    },
  };

  // Variation elements that can be added to any theme
  const timeOfDay = [
    "morning",
    "afternoon",
    "evening",
    "late-night",
    "golden hour",
  ];
  const weatherMoods = [
    "rainy day",
    "sunny afternoon",
    "cloudy sky",
    "misty morning",
    "starlit night",
  ];
  const extraTextures = [
    "with vinyl crackle",
    "with ambient room tone",
    "with subtle field recordings",
    "with tape warmth",
    "with nostalgic touches",
  ];

  // Find matching food theme
  let selectedTheme = null;
  let foodName = "";
  for (const [food, theme] of Object.entries(foodThemes)) {
    if (titleLower.includes(food)) {
      selectedTheme = theme;
      foodName = food;
      break;
    }
  }

  // If no specific food matched, use AI to generate custom prompt
  if (!selectedTheme) {
    // Extract likely food name from title (simple heuristic)
    const words = title.split(" ");
    const potentialFood =
      words.find(
        (w) =>
          w.length > 3 &&
          !["lofi", "beats", "chill", "study"].includes(w.toLowerCase())
      ) || title;

    return await generateAIFoodPrompt(potentialFood);
  }

  // Randomly select variations for unique output each time
  const randomVibe =
    selectedTheme.vibes[Math.floor(Math.random() * selectedTheme.vibes.length)];
  const randomInstruments =
    selectedTheme.instruments[
      Math.floor(Math.random() * selectedTheme.instruments.length)
    ];
  const randomMood =
    selectedTheme.moods[Math.floor(Math.random() * selectedTheme.moods.length)];
  const randomTempo =
    selectedTheme.tempos[
      Math.floor(Math.random() * selectedTheme.tempos.length)
    ];

  // 50% chance to add time of day or weather mood for extra variation
  let extraContext = "";
  if (Math.random() > 0.5) {
    const useTimeOfDay = Math.random() > 0.5;
    extraContext = useTimeOfDay
      ? ` Evokes ${
          timeOfDay[Math.floor(Math.random() * timeOfDay.length)]
        } vibes.`
      : ` Perfect for ${
          weatherMoods[Math.floor(Math.random() * weatherMoods.length)]
        }.`;
  }

  // 40% chance to add texture variation
  const texture =
    Math.random() > 0.6
      ? ` ${extraTextures[Math.floor(Math.random() * extraTextures.length)]}`
      : "";

  // Construct detailed prompt with randomized elements
  return `${randomVibe} lofi hip hop inspired by ${foodName}. Features ${randomInstruments}${texture}. Captures ${randomMood}. ${randomTempo}.${extraContext} Chill, instrumental, perfect for studying or relaxing.`;
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
      `✓ Audio file validated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
    );
    return true;
  } catch (error) {
    console.error("Audio validation failed:", error.message);
    return false;
  }
}
