import React from "react";
import { asciiColors } from "../../theme/asciiTheme";

const SkeletonBox: React.FC<{
  width?: string;
  height?: string;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = "20px", style = {} }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: asciiColors.backgroundSoft,
      borderRadius: 2,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: "-100%",
        width: "100%",
        height: "100%",
        background: `linear-gradient(90deg, transparent, ${asciiColors.border}40, transparent)`,
        animation: "shimmer 1.5s infinite",
      }}
    />
  </div>
);

export const SkeletonLoader: React.FC<{
  variant?: "table" | "panel";
}> = ({ variant = "panel" }) => (
  <div
    style={{
      padding: 24,
      fontFamily: "Consolas",
      fontSize: 12,
      maxWidth: 1400,
      margin: "0 auto",
    }}
  >
    <style>{`
      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }
    `}</style>
    {variant === "table" && (
      <>
        <div style={{ marginBottom: 16 }}>
          <SkeletonBox width="200px" height="18px" style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <SkeletonBox width="150px" height="32px" />
            <SkeletonBox width="150px" height="32px" />
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${asciiColors.border}`,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 8,
              padding: 12,
              backgroundColor: asciiColors.backgroundSoft,
              borderBottom: `1px solid ${asciiColors.border}`,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBox key={i} width="100%" height="14px" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 8,
                padding: 12,
                borderBottom:
                  i < 5 ? `1px solid ${asciiColors.border}` : "none",
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <SkeletonBox key={j} width="100%" height="12px" />
              ))}
            </div>
          ))}
        </div>
      </>
    )}
    {variant === "panel" && (
      <div
        style={{
          border: `1px solid ${asciiColors.border}`,
          borderRadius: 2,
          padding: 16,
          backgroundColor: asciiColors.background,
        }}
      >
        <SkeletonBox width="120px" height="14px" style={{ marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <SkeletonBox width="60%" height="12px" />
              <SkeletonBox width="30%" height="16px" />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default SkeletonLoader;
