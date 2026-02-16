import { pool } from "./database.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "..", "..", "..", "schema", "init_backup_metadata.sql");

/**
 * Ensures iks.backups and iks.backup_history exist. If not, runs schema/init_backup_metadata.sql.
 * Call once at server startup so the UI works without a manual psql step.
 */
export async function ensureSchema() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT to_regclass('iks.backups')::text AS t"
    );
    if (r.rows[0]?.t) {
      return;
    }
  } catch (err) {
    // Schema or table missing; run init.
  } finally {
    client.release();
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.warn(
      "[Backup UI] Schema file not found:",
      SCHEMA_PATH,
      "- create iks.backups and iks.backup_history manually."
    );
    return;
  }

  const client2 = await pool.connect();
  try {
    await client2.query("CREATE SCHEMA IF NOT EXISTS iks");

    const sql = fs.readFileSync(SCHEMA_PATH, "utf8");

    function stripLeadingCommentLines(text) {
      const lines = text.split("\n");
      while (lines.length > 0 && /^\s*--/.test(lines[0])) lines.shift();
      return lines.join("\n").trim();
    }

    const statements = sql
      .split(";")
      .map((s) => stripLeadingCommentLines(s.trim()))
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await client2.query(stmt + ";");
    }
    console.log("[Backup UI] Schema iks initialized (iks.backups, iks.backup_history).");
  } catch (err) {
    console.error("[Backup UI] Failed to init schema:", err.message);
    throw err;
  } finally {
    client2.release();
  }
}
