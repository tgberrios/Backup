import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pool } from "../services/database.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_BACKUP_BINARY = path.join(BACKUP_PROJECT_ROOT, "build", "Backup");
const BackupBinaryPath = process.env.BACKUP_BINARY || DEFAULT_BACKUP_BINARY;
const backupsDir = process.env.BACKUP_STORAGE_DIR
  ? path.resolve(process.env.BACKUP_STORAGE_DIR)
  : path.join(BACKUP_PROJECT_ROOT, "storage", "backups");

const router = express.Router();

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

/** Parse postgresql://user:password@host:port/database into { host, port, user, password, database }. */
function parsePgConnectionString(connection_string) {
  const u = new URL(connection_string.replace(/^postgresql:\/\//i, "postgres://"));
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname ? decodeURIComponent(u.pathname.slice(1)) : "postgres",
  };
}

/** Run pg_dump from Node (avoids C++ binary; can avoid double-free in some environments). */
function runPgDumpFromNode(conn, database_name, backup_type, filePath) {
  return new Promise((resolve) => {
    const args = ["-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", database_name, "-f", filePath, "-F", "c"];
    if (backup_type === "structure") args.push("--schema-only");
    else if (backup_type === "data") args.push("--data-only");
    const env = { ...process.env, PGPASSWORD: conn.password };
    const proc = spawn("pg_dump", args, { env });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code, signal) => {
      if (code === 0 && fs.existsSync(filePath)) {
        try {
          const fileSize = fs.statSync(filePath).size;
          resolve({ success: true, file_size: fileSize, stderr });
        } catch {
          resolve({ success: false, stderr: stderr || "Could not stat backup file" });
        }
      } else {
        resolve({ success: false, stderr: stderr || (signal ? `Process killed (${signal})` : `Exit code ${code}`) });
      }
    });
  });
}

function sanitizeError(err, fallback, _hideInProduction) {
  if (err?.message) return err.message;
  return fallback || "Unknown error";
}

const MAX_ERROR_MESSAGE_LENGTH = 1000;

/** Normalize backup process stderr so the UI shows a clear message instead of low-level noise (e.g. double free after collation warning). */
function normalizeBackupProcessError(stderrOrMessage) {
  const raw = (stderrOrMessage || "").trim();
  if (!raw) return "Backup process failed.";

  if (/collation version mismatch/i.test(raw)) {
    const dbMatch = raw.match(/database\s+"([^"]+)"/i);
    const dbName = dbMatch ? dbMatch[1] : "YourDatabase";
    return `Database collation version mismatch (${dbName}). On the source PostgreSQL server run: ALTER DATABASE "${dbName}" REFRESH COLLATION VERSION; Then retry the backup.`;
  }
  if (/free\(\): double free|double free detected/i.test(raw)) {
    const withoutFree = raw.replace(/\n?free\(\): double free detected in tcache \d+\s*/gi, "").trim();
    if (withoutFree.length > 0) return normalizeBackupProcessError(withoutFree);
    // No other content: show raw so user sees real error (e.g. after fixing collation, another failure)
    return raw.length > MAX_ERROR_MESSAGE_LENGTH
      ? raw.slice(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
      : raw;
  }
  return raw.length > MAX_ERROR_MESSAGE_LENGTH
    ? raw.slice(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
    : raw;
}

function matchesCronField(field, currentValue) {
  if (field === "*") return true;
  const dashPos = field.indexOf("-");
  const commaPos = field.indexOf(",");
  const slashPos = field.indexOf("/");
  if (dashPos !== -1) {
    try {
      const start = parseInt(field.substring(0, dashPos));
      const end = parseInt(field.substring(dashPos + 1));
      return currentValue >= start && currentValue <= end;
    } catch {
      return false;
    }
  }
  if (commaPos !== -1) {
    const items = field.split(",");
    for (const item of items) {
      try {
        if (parseInt(item.trim()) === currentValue) return true;
      } catch {
        continue;
      }
    }
    return false;
  }
  if (slashPos !== -1) {
    try {
      const base = field.substring(0, slashPos);
      const step = parseInt(field.substring(slashPos + 1));
      if (base === "*") return currentValue % step === 0;
      const start = parseInt(base);
      return (currentValue - start) % step === 0 && currentValue >= start;
    } catch {
      return false;
    }
  }
  try {
    return parseInt(field) === currentValue;
  } catch {
    return false;
  }
}

function calculateNextRunTime(cronSchedule) {
  const now = new Date();
  let nextRun = new Date(now);
  nextRun.setUTCSeconds(0);
  nextRun.setUTCMilliseconds(0);
  nextRun.setUTCMinutes(nextRun.getUTCMinutes() + 1);
  const parts = cronSchedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, day, month, dow] = parts;
  let iterations = 0;
  const maxIterations = 366 * 24 * 60;
  while (iterations < maxIterations) {
    iterations++;
    const currentMinute = nextRun.getUTCMinutes();
    const currentHour = nextRun.getUTCHours();
    const currentDay = nextRun.getUTCDate();
    const currentMonth = nextRun.getUTCMonth() + 1;
    const currentDow = nextRun.getUTCDay();
    if (
      matchesCronField(minute, currentMinute) &&
      matchesCronField(hour, currentHour) &&
      matchesCronField(day, currentDay) &&
      matchesCronField(month, currentMonth) &&
      matchesCronField(dow, currentDow)
    ) {
      if (nextRun > now) return nextRun;
    }
    nextRun.setUTCMinutes(nextRun.getUTCMinutes() + 1);
  }
  return null;
}

