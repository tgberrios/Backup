import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import backupsRoutes from "./routes/backups.routes.js";
import connectionsRoutes from "./routes/connections.routes.js";
import { ensureSchema } from "./services/init-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from project root (backup.env or .env)
const backupEnvPath = path.resolve(__dirname, "..", "..", "backup.env");
const dotenvPath = path.resolve(__dirname, "..", "..", ".env");
const fs = await import("fs");
const { config } = await import("dotenv");
if (fs.existsSync(backupEnvPath)) {
  config({ path: backupEnvPath });
} else if (fs.existsSync(dotenvPath)) {
  config({ path: dotenvPath });
}

const app = express();
const PORT = process.env.BACKUP_UI_PORT || 3100;

app.use(cors());
app.use(express.json());

app.use("/api/backups", backupsRoutes);
app.use("/api", connectionsRoutes);

const frontendDist = path.join(__dirname, "..", "frontend", "dist");
const { existsSync } = await import("fs");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

(async () => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("Startup: could not ensure schema:", err.message);
  }
  app.listen(PORT, () => {
    console.log(`IKS Backups server running at http://localhost:${PORT}`);
  });
})();
