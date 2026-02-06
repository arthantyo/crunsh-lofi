import { createVideo } from "./videoProcessor.js";
import fs from "fs/promises";
import path from "path";
import inquirer from "inquirer";

async function selectFile(
  folder: string,
  ext: string,
  message: string,
): Promise<string> {
  const files = (await fs.readdir(folder)).filter((f) =>
    f.toLowerCase().endsWith(ext),
  );
  if (files.length === 0) throw new Error(`No ${ext} files found in ${folder}`);
  const { file } = await inquirer.prompt([
    {
      type: "list",
      name: "file",
      message,
      choices: files,
    },
  ]);
  return path.join(folder, file);
}

async function main(): Promise<void> {
  const tempDir = path.resolve("./temp");
  const outputDir = path.resolve("./output");
  try {
    const imagePath = await selectFile(
      tempDir,
      ".png",
      "Select an image (PNG):",
    );
    const audioPath = await selectFile(
      tempDir,
      ".mp3",
      "Select an audio (MP3):",
    );
    const timestamp = Date.now();
    const output = path.join(outputDir, `lofi_video_${timestamp}.mp4`);
    await fs.mkdir(outputDir, { recursive: true });
    await createVideo(
      {
        audioPath,
        backgroundImage: imagePath,
        format: "mp4",
      },
      output,
    );
    console.log(`Done! Video saved to ${output}`);
  } catch (err) {
    console.error("Failed to stitch:", (err as Error).message);
    process.exit(1);
  }
}

main();
