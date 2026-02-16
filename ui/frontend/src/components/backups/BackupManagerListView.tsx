import React from "react";
import { AsciiButton } from "../../ui/controls/AsciiButton";
import { asciiColors } from "../../theme/asciiTheme";
import { theme } from "../../theme/theme";
import type { BackupEntry } from "../../services/api";

interface BackupManagerListViewProps {
  backups: BackupEntry[];
  onViewHistory?: (backupId: number) => void;
  onToggleSchedule?: (backup: BackupEntry) => void;
  onRestore?: (backupId: number) => void;
  onDelete?: (backupId: number) => void;
  onSelect?: (backup: BackupEntry) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return asciiColors.accent;
    case "failed":
      return asciiColors.foreground;
    case "in_progress":
    case "pending":
      return asciiColors.muted;
    default:
      return asciiColors.foreground;
  }
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const BackupManagerListView: React.FC<BackupManagerListViewProps> = ({
  backups,
  onViewHistory,
  onToggleSchedule,
  onRestore,
  onDelete,
  onSelect,
}) => {
  if (backups.length === 0) {
    return (
      <div
        style={{
          padding: theme.spacing.lg,
          textAlign: "center",
          color: asciiColors.muted,
          fontFamily: "Consolas",
          fontSize: 12,
        }}
      >
        No backups found
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "Consolas",
        fontSize: 12,
        color: asciiColors.foreground,
        border: `1px solid ${asciiColors.border}`,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 100px 70px 80px 70px 130px 1fr",
          gap: theme.spacing.sm,
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          background: asciiColors.backgroundSoft,
          borderBottom: `1px solid ${asciiColors.border}`,
          fontWeight: 600,
          fontSize: 11,
          textTransform: "uppercase",
          color: asciiColors.muted,
        }}
      >
        <span>Name</span>
        <span>Engine</span>
        <span>Database</span>
        <span>Type</span>
        <span>Status</span>
        <span>Size</span>
        <span>Created</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>

      {backups.map((backup) => (
        <div
          key={backup.backup_id}
          onClick={() => onSelect?.(backup)}
          role="row"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect?.(backup);
            }
          }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 100px 70px 80px 70px 130px 1fr",
            gap: theme.spacing.sm,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            alignItems: "center",
            borderBottom: `1px solid ${asciiColors.border}`,
            cursor: "pointer",
            transition: "background 0.15s ease",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = asciiColors.backgroundSoft;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <span
            style={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {backup.backup_name}
          </span>
          <span style={{ color: asciiColors.muted, fontSize: 11 }}>
            {backup.db_engine || "—"}
          </span>
          <span style={{ color: asciiColors.foreground, fontSize: 11 }}>
            {backup.database_name || "—"}
          </span>
          <span style={{ color: asciiColors.muted, fontSize: 11 }}>
            {backup.backup_type.toUpperCase()}
          </span>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 2,
              fontSize: 10,
              fontWeight: 500,
              border: `1px solid ${getStatusColor(backup.status)}`,
              color: getStatusColor(backup.status),
              backgroundColor: "transparent",
              width: "fit-content",
            }}
          >
            {backup.status.toUpperCase()}
          </span>
          <span style={{ color: asciiColors.muted, fontSize: 11 }}>
            {formatFileSize(backup.file_size)}
          </span>
          <span style={{ color: asciiColors.muted, fontSize: 11 }}>
            {backup.created_at
              ? new Date(backup.created_at).toLocaleString()
              : "—"}
          </span>
          <div
            style={{
              display: "flex",
              gap: 4,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AsciiButton
              label="History"
              onClick={() => onViewHistory?.(backup.backup_id)}
              variant="ghost"
              style={{ fontSize: 10, padding: "2px 6px" }}
            />
            {backup.cron_schedule && (
              <AsciiButton
                label={backup.is_scheduled ? "Disable" : "Enable"}
                onClick={() => onToggleSchedule?.(backup)}
                variant="ghost"
                style={{ fontSize: 10, padding: "2px 6px" }}
              />
            )}
            {backup.status === "completed" && (
              <AsciiButton
                label="Restore"
                onClick={() => onRestore?.(backup.backup_id)}
                variant="ghost"
                style={{ fontSize: 10, padding: "2px 6px" }}
              />
            )}
            <AsciiButton
              label="Delete"
              onClick={() => onDelete?.(backup.backup_id)}
              variant="ghost"
              style={{ fontSize: 10, padding: "2px 6px" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BackupManagerListView;
