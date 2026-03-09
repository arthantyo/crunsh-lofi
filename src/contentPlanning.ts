import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

interface ContentPlan {
  title: string;
  description: string;
  tags: string[];
  audioStyle: string;
  duration: number;
  recordId: string;
}

/**
 * Fetch content planning from Airtable
 * Uses personal access token (API keys are deprecated)
 */
export async function fetchContentPlan(): Promise<ContentPlan> {
  console.log("📋 Fetching content plan from Airtable...");

  console.log(process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN);
  console.log(process.env.AIRTABLE_BASE_ID);

  Airtable.configure({
    endpointUrl: "https://api.airtable.com",
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN!,
  });

  const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

  console.log(base);
  try {
    const records = await base(process.env.AIRTABLE_TABLE_NAME!)
      .select({
        filterByFormula: "{Status} = 'Pending'",
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      throw new Error("No pending content plan found in Airtable");
    }

    const record = records[0];

    return {
      title: record.get("Title") as string,
      description: record.get("Description") as string,
      tags: record.get("Tags")
        ? (record.get("Tags") as string).split(",").map((t) => t.trim())
        : [],
      audioStyle: (record.get("AudioStyle") as string) || "lofi-chill",
      duration: (record.get("Duration") as number) || 3600,
      recordId: record.id,
    };
  } catch (error) {
    console.error("Error fetching from Airtable:", error);
    throw error;
  }
}

/**
 * Update content plan status in Airtable
 * @param recordId - The Airtable record ID
 * @param status - The new status (e.g., 'Generated', 'Published')
 */
export async function updateContentPlanStatus(
  recordId: string,
  status: string,
): Promise<void> {
  console.log(`📝 Updating record status to "${status}"...`);

  Airtable.configure({
    endpointUrl: "https://api.airtable.com",
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN!,
  });

  const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

  try {
    await base(process.env.AIRTABLE_TABLE_NAME!).update(recordId, {
      Status: status,
    });

    console.log(`✓ Record status updated to "${status}"`);
  } catch (error) {
    console.error("Error updating record status:", error);
    throw error;
  }
}
