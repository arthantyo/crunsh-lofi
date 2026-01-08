import { Client, Databases } from "node-appwrite";
import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

/**
 * Fetch content planning from Appwrite
 */
export async function fetchFromAppwrite() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID,
      process.env.APPWRITE_COLLECTION_ID
    );

    // Get the first pending content plan
    const contentPlan = response.documents.find(
      (doc) => doc.status === "pending" || doc.status === "scheduled"
    );

    if (!contentPlan) {
      throw new Error("No pending content plan found");
    }

    return {
      title: contentPlan.title,
      description: contentPlan.description,
      tags: contentPlan.tags || [],
      chapters: contentPlan.chapters || [],
      imagePrompt: contentPlan.imagePrompt,
      audioStyle: contentPlan.audioStyle || "lofi-chill",
      duration: contentPlan.duration || 3600, // Default 1 hour
      documentId: contentPlan.$id,
    };
  } catch (error) {
    console.error("Error fetching from Appwrite:", error);
    throw error;
  }
}

/**
 * Fetch content planning from Airtable
 */
export async function fetchFromAirtable() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: "OR({Status} = 'Pending', {Status} = 'Scheduled')",
        maxRecords: 1,
        sort: [{ field: "CreatedTime", direction: "asc" }],
      })
      .firstPage();

    if (records.length === 0) {
      throw new Error("No pending content plan found in Airtable");
    }

    const record = records[0];

    return {
      title: record.get("Title"),
      description: record.get("Description"),
      tags: record.get("Tags")
        ? record
            .get("Tags")
            .split(",")
            .map((t) => t.trim())
        : [],
      chapters: record.get("Chapters")
        ? JSON.parse(record.get("Chapters"))
        : [],
      imagePrompt: record.get("ImagePrompt"),
      audioStyle: record.get("AudioStyle") || "lofi-chill",
      duration: record.get("Duration") || 3600,
      recordId: record.id,
    };
  } catch (error) {
    console.error("Error fetching from Airtable:", error);
    throw error;
  }
}

/**
 * Main function to fetch content planning
 * Tries Appwrite first, falls back to Airtable if configured
 */
export async function fetchContentPlan() {
  console.log("📋 Fetching content plan...");

  if (process.env.APPWRITE_PROJECT_ID) {
    try {
      return await fetchFromAppwrite();
    } catch (error) {
      console.log("Appwrite fetch failed, trying Airtable...");
    }
  }

  if (process.env.AIRTABLE_API_KEY) {
    return await fetchFromAirtable();
  }

  throw new Error(
    "No content planning service configured. Set up Appwrite or Airtable in .env"
  );
}
