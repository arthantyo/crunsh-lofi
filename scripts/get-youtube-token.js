#!/usr/bin/env node

/**
 * Helper script to get YouTube OAuth refresh token
 * Run: node scripts/get-youtube-token.js
 */

import { generateAuthUrl, getTokenFromCode } from "../src/youtubeUploader.js";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\n🔐 YouTube OAuth Token Generator");
  console.log("=================================\n");

  // Check if credentials exist
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    console.error("❌ Missing YouTube credentials in .env file");
    console.error(
      "Please add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET first\n"
    );
    console.log("See docs/YOUTUBE_API_SETUP.md for setup instructions");
    process.exit(1);
  }

  console.log("Step 1: Generate Authorization URL\n");

  try {
    const authUrl = generateAuthUrl();
    console.log("\n✓ Authorization URL generated!\n");
    console.log("Step 2: Visit this URL in your browser:\n");
    console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
    console.log("Step 3: After authorizing, you will be redirected to:");
    console.log("http://localhost:3000/oauth2callback?code=YOUR_CODE\n");
    console.log('Copy the "code" parameter from the URL\n');

    const code = await prompt("Paste the authorization code here: ");

    if (!code || code.trim() === "") {
      console.error("\n❌ No code provided. Exiting.");
      rl.close();
      process.exit(1);
    }

    console.log("\n⏳ Exchanging code for tokens...\n");

    const tokens = await getTokenFromCode(code.trim());

    console.log("\n✅ Success! Tokens received.\n");
    console.log("=================================");
    console.log("Add this to your .env file:\n");
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("=================================\n");
    console.log("You can now upload videos to YouTube!");

    rl.close();
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    rl.close();
    process.exit(1);
  }
}

main();
