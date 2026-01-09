import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

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
