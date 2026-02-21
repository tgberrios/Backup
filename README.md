# IKS Backups

**Multi-engine backup manager** with a web UI and cron-style scheduler. Supports PostgreSQL, MariaDB, MongoDB, and Oracle.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

IKS Backups provides:

- **Web UI** — Create, list, schedule, and manage backup jobs from a single interface.
- **Scheduler** — Run backups on a schedule (cron expressions); optional systemd service for production.
- **Metadata in PostgreSQL** — All jobs and run history are stored in a configurable PostgreSQL instance using the **`iks`** schema (one schema per product; same database can host multiple applications).

Configuration is **environment-only** (no config files). Copy `backup.env.example` to `backup.env`, set your variables, and run.

---

## Requirements

| Component | Purpose |
|-----------|---------|
| **Node.js** | Web UI (Express backend + React frontend) |
| **PostgreSQL** | Metadata store (schema `iks`: jobs, history) |
| **C++ build** (optional for UI-only) | C++17, CMake 3.16+, libpqxx — for building the `Backup` binary (used for MariaDB/MongoDB/Oracle and for the scheduler) |
| **Client tools** | Per engine: `pg_dump`/`pg_restore`, `mysqldump`/`mysql`, `mongodump`/`mongorestore`, Oracle `expdp`/`impdp` as needed |

---

## Quick Start

1. **Clone the repository** and go to the project root.

2. **Configure environment:**

   ```bash
   cp backup.env.example backup.env
   ```

   Edit `backup.env` and set at least: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.

3. **Install dependencies** (first time only):

   ```bash
   cd ui/backend && npm install && cd ../frontend && npm install && cd ../..
   ```

4. **Start the application:**

   ```bash
   npm run start
   ```

   This builds the C++ binary (if missing), builds the frontend, and starts the server. The backend creates the `iks` schema and tables automatically on first run.

5. **Open the UI:** [http://localhost:3100](http://localhost:3100)

---

## Configuration

All configuration is done via **environment variables**. Use `backup.env` or `.env` in the project root; system environment variables take precedence.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_HOST` | Yes | PostgreSQL host (e.g. `localhost`) |
| `POSTGRES_PORT` | Yes | Port (e.g. `5432`) |
| `POSTGRES_DB` | Yes | Database name (schema `iks` will be created here) |
| `POSTGRES_USER` | Yes | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `BACKUP_UI_PORT` | No | Web server port (default: `3100`) |
| `BACKUP_BINARY` | No | Path to the `Backup` executable (default: `build/Backup`) |
| `BACKUP_STORAGE_DIR` | No | Directory for backup files (default: `storage/backups`) |

---

## Usage

### Web UI

At [http://localhost:3100](http://localhost:3100) you can:

- **List** backups with filters by engine and status.
- **Create** a backup: name, engine, connection string, database, type (full, structure, data, config), and optional cron schedule.
- **Test connection** and **discover databases** before creating a job.
- **View history** of runs per backup.
- **Enable or disable** scheduling for a backup.
- **Delete** a backup (and its file from disk).

Scheduled backups are enabled by default when creating a job; you can uncheck to create a one-off backup.

### CLI (one-off backup)

```bash
./build/Backup backup create <path_to_json>
```

Example JSON:

```json
{
  "backup_name": "my_db_full",
  "db_engine": "PostgreSQL",
  "connection_string": "postgresql://user:password@localhost:5432/mydb",
  "database_name": "mydb",
  "backup_type": "full",
  "file_path": "/var/backups/mydb.dump"
}
```

- **backup_type:** `full`, `structure`, `data`, `config`
- **db_engine:** `PostgreSQL`, `MariaDB`, `MongoDB`, `Oracle`

Output is JSON to stdout (`success`, `file_path`, `file_size`, `duration_seconds`, `error_message` on failure).

### Scheduler (scheduled backups)

1. Ensure PostgreSQL is configured (same `POSTGRES_*` as in `backup.env`). The `iks` schema is created when the UI starts, or run manually:

   ```bash
   psql -h HOST -p PORT -U USER -d DB -f schema/init_iks_schema.sql
   ```

2. **Register a scheduled backup** from the Web UI (create a backup with “Enable scheduled backup” and a cron expression, e.g. `0 2 * * *` for daily at 02:00).

3. **Run the scheduler:**
   - **Manually:** `./build/Backup backup schedule` (runs until SIGINT/SIGTERM; checks every minute).
   - **Production (systemd):**
     ```bash
     sudo cp systemd/backup-scheduler.service /etc/systemd/system/
     # Edit ExecStart and WorkingDirectory if needed; set Environment= or place backup.env in WorkingDirectory
     sudo systemctl daemon-reload
     sudo systemctl enable backup-scheduler
     sudo systemctl start backup-scheduler
     ```

---

## PostgreSQL schema (iks)

Metadata is stored in the **`iks`** schema within the database you configure. This allows multiple IKS products to share the same PostgreSQL instance (each with its own schema).

| Table | Description |
|-------|-------------|
| **iks.backups** | One row per backup job (name, engine, connection, database, type, file path, status, cron, is_scheduled, etc.). The Web UI list is built from this table. |
| **iks.backup_history** | One row per run (backup_id, status, started_at, completed_at, duration, file_path, file_size, error_message, triggered_by). |
| **iks.backup_control_log** | Control log (defined in DDL; not currently written by the application; may be empty). |

To inspect data, use the **same** PostgreSQL connection as in `backup.env`:

```bash
psql -h HOST -p PORT -U USER -d DB -c 'SELECT backup_id, backup_name, status, created_at FROM iks.backups ORDER BY created_at DESC;'
```

Backup files are stored according to `iks.backups.file_path`; default directory is `storage/backups/` (or `BACKUP_STORAGE_DIR`). Full DDL: `schema/init_iks_schema.sql`.

---

## Restore

Restore is not implemented in the UI. Use the native tools for each engine with the files produced by IKS Backups:

- **PostgreSQL:** `pg_restore`
- **MariaDB:** `mysql`
- **MongoDB:** `mongorestore`
- **Oracle:** `impdp`

---

## License

[MIT](LICENSE) — open source.

Part of [IKS - Enterprise Solutions](https://iks-enterprise-5sjib5zd4-tomy-gustavo-berrios-berrios-projects.vercel.app/).
