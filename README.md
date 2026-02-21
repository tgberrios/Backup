# IKS Backups

**License:** [MIT](LICENSE) — open source.

Multi-engine backup manager (PostgreSQL, MariaDB, MongoDB, Oracle) with a web UI and cron-like scheduler. Part of [IKS - Enterprise Solutions](https://iks-enterprise-5sjib5zd4-tomy-gustavo-berrios-berrios-projects.vercel.app/).

---

## Requirements

- **Node.js** – for the Web UI (Express backend + React frontend).
- **PostgreSQL** – stores the `iks` schema and backup history (scheduler and UI).
- **To build the C++ binary:** C++17 compiler, CMake 3.16+, libpqxx, and the client tools for each engine you use:
  - PostgreSQL: `pg_dump` / `pg_restore`
  - MariaDB: `mysqldump` / `mysql`
  - MongoDB: `mongodump` / `mongorestore`
  - Oracle: `expdp` / `impdp` (if applicable)

---

## Installation

1. **Clone or copy the repository** and go to the project root.

2. **Configure environment variables.** Copy the example and edit:

   ```bash
   cp backup.env.example backup.env
   ```

   Edit `backup.env` and set at least:

   - `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (connection to the PostgreSQL instance where the `iks` schema will be created).

   Optional: `BACKUP_UI_PORT` (default 3100), `BACKUP_BINARY` (path to the binary if not at `build/Backup`), `BACKUP_STORAGE_DIR` (directory where backup files are stored).

3. **Install UI dependencies** (first time only):

   ```bash
   cd ui/backend && npm install && cd ../frontend && npm install && cd ../..
   ```

4. **Start everything** (builds the binary if missing, builds the frontend, and starts the server):

   ```bash
   npm run start
   ```

5. Open **http://localhost:3100**. The backend creates the `iks` schema and tables (`iks.backups`, `iks.backup_history`, `iks.backup_control_log`) if they do not exist.

---

## Configuration

Only **environment variables** are used (no `config.json`).

| Variable | Description |
|----------|-------------|
| `POSTGRES_HOST` | PostgreSQL host (e.g. `localhost`) |
| `POSTGRES_PORT` | Port (e.g. `5432`) |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | User |
| `POSTGRES_PASSWORD` | Password |
| `BACKUP_UI_PORT` | Web server port (default `3100`) |
| `BACKUP_BINARY` | Absolute path to the `Backup` executable if not at `build/Backup` |
| `BACKUP_STORAGE_DIR` | Directory where backup files are stored (optional) |

The program loads `backup.env` or `.env` from the project root on startup. System environment variables take precedence when set.

---

## Usage

### Web UI

At http://localhost:3100 you can:

- **List** backups (with filters by engine and status).
- **Create** a backup: name, engine (PostgreSQL / MariaDB / MongoDB / Oracle), connection string, database, type (full, structure, data, config), and optionally a cron expression for scheduling.
- **Test connection** and **discover databases** before creating.
- **View history** of runs per backup.
- **Enable/disable** scheduling for a backup.
- **Delete** a backup (and its associated file).

### CLI (one-off backup)

```bash
./Backup backup create <path_to_json>
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

Output is JSON to stdout (success, file_path, file_size, duration_seconds, error_message on failure).

### Scheduler (scheduled backups)

1. **PostgreSQL** must be configured with the `POSTGRES_*` variables (see Configuration). The `iks` schema and tables are created automatically when the UI starts, or you can run manually:

   ```bash
   psql -h localhost -U backup -d postgres -f schema/init_iks_schema.sql
   ```

2. **Register a scheduled backup:** from the Web UI (create a backup and enable “Enable scheduled backup” with a cron expression, e.g. `0 2 * * *` for daily at 02:00) or by inserting a row into `iks.backups` with `is_scheduled = true` and a valid `cron_schedule`.

3. **Run the scheduler:**
   - Manually: `./Backup backup schedule` (runs in a loop until SIGINT/SIGTERM; checks every minute).
   - With systemd (recommended for production):
     ```bash
     sudo cp systemd/backup-scheduler.service /etc/systemd/system/
     # Adjust ExecStart and WorkingDirectory if needed
     sudo systemctl daemon-reload
     sudo systemctl enable backup-scheduler
     sudo systemctl start backup-scheduler
     ```

---

## PostgreSQL schema (iks)

The schema name is **iks**. Main tables:

- **iks.backups** – One row per backup job. **The list you see in the Web UI comes from this table.** Columns: backup_name, db_engine, database_name, backup_type, status, file_path, created_at, cron_schedule, is_scheduled, etc.
- **iks.backup_history** – One row per run (each time a backup runs). Links to iks.backups via backup_id; stores status, started_at, completed_at, file_path, file_size, error_message, triggered_by.
- **iks.backup_control_log** – Control log table (defined in schema; not currently written by the UI or scheduler; may be empty).

To see the same data as the UI in the database you **must use the same PostgreSQL** as in `backup.env` (same host, port, database name). If you query a different DB, tables will look empty even though the UI shows backups.

**Query with psql** (use the same host, port, and database as in `backup.env`):

```bash
psql -h localhost -p 5432 -d postgres -c 'SELECT backup_id, backup_name, status, created_at FROM iks.backups ORDER BY created_at DESC;'
```

Or in SQL:

```sql
SELECT backup_id, backup_name, db_engine, database_name, status, file_path, created_at
FROM iks.backups
ORDER BY created_at DESC;
```

**Where backup files are stored:** Each job’s file path is in `iks.backups.file_path`. By default files are under the project’s **`storage/backups/`** directory (or `BACKUP_STORAGE_DIR` if set in env). If a run failed, the file may be missing or incomplete.

Full DDL is in `schema/init_iks_schema.sql` (creates the `iks` schema and tables with indexes and comments).

---

## Restore

Restore from the UI is not implemented. To restore, use the native tools for each engine: `pg_restore`, `mysql`, `mongorestore`, Oracle `impdp`, etc., with the files produced by IKS Backups.
