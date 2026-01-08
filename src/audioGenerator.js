import axios from "axios";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_ENDPOINT = process.env.KIE_AI_ENDPOINT || "https://api.kie.ai/v1";

/**
 * Generate lofi audio track using kie.ai API
 * @param {Object} options - Audio generation options
 * @param {string} options.style - Audio style (e.g., 'lofi-chill', 'lofi-jazz')
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.prompt - Additional prompt for audio generation
 * @param {string} outputPath - Where to save the generated audio
 * @returns {Promise<string>} Path to the generated audio file
 */
export async function generateAudio(options, outputPath) {
  console.log("🎵 Generating lofi audio with kie.ai...");
  console.log(`   Style: ${options.style}, Duration: ${options.duration}s`);

  try {
    const response = await axios.post(
      `${KIE_ENDPOINT}/audio/generate`,
      {
        prompt:
          options.prompt ||
          `Create a relaxing lofi hip hop beat, ${options.style} style`,
        duration: options.duration,
        style: options.style || "lofi-chill",
        format: "mp3",
        quality: "high",
        bpm: 80, // Typical lofi tempo
        mood: "relaxing",
      },
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 minutes timeout for audio generation
      }
    );

    // Check generation status
    let audioUrl = response.data.url || response.data.audio_url;

    // If generation is async, poll for completion
    if (response.data.status === "processing" && response.data.id) {
      audioUrl = await pollForCompletion(response.data.id);
    }

    if (!audioUrl) {
      throw new Error("No audio URL returned from kie.ai API");
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
 * Poll kie.ai API for audio generation completion
 */
async function pollForCompletion(generationId, maxAttempts = 30) {
  console.log("⏳ Waiting for audio generation to complete...");

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    try {
      const response = await axios.get(
        `${KIE_ENDPOINT}/audio/status/${generationId}`,
        {
          headers: {
            Authorization: `Bearer ${KIE_API_KEY}`,
          },
        }
      );

      if (response.data.status === "completed") {
        return response.data.url || response.data.audio_url;
      } else if (response.data.status === "failed") {
        throw new Error("Audio generation failed");
      }

      console.log(
        `   Attempt ${i + 1}/${maxAttempts}: ${response.data.status}...`
      );
    } catch (error) {
      console.error("Error polling status:", error.message);
    }
  }

  throw new Error("Audio generation timed out");
}

/**
 * Generate audio from content plan
 */
export async function generateAudioFromPlan(contentPlan, outputPath) {
  const audioOptions = {
    style: contentPlan.audioStyle || "lofi-chill",
    duration: contentPlan.duration || 3600,
    prompt: `Lofi hip hop for "${contentPlan.title}" - relaxing study beats`,
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
