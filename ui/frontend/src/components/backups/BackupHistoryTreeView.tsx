import React, { useState } from "react";
import { asciiColors, ascii } from "../../theme/asciiTheme";
import { theme } from "../../theme/theme";

interface BackupHistoryEntry {
  id: number;
  started_at: string;
  status: string;
  duration_seconds?: number;
  file_size?: number;
  triggered_by?: string;
  error_message?: string;
}

interface BackupHistoryTreeViewProps {
  history: BackupHistoryEntry[];
  backupName?: string;
  backupId?: number;
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

export const BackupHistoryTreeView: React.FC<BackupHistoryTreeViewProps> = ({
  history,
  backupName,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (history.length === 0) {
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
        No backup history available
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "Consolas",
        fontSize: 12,
        color: asciiColors.foreground,
      }}
    >
      {backupName && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 8px",
            cursor: "pointer",
            borderLeft: `2px solid ${asciiColors.accent}`,
            backgroundColor: expanded
              ? asciiColors.backgroundSoft
              : asciiColors.background,
            transition: "all 0.15s ease",
            marginBottom: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = asciiColors.backgroundSoft;
          }}
          onMouseLeave={(e) => {
            if (!expanded) {
              e.currentTarget.style.backgroundColor = asciiColors.background;
            }
          }}
        >
          <span
            style={{
              marginRight: 8,
              color: expanded ? asciiColors.accent : asciiColors.muted,
              fontSize: 10,
              transition: "transform 0.15s ease",
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            {ascii.arrowRight}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: asciiColors.accent,
              fontSize: 12,
              flex: 1,
            }}
          >
            {backupName}
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 2,
              fontSize: 10,
              fontWeight: 500,
              border: `1px solid ${asciiColors.border}`,
              backgroundColor: asciiColors.backgroundSoft,
              color: asciiColors.foreground,
            }}
          >
            {history.length}
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ paddingLeft: backupName ? 24 : 0 }}>
          {history.map((entry, entryIdx) => {
            const isEntryLast = entryIdx === history.length - 1;
            return (
              <div
                key={entry.id || entryIdx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "8px 8px",
                  marginLeft: backupName ? 8 : 0,
                  marginBottom: 2,
                  borderLeft: `1px solid ${asciiColors.border}`,
                  backgroundColor: "transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    asciiColors.backgroundSoft;
                  e.currentTarget.style.borderLeftColor = asciiColors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderLeftColor = asciiColors.border;
                }}
              >
                {backupName && (
                  <span
                    style={{
                      color: asciiColors.border,
                      marginRight: 6,
                      fontFamily: "Consolas",
                      fontSize: 11,
                    }}
                  >
                    {isEntryLast
                      ? `${ascii.bl}${ascii.h}${ascii.h} `
                      : `${ascii.tRight}${ascii.h}${ascii.h} `}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                        color: asciiColors.foreground,
                        fontSize: 11,
                      }}
                    >
                      {new Date(entry.started_at).toLocaleString()}
                    </span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontSize: 10,
                        fontWeight: 500,
                        border: `1px solid ${getStatusColor(entry.status)}`,
                        color: getStatusColor(entry.status),
                        backgroundColor: "transparent",
                      }}
                    >
                      {entry.status.toUpperCase()}
                    </span>
                    {entry.duration_seconds != null && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 500,
                          border: `1px solid ${asciiColors.border}`,
                          color: asciiColors.muted,
                          backgroundColor: "transparent",
                        }}
                      >
                        {entry.duration_seconds}s
                      </span>
                    )}
                    {entry.file_size != null && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 500,
                          border: `1px solid ${asciiColors.border}`,
                          color: asciiColors.muted,
                          backgroundColor: "transparent",
                        }}
                      >
                        {formatFileSize(entry.file_size)}
                      </span>
                    )}
                    {entry.triggered_by && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 500,
                          border: `1px solid ${asciiColors.border}`,
                          color: asciiColors.muted,
                          backgroundColor: "transparent",
                        }}
                      >
                        {entry.triggered_by.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {entry.error_message && (
                    <div
                      style={{
                        fontSize: 10,
                        color: asciiColors.foreground,
                        fontFamily: "Consolas",
                        padding: "4px 8px",
                        backgroundColor: asciiColors.backgroundSoft,
                        borderRadius: 2,
                        border: `1px solid ${asciiColors.border}`,
                        marginTop: 4,
                        wordBreak: "break-word",
                      }}
                    >
                      Error: {entry.error_message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BackupHistoryTreeView;
