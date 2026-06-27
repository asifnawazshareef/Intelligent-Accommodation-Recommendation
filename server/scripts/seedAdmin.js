import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const child = spawn(process.execPath, [path.join(__dirname, "seed.js")], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
