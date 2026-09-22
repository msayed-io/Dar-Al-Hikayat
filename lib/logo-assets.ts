import type { ThemeMode } from "../contexts/AppContext";

export function logoAsset(theme: ThemeMode): string {
  return `/dar-al-hikayat-logo-${theme}.png`;
}
