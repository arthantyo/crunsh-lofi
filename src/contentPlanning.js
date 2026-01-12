import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

/**
 * Fetch content planning from Airtable
 * Uses personal access token (API keys are deprecated)
 */
export async function fetchContentPlan() {
  console.log("📋 Fetching content plan from Airtable...");

  console.log(process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN);
  console.log(process.env.AIRTABLE_BASE_ID);

  Airtable.configure({
    endpointUrl: "https://api.airtable.com",
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
  });

  const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

  console.log(base);
  try {
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: "OR({Status} = 'Pending', {Status} = 'Scheduled')",
        maxRecords: 1,
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
