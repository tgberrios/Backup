import { useState, useEffect, useCallback } from "react";
import { backupsApi, type BackupEntry } from "../../services/api";
import { extractApiError } from "../../utils/errorHandler";
import { AsciiButton } from "../../ui/controls/AsciiButton";
import { asciiColors, ascii } from "../../theme/asciiTheme";
import { ConnectionStringInput } from "../shared/ConnectionStringInput";
import SkeletonLoader from "../shared/SkeletonLoader";
import { Container } from "../shared/Container";
import { theme } from "../../theme/theme";
import BackupManagerListView from "./BackupManagerListView";
import BackupHistoryTreeView from "./BackupHistoryTreeView";

const ENGINES = ["PostgreSQL", "MariaDB", "MongoDB", "Oracle"] as const;

const getConnectionStringExample = (engine: string) => {
  switch (engine) {
    case "PostgreSQL":
      return "postgresql://username:password@localhost:5432/database_name";
    case "MariaDB":
      return "mysql://username:password@localhost:3306/database_name";
    case "MongoDB":
      return "mongodb://username:password@localhost:27017/database_name?authSource=admin";
    case "Oracle":
      return "Host=localhost;Port=1521;User=user;Password=pass;ServiceName=XE";
    default:
      return "";
  }
};

export const BackupManager = () => {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setSelectedBackup] = useState<BackupEntry | null>(null);
  const [filters, setFilters] = useState({ db_engine: "", status: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [backupForm, setBackupForm] = useState<{
    backup_name: string;
    db_engine: string;
    connection_string: string;
    database_name: string;
    selected_databases: string[];
    backup_type: "structure" | "data" | "full" | "config";
    cron_schedule: string;
    is_scheduled: boolean;
  }>({
    backup_name: "",
    db_engine: "PostgreSQL",
    connection_string: getConnectionStringExample("PostgreSQL"),
    database_name: "",
    selected_databases: [],
    backup_type: "full",
    cron_schedule: "",
    is_scheduled: false,
  });
  const [backupHistory, setBackupHistory] = useState<
    { id: number; started_at: string; status: string; duration_seconds?: number; file_size?: number; triggered_by?: string; error_message?: string }[]
  >([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyBackupId, setHistoryBackupId] = useState<number | null>(null);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [connectionTested, setConnectionTested] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (backupForm.db_engine) {
      const example = getConnectionStringExample(backupForm.db_engine);
      const currentValue = backupForm.connection_string;
      const examples: string[] = ENGINES.map((e) => getConnectionStringExample(e));
      const isExample = examples.includes(currentValue);
      if (!currentValue || isExample) {
        setBackupForm((prev) => ({ ...prev, connection_string: example }));
        setConnectionTested(false);
        setAvailableDatabases([]);
      }
    }
  }, [backupForm.db_engine]);

  const fetchBackups = useCallback(async () => {
    const startTime = Date.now();
    const minLoadingTime = 300;
    try {
      setLoading(true);
      setError(null);
      const params: { page: number; limit: number; db_engine?: string; status?: string } = {
        page,
        limit,
      };
      if (filters.db_engine) params.db_engine = filters.db_engine;
      if (filters.status) params.status = filters.status;
      const response = await backupsApi.getAll(params);
      const elapsed = Date.now() - startTime;
      await new Promise((r) => setTimeout(r, Math.max(0, minLoadingTime - elapsed)));
      setBackups(response.backups || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchBackups();
    const interval = setInterval(fetchBackups, 5000);
    return () => clearInterval(interval);
  }, [fetchBackups]);

  const handleTestConnection = useCallback(async () => {
    if (!backupForm.connection_string) {
      setError("Please enter a connection string first");
      return;
    }
    try {
      setError(null);
      setTestingConnection(true);
      const testRes = await backupsApi.testConnection(
        backupForm.db_engine,
        backupForm.connection_string
      );
      if (!(testRes as { success?: boolean }).success) {
        throw new Error((testRes as { message?: string }).message || "Connection failed");
      }
      const dbResponse = await backupsApi.discoverDatabases(
        backupForm.db_engine,
        backupForm.connection_string
      );
      setAvailableDatabases(dbResponse.databases || []);
      setConnectionTested(true);
    } catch (err) {
      setError(extractApiError(err));
      setAvailableDatabases([]);
      setConnectionTested(false);
    } finally {
      setTestingConnection(false);
    }
  }, [backupForm.db_engine, backupForm.connection_string]);

  const handleCreateBackup = useCallback(async () => {
    try {
      setError(null);
      const databasesToBackup =
        backupForm.is_scheduled && backupForm.selected_databases.length > 0
          ? backupForm.selected_databases
          : [backupForm.database_name].filter(Boolean);
      if (databasesToBackup.length === 0) {
        setError("Please select at least one database");
        return;
      }
      for (const dbName of databasesToBackup) {
        const backupName = backupForm.is_scheduled
          ? `${dbName}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`
          : backupForm.backup_name || `${dbName}_backup`;
        await backupsApi.create({
          backup_name: backupName,
          db_engine: backupForm.db_engine,
          connection_string: backupForm.connection_string,
          database_name: dbName,
          backup_type: backupForm.backup_type,
          cron_schedule:
            backupForm.is_scheduled && backupForm.cron_schedule
              ? backupForm.cron_schedule
              : undefined,
        });
      }
      setIsModalOpen(false);
      setBackupForm({
        backup_name: "",
        db_engine: "PostgreSQL",
        connection_string: getConnectionStringExample("PostgreSQL"),
        database_name: "",
        selected_databases: [],
        backup_type: "full",
        cron_schedule: "",
        is_scheduled: false,
      });
      setAvailableDatabases([]);
      setConnectionTested(false);
      fetchBackups();
    } catch (err) {
      setError(extractApiError(err));
    }
  }, [backupForm, fetchBackups]);

  const handleViewHistory = useCallback(async (backupId: number) => {
    try {
      setError(null);
      const response = await backupsApi.getHistory(backupId);
      setBackupHistory(response.history || []);
      setHistoryBackupId(backupId);
      setShowHistory(true);
    } catch (err) {
      setError(extractApiError(err));
    }
  }, []);

  const handleToggleSchedule = useCallback(
    async (backup: BackupEntry) => {
      try {
        setError(null);
        if (backup.is_scheduled) {
          await backupsApi.disableSchedule(backup.backup_id);
        } else {
          await backupsApi.enableSchedule(backup.backup_id);
        }
        fetchBackups();
      } catch (err) {
        setError(extractApiError(err));
      }
    },
    [fetchBackups]
  );

  const handleDeleteBackup = useCallback(
    async (backupId: number) => {
      if (!confirm("Are you sure you want to delete this backup?")) return;
      try {
        setError(null);
        await backupsApi.delete(backupId);
        fetchBackups();
      } catch (err) {
        setError(extractApiError(err));
      }
    },
    [fetchBackups]
  );

  if (loading && backups.length === 0) {
    return <SkeletonLoader variant="table" />;
  }

  const commonSelectStyle = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${asciiColors.border}`,
    borderRadius: 2,
    background: asciiColors.background,
    color: asciiColors.foreground,
    fontFamily: "Consolas",
    fontSize: 12,
    cursor: "pointer" as const,
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  return (
    <Container>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          borderBottom: `2px solid ${asciiColors.accent}`,
        }}
      >
        <h1
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            color: asciiColors.foreground,
            fontFamily: "Consolas",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: asciiColors.accent, marginRight: theme.spacing.sm }}>
            {ascii.blockFull}
          </span>
          IKS BACKUPS
        </h1>
        <AsciiButton
          label="+ CREATE BACKUP"
          onClick={() => setIsModalOpen(true)}
          variant="primary"
        />
      </div>

      {error && (
        <div
          style={{
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            background: asciiColors.backgroundSoft,
            border: `1px solid ${asciiColors.border}`,
            borderRadius: 2,
            color: asciiColors.foreground,
            fontSize: 12,
            fontFamily: "Consolas",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <select
          value={filters.db_engine}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, db_engine: e.target.value }));
            setPage(1);
          }}
          style={{ ...commonSelectStyle, width: 160 }}
        >
          <option value="">All Engines</option>
          {ENGINES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, status: e.target.value }));
            setPage(1);
          }}
          style={{ ...commonSelectStyle, width: 140 }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: asciiColors.muted,
            fontFamily: "Consolas",
            fontSize: 12,
          }}
        >
          Loading backups...
        </div>
      ) : backups.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: asciiColors.muted,
            fontFamily: "Consolas",
            fontSize: 12,
          }}
        >
          No backups found
        </div>
      ) : (
        <>
          <BackupManagerListView
            backups={backups}
            onViewHistory={handleViewHistory}
            onToggleSchedule={handleToggleSchedule}
            onRestore={(backupId) => {
              if (confirm("Restore this backup?")) {
                backupsApi
                  .restore(backupId)
                  .then(() => alert("Restore operation started"))
                  .catch((err) => setError(extractApiError(err)));
              }
            }}
            onDelete={handleDeleteBackup}
            onSelect={setSelectedBackup}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: theme.spacing.md,
              paddingTop: theme.spacing.md,
              borderTop: `1px solid ${asciiColors.border}`,
            }}
          >
            <div
              style={{
                color: asciiColors.muted,
                fontSize: 11,
                fontFamily: "Consolas",
              }}
            >
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}
            </div>
            <div style={{ display: "flex", gap: theme.spacing.sm }}>
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                style={{
                  ...commonSelectStyle,
                  background: page === 1 ? asciiColors.backgroundSoft : asciiColors.background,
                  color: page === 1 ? asciiColors.muted : asciiColors.foreground,
                  cursor: page === 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page * limit >= total}
                style={{
                  ...commonSelectStyle,
                  background:
                    page * limit >= total ? asciiColors.backgroundSoft : asciiColors.background,
                  color: page * limit >= total ? asciiColors.muted : asciiColors.foreground,
                  cursor: page * limit >= total ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showHistory && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 999,
            }}
            onClick={() => setShowHistory(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: asciiColors.background,
              padding: theme.spacing.lg,
              borderRadius: 2,
              border: `2px solid ${asciiColors.accent}`,
              zIndex: 1000,
              minWidth: 400,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
              fontFamily: "Consolas",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
                borderBottom: `2px solid ${asciiColors.border}`,
              }}
            >
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: asciiColors.accent,
                  margin: 0,
                  fontFamily: "Consolas",
                  textTransform: "uppercase",
                }}
              >
                {ascii.blockFull} BACKUP HISTORY
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: asciiColors.foreground,
                  fontSize: 20,
                  cursor: "pointer",
                  padding: `0 ${theme.spacing.sm}`,
                  fontFamily: "Consolas",
                }}
              >
                ×
              </button>
            </div>
            <BackupHistoryTreeView
              history={backupHistory}
              backupName={
                historyBackupId
                  ? backups.find((b) => b.backup_id === historyBackupId)?.backup_name
                  : undefined
              }
              backupId={historyBackupId ?? undefined}
            />
          </div>
        </>
      )}

      {isModalOpen && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 999,
            }}
            onClick={() => setIsModalOpen(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: asciiColors.background,
              padding: theme.spacing.lg,
              borderRadius: 2,
              border: `2px solid ${asciiColors.accent}`,
              zIndex: 1000,
              minWidth: 500,
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflowY: "auto",
              fontFamily: "Consolas",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: theme.spacing.md,
                paddingBottom: theme.spacing.sm,
                borderBottom: `2px solid ${asciiColors.border}`,
              }}
            >
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: asciiColors.accent,
                  margin: 0,
                  fontFamily: "Consolas",
                  textTransform: "uppercase",
                }}
              >
                {ascii.blockFull} CREATE BACKUP
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setBackupForm({
                    backup_name: "",
                    db_engine: "PostgreSQL",
                    connection_string: getConnectionStringExample("PostgreSQL"),
                    database_name: "",
                    selected_databases: [],
                    backup_type: "full",
                    cron_schedule: "",
                    is_scheduled: false,
                  });
                  setAvailableDatabases([]);
                  setConnectionTested(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: asciiColors.foreground,
                  fontSize: 20,
                  cursor: "pointer",
                  padding: `0 ${theme.spacing.sm}`,
                  fontFamily: "Consolas",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
              {!backupForm.is_scheduled && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: asciiColors.foreground,
                      marginBottom: theme.spacing.xs,
                      fontFamily: "Consolas",
                      textTransform: "uppercase",
                    }}
                  >
                    {ascii.v} BACKUP NAME *
                  </label>
                  <input
                    type="text"
                    value={backupForm.backup_name}
                    onChange={(e) =>
                      setBackupForm((prev) => ({ ...prev, backup_name: e.target.value }))
                    }
                    placeholder="my_backup_2024"
                    style={{
                      width: "100%",
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      border: `1px solid ${asciiColors.border}`,
                      borderRadius: 2,
                      fontSize: 12,
                      fontFamily: "Consolas",
                      backgroundColor: asciiColors.background,
                      color: asciiColors.foreground,
                      outline: "none",
                    }}
                  />
                </div>
              )}

              {backupForm.is_scheduled && (
                <div
                  style={{
                    padding: theme.spacing.sm,
                    background: asciiColors.backgroundSoft,
                    border: `1px solid ${asciiColors.accent}`,
                    borderRadius: 2,
                    fontSize: 11,
                    color: asciiColors.muted,
                    fontFamily: "Consolas",
                  }}
                >
                  {ascii.blockSemi} Backup name will be auto-generated as:
                  database_name_YYYY-MM-DDTHH-MM-SS
                </div>
              )}

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: asciiColors.foreground,
                    marginBottom: theme.spacing.xs,
                    fontFamily: "Consolas",
                    textTransform: "uppercase",
                  }}
                >
                  {ascii.v} DB ENGINE *
                </label>
                <select
                  value={backupForm.db_engine}
                  onChange={(e) =>
                    setBackupForm((prev) => ({ ...prev, db_engine: e.target.value }))
                  }
                  style={{ ...commonSelectStyle, width: "100%" }}
                >
                  {ENGINES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <ConnectionStringInput
                label="Connection String"
                value={backupForm.connection_string}
                onChange={(val) => {
                  setBackupForm((prev) => ({ ...prev, connection_string: val }));
                  setConnectionTested(false);
                  setAvailableDatabases([]);
                }}
                onTestConnection={handleTestConnection}
                isTesting={testingConnection}
                testResult={
                  connectionTested
                    ? {
                        success: true,
                        message: `Connection successful! Found ${availableDatabases.length} database(s)`,
                      }
                    : null
                }
                required
              />
              {connectionTested && availableDatabases.length > 0 && (
                <div
                  style={{
                    marginTop: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    background: asciiColors.accent + "20",
                    border: `1px solid ${asciiColors.accent}`,
                    borderRadius: 2,
                    fontSize: 11,
                    color: asciiColors.accent,
                    fontFamily: "Consolas",
                  }}
                >
                  {ascii.blockSemi} Found {availableDatabases.length} database(s)
                </div>
              )}

              {connectionTested &&
              backupForm.is_scheduled &&
              availableDatabases.length > 0 ? (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: asciiColors.foreground,
                      marginBottom: theme.spacing.xs,
                      fontFamily: "Consolas",
                      textTransform: "uppercase",
                    }}
                  >
                    {ascii.v} SELECT DATABASES TO BACKUP *
                  </label>
                  <div
                    style={{
                      maxHeight: 200,
                      overflowY: "auto",
                      border: `1px solid ${asciiColors.border}`,
                      borderRadius: 2,
                      padding: theme.spacing.sm,
                      background: asciiColors.background,
                    }}
                  >
                    {availableDatabases.map((db) => (
                      <div
                        key={db}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: theme.spacing.sm,
                          padding: `${theme.spacing.xs} 0`,
                          fontFamily: "Consolas",
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={backupForm.selected_databases.includes(db)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBackupForm((prev) => ({
                                ...prev,
                                selected_databases: [...prev.selected_databases, db],
                              }));
                            } else {
                              setBackupForm((prev) => ({
                                ...prev,
                                selected_databases: prev.selected_databases.filter((d) => d !== db),
                              }));
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{ color: asciiColors.foreground }}>{db}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !backupForm.is_scheduled ? (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: asciiColors.foreground,
                      marginBottom: theme.spacing.xs,
                      fontFamily: "Consolas",
                      textTransform: "uppercase",
                    }}
                  >
                    {ascii.v} DATABASE NAME *
                  </label>
                  {connectionTested && availableDatabases.length > 0 ? (
                    <select
                      value={backupForm.database_name}
                      onChange={(e) =>
                        setBackupForm((prev) => ({ ...prev, database_name: e.target.value }))
                      }
                      style={{ ...commonSelectStyle, width: "100%" }}
                    >
                      <option value="">Select a database</option>
                      {availableDatabases.map((db) => (
                        <option key={db} value={db}>
                          {db}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={backupForm.database_name}
                      onChange={(e) =>
                        setBackupForm((prev) => ({ ...prev, database_name: e.target.value }))
                      }
                      placeholder="mydatabase"
                      style={{
                        width: "100%",
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        border: `1px solid ${asciiColors.border}`,
                        borderRadius: 2,
                        fontSize: 12,
                        fontFamily: "Consolas",
                        backgroundColor: asciiColors.background,
                        color: asciiColors.foreground,
                        outline: "none",
                      }}
                    />
                  )}
                </div>
              ) : null}

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: asciiColors.foreground,
                    marginBottom: theme.spacing.xs,
                    fontFamily: "Consolas",
                    textTransform: "uppercase",
                  }}
                >
                  {ascii.v} BACKUP TYPE *
                </label>
                <select
                  value={backupForm.backup_type}
                  onChange={(e) =>
                    setBackupForm((prev) => ({
                      ...prev,
                      backup_type: e.target.value as "structure" | "data" | "full" | "config",
                    }))
                  }
                  style={{ ...commonSelectStyle, width: "100%" }}
                >
                  <option value="full">Full (Structure + Data)</option>
                  <option value="structure">Structure Only</option>
                  <option value="data">Data Only</option>
                  <option value="config">Config Only</option>
                </select>
              </div>

              <div
                style={{
                  padding: theme.spacing.sm,
                  background: asciiColors.backgroundSoft,
                  border: `1px solid ${asciiColors.border}`,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={backupForm.is_scheduled}
                    onChange={(e) =>
                      setBackupForm((prev) => ({ ...prev, is_scheduled: e.target.checked }))
                    }
                    style={{ cursor: "pointer" }}
                  />
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: asciiColors.foreground,
                      fontFamily: "Consolas",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {ascii.v} ENABLE SCHEDULED BACKUP
                  </label>
                </div>
                {backupForm.is_scheduled && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 600,
                        color: asciiColors.muted,
                        marginBottom: theme.spacing.xs,
                        fontFamily: "Consolas",
                      }}
                    >
                      CRON SCHEDULE (minute hour day month dow)
                    </label>
                    <input
                      type="text"
                      value={backupForm.cron_schedule}
                      onChange={(e) =>
                        setBackupForm((prev) => ({ ...prev, cron_schedule: e.target.value }))
                      }
                      placeholder="0 2 * * *"
                      style={{
                        width: "100%",
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        border: `1px solid ${asciiColors.border}`,
                        borderRadius: 2,
                        fontSize: 12,
                        fontFamily: "Consolas",
                        backgroundColor: asciiColors.background,
                        color: asciiColors.foreground,
                        outline: "none",
                      }}
                    />
                    <div
                      style={{
                        marginTop: theme.spacing.sm,
                        fontSize: 10,
                        color: asciiColors.muted,
                        fontFamily: "Consolas",
                        fontStyle: "italic",
                      }}
                    >
                      Examples: "0 2 * * *" (daily 2 AM), "0 */6 * * *" (every 6h), "0 0 * * 0"
                      (weekly Sunday)
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: `1px solid ${asciiColors.border}`,
                }}
              >
                <AsciiButton
                  label="Cancel"
                  onClick={() => {
                    setIsModalOpen(false);
                    setConnectionTested(false);
                    setAvailableDatabases([]);
                  }}
                  variant="ghost"
                />
                <AsciiButton label="Create Backup" onClick={handleCreateBackup} variant="primary" />
              </div>
            </div>
          </div>
        </>
      )}
    </Container>
  );
};

export default BackupManager;
