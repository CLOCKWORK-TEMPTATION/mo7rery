import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const backendBaseUrl = "http://127.0.0.1:18987";
const backendExtractUrl = `${backendBaseUrl}/api/file-extract`;
const backendReviewUrl = `${backendBaseUrl}/api/agent/review`;
const viteEntry = resolve(process.cwd(), "node_modules/vite/bin/vite.js");

const child = spawn(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1", "--port", "3000"],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      VITE_FILE_IMPORT_BACKEND_URL: backendExtractUrl,
      VITE_AGENT_REVIEW_BACKEND_URL: backendReviewUrl,
    },
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
