import "./load-env.js"; // Must run first so POSTGRES_* are set before database.service.js creates the pool
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import backupsRoutes from "./routes/backups.routes.js";
import connectionsRoutes from "./routes/connections.routes.js";
import { ensureSchema } from "./services/init-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  } catch (_err) {
    // Schema init failed; continue without logging
  }
  app.listen(PORT);
})();
