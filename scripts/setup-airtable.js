import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

/**
 * Setup Airtable table with all required fields
 */
async function setupAirtable() {
  console.log("🔧 Setting up Airtable fields...");

  if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
    console.error("❌ AIRTABLE_PERSONAL_ACCESS_TOKEN not found in .env");
    process.exit(1);
  }

  if (!process.env.AIRTABLE_BASE_ID) {
    console.error("❌ AIRTABLE_BASE_ID not found in .env");
    process.exit(1);
  }

  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "contentplan";
  const token = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;

  try {
    // Use Airtable Metadata API to create fields
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: tableName,
          description: "Content planning for Lofi video automation",
          fields: [
            {
              name: "Title",
              type: "singleLineText",
              description: "The title of the video",
            },
            {
              name: "Description",
              type: "multilineText",
              description: "YouTube video description",
            },
            {
              name: "Status",
              type: "singleSelect",
              options: {
                choices: [
                  { name: "Pending", color: "yellowBright" },
                  { name: "Scheduled", color: "blueBright" },
                  { name: "Processing", color: "orangeBright" },
                  { name: "Completed", color: "greenBright" },
                  { name: "Failed", color: "redBright" },
                ],
              },
            },
            {
              name: "AudioStyle",
              type: "singleSelect",
              options: {
                choices: [
                  { name: "lofi-chill", color: "blueBright" },
                  { name: "lofi-jazz", color: "purpleBright" },
                  { name: "lofi-ambient", color: "tealBright" },
                  { name: "lofi-upbeat", color: "orangeBright" },
                ],
              },
            },
            {
              name: "Duration",
              type: "number",
              options: {
                precision: 0,
              },
              description: "Duration in seconds (default 3600 = 1 hour)",
            },
            {
              name: "Tags",
              type: "multilineText",
              description: "Comma-separated tags for YouTube",
            },
            {
              name: "ImagePrompt",
              type: "multilineText",
              description: "Custom prompt for image generation",
            },
            {
              name: "Chapters",
              type: "multilineText",
              description: "JSON string of chapters",
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (data.error?.type === "TABLE_NAME_ALREADY_EXISTS") {
        console.log(
          "⚠️  Table already exists. Attempting to add missing fields..."
        );
        await addMissingFields(baseId, tableName, token);
      } else {
        throw new Error(data.error?.message || "Failed to create table");
      }
    } else {
      console.log(`✅ Table '${tableName}' created successfully!`);
      console.log(`   Table ID: ${data.id}`);
      console.log("\n📋 Fields created:");
      data.fields.forEach((field) => {
        console.log(`   - ${field.name} (${field.type})`);
      });
    }

    console.log("\n✨ Setup complete! You can now use the content plan UI.");
  } catch (error) {
    console.error("❌ Error setting up Airtable:", error.message);
    if (error.response) {
      console.error("Response:", await error.response.text());
    }
    process.exit(1);
  }
}

/**
 * Add missing fields to existing table
 */
async function addMissingFields(baseId, tableName, token) {
  try {
    // First, get the existing table structure
    const tablesResponse = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const tablesData = await tablesResponse.json();
    const table = tablesData.tables.find((t) => t.name === tableName);

    if (!table) {
      console.error(`❌ Table '${tableName}' not found in base`);
      process.exit(1);
    }

    console.log(`   Found table ID: ${table.id}`);

    const existingFields = table.fields.map((f) => f.name);
    console.log("   Existing fields:", existingFields.join(", "));

    const requiredFields = [
      {
        name: "Title",
        type: "singleLineText",
      },
      {
        name: "Description",
        type: "multilineText",
      },
      {
        name: "Status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "Pending" },
            { name: "Scheduled" },
            { name: "Processing" },
            { name: "Completed" },
            { name: "Failed" },
          ],
        },
      },
      {
        name: "AudioStyle",
        type: "singleSelect",
        options: {
          choices: [
            { name: "lofi-chill" },
            { name: "lofi-jazz" },
            { name: "lofi-ambient" },
            { name: "lofi-upbeat" },
          ],
        },
      },
      {
        name: "Duration",
        type: "number",
        options: { precision: 0 },
      },
      {
        name: "Tags",
        type: "multilineText",
      },
      {
        name: "ImagePrompt",
        type: "multilineText",
      },
      {
        name: "Chapters",
        type: "multilineText",
      },
    ];

    // Add missing fields
    let addedCount = 0;
    for (const field of requiredFields) {
      if (!existingFields.includes(field.name)) {
        console.log(`   Adding field: ${field.name}...`);

        const response = await fetch(
          `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(field),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error(
            `   ❌ Failed to add ${field.name}:`,
            error.error.message
          );
        } else {
          console.log(`   ✅ Added ${field.name}`);
          addedCount++;
        }
      }
    }

    if (addedCount === 0) {
      console.log("   ✅ All required fields already exist!");
    } else {
      console.log(`\n✅ Added ${addedCount} missing field(s)`);
    }
  } catch (error) {
    console.error("❌ Error adding fields:", error.message);
    throw error;
  }
}

// Run the setup
setupAirtable();
