import express from "express";
import dotenv from "dotenv";
import Airtable from "airtable";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Store pending tasks and their resolvers
const pendingTasks = new Map();

/**
 * Register a task to wait for callback
 */
export function registerTask(taskId) {
  return new Promise((resolve, reject) => {
    pendingTasks.set(taskId, { resolve, reject, timestamp: Date.now() });

    // Timeout after 10 minutes
    setTimeout(() => {
      if (pendingTasks.has(taskId)) {
        pendingTasks.delete(taskId);
        reject(new Error("Task timeout - no callback received"));
      }
    }, 600000);
  });
}

/**
 * Callback endpoint for kie.ai
 */
app.post("/api/callback", (req, res) => {
  console.log("📥 Received callback:", req.body);

  const taskId = req.body.taskId || req.body.task_id;
  const status = req.body.status;
  const result = req.body.result || req.body.data;

  if (!taskId) {
    console.error("⚠️ Callback missing taskId");
    return res.status(400).json({ error: "Missing taskId" });
  }

  const pendingTask = pendingTasks.get(taskId);

  if (!pendingTask) {
    console.log(`⚠️ No pending task found for ${taskId}`);
    return res
      .status(200)
      .json({ message: "Task not found or already completed" });
  }

  if (status === "completed" || status === "success") {
    console.log(`✓ Task ${taskId} completed successfully`);
    pendingTask.resolve(result);
    pendingTasks.delete(taskId);
  } else if (status === "failed" || status === "error") {
    console.error(`❌ Task ${taskId} failed:`, result);
    pendingTask.reject(new Error(result?.message || "Task failed"));
    pendingTasks.delete(taskId);
  } else {
    console.log(`⏳ Task ${taskId} status: ${status}`);
  }

  res.status(200).json({ message: "Callback received" });
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    pendingTasks: pendingTasks.size,
    uptime: process.uptime(),
  });
});

/**
 * Create new content plan in Airtable
 */
app.post("/api/content-plan", async (req, res) => {
  try {
    const {
      title,
      description,
      audioStyle,
      duration,
      tags,
      imagePrompt,
      chapters,
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Initialize Airtable
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    }).base(process.env.AIRTABLE_BASE_ID);

    // Create record in Airtable
    const record = await base(process.env.AIRTABLE_TABLE_NAME).create({
      Title: title,
      Description: description || "",
      AudioStyle: audioStyle || "lofi-chill",
      Duration: duration || 3600,
      Tags: tags || "",
      ImagePrompt: imagePrompt || "",
      Chapters: chapters && chapters.length > 0 ? JSON.stringify(chapters) : "",
      Status: "Pending",
    });

    console.log(`✓ Created content plan: ${title} (ID: ${record.id})`);

    res.json({
      success: true,
      recordId: record.id,
      title: title,
    });
  } catch (error) {
    console.error("Error creating content plan:", error);
    res.status(500).json({
      error: error.message || "Failed to create content plan",
    });
  }
});

let server;

/**
 * Start the callback server
 */
export function startCallbackServer(port = 3000) {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(port, () => {
        console.log(`🚀 Callback server running on http://localhost:${port}`);
        console.log(`   Callback URL: http://localhost:${port}/api/callback`);
        console.log(`   📋 Content Plan UI: http://localhost:${port}`);
        resolve(server);
      });

      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          console.log(`⚠️ Port ${port} is in use, trying ${port + 1}...`);
          startCallbackServer(port + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop the callback server
 */
export function stopCallbackServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log("🛑 Callback server stopped");
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export default app;
