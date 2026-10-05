import type { CSSProperties } from "react";
import type { ThemeColors } from "../contexts/AppContext";

/** The existing Home / Prayer floating capsule surface, shared without redesign. */
export const FLOATING_CAPSULE_CLASS =
  "border-[0.5px] flex items-center justify-center backdrop-blur-xl transition-all duration-300";
export function floatingCapsuleStyle(
  theme: Pick<ThemeColors, "mode" | "glass" | "border" | "shadow">,
): CSSProperties {
  return {
    backgroundColor: theme.mode === "apple_dark" ? "#1C1C1E" : theme.glass,
    borderColor:
      theme.mode === "apple_dark" ? "rgba(255, 255, 255, 0.08)" : theme.border,
    boxShadow:
      theme.mode === "apple_dark"
        ? "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)"
        : theme.shadow,
  };
}
