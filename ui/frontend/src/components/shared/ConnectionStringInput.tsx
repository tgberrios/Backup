import React from "react";
import { asciiColors, ascii } from "../../theme/asciiTheme";
import { theme } from "../../theme/theme";

interface ConnectionStringInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onTestConnection: () => void;
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
  required?: boolean;
}

const inputStyle = {
  width: "100%" as const,
  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
  border: `1px solid ${asciiColors.border}`,
  borderRadius: 2,
  fontSize: 12,
  fontFamily: "Consolas",
  backgroundColor: asciiColors.background,
  color: asciiColors.foreground,
  outline: "none",
  transition: "border-color 0.15s ease",
};

export const ConnectionStringInput: React.FC<ConnectionStringInputProps> = ({
  label,
  value,
  onChange,
  onTestConnection,
  isTesting,
  testResult,
  required,
}) => (
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
      {ascii.v} {label} {required ? "*" : ""}
    </label>
    <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="postgresql://user:pass@host:5432/db"
        style={inputStyle}
        onFocus={(e) => {
          e.target.style.borderColor = asciiColors.accent;
          e.target.style.outline = `2px solid ${asciiColors.accent}`;
          (e.target.style as React.CSSProperties).outlineOffset = "2px";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = asciiColors.border;
          e.target.style.outline = "none";
        }}
      />
      <button
        type="button"
        onClick={onTestConnection}
        disabled={isTesting || !value.trim()}
        style={{
          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
          border: `1px solid ${asciiColors.accent}`,
          borderRadius: 2,
          background: asciiColors.accent,
          color: "#fff",
          fontFamily: "Consolas",
          fontSize: 12,
          cursor: isTesting || !value.trim() ? "not-allowed" : "pointer",
          opacity: isTesting || !value.trim() ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {isTesting ? "Testing…" : "Test"}
      </button>
    </div>
    {testResult && (
      <div
        style={{
          marginTop: theme.spacing.sm,
          padding: theme.spacing.sm,
          background: testResult.success
            ? `${asciiColors.success}20`
            : `${asciiColors.danger}20`,
          border: `1px solid ${testResult.success ? asciiColors.success : asciiColors.danger}`,
          borderRadius: 2,
          fontSize: 11,
          color: testResult.success ? asciiColors.success : asciiColors.danger,
          fontFamily: "Consolas",
        }}
      >
        {testResult.message}
      </div>
    )}
  </div>
);
