import React, { useState } from "react";
import { asciiColors, ascii } from "../../theme/asciiTheme";

type Props = {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  style?: React.CSSProperties;
};

export const AsciiButton: React.FC<Props> = ({
  label,
  onClick,
  variant = "primary",
  disabled = false,
  style: styleProp,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isPrimary = variant === "primary";
  const textColor = isPrimary ? "#ffffff" : asciiColors.foreground;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          border: `1px solid ${isPrimary ? asciiColors.accent : asciiColors.border}`,
          backgroundColor: isPrimary ? asciiColors.accent : asciiColors.background,
          color: textColor,
          padding: "4px 12px",
          fontSize: 12,
          fontFamily: "Consolas",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 500,
          borderRadius: 2,
          opacity: disabled ? 0.5 : 1,
          transition: "all 0.2s ease",
          transform: isHovered && !disabled ? "translateY(-1px)" : "translateY(0)",
          boxShadow:
            isHovered && !disabled
              ? `0 2px 8px ${isPrimary ? "rgba(30, 64, 175, 0.3)" : "rgba(0, 0, 0, 0.1)"}`
              : "none",
          position: "relative",
          overflow: "hidden",
          minWidth: "fit-content",
          ...styleProp,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {isHovered && !disabled && (
            <span
              style={{
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)",
                animation: "shimmer 0.6s ease-in-out",
                zIndex: 0,
              }}
            />
          )}
        </span>
        <span
          style={{
            transition: "transform 0.2s ease",
            transform: isHovered && !disabled ? "scale(1.1)" : "scale(1)",
            display: "inline-block",
            lineHeight: "1.2",
            position: "relative",
            zIndex: 2,
            flexShrink: 0,
            marginRight: "4px",
            color: textColor,
          }}
        >
          {ascii.thickV}
        </span>
        <span
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            lineHeight: "1.2",
            position: "relative",
            zIndex: 2,
            flexShrink: 0,
            color: textColor,
          }}
        >
          {label}
        </span>
      </button>
      <style>{`
        @keyframes shimmer {
          to { left: 100%; }
        }
      `}</style>
    </>
  );
};
