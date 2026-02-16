-- =============================================================================
-- IKS Backups – Schema PostgreSQL para control log, backups y backup_history.
-- Marca: IKS (https://iks-enterprise-5sjib5zd4-tomy-gustavo-berrios-berrios-projects.vercel.app/)
-- Todas las columnas definidas y documentadas. Ejecutar una vez (idempotente).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS iks;

-- -----------------------------------------------------------------------------
-- iks.backup_control_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS iks.backup_control_log (
    id                     SERIAL PRIMARY KEY,
    backup_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    database_name          VARCHAR(255) NOT NULL,
    backup_status          VARCHAR(20) NOT NULL,
    backup_file_path       TEXT,
    backup_size_bytes      BIGINT,
    execution_time_seconds NUMERIC(10, 2),
    error_message          TEXT
);

COMMENT ON TABLE iks.backup_control_log IS 'Control log for database backup operations';
COMMENT ON COLUMN iks.backup_control_log.id IS 'Primary key';
COMMENT ON COLUMN iks.backup_control_log.backup_date IS 'When the backup run was recorded';
COMMENT ON COLUMN iks.backup_control_log.database_name IS 'Name of the database backed up';
COMMENT ON COLUMN iks.backup_control_log.backup_status IS 'Status: pending, in_progress, completed, failed';
COMMENT ON COLUMN iks.backup_control_log.backup_file_path IS 'Absolute path to the backup file on disk';
COMMENT ON COLUMN iks.backup_control_log.backup_size_bytes IS 'Size of the backup file in bytes';
COMMENT ON COLUMN iks.backup_control_log.execution_time_seconds IS 'Duration of the backup in seconds';
COMMENT ON COLUMN iks.backup_control_log.error_message IS 'Error message if backup failed';

CREATE INDEX IF NOT EXISTS idx_backup_control_database ON iks.backup_control_log (database_name);
CREATE INDEX IF NOT EXISTS idx_backup_control_date ON iks.backup_control_log (backup_date);
CREATE INDEX IF NOT EXISTS idx_backup_control_status ON iks.backup_control_log (backup_status);

-- -----------------------------------------------------------------------------
-- iks.backups
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS iks.backups (
    backup_id         SERIAL PRIMARY KEY,
    backup_name       VARCHAR(255) NOT NULL,
    db_engine         VARCHAR(50) NOT NULL,
    connection_string TEXT,
    database_name     VARCHAR(255),
    backup_type       VARCHAR(20) NOT NULL,
    file_path         TEXT NOT NULL,
    file_size         BIGINT,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message     TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    created_by        VARCHAR(255),
    completed_at      TIMESTAMP,
    metadata          JSONB DEFAULT '{}',
    cron_schedule     VARCHAR(100),
    is_scheduled      BOOLEAN DEFAULT FALSE,
    next_run_at       TIMESTAMP,
    last_run_at       TIMESTAMP,
    run_count         INTEGER DEFAULT 0
);

COMMENT ON TABLE iks.backups IS 'Stores backup records for all supported database engines';
COMMENT ON COLUMN iks.backups.backup_id IS 'Primary key';
COMMENT ON COLUMN iks.backups.backup_name IS 'Human-readable name of the backup job';
COMMENT ON COLUMN iks.backups.db_engine IS 'Engine: PostgreSQL, MariaDB, MongoDB, Oracle';
COMMENT ON COLUMN iks.backups.connection_string IS 'Connection string to the source database (may be masked in UI)';
COMMENT ON COLUMN iks.backups.database_name IS 'Name of the database/schema being backed up';
COMMENT ON COLUMN iks.backups.backup_type IS 'full, structure, data, or config';
COMMENT ON COLUMN iks.backups.file_path IS 'Path where the backup file is or will be stored';
COMMENT ON COLUMN iks.backups.file_size IS 'Size of the backup file in bytes (after completion)';
COMMENT ON COLUMN iks.backups.status IS 'pending, in_progress, completed, failed';
COMMENT ON COLUMN iks.backups.error_message IS 'Last error message if status is failed';
COMMENT ON COLUMN iks.backups.created_at IS 'When the backup job was created';
COMMENT ON COLUMN iks.backups.created_by IS 'User or system that created the job';
COMMENT ON COLUMN iks.backups.completed_at IS 'When the last run completed';
COMMENT ON COLUMN iks.backups.metadata IS 'Extra JSON metadata for the job';
COMMENT ON COLUMN iks.backups.cron_schedule IS 'Cron expression (e.g. 0 2 * * * for daily at 02:00)';
COMMENT ON COLUMN iks.backups.is_scheduled IS 'Whether the scheduler should run this job';
COMMENT ON COLUMN iks.backups.next_run_at IS 'Next scheduled run time';
COMMENT ON COLUMN iks.backups.last_run_at IS 'Last time the job was run';
COMMENT ON COLUMN iks.backups.run_count IS 'Total number of runs for this job';

CREATE INDEX IF NOT EXISTS idx_backups_db_engine ON iks.backups (db_engine);
CREATE INDEX IF NOT EXISTS idx_backups_status ON iks.backups (status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON iks.backups (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_cron_schedule ON iks.backups (cron_schedule) WHERE cron_schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backups_next_run_at ON iks.backups (next_run_at) WHERE next_run_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- iks.backup_history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS iks.backup_history (
    id               SERIAL PRIMARY KEY,
    backup_id        INTEGER NOT NULL REFERENCES iks.backups(backup_id) ON DELETE CASCADE,
    backup_name      VARCHAR(255) NOT NULL,
    status           VARCHAR(20) NOT NULL
        CONSTRAINT chk_backup_history_status
        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    started_at       TIMESTAMP DEFAULT NOW(),
    completed_at     TIMESTAMP,
    duration_seconds INTEGER,
    file_path        TEXT,
    file_size        BIGINT,
    error_message    TEXT,
    triggered_by     VARCHAR(50) DEFAULT 'scheduled'
);

COMMENT ON TABLE iks.backup_history IS 'History of scheduled backup executions';
COMMENT ON COLUMN iks.backup_history.id IS 'Primary key';
COMMENT ON COLUMN iks.backup_history.backup_id IS 'FK to iks.backups';
COMMENT ON COLUMN iks.backup_history.backup_name IS 'Snapshot of backup name at run time';
COMMENT ON COLUMN iks.backup_history.status IS 'pending, in_progress, completed, failed';
COMMENT ON COLUMN iks.backup_history.started_at IS 'When this run started';
COMMENT ON COLUMN iks.backup_history.completed_at IS 'When this run finished';
COMMENT ON COLUMN iks.backup_history.duration_seconds IS 'Duration of this run in seconds';
COMMENT ON COLUMN iks.backup_history.file_path IS 'Path to the backup file produced by this run';
COMMENT ON COLUMN iks.backup_history.file_size IS 'Size of the backup file in bytes';
COMMENT ON COLUMN iks.backup_history.error_message IS 'Error message if this run failed';
COMMENT ON COLUMN iks.backup_history.triggered_by IS 'manual or scheduled';

CREATE INDEX IF NOT EXISTS idx_backup_history_backup_id ON iks.backup_history (backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON iks.backup_history (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON iks.backup_history (status);