router.post("/create", async (req, res) => {
  try {
    const {
      backup_name,
      db_engine,
      connection_string,
      database_name,
      backup_type,
    } = req.body;

    if (
      !backup_name ||
      !db_engine ||
      !connection_string ||
      !database_name ||
      !backup_type
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: backup_name, db_engine, connection_string, database_name, backup_type",
      });
    }

    if (!["PostgreSQL", "MariaDB", "MongoDB", "Oracle"].includes(db_engine)) {
      return res.status(400).json({
        error: "Unsupported database engine. Supported: PostgreSQL, MariaDB, MongoDB, Oracle",
      });
    }

    if (!["structure", "data", "full", "config"].includes(backup_type)) {
      return res.status(400).json({
        error: "Invalid backup_type. Must be: structure, data, full, or config",
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileExtension =
      db_engine === "PostgreSQL"
        ? "dump"
        : db_engine === "MariaDB"
        ? "sql"
        : db_engine === "MongoDB"
        ? "gz"
        : "dmp";
    const fileName = `${backup_name}_${timestamp}.${fileExtension}`;
    const filePath = path.join(backupsDir, fileName);

    const cronSchedule = req.body.cron_schedule || null;
    const isScheduled = !!cronSchedule;
    const nextRunAt = cronSchedule ? calculateNextRunTime(cronSchedule) : null;

    const backupRecord = await pool.query(
      `INSERT INTO iks.backups 
       (backup_name, db_engine, connection_string, database_name, backup_type, file_path, status, cron_schedule, is_scheduled, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING backup_id`,
      [
        backup_name,
        db_engine,
        connection_string,
        database_name,
        backup_type,
        filePath,
        "in_progress",
        cronSchedule,
        isScheduled,
        nextRunAt,
      ]
    );

    const backupId = backupRecord.rows[0].backup_id;

    (async () => {
      const historyIdRef = { current: null };
      try {
        const historyRecord = await pool.query(
          `INSERT INTO iks.backup_history 
           (backup_id, backup_name, status, started_at, triggered_by)
           VALUES ($1, $2, $3, NOW(), $4)
           RETURNING id`,
          [backupId, backup_name, "in_progress", "manual"]
        );
        historyIdRef.current = historyRecord.rows[0].id;
        const startTime = Date.now();

        let resultPath = filePath;
        let fileSize = 0;
        let durationSeconds = 0;

        if (db_engine === "PostgreSQL") {
          const conn = parsePgConnectionString(connection_string);
          const pgResult = await runPgDumpFromNode(conn, database_name, backup_type, filePath);
          durationSeconds = Math.round((Date.now() - startTime) / 1000);
          if (pgResult.success) {
            fileSize = pgResult.file_size;
            await pool.query(
              `UPDATE iks.backups 
               SET status = 'completed', file_size = $1, completed_at = NOW()
               WHERE backup_id = $2`,
              [fileSize, backupId]
            );
            await pool.query(
              `UPDATE iks.backup_history 
               SET status = 'completed', completed_at = NOW(), 
                   duration_seconds = $1, file_path = $2, file_size = $3
               WHERE id = $4`,
              [durationSeconds, resultPath, fileSize, historyIdRef.current]
            );
            return;
          }
          throw new Error(normalizeBackupProcessError(pgResult.stderr));
        }

        const backupConfig = {
          backup_name,
          db_engine,
          connection_string,
          database_name,
          backup_type,
          file_path: filePath,
        };
        const configPath = path.join(backupsDir, `backup_config_${backupId}.json`);
        await fs.promises.writeFile(configPath, JSON.stringify(backupConfig, null, 2));

        const backupProcess = spawn(BackupBinaryPath, ["backup", "create", configPath], {
          cwd: BACKUP_PROJECT_ROOT,
        });
        let stdout = "";
        let stderr = "";
        backupProcess.stdout.on("data", (data) => { stdout += data.toString(); });
        backupProcess.stderr.on("data", (data) => { stderr += data.toString(); });
        const exitCode = await new Promise((resolve) => backupProcess.on("close", resolve));

        try {
          await fs.promises.unlink(configPath);
        } catch {
          // ignore
        }

        if (exitCode !== 0) {
          throw new Error(normalizeBackupProcessError(stderr || stdout));
        }

        const result = JSON.parse(stdout);
        if (!result.success) {
          throw new Error(result.error_message || "Backup failed");
        }
        resultPath = result.file_path || filePath;
        fileSize = result.file_size || 0;
        durationSeconds = Math.round((Date.now() - startTime) / 1000);

        await pool.query(
          `UPDATE iks.backups 
           SET status = 'completed', file_size = $1, completed_at = NOW()
           WHERE backup_id = $2`,
          [fileSize, backupId]
        );
        await pool.query(
          `UPDATE iks.backup_history 
           SET status = 'completed', completed_at = NOW(), 
               duration_seconds = $1, file_path = $2, file_size = $3
           WHERE id = $4`,
          [durationSeconds, resultPath, fileSize, historyIdRef.current]
        );
      } catch (err) {
        await pool.query(
          `UPDATE iks.backups 
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE backup_id = $2`,
          [err.message, backupId]
        );
        await pool.query(
          `UPDATE iks.backup_history 
           SET status = 'failed', completed_at = NOW(), error_message = $1
           WHERE id = (
             SELECT id FROM iks.backup_history 
             WHERE backup_id = $2 AND status = 'in_progress'
             ORDER BY started_at DESC 
             LIMIT 1
           )`,
          [err.message, backupId]
        );
      }
    })();

    res.json({
      message: "Backup creation started",
      backup_id: backupId,
      status: "in_progress",
    });
  } catch (err) {
    res.status(500).json({
      error: "Error creating backup",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.get("", async (req, res) => {
  try {
    const { db_engine, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = "SELECT * FROM iks.backups WHERE 1=1";
    const params = [];
    let n = 0;

    if (db_engine) {
      n++;
      query += ` AND db_engine = $${n}`;
      params.push(db_engine);
    }
    if (status) {
      n++;
      query += ` AND status = $${n}`;
      params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT $${n + 1} OFFSET $${n + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    let countQuery = "SELECT COUNT(*) as total FROM iks.backups WHERE 1=1";
    const countParams = [];
    let cn = 0;
    if (db_engine) {
      cn++;
      countQuery += ` AND db_engine = $${cn}`;
      countParams.push(db_engine);
    }
    if (status) {
      cn++;
      countQuery += ` AND status = $${cn}`;
      countParams.push(status);
    }
    const countResult = await pool.query(countQuery, countParams);

    const backups = result.rows.map((row) => ({
      backup_id: row.backup_id,
      backup_name: row.backup_name,
      db_engine: row.db_engine,
      connection_string: row.connection_string || null,
      database_name: row.database_name || null,
      backup_type: row.backup_type,
      file_path: row.file_path,
      file_size: row.file_size ? parseInt(row.file_size) : null,
      status: row.status,
      error_message: row.error_message || null,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      cron_schedule: row.cron_schedule || null,
      is_scheduled: row.is_scheduled || false,
      next_run_at: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
      last_run_at: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
      run_count: row.run_count ? parseInt(row.run_count) : 0,
    }));

    res.json({
      backups,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({
      error: "Error fetching backups",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const result = await pool.query(
      "SELECT * FROM iks.backups WHERE backup_id = $1",
      [backupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Backup not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: "Error fetching backup",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.get("/:id/history", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      `SELECT * FROM iks.backup_history 
       WHERE backup_id = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
      [backupId, limit]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({
      error: "Error fetching history",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.put("/:id/schedule", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const { cron_schedule, is_scheduled } = req.body;

    if (is_scheduled && (!cron_schedule || cron_schedule.trim() === "")) {
      return res.status(400).json({
        error: "cron_schedule is required when is_scheduled is true",
      });
    }

    const parts = cron_schedule ? cron_schedule.trim().split(/\s+/) : [];
    if (is_scheduled && parts.length !== 5) {
      return res.status(400).json({
        error: "Invalid cron_schedule format. Expected: minute hour day month dow",
      });
    }

    const nextRunAt =
      is_scheduled && cron_schedule ? calculateNextRunTime(cron_schedule) : null;

    await pool.query(
      `UPDATE iks.backups 
       SET cron_schedule = $1, is_scheduled = $2, next_run_at = $3
       WHERE backup_id = $4`,
      [cron_schedule || null, is_scheduled || false, nextRunAt, backupId]
    );

    res.json({
      message: "Backup schedule updated",
      next_run_at: nextRunAt,
    });
  } catch (err) {
    res.status(500).json({
      error: "Error updating schedule",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.post("/:id/enable-schedule", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const backupResult = await pool.query(
      "SELECT cron_schedule FROM iks.backups WHERE backup_id = $1",
      [backupId]
    );
    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup not found" });
    }
    const cronSchedule = backupResult.rows[0].cron_schedule;
    if (!cronSchedule) {
      return res.status(400).json({
        error: "Backup has no cron_schedule. Set it first.",
      });
    }
    const nextRunAt = calculateNextRunTime(cronSchedule);
    await pool.query(
      `UPDATE iks.backups SET is_scheduled = true, next_run_at = $1 WHERE backup_id = $2`,
      [nextRunAt, backupId]
    );
    res.json({ message: "Schedule enabled", next_run_at: nextRunAt });
  } catch (err) {
    res.status(500).json({
      error: "Error enabling schedule",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.post("/:id/disable-schedule", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    await pool.query(
      `UPDATE iks.backups SET is_scheduled = false, next_run_at = NULL WHERE backup_id = $1`,
      [backupId]
    );
    res.json({ message: "Schedule disabled" });
  } catch (err) {
    res.status(500).json({
      error: "Error disabling schedule",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.post("/:id/restore", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const backupResult = await pool.query(
      "SELECT * FROM iks.backups WHERE backup_id = $1",
      [backupId]
    );
    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup not found" });
    }
    res.json({
      message: "Restore not implemented yet. Use native restore tools.",
      backup_id: backupId,
    });
  } catch (err) {
    res.status(500).json({
      error: "Error restoring backup",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const backupId = parseInt(req.params.id);
    const backupResult = await pool.query(
      "SELECT * FROM iks.backups WHERE backup_id = $1",
      [backupId]
    );
    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: "Backup not found" });
    }
    const backup = backupResult.rows[0];
    if (backup.file_path && fs.existsSync(backup.file_path)) {
      await fs.promises.unlink(backup.file_path);
    }
    await pool.query("DELETE FROM iks.backups WHERE backup_id = $1", [backupId]);
    res.json({ message: "Backup deleted" });
  } catch (err) {
    res.status(500).json({
      error: "Error deleting backup",
      details: sanitizeError(err, "Server error", false),
    });
  }
});

export default router;
