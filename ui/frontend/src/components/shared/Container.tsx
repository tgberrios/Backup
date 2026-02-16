import React from "react";
import { theme } from "../../theme/theme";

export const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: theme.spacing.lg,
      fontFamily: theme.fonts.primary,
      backgroundColor: "#ffffff",
      color: "#333",
      minHeight: "100vh",
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);
