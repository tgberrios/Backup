/**
 * Load backup.env / .env before any other backend code runs.
 * Must be imported first in server.js so the pg Pool uses the correct POSTGRES_*.
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const backupEnvPath = path.join(projectRoot, "backup.env");
const dotenvPath = path.join(projectRoot, ".env");

if (fs.existsSync(backupEnvPath)) {
  config({ path: backupEnvPath });
} else if (fs.existsSync(dotenvPath)) {
  config({ path: dotenvPath });
}
