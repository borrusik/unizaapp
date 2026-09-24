import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const workerPath = resolve("public", "sw.js");

try {
  await access(workerPath, constants.R_OK);
  const worker = await stat(workerPath);
  if (!worker.isFile() || worker.size === 0) throw new Error("service worker is empty");
  console.log(`PWA service worker verified (${worker.size} bytes).`);
} catch (error) {
  console.error("PWA build verification failed: public/sw.js was not generated.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
