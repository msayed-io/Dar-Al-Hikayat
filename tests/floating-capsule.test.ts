import { expect, it } from "vitest";
import {
  floatingCapsuleStyle,
  FLOATING_CAPSULE_CLASS,
} from "../lib/floating-capsule";
it("shares the exact existing Home/Prayer capsule surface, including Apple dark overrides", () => {
  const theme = {
    mode: "royal_classic",
    glass: "rgba(244,241,228,0.96)",
    border: "rgba(18,26,27,0.12)",
    shadow: "0 4px 30px rgba(0,0,0,0.4)",
  } as any;
  expect(floatingCapsuleStyle(theme)).toEqual({
    backgroundColor: theme.glass,
    borderColor: theme.border,
    boxShadow: theme.shadow,
  });
  expect(floatingCapsuleStyle({ ...theme, mode: "apple_dark" })).toEqual({
    backgroundColor: "#1C1C1E",
    borderColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.6)",
  });
  expect(FLOATING_CAPSULE_CLASS).toContain("backdrop-blur-xl");
  expect(FLOATING_CAPSULE_CLASS).toContain("border-[0.5px]");
});
